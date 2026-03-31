import {defineField, defineType} from 'sanity'

export const productType = defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Product Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'price',
      title: 'Price (USD)',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Ortodoncia', value: 'Ortodoncia'},
          {title: 'Material Gastable', value: 'Material Gastable'},
          {title: 'Equipos', value: 'Equipos'},
        ],
      },
    }),
    defineField({
      name: 'image',
      title: 'Product Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'stock',
      title: 'Stock',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
  ],
})
