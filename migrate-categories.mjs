import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'eca3j5m8',
  dataset: 'production',
  apiVersion: '2024-03-30',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

async function migrateCategories() {
  try {
    // Fetch all product documents where category is a string (not an array)
    const products = await client.fetch(
      `*[_type == "product" && defined(category) && string(category) == category]{ _id, category }`,
    )

    console.log(`Found ${products.length} product(s) with a string category to migrate`)

    if (products.length === 0) {
      console.log('Nothing to migrate.')
      return
    }

    const mutations = products.map(({_id, category}) => ({
      patch: {
        id: _id,
        set: {category: [category]},
      },
    }))

    await client.mutate(mutations)

    console.log(`✅ Migrated ${products.length} product(s): category string → array`)
    products.forEach(({_id, category}) =>
      console.log(`  • ${_id}: "${category}" → ["${category}"]`),
    )
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

migrateCategories()
