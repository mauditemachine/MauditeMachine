import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
    }),
    defineField({
      name: 'url',
      title: 'URL (Facebook event, etc.)',
      type: 'url',
    }),
    defineField({
      name: 'color',
      title: 'Accent color',
      type: 'string',
      description: 'Hex color (e.g. #1aff88)',
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'past',
      title: 'Past event',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'date', media: 'image'},
  },
  orderings: [
    {
      title: 'Date (newest first)',
      name: 'dateDesc',
      by: [{field: 'date', direction: 'desc'}],
    },
  ],
})
