/* eslint-env node */

import {createClient} from '@sanity/client'
import {getCliClient} from 'sanity/cli'

const nodeProcess = globalThis.process
const nodeConsole = globalThis.console

if (!nodeProcess || !nodeConsole) {
  throw new Error('This script must run in a Node.js environment')
}

const projectId = nodeProcess.env.SANITY_PROJECT_ID || 'eca3j5m8'
const dataset = nodeProcess.env.SANITY_DATASET || 'production'
const apiVersion = nodeProcess.env.SANITY_API_VERSION || '2024-03-30'
const token = nodeProcess.env.SANITY_API_TOKEN
const shouldApply = nodeProcess.argv.includes('--apply')
const shouldUnsetLegacy = nodeProcess.argv.includes('--unset-legacy')

const client = token
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      token,
      useCdn: false,
    })
  : getCliClient({
      apiVersion,
    })

const PRODUCTS_QUERY = `*[_type == "product" && defined(category)]{
  _id,
  name,
  slug,
  category,
  "existingCategoryRefs": categories[]._ref
}`

const CATEGORIES_QUERY = `*[_type == "category"]{
  _id,
  title,
  "slug": slug.current
}`

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractLegacyCategoryNames(value) {
  const rawValues = Array.isArray(value) ? value : [value]
  const seen = new Set()
  const result = []

  rawValues.forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    if (!trimmed) return

    const key = normalize(trimmed)
    if (seen.has(key)) return

    seen.add(key)
    result.push(trimmed)
  })

  return result
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function toReferenceKey(ref, index) {
  const base = String(ref || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 32)

  return `${base || 'category'}-${index + 1}`
}

async function run() {
  try {
    const [products, existingCategories] = await Promise.all([
      client.fetch(PRODUCTS_QUERY),
      client.fetch(CATEGORIES_QUERY),
    ])

    if (products.length === 0) {
      nodeConsole.log('No products with legacy category data were found.')
      return
    }

    const titleToId = new Map()
    const slugToId = new Map()
    const usedIds = new Set()

    existingCategories.forEach((category) => {
      if (!category?._id) return

      usedIds.add(category._id)

      const titleKey = normalize(category.title)
      if (titleKey && !titleToId.has(titleKey)) {
        titleToId.set(titleKey, category._id)
      }

      const slugKey = normalize(category.slug)
      if (slugKey && !slugToId.has(slugKey)) {
        slugToId.set(slugKey, category._id)
      }
    })

    const plannedCategoryCreates = []
    const plannedProductPatches = []

    const resolveCategoryId = (categoryName) => {
      const titleKey = normalize(categoryName)
      if (titleToId.has(titleKey)) {
        return titleToId.get(titleKey)
      }

      const slug = toSlug(categoryName)
      if (slug && slugToId.has(slug)) {
        const existingId = slugToId.get(slug)
        titleToId.set(titleKey, existingId)
        return existingId
      }

      let candidateSlug = slug || 'categoria'
      let categoryId = `category.${candidateSlug}`
      let suffix = 2

      while (usedIds.has(categoryId)) {
        categoryId = `category.${candidateSlug}-${suffix}`
        suffix += 1
      }

      usedIds.add(categoryId)
      titleToId.set(titleKey, categoryId)
      if (candidateSlug) slugToId.set(candidateSlug, categoryId)

      plannedCategoryCreates.push({
        _id: categoryId,
        _type: 'category',
        title: categoryName,
        slug: {
          _type: 'slug',
          current: candidateSlug,
        },
        isActive: true,
      })

      return categoryId
    }

    products.forEach((product) => {
      const legacyCategoryNames = extractLegacyCategoryNames(product.category)
      if (legacyCategoryNames.length === 0) {
        return
      }

      const existingRefs = Array.isArray(product.existingCategoryRefs)
        ? product.existingCategoryRefs.filter((value) => typeof value === 'string' && value.trim())
        : []

      const legacyRefs = legacyCategoryNames.map((name) => resolveCategoryId(name))
      const mergedRefs = Array.from(new Set([...existingRefs, ...legacyRefs]))
      const shouldPatchCategories = !arraysEqual(existingRefs, mergedRefs)

      if (!shouldPatchCategories && !shouldUnsetLegacy) {
        return
      }

      plannedProductPatches.push({
        id: product._id,
        name: product?.name || 'Unnamed product',
        slug: product?.slug?.current ? ` (${product.slug.current})` : '',
        categoryNames: legacyCategoryNames,
        existingRefCount: existingRefs.length,
        nextRefCount: mergedRefs.length,
        patch: {
          set: shouldPatchCategories
            ? {
                categories: mergedRefs.map((ref, index) => ({
                  _type: 'reference',
                  _ref: ref,
                  _key: toReferenceKey(ref, index),
                })),
              }
            : undefined,
          unset: shouldUnsetLegacy ? ['category'] : undefined,
        },
      })
    })

    if (plannedCategoryCreates.length === 0 && plannedProductPatches.length === 0) {
      nodeConsole.log('No category reference migrations are needed.')
      return
    }

    nodeConsole.log(`Found ${products.length} product(s) with legacy category data.`)
    nodeConsole.log(`Planned category creates: ${plannedCategoryCreates.length}`)
    nodeConsole.log(`Planned product patches: ${plannedProductPatches.length}`)

    if (plannedCategoryCreates.length > 0) {
      nodeConsole.log('\nCategories to create:')
      plannedCategoryCreates.forEach((category) => {
        nodeConsole.log(`- ${category._id}: ${category.title}`)
      })
    }

    if (plannedProductPatches.length > 0) {
      nodeConsole.log('\nProducts to patch:')
      plannedProductPatches.forEach((product) => {
        const categorySummary = product.categoryNames.join(', ')
        nodeConsole.log(
          `- ${product.id}: ${product.name}${product.slug} | categories: [${categorySummary}] | refs ${product.existingRefCount} -> ${product.nextRefCount}${shouldUnsetLegacy ? ' | unset legacy: yes' : ''}`,
        )
      })
    }

    if (!shouldApply) {
      nodeConsole.log('\nDry run only. Re-run with --apply to write changes.')
      if (!shouldUnsetLegacy) {
        nodeConsole.log('Tip: add --unset-legacy when you are ready to remove the old category field.')
      }
      return
    }

    let tx = client.transaction()

    plannedCategoryCreates.forEach((category) => {
      tx = tx.createIfNotExists(category)
    })

    plannedProductPatches.forEach((item) => {
      const patch = {}
      if (item.patch.set) {
        patch.set = item.patch.set
      }
      if (item.patch.unset) {
        patch.unset = item.patch.unset
      }
      tx = tx.patch(item.id, patch)
    })

    await tx.commit()

    nodeConsole.log(
      `\n✅ Applied migration. Created ${plannedCategoryCreates.length} category document(s) and patched ${plannedProductPatches.length} product(s).`,
    )
  } catch (error) {
    nodeConsole.error('Failed to migrate product category references:', error)
    nodeProcess.exit(1)
  }
}

run()