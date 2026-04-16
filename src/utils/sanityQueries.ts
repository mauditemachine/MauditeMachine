import {sanityClient, urlFor} from './sanityClient'

export interface SanityEvent {
  _id: string
  title: string
  date: string
  location?: string
  url?: string
  color?: string
  image?: any
  past?: boolean
}

export interface SanityMessage {
  _id: string
  title: string
  description?: string
  date: string
  image?: any
}

export interface SanityMerchItem {
  _id: string
  caption: string
  alt?: string
  image?: any
  price?: string
  category?: string
  active?: boolean
  soldOut?: boolean
  sizes?: {S?: boolean; M?: boolean; L?: boolean; XL?: boolean}
}

export async function fetchEvents(includePast = false): Promise<SanityEvent[]> {
  const filter = includePast ? '' : ' && past != true'
  return sanityClient.fetch(
    `*[_type == "event"${filter}] | order(date desc){
      _id, title, date, location, url, color, image, past
    }`
  )
}

export async function fetchMessages(): Promise<SanityMessage[]> {
  return sanityClient.fetch(
    `*[_type == "message"] | order(date desc){
      _id, title, description, date, image
    }`
  )
}

export async function fetchMerchItems(onlyActive = true): Promise<SanityMerchItem[]> {
  const filter = onlyActive ? '[_type == "merchItem" && active == true]' : '[_type == "merchItem"]'
  return sanityClient.fetch(
    `*${filter} | order(_createdAt desc){
      _id, caption, alt, image, price, category, active, soldOut, sizes
    }`
  )
}

export {urlFor}
