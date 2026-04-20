import {defineArrayMember, defineField, defineType} from 'sanity'

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
      name: 'offer',
      title: 'Offer',
      type: 'object',
      description: 'Optional fixed discount applied to base product and variants.',
      fields: [
        defineField({
          name: 'fixedDiscount',
          title: 'Fixed Discount (USD)',
          type: 'number',
          validation: (rule) => rule.min(0).precision(2),
          description: 'Amount to subtract from the current price. Example: 2.50',
        }),
        defineField({
          name: 'label',
          title: 'Offer Label',
          type: 'string',
          initialValue: 'Oferta',
          description: 'Short badge text shown in the storefront.',
        }),
      ],
      validation: (rule) =>
        rule.custom((value) => {
          if (!value || typeof value !== 'object') {
            return true
          }

          const fixedDiscount = (value as {fixedDiscount?: number}).fixedDiscount

          if (fixedDiscount === undefined || fixedDiscount === null) {
            return true
          }

          if (typeof fixedDiscount !== 'number' || Number.isNaN(fixedDiscount)) {
            return 'Fixed discount must be a valid number.'
          }

          if (fixedDiscount < 0) {
            return 'Fixed discount must be 0 or greater.'
          }

          return true
        }),
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'category'}],
          options: {
            disableNew: false,
          },
        }),
      ],
      description:
        'Assign one or more categories. You can also create a new category directly from this selector.',
      validation: (rule) => rule.required().min(1).error('Select at least one category.'),
    }),
    defineField({
      name: 'category',
      title: 'Legacy Category (fallback)',
      type: 'string',
      hidden: true,
      readOnly: true,
      description:
        'Legacy field kept for backwards compatibility. Prefer using the Categories field above.',
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
    }),
    defineField({
      name: 'images',
      title: 'Gallery Images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
        }),
      ],
      description: 'Optional extra product images used in product gallery.',
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
      isActive: 'isActive',
      variantCount: 'variants',
    },
    prepare: ({title, media, isActive, variantCount}) => ({
      title,
      media,
      subtitle: `${isActive === false ? 'Inactive' : 'Active'}${Array.isArray(variantCount) && variantCount.length > 0 ? ` - ${variantCount.length} variants` : ''}`,
    }),
  },
})
