import {defineField, defineType} from 'sanity'

type ProductAttribute = {
  name?: string
  value?: string
}

type ProductOption = {
  name?: string
  values?: string[]
}

type ProductVariantSelection = {
  option?: string
  value?: string
}

type ProductVariant = {
  title?: string
  sku?: string
  price?: number
  stock?: number
  selections?: ProductVariantSelection[]
}

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const toLabel = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : 'Unnamed'

const validateOptions = (options?: ProductOption[]): true | string => {
  if (!Array.isArray(options) || options.length === 0) {
    return true
  }

  const seenOptionNames = new Set<string>()

  for (const option of options) {
    const optionName = normalize(option?.name)
    if (!optionName) {
      return 'Each option requires a name.'
    }

    if (seenOptionNames.has(optionName)) {
      return `Option "${toLabel(option?.name)}" is duplicated.`
    }
    seenOptionNames.add(optionName)

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
  }

  return true
}

const buildOptionMap = (options?: ProductOption[]): Map<string, Set<string>> => {
  const optionMap = new Map<string, Set<string>>()
  if (!Array.isArray(options)) {
    return optionMap
  }

  options.forEach((option) => {
    const optionName = normalize(option?.name)
    if (!optionName) {
      return
    }
    const values = new Set<string>()
    ;(option.values || []).forEach((value) => {
      const normalizedValue = normalize(value)
      if (normalizedValue) {
        values.add(normalizedValue)
      }
    })
    optionMap.set(optionName, values)
  })

  return optionMap
}

const variantCombinationKey = (selections?: ProductVariantSelection[]): string => {
  if (!Array.isArray(selections) || selections.length === 0) {
    return ''
  }

  return selections
    .map((selection) => `${normalize(selection.option)}:${normalize(selection.value)}`)
    .sort()
    .join('|')
}

const validateVariants = (variants?: ProductVariant[], options?: ProductOption[]): true | string => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return true
  }

  const optionMap = buildOptionMap(options)
  const requiresSelections = optionMap.size > 0
  const seenSkus = new Set<string>()
  const seenCombinationKeys = new Set<string>()

  for (const variant of variants) {
    const sku = normalize(variant?.sku)
    if (!sku) {
      return 'Each variant requires a SKU.'
    }
    if (seenSkus.has(sku)) {
      return `Variant SKU "${toLabel(variant?.sku)}" is duplicated.`
    }
    seenSkus.add(sku)

    const selections = Array.isArray(variant?.selections) ? variant.selections : []
    if (!requiresSelections && selections.length > 0) {
      return 'Define options before assigning selections to variants.'
    }

    if (!requiresSelections) {
      continue
    }

    if (selections.length !== optionMap.size) {
      return `Variant "${toLabel(variant?.title || variant?.sku)}" must define all configured options.`
    }

    const selectedOptions = new Set<string>()
    for (const selection of selections) {
      const optionName = normalize(selection?.option)
      const optionValue = normalize(selection?.value)

      if (!optionName || !optionValue) {
        return `Variant "${toLabel(variant?.title || variant?.sku)}" has an incomplete selection.`
      }

      if (!optionMap.has(optionName)) {
        return `Variant "${toLabel(variant?.title || variant?.sku)}" uses unknown option "${toLabel(selection?.option)}".`
      }

      if (selectedOptions.has(optionName)) {
        return `Variant "${toLabel(variant?.title || variant?.sku)}" repeats option "${toLabel(selection?.option)}".`
      }
      selectedOptions.add(optionName)

      const validValues = optionMap.get(optionName)
      if (!validValues || !validValues.has(optionValue)) {
        return `Variant "${toLabel(variant?.title || variant?.sku)}" uses value "${toLabel(selection?.value)}" that is not listed in option "${toLabel(selection?.option)}".`
      }
    }

    const combinationKey = variantCombinationKey(selections)
    if (seenCombinationKeys.has(combinationKey)) {
      return 'Two variants share the same option combination.'
    }
    seenCombinationKeys.add(combinationKey)
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
      name: 'sku',
      title: 'Base SKU',
      type: 'string',
      description: 'Optional base SKU. Variants should have their own SKU.',
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
      title: 'Variant Options',
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
              description: 'Examples: Color, Size, Material',
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
      validation: (rule) => rule.custom((options) => validateOptions(options as ProductOption[])),
      description: 'Defines which attributes customers can choose before adding to cart.',
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
              description: 'Optional internal label, for example Blue / Medium.',
            }),
            defineField({
              name: 'sku',
              title: 'Variant SKU',
              type: 'string',
              validation: (rule) => rule.required(),
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
            defineField({
              name: 'selections',
              title: 'Option Selections',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'option',
                      title: 'Option',
                      type: 'string',
                      validation: (rule) => rule.required(),
                    }),
                    defineField({
                      name: 'value',
                      title: 'Value',
                      type: 'string',
                      validation: (rule) => rule.required(),
                    }),
                  ],
                  preview: {
                    select: {
                      title: 'option',
                      subtitle: 'value',
                    },
                  },
                },
              ],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              sku: 'sku',
              price: 'price',
              stock: 'stock',
              selections: 'selections',
            },
            prepare: ({title, sku, price, stock, selections}) => {
              const selectionText = Array.isArray(selections)
                ? selections
                    .map((selection: ProductVariantSelection) => {
                      const option = selection?.option || 'Option'
                      const value = selection?.value || 'Value'
                      return `${option}: ${value}`
                    })
                    .join(' | ')
                : ''
              const parts = [selectionText, sku ? `SKU: ${sku}` : '', typeof price === 'number' ? `$${price}` : '', typeof stock === 'number' ? `Stock: ${stock}` : '']
                .filter(Boolean)
                .join(' - ')

              return {
                title: title || sku || 'Variant',
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
      description: 'Each variant is a sellable product version with its own SKU, stock, and price.',
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
