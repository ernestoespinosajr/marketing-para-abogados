import type { CollectionConfig } from 'payload'

// Plain content collection — no upload behaviour. Exists so a content
// record's survival across redeploys can be verified independently of
// the Media collection's upload path.
export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
    },
  ],
}
