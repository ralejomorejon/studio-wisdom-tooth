import {defineField, defineType} from 'sanity'

type ProductAttribute = {
  name?: string
  value?: string
}

type ProductVariant = {
  name?: string
  title?: string
  optionValue?: string
  price?: number
  stock?: number
}

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const toLabel = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : 'Unnamed'

const validateVariants = (variants?: ProductVariant[]): true | string => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return true
  }

  const seenNames = new Set<string>()

  for (const variant of variants) {
    const variantName = normalize(variant?.name || variant?.title || variant?.optionValue)

    if (!variantName) {
      return 'Each variant requires a Variant Name.'
    }

    if (seenNames.has(variantName)) {
      return `Variant "${toLabel(variant?.name || variant?.title || variant?.optionValue)}" is duplicated.`
    }
    seenNames.add(variantName)
  }

  return true
}

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
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
      },
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
      title: 'Base Price (USD)',
      type: 'number',
      description: 'Used for products without variants or as fallback price.',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (typeof value === 'number' && value < 0) {
            return 'Base price must be 0 or greater.'
          }

          const hasVariants =
            Array.isArray((context.document as {variants?: ProductVariant[]})?.variants) &&
            ((context.document as {variants?: ProductVariant[]})?.variants?.length || 0) > 0

          if (!hasVariants && (value === null || value === undefined)) {
            return 'Base price is required when no variants are configured.'
          }

          return true
        }),
    }),
    defineField({
      name: 'stock',
      title: 'Base Stock',
      type: 'number',
      description: 'Used for products without variants or as fallback stock.',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (typeof value === 'number' && value < 0) {
            return 'Base stock must be 0 or greater.'
          }

          const hasVariants =
            Array.isArray((context.document as {variants?: ProductVariant[]})?.variants) &&
            ((context.document as {variants?: ProductVariant[]})?.variants?.length || 0) > 0

          if (!hasVariants && (value === null || value === undefined)) {
            return 'Base stock is required when no variants are configured.'
          }

          return true
        }),
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
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
      description: 'Inactive products are hidden from the storefront.',
    }),
    defineField({
      name: 'image',
      title: 'Main Image',
      type: 'image',
      options: {hotspot: true},
      description: 'Primary image used as default cover and fallback.',
    }),
    defineField({
      name: 'images',
      title: 'Product Gallery',
      type: 'array',
      of: [
        {
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Optional accessible description for this image.',
            }),
          ],
        },
      ],
      description:
        'Optional additional images for product gallery in storefront. First item can be used as fallback cover.',
    }),
    defineField({
      name: 'attributes',
      title: 'Attributes',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Attribute Name',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'value',
              title: 'Attribute Value',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'name',
              subtitle: 'value',
            },
          },
        },
      ],
      validation: (rule) =>
        rule.custom((attributes) => {
          if (!Array.isArray(attributes) || attributes.length === 0) {
            return true
          }
          const seen = new Set<string>()
          for (const attribute of attributes as ProductAttribute[]) {
            const name = normalize(attribute?.name)
            if (!name) {
              return 'Each attribute requires a name.'
            }
            if (seen.has(name)) {
              return `Attribute "${toLabel(attribute?.name)}" is duplicated.`
            }
            seen.add(name)
          }
          return true
        }),
      description: 'General product attributes, for example Material, Use, or Package Size.',
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Variant Name',
              type: 'string',
              description: 'Example: Azul, Negro, 500ml, XL.',
            }),
            defineField({
              name: 'price',
              title: 'Price (USD)',
              type: 'number',
              validation: (rule) => rule.required().min(0),
            }),
            defineField({
              name: 'stock',
              title: 'Stock',
              type: 'number',
              validation: (rule) => rule.required().min(0),
            }),
            defineField({
              name: 'image',
              title: 'Variant Image',
              type: 'image',
              options: {hotspot: true},
            }),
          ],
          preview: {
            select: {
              title: 'name',
              price: 'price',
              stock: 'stock',
            },
            prepare: ({title, price, stock}) => {
              const parts = [
                typeof price === 'number' ? `$${price}` : '',
                typeof stock === 'number' ? `Stock: ${stock}` : '',
              ]
                .filter(Boolean)
                .join(' - ')

              return {
                title: title || 'Variant',
                subtitle: parts,
              }
            },
          },
        },
      ],
      validation: (rule) =>
        rule.custom((variants) => validateVariants(variants as ProductVariant[])),
      description:
        'Single field to define product variants with name, price, stock, and optional image.',
    }),
    defineField({
      name: 'colors',
      title: 'Legacy Colors',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Color Name',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'colorCode',
              title: 'Color Code (Hex)',
              type: 'string',
              validation: (rule) => rule.required(),
              description: 'Example: #FF0000 for red',
            }),
            defineField({
              name: 'colorStock',
              title: 'Stock for this Color',
              type: 'number',
              validation: (rule) => rule.required().min(0),
            }),
          ],
        },
      ],
      description:
        'Legacy color field kept for backward compatibility. New products should use Variants.',
    }),
    defineField({
      name: 'details',
      title: 'Product Details',
      type: 'text',
      description: 'Additional product details and features.',
    }),
    defineField({
      name: 'specifications',
      title: 'Specifications',
      type: 'text',
      description: 'Technical specifications such as dimensions and materials.',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      media: 'image',
      galleryMedia: 'images.0',
      isActive: 'isActive',
      variantCount: 'variants',
    },
    prepare: ({title, media, galleryMedia, isActive, variantCount}) => ({
      title,
      media: media || galleryMedia,
      subtitle: `${isActive === false ? 'Inactive' : 'Active'}${Array.isArray(variantCount) && variantCount.length > 0 ? ` - ${variantCount.length} variants` : ''}`,
    }),
  },
})
