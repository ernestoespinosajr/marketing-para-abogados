import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { getDatabaseUrl } from './lib/platform-data-dir'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Posts],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      // NOT a hardcoded 'file:data/db/payload.db' — see
      // src/lib/platform-data-dir.ts for why.
      url: getDatabaseUrl(),
    },
    // WAL is off by default in the adapter; explicit here because SQLite's
    // default rollback-journal mode serializes readers behind writers,
    // which is the wrong tradeoff for a CMS admin UI + public reads.
    wal: true,
    busyTimeout: 5000,
    // `@payloadcms/db-sqlite` SKIPS schema push when NODE_ENV=production —
    // this is the ONLY way the schema gets created on a fresh site.
    // Generated via `npx payload migrate:create`, committed, imported here.
    prodMigrations: migrations,
  }),
  sharp,
})
