import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {publishPlugin} from './plugins/publish-plugin'

export default defineConfig({
  name: 'default',
  title: 'Wisdom Tooth',

  projectId: 'eca3j5m8',
  dataset: 'production',

  plugins: [structureTool(), visionTool(), publishPlugin()],

  schema: {
    types: schemaTypes,
  },
})
