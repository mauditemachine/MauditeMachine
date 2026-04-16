import {createClient, type SanityClient} from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityImageSource} from '@sanity/image-url/lib/types/types'

export const sanityClient: SanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'ofkhqlly',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = imageUrlBuilder(sanityClient)

export const urlFor = (source: SanityImageSource) => builder.image(source)
