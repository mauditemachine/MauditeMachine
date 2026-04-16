import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'ofkhqlly',
    dataset: 'production',
  },
  studioHost: 'mauditemachine',
  autoUpdates: true,
})
