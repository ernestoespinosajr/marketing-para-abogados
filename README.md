# GRN Commerce — Payload CMS starter

Payload CMS 3 on Node 22, backed by SQLite on this platform's persistent
per-site storage. The platform provisioned this repo for you: it created
a private repo on your own GitHub account, pushed this starter's content
into it as your first commit, and deployed from there — you own the repo
outright from the first commit.

## Why SQLite, and why that's not a downgrade here

Most platforms need an external managed database for anything stat.
This platform runs each site on a persistent disk that survives deploys,
so SQLite on that disk is not a compromise, it's the whole point: no
database to provision, no connection string to manage, no separate
service to pay for.

## Three platform-specific traps this starter has already worked around

These were each found by reproducing a real failure, not by reading docs.

### 1. `output: 'standalone'` is required, and it breaks the "just use a relative path" convention

The platform's launcher `cd`s into the release directory before starting
the app, which is exactly what lets a plain cwd-relative path resolve
through the platform's `data` symlink for most frameworks. **Next.js's
own generated `standalone/server.js` breaks that**: it does

```js
const __dirname = fileURLToPath(new URL('.', import.meta.url))
process.chdir(__dirname)
```

unconditionally, before serving a single request — and `__dirname` there
is `<release>/standalone`, one level *below* where the platform's `data`
symlink actually lives. A literal `file:data/db/payload.db` would resolve
to `<release>/standalone/data/db/payload.db`, which doesn't exist and
isn't the symlink.

**Fix, in `src/lib/platform-data-dir.ts`**: resolve every persistent-storage
path through the absolute, chdir-immune `$GRN_DATA_DIR` env var instead of
a bare relative path.

### 2. `@payloadcms/db-sqlite` skips schema push under `NODE_ENV=production`

This is *deliberate* upstream behavior, not a bug — production apps aren't
supposed to auto-push schema changes. But it means the ONLY way a fresh
site gets its schema is `prodMigrations`. This starter ships a committed
initial migration (`src/migrations/`) generated with
`npx payload migrate:create` and passed to the adapter explicitly:

```ts
db: sqliteAdapter({
  client: { url: getDatabaseUrl() },
  prodMigrations: migrations,
})
```

Verified locally: a cold start against a **completely empty** scratch
persistent-storage directory (no `db/`, no prior state) runs the migration
and creates the full schema before serving the first request — not
assumed, reproduced.

### 3. libSQL will not create its own parent directory

A brand-new site's persistent-storage directory is created empty — no
`db/`, no `uploads/`. Payload's own upload handler creates `uploads/` for
you (`fs.mkdir(staticDir, { recursive: true })`), but `@libsql/client`'s
local-file backend does **not** create `db/` — it throws
`SQLITE_CANTOPEN` if the directory doesn't already exist yet.

**Fix, also in `platform-data-dir.ts`**: `getDatabaseUrl()` synchronously
`mkdirSync`s the `db/` subdirectory before returning the file URL.

## After the first deploy: migrations and seeds must assume a non-empty database

This is the flip side of "Why SQLite" above: the same persistence that means
no external database to provision also means every deploy after your first
one runs against a database that already has your previous deploy's schema
and data sitting in it. Code written as though the database starts empty —
a regenerated `_initial` migration, an unguarded seed script — works exactly
once and then fails or duplicates forever after.

**Migrations: once a migration has run for real, only add incremental
ones.** Regenerating `_initial` (or any migration that emits a bare
`CREATE TABLE`) against a database that already has those tables fails at
boot with exactly this:

```
ERROR: SQLITE_ERROR: table `<your_table_name>` already exists
```

The app exits non-zero, systemd restart-loops it, and the platform
correctly refuses to activate the broken release — your previous deploy
keeps serving, so the site doesn't go down, but the new one never comes up
either. Fix: run `npx payload migrate:create` to generate an *incremental*
migration against your current schema, commit it, and deploy that. Never
delete or regenerate an already-applied `_initial` once it has run anywhere
with real data — treat it as a one-time file, not something to touch again.

**Seeds: guard on existing data and run them at boot — there is no other
way to run them here.** This platform gives customers no shell and no
one-off command runner, even with cPanel access; the site's persistent
data directory is reachable only by the app's own process. A runbook step
like "run `npm run seed` once" does not work on this platform — that
command has nowhere to execute. If you need seed data, make the seed
idempotent and call it from somewhere that runs on every boot (an `onInit`
in `payload.config.ts` is the natural place), guarded by a check for
existing rows:

