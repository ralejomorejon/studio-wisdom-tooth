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

const QUERY = `*[_type == "product" && (
  (defined(image) && !defined(image.asset._ref)) ||
  count(images[defined(@) && !defined(asset._ref)]) > 0 ||
  count(variants[defined(image) && !defined(image.asset._ref)]) > 0
)]{
  _id,
  name,
  slug,
  image,
  images,
  variants
}`

function hasValidAssetRef(image) {
  return Boolean(image && image.asset && typeof image.asset._ref === 'string' && image.asset._ref)
}

function sanitizeProduct(product) {
  const updates = {set: {}, unset: []}
  let changed = false

  if (product.image && !hasValidAssetRef(product.image)) {
    updates.unset.push('image')
    changed = true
  }

  const images = Array.isArray(product.images) ? product.images : []
  const cleanedImages = images.filter((img) => hasValidAssetRef(img))
  if (cleanedImages.length !== images.length) {
    updates.set.images = cleanedImages
    changed = true
  }

  const variants = Array.isArray(product.variants) ? product.variants : []
  const cleanedVariants = variants.map((variant) => {
    if (!variant || typeof variant !== 'object') return variant
    if (!variant.image || hasValidAssetRef(variant.image)) return variant

    const {image, ...rest} = variant
    return rest
  })

  const variantsChanged = JSON.stringify(cleanedVariants) !== JSON.stringify(variants)
  if (variantsChanged) {
    updates.set.variants = cleanedVariants
    changed = true
  }

  return {changed, updates}
}

async function run() {
  try {
    const products = await client.fetch(QUERY)

    if (products.length === 0) {
      nodeConsole.log('No products with broken image references were found.')
      return
    }

    nodeConsole.log(`Found ${products.length} product(s) with broken image references.`)

    const planned = []
    for (const product of products) {
      const {changed, updates} = sanitizeProduct(product)
      if (!changed) continue

      const slug = product?.slug?.current ? ` (${product.slug.current})` : ''
      const setKeys = Object.keys(updates.set)
      planned.push({id: product._id, name: product.name || 'Unnamed product', slug, setKeys, unsetCount: updates.unset.length, updates})
    }

    if (planned.length === 0) {
      nodeConsole.log('Products matched query, but no safe mutations were generated.')
      return
    }

    nodeConsole.log('Planned fixes:')
    planned.forEach((item) => {
      const setSummary = item.setKeys.length > 0 ? `set=[${item.setKeys.join(', ')}]` : 'set=[]'
      const unsetSummary = `unset=${item.unsetCount}`
      nodeConsole.log(`- ${item.id}: ${item.name}${item.slug} | ${setSummary} ${unsetSummary}`)
    })

    if (!shouldApply) {
      nodeConsole.log('\nDry run only. Re-run with --apply to write changes.')
      return
    }

    let tx = client.transaction()
    planned.forEach((item) => {
      const patch = {}
      if (Object.keys(item.updates.set).length > 0) {
        patch.set = item.updates.set
      }
      if (item.updates.unset.length > 0) {
        patch.unset = item.updates.unset
      }
      tx = tx.patch(item.id, patch)
    })

    await tx.commit()
    nodeConsole.log(`\n✅ Applied fixes to ${planned.length} product(s).`)
  } catch (error) {
    nodeConsole.error('Failed to fix broken product images:', error)
    nodeProcess.exit(1)
  }
}

run()
