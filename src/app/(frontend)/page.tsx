import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <div className="home">
      <div className="content">
        {!user || !('email' in user) ? (
          <h1>Welcome to your new Payload site.</h1>
        ) : (
          <h1>Welcome back, {user.email}</h1>
        )}
        <p>
          This is the GRN Commerce Payload starter — a headless CMS running on Node with SQLite
          on your site&apos;s persistent storage. No external database to provision.
        </p>
        <div className="links">
          <a
            className="admin"
            href={payloadConfig.routes.admin}
            rel="noopener noreferrer"
            target="_blank"
          >
            Go to admin panel
          </a>
          <a
            className="docs"
            href="https://payloadcms.com/docs"
            rel="noopener noreferrer"
            target="_blank"
          >
            Payload documentation
          </a>
        </div>
      </div>
      <div className="footer">
        <p>Edit collections under src/collections, then git push.</p>
      </div>
    </div>
  )
}
