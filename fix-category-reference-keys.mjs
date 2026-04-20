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

const QUERY = `*[_type == "product" && count(categories[!defined(_key) || _key == ""]) > 0]{
  _id,
  name,
  slug,
  categories
}`

function toReferenceKey(ref, index) {
  const base = String(ref || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 32)

  return `${base || 'category'}-${index + 1}`
}

function sanitizeCategories(categories) {
  const list = Array.isArray(categories) ? categories : []
  const usedKeys = new Set(
    list
      .map((item) => item?._key)
      .filter((key) => typeof key === 'string' && key.trim())
      .map((key) => key.trim()),
  )

  let changed = false

  const next = list
    .filter((item) => item && typeof item._ref === 'string' && item._ref.trim())
    .map((item, index) => {
      const hasValidKey = typeof item._key === 'string' && item._key.trim()
      if (hasValidKey) {
        return item
      }

      changed = true
      let candidate = toReferenceKey(item._ref, index)
      let suffix = 2
      while (usedKeys.has(candidate)) {
        candidate = `${toReferenceKey(item._ref, index)}-${suffix}`
        suffix += 1
      }
      usedKeys.add(candidate)

      return {
        ...item,
        _key: candidate,
      }
    })

  return {changed, categories: next}
}

async function run() {
  try {
    const products = await client.fetch(QUERY)

    if (products.length === 0) {
      nodeConsole.log('No products with missing category reference keys were found.')
      return
    }

    const planned = products
      .map((product) => {
        const fixed = sanitizeCategories(product.categories)
        return {
          id: product._id,
          name: product?.name || 'Unnamed product',
          slug: product?.slug?.current ? ` (${product.slug.current})` : '',
          missingCount: Array.isArray(product.categories)
            ? product.categories.filter(
                (item) => !(typeof item?._key === 'string' && item._key.trim()),
              ).length
            : 0,
          changed: fixed.changed,
          categories: fixed.categories,
        }
      })
      .filter((entry) => entry.changed)

    if (planned.length === 0) {
      nodeConsole.log('Products were found, but no safe key fixes were generated.')
      return
    }

    nodeConsole.log(`Found ${planned.length} product(s) needing category _key fixes.`)
    planned.forEach((entry) => {
      nodeConsole.log(
        `- ${entry.id}: ${entry.name}${entry.slug} | missing keys: ${entry.missingCount}`,
      )
    })

    if (!shouldApply) {
      nodeConsole.log('\nDry run only. Re-run with --apply to write changes.')
      return
    }

    let tx = client.transaction()
    planned.forEach((entry) => {
      tx = tx.patch(entry.id, {
        set: {
          categories: entry.categories,
        },
      })
    })

    await tx.commit()
    nodeConsole.log(`\n✅ Applied category _key fixes to ${planned.length} product(s).`)
  } catch (error) {
    nodeConsole.error('Failed to fix category reference keys:', error)
    nodeProcess.exit(1)
  }
}

run()