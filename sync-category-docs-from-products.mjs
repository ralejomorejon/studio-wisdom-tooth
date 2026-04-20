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

const PRODUCTS_QUERY = `*[_type == "product" && coalesce(isActive, true) == true]{
  "referencedCategoryTitles": categories[]->title,
  "referencedCategoryRefs": categories[]._ref
}`

const CATEGORY_DOCS_QUERY = `*[_type == "category"]{
  _id,
  title,
  isActive,
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

function extractStrings(value) {
  const list = Array.isArray(value) ? value : [value]
  return list
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function pickDisplayTitle(current, incoming) {
  const currentClean = typeof current === 'string' ? current.trim() : ''
  if (currentClean) return currentClean
  return incoming
}

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function run() {
  try {
    const [products, categoryDocs] = await Promise.all([
      client.fetch(PRODUCTS_QUERY),
      client.fetch(CATEGORY_DOCS_QUERY),
    ])

    if (products.length === 0) {
      nodeConsole.log('No active products were found.')
      return
    }

    const desiredTitlesByKey = new Map()
    const referencedCategoryIds = new Set()
    const preferredTitleByRefId = new Map()

    products.forEach((product) => {
      const fromReferences = extractStrings(product.referencedCategoryTitles)
      const refs = extractStrings(product.referencedCategoryRefs)

      fromReferences.forEach((title) => {
        const key = normalize(title)
        if (!key) return
        const previous = desiredTitlesByKey.get(key)
        desiredTitlesByKey.set(key, pickDisplayTitle(previous, title))
      })

      refs.forEach((refId) => {
        referencedCategoryIds.add(refId)
        if (fromReferences.length > 0 && !preferredTitleByRefId.has(refId)) {
          preferredTitleByRefId.set(refId, fromReferences[0])
        }
      })
    })

    if (desiredTitlesByKey.size === 0 && referencedCategoryIds.size === 0) {
      nodeConsole.log('No category references were found on active products.')
      return
    }

    const categoryByKey = new Map()
    const slugToId = new Map()
    const usedIds = new Set()

    categoryDocs.forEach((doc) => {
      if (!doc?._id) return

      usedIds.add(doc._id)

      const key = normalize(doc.title)
      if (key && !categoryByKey.has(key)) {
        categoryByKey.set(key, doc)
      }

      const slugKey = normalize(doc.slug)
      if (slugKey && !slugToId.has(slugKey)) {
        slugToId.set(slugKey, doc._id)
      }
    })

    const plannedCreates = []
    const plannedActivations = []

    desiredTitlesByKey.forEach((title, key) => {
      const existing = categoryByKey.get(key)
      if (existing) {
        if (existing.isActive === false) {
          plannedActivations.push({
            id: existing._id,
            title: existing.title || title,
          })
        }
        return
      }

      const slugBase = toSlug(title) || 'categoria'
      let slugCandidate = slugBase
      let idCandidate = `category.${slugCandidate}`
      let suffix = 2

      while (usedIds.has(idCandidate) || slugToId.has(slugCandidate)) {
        slugCandidate = `${slugBase}-${suffix}`
        idCandidate = `category.${slugCandidate}`
        suffix += 1
      }

      usedIds.add(idCandidate)
      slugToId.set(slugCandidate, idCandidate)

      plannedCreates.push({
        _id: idCandidate,
        _type: 'category',
        title,
        slug: {
          _type: 'slug',
          current: slugCandidate,
        },
        isActive: true,
      })
    })

    const existingCategoryIds = new Set(categoryDocs.map((doc) => doc._id).filter(Boolean))
    const orphanRefIds = Array.from(referencedCategoryIds).filter(
      (refId) =>
        typeof refId === 'string' &&
        refId.startsWith('category.') &&
        !existingCategoryIds.has(refId),
    )

    const alreadyPlannedIds = new Set(plannedCreates.map((doc) => doc._id))

    orphanRefIds.forEach((refId) => {
      if (alreadyPlannedIds.has(refId)) return

      const slugCandidate = refId.replace(/^category\./, '').trim() || 'categoria'
      const preferredTitle = preferredTitleByRefId.get(refId)
      const title =
        (typeof preferredTitle === 'string' && preferredTitle.trim()) || titleFromSlug(slugCandidate)

      plannedCreates.push({
        _id: refId,
        _type: 'category',
        title,
        slug: {
          _type: 'slug',
          current: slugCandidate,
        },
        isActive: true,
      })

      alreadyPlannedIds.add(refId)
    })

    nodeConsole.log(`Active products scanned: ${products.length}`)
    nodeConsole.log(`Unique category names found: ${desiredTitlesByKey.size}`)
    nodeConsole.log(`Orphan category refs found: ${orphanRefIds.length}`)
    nodeConsole.log(`Planned category creates: ${plannedCreates.length}`)
    nodeConsole.log(`Planned category activations: ${plannedActivations.length}`)

    if (plannedCreates.length > 0) {
      nodeConsole.log('\nCategories to create:')
      plannedCreates.forEach((doc) => {
        nodeConsole.log(`- ${doc._id}: ${doc.title}`)
      })
    }

    if (plannedActivations.length > 0) {
      nodeConsole.log('\nCategories to activate:')
      plannedActivations.forEach((doc) => {
        nodeConsole.log(`- ${doc.id}: ${doc.title}`)
      })
    }

    if (plannedCreates.length === 0 && plannedActivations.length === 0) {
      nodeConsole.log('\nNo category document sync changes are needed.')
      return
    }

    if (!shouldApply) {
      nodeConsole.log('\nDry run only. Re-run with --apply to write changes.')
      return
    }

    let tx = client.transaction()

    plannedCreates.forEach((doc) => {
      tx = tx.createIfNotExists(doc)
    })

    plannedActivations.forEach((doc) => {
      tx = tx.patch(doc.id, {
        set: {isActive: true},
      })
    })

    await tx.commit()
    nodeConsole.log(
      `\n✅ Applied category doc sync. Created ${plannedCreates.length} and activated ${plannedActivations.length}.`,
    )
  } catch (error) {
    nodeConsole.error('Failed to sync category documents from products:', error)
    nodeProcess.exit(1)
  }
}

run()