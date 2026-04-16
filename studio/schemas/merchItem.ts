import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'merchItem',
  title: 'Merch Item',
  type: 'document',
  fields: [
    defineField({
      name: 'caption',
      title: 'Name',
      type: 'string',
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'string',
      description: 'e.g. "50$ CAD"',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Sweatshirt', value: 'sweatshirt'},
          {title: 'Hoodie', value: 'hoodie'},
          {title: 'T-shirt', value: 'tshirt'},
          {title: 'Bag', value: 'bag'},
          {title: 'Sticker', value: 'sticker'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'active',
      title: 'Active (visible on site)',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'soldOut',
      title: 'Sold out',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'sizes',
      title: 'Sizes available',
      type: 'object',
      fields: [
        {name: 'S', title: 'S', type: 'boolean'},
        {name: 'M', title: 'M', type: 'boolean'},
        {name: 'L', title: 'L', type: 'boolean'},
        {name: 'XL', title: 'XL', type: 'boolean'},
      ],
    }),
  ],
  preview: {
    select: {title: 'caption', subtitle: 'category', media: 'image'},
  },
})