```ts
onInit: async (payload) => {
  const { totalDocs } = await payload.count({ collection: 'posts' })
  if (totalDocs === 0) {
    await payload.create({ collection: 'posts', data: { /* ... */ } })
  }
},
```

Skip the guard and every future deploy re-runs against the same persistent
database your last deploy left behind, duplicating rows instead of seeding
an empty one.

## Evolving the starter's schema into your own product

Everything above assumes you're still building on top of the starter's
collections. Once you start replacing them with your own, you have two
paths.

**Recommended — stay incremental.** Keep the starter's original migration
file in `src/migrations/` forever, even after you've removed every starter
collection (`posts` included). Generate each schema change, including
removing a collection, as a *new* migration: run
`npx payload migrate:create <name>` with your local database fully up to
date (every previous migration applied) so the generated file contains
only the delta, not the schema again. Dropping a collection is a migration
too — same command, it just emits a `DROP TABLE` — never delete the
collection's original `CREATE TABLE` migration to "clean up" instead. This
path never touches an already-applied migration and never needs a database
reset; every deploy just applies the next incremental file on top of what's
already there.

**Advanced — re-baseline your migration history.** If you'd rather squash
your migration history into a single baseline representing your final
schema, the first deploy of that rebaselined app requires a **clean
production database**. Contact support to request a database reset before
that deploy, and deploy promptly once support confirms the reset is done.
A reset erases all production content — users, uploads, every document —
so only take this path while the site has no real content you need to
keep.

**Recognizing which situation you're in:** if a deploy fails to activate
and the log or dashboard shows the same `table ... already exists` error
described above, your migration set doesn't match what's already in the
production database — you're in one of the two situations on this list.
The fix is to regenerate the missing change as an incremental migration
(recommended path) or request a database reset (advanced path). Either
way, never edit or delete a migration that has already run for real.

## Uploads are served by the app, never by nginx directly

`Media.upload.staticDir` points at `$GRN_DATA_DIR/uploads` (via
`getUploadsDir()`), and files are served through Payload's own
request-time route (`GET /api/media/file/:filename`), not a static nginx
location block. Serving uploads directly from nginx would bypass
Payload's own `access.read` check on the `media` collection — harmless for
this starter's fully-public Media collection, but a real bug waiting to
happen the moment a customer locks reads down per-document. Don't add an
nginx alias for this path.

## Local verification performed (2026-08-11, before first push)

All of it simulates the platform's actual launch mechanics
(`cd <release>; node standalone/server.js`) against scratch directories —
never against a real site, never against a paying customer's account.

1. `NODE_ENV=production npm run build` with no database present —
   succeeded. All Payload-touching routes are dynamic (`ƒ`), so nothing
   tried to reach a database during the build itself.
2. Assembled a scratch release directory mirroring the platform's
   node-mode release staging (`.next` contents at the release root, `data`
   symlink at the release root, sibling to `standalone/`), launched
   exactly as the platform's launcher does, against a **completely empty**
   scratch persistent-storage directory. `prodMigrations` ran and created
   the full schema (`users`, `media`, `posts`, `payload_migrations`, ...)
   before the first request completed.
3. Created a user, a `Posts` record, and a real 1×1 PNG upload via
   Payload's Local API (temporary seed script, not committed). Confirmed
   on disk under the scratch persistent-storage directory
   (`db/payload.db`, `uploads/test-pixel.png`) and confirmed **absent**
   from the release tree itself.
4. Killed the process and started a completely fresh one against the same
   scratch persistent-storage directory (simulating a second deploy): the
   post and the upload both survived, no re-migration attempt, and the
   image was served back byte-identical via the app's own
   `/api/media/file/...` route.

## What this starter deliberately does NOT include

- `Folders` / `Tags` collections, localization, and the MCP plugin from
  Payload's current official blank template — dropped to keep the surface
  area small and predictable for a starter. Add them yourself once you're
  building on this for real.
- Any Docker/docker-compose files — this platform deploys via `git push`,
  not containers.
- A pinned `DATABASE_URL` — deliberately unset. Setting it would override
  `getDatabaseUrl()`'s platform-aware resolution; see `.env.example`.

## Environment variables

- `PAYLOAD_SECRET` — **required**. On the platform, generated (or
  supplied) by the provisioning wizard and written before your first
  deploy is enqueued. For local dev, copy `.env.example` to `.env.local`
  and set your own.
- `GRN_DATA_DIR` — set automatically by the platform at deploy time. Leave
  unset locally; the app falls back to `./data` (gitignored).
