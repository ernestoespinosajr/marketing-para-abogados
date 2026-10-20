import type { CollectionConfig } from 'payload'

import { getUploadsDir } from '@/lib/platform-data-dir'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    // Payload's own default (`staticDir || slug`) would put uploads at
    // `media/`, relative to the release directory — read-only on this
    // platform and gone on every deploy. Route through the same
    // persistent-storage resolver the SQLite file uses.
    //
    // Uploads are served by the app's own request-time route
    // (`/api/media/file/:filename`, via Payload's `getFileHandler`), NOT
    // directly by nginx — nginx has no reason to know this path exists.
    // Serving it directly from nginx would bypass Payload's `checkFileAccess`
    // (currently open here via `access.read`, but templates that lock reads
    // down per-document would have that check silently skipped). This is a
    // hard constraint, not a style preference.
    staticDir: getUploadsDir(),
  },
}
