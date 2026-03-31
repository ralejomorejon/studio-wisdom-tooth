import sanityClient from '@sanity/client';

const client = sanityClient({
  projectId: 'eca3j5m8',
  dataset: 'production',
  apiVersion: '2024-03-30',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

async function publishDrafts() {
  try {
    // Obtener todos los borradores
    const drafts = await client.fetch(
      `*[_id in path("drafts.**")]`
    );

    console.log(`Found ${drafts.length} drafts to publish`);

    if (drafts.length === 0) {
      console.log('No drafts to publish');
      return;
    }

    // Crear mutaciones para publicar cada borrador
    const mutations = drafts.map((draft) => {
      // Excluir campos del sistema
      const { _id, _rev, _createdAt, _updatedAt, ...cleanDraft } = draft;
      
      return {
        createIfNotExists: {
          ...cleanDraft,
          _id: _id.replace('drafts.', ''),
        },
      };
    });

    // Ejecutar todas las mutaciones en batch
    const result = await client.mutate(mutations);

    console.log(`✅ Published ${drafts.length} documents`);
    console.log('\n🎉 All drafts published!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

publishDrafts();
