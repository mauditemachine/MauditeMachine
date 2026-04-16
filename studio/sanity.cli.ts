import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'ofkhqlly',
    dataset: 'production',
  },
  autoUpdates: true,
})
