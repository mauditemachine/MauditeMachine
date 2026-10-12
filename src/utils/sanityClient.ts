import {createClient, type SanityClient} from '@sanity/client'
// 2026-10-11 : l'export nomme (@sanity/image-url 2.x), l'export par defaut est deprecie (avertissement en console)
import {createImageUrlBuilder} from '@sanity/image-url'
import type {SanityImageSource} from '@sanity/image-url/lib/types/types'

export const sanityClient: SanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'ofkhqlly',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = createImageUrlBuilder(sanityClient)

export const urlFor = (source: SanityImageSource) => builder.image(source)
