/**
 * Cloudflare Worker - Sanity Webhook Handler
 * Triggers a deploy on Cloudflare Pages when Sanity content changes
 */

interface SanityWebhookPayload {
  _id: string
  _type: string
  [key: string]: unknown
}

interface Env {
  CLOUDFLARE_API_TOKEN: string
  SANITY_WEBHOOK_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {status: 405})
    }

    // Verify it's the Sanity webhook path
    const url = new URL(request.url)
    if (url.pathname !== '/deploy') {
      return new Response('Not found', {status: 404})
    }

    try {
      // Parse the Sanity webhook payload
      const payload = (await request.json()) as SanityWebhookPayload

      console.log(`Webhook received for document: ${payload._id}`)

      // Trigger Cloudflare Pages deployment
      const deploymentResponse = await triggerDeploy(env.CLOUDFLARE_API_TOKEN)

      if (!deploymentResponse.ok) {
        const errorData = await deploymentResponse.json()
        console.error('Deployment failed:', errorData)
        return new Response(JSON.stringify({error: 'Deployment failed', details: errorData}), {
          status: 500,
          headers: {'Content-Type': 'application/json'},
        })
      }

      const deploymentData = await deploymentResponse.json()
      console.log('Deployment triggered:', deploymentData)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Deployment triggered',
          deployment: deploymentData,
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      )
    } catch (error) {
      console.error('Error processing webhook:', error)
      return new Response(JSON.stringify({error: 'Internal server error'}), {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      })
    }
  },
}

/**
 * Trigger a Cloudflare Pages deployment
 */
async function triggerDeploy(apiToken: string): Promise<Response> {
  // Replace these with your actual values
  const ACCOUNT_ID = 'ac75948bea06fe23ac94bfc6a64fd9de'
  const PROJECT_NAME = 'astro-store'

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
}
