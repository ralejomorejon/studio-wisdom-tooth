import sanityClient from '@sanity/client'

const client = sanityClient({
  projectId: 'eca3j5m8',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN, // Necesita token con permisos de management
})

async function setupWebhook() {
  try {
    const webhook = await client.create({
      _type: 'webhook',
      name: 'GitHub Pages Deploy',
      url: process.env.WORKER_URL, // Tu Worker URL
      events: ['create', 'update', 'delete'],
      filter: '_type == "product" || _type == "post"', // Ajusta según tus tipos
    })
    console.log('✅ Webhook creado:', webhook)
  } catch (error) {
    console.error('❌ Error creando webhook:', error)
  }
}

setupWebhook()
