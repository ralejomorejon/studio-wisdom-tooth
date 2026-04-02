import {defineField, defineType} from 'sanity'

type ProductAttribute = {
  name?: string
  value?: string
}

type ProductOption = {
  name?: string
  values?: string[]
}

type ProductVariant = {
  title?: string
  optionValue?: string
  price?: number
  stock?: number
}

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const toLabel = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : 'Unnamed'

const validateOptions = (options?: ProductOption[]): true | string => {
  if (!Array.isArray(options) || options.length === 0) {
    return true
  }

  if (options.length > 1) {
    return 'Only one variant option is supported. Keep a single option (for example: Color).'
  }

  const option = options[0]
  const optionName = normalize(option?.name)
  if (!optionName) {
    return 'The variant option requires a name.'
  }

  const optionValues = Array.isArray(option?.values) ? option.values : []
  if (optionValues.length === 0) {
    return `Option "${toLabel(option?.name)}" requires at least one value.`
  }

  const seenValues = new Set<string>()
  for (const rawValue of optionValues) {
    const normalizedValue = normalize(rawValue)
    if (!normalizedValue) {
      return `Option "${toLabel(option?.name)}" contains an empty value.`
    }
    if (seenValues.has(normalizedValue)) {
      return `Option "${toLabel(option?.name)}" has duplicated value "${rawValue}".`
    }
    seenValues.add(normalizedValue)
  }

  return true
}

const validateVariants = (variants?: ProductVariant[], options?: ProductOption[]): true | string => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return true
  }

  const configuredOption = Array.isArray(options) ? options[0] : undefined
  const configuredOptionName = configuredOption?.name?.trim() || ''
  const hasConfiguredOption = configuredOptionName.length > 0
  const validValues = new Set(
    (configuredOption?.values || []).map((value) => normalize(value)).filter(Boolean),
  )
  const seenOptionValues = new Set<string>()

  for (const variant of variants) {
    const optionValue = normalize(variant?.optionValue)

    if (!hasConfiguredOption && optionValue) {
      return 'Define a Variant Option before assigning option values to variants.'
    }

    if (!hasConfiguredOption) {
      continue
    }

    if (!optionValue) {
      return `Variant "${toLabel(variant?.title)}" requires a value for option "${configuredOptionName}".`
    }

    if (!validValues.has(optionValue)) {
      return `Variant "${toLabel(variant?.title)}" uses value "${toLabel(variant?.optionValue)}" that is not listed in option "${configuredOptionName}".`
    }

    if (seenOptionValues.has(optionValue)) {
      return `Variant value "${toLabel(variant?.optionValue)}" is duplicated.`
    }
    seenOptionValues.add(optionValue)
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
      name: 'options',
      title: 'Variant Option',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Option Name',
              type: 'string',
              validation: (rule) => rule.required(),
              description: 'Use a single option such as Color, Presentation, or Size.',
            }),
            defineField({
              name: 'values',
              title: 'Values',
              type: 'array',
              of: [{type: 'string'}],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: {
              title: 'name',
              values: 'values',
            },
            prepare: ({title, values}) => ({
              title: title || 'Option',
              subtitle: Array.isArray(values) ? values.join(', ') : '',
            }),
          },
        },
      ],
      validation: (rule) =>
        rule.max(1).custom((options) => validateOptions(options as ProductOption[])),
      description:
        'Defines the single attribute customers can choose before adding to cart.',
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
              name: 'title',
              title: 'Variant Title',
              type: 'string',
              description: 'Optional internal label, for example Azul.',
            }),
            defineField({
              name: 'optionValue',
              title: 'Option Value',
              type: 'string',
              validation: (rule) =>
                rule.custom((value, context) => {
                  const configuredOption =
                    (context.document as {options?: ProductOption[]})?.options?.[0]
                  const hasConfiguredOption =
                    typeof configuredOption?.name === 'string' &&
                    configuredOption.name.trim().length > 0

                  if (
                    hasConfiguredOption &&
                    (typeof value !== 'string' || value.trim().length === 0)
                  ) {
                    return `Required when option "${configuredOption?.name}" is configured.`
                  }

                  return true
                }),
              description: 'Value for the Variant Option, for example Blue.',
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
              title: 'title',
              optionValue: 'optionValue',
              price: 'price',
              stock: 'stock',
            },
            prepare: ({title, optionValue, price, stock}) => {
              const parts = [
                optionValue ? `Value: ${optionValue}` : '',
                typeof price === 'number' ? `$${price}` : '',
                typeof stock === 'number' ? `Stock: ${stock}` : '',
              ]
                .filter(Boolean)
                .join(' - ')

              return {
                title: title || optionValue || 'Variant',
                subtitle: parts,
              }
            },
          },
        },
      ],
      validation: (rule) =>
        rule.custom((variants, context) => {
          const options = (context.document as {options?: ProductOption[]})?.options
          return validateVariants(variants as ProductVariant[], options)
        }),
      description:
        'Each variant is a sellable product version with one option value, price, stock, and optional image.',
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
        'Legacy color field kept for backward compatibility. New products should use Variant Options and Variants.',
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
