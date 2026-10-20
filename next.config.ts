import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// `output: 'standalone'` is REQUIRED on this platform, not optional. The
// platform's deploy tooling only recognizes `standalone/server.js` as a
// launchable entry — plain Next SSR output has no equivalent the launcher
// can find. This is also what makes
// `$GRN_DATA_DIR` (not a bare relative `data/...` path) load-bearing: Next's
// own generated `standalone/server.js` does `process.chdir(__dirname)` on
// boot, one directory level BELOW the release root where the platform's
// persistent-storage symlink lives. See `src/lib/platform-data-dir.ts`.
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
