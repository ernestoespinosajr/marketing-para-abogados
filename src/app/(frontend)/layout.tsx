import React from 'react'
import './styles.css'

export const metadata = {
  description: 'A Payload CMS starter for the GRN Commerce platform.',
  title: 'GRN Commerce — Payload Starter',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
