import {definePlugin} from 'sanity'
import {Tool} from 'sanity'
import {PublishTool} from '../publish-tool'

export const publishPlugin = definePlugin({
  name: 'publish-plugin',
  tools: [
    {
      name: 'publish',
      title: 'Publish Drafts',
      component: PublishTool,
      icon: () => '📦',
    } as Tool,
  ],
})
