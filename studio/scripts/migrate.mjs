#!/usr/bin/env node
/**
 * Migration JSON → Sanity
 * Usage :
 *   cd studio
 *   SANITY_WRITE_TOKEN=<token> node scripts/migrate.mjs
 *
 * Le token doit avoir le rôle "Editor" (écriture).
 * Génère-le sur https://www.sanity.io/manage/project/ofkhqlly/api
 */

import {createClient} from '@sanity/client'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const PUBLIC = path.join(ROOT, 'public')

const TOKEN = process.env.SANITY_WRITE_TOKEN
if (!TOKEN) {
  console.error('❌ SANITY_WRITE_TOKEN manquant. Génère-le sur sanity.io/manage → API → Tokens (rôle Editor).')
  process.exit(1)
}

const client = createClient({
  projectId: 'ofkhqlly',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: TOKEN,
  useCdn: false,
})

// Upload une image locale et retourne la référence Sanity
async function uploadImage(relativePath) {
  if (!relativePath) return null
  const clean = relativePath.replace(/^\/?/, '')
  const fullPath = path.join(PUBLIC, clean)
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  image introuvable: ${clean}`)
    return null
  }
  try {
    const asset = await client.assets.upload('image', fs.createReadStream(fullPath), {
      filename: path.basename(fullPath),
    })
    return {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}
  } catch (err) {
    console.warn(`  ⚠️  upload failed ${clean}:`, err.message)
    return null
  }
}

async function migrateEvents() {
  const data = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'events.json'), 'utf8'))
  console.log(`\n📅 Events: ${data.length}`)
  for (const ev of data) {
    const image = await uploadImage(ev.image)
    const doc = {
      _type: 'event',
      title: ev.title,
      date: ev.date,
      location: ev.location,
      url: ev.url,
      color: ev.color,
      past: false,
      ...(image && {image}),
    }
    try {
      const created = await client.create(doc)
      console.log(`  ✓ ${ev.title} (${ev.date}) → ${created._id}`)
    } catch (err) {
      console.error(`  ✗ ${ev.title}:`, err.message)
    }
  }
}

async function migrateMessages() {
  const data = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'messages.json'), 'utf8'))
  console.log(`\n💬 Messages: ${data.length}`)
  for (const m of data) {
    const image = await uploadImage(m.image)
    const doc = {
      _type: 'message',
      title: m.title,
      description: m.description,
      date: m.date,
      ...(image && {image}),
    }
    try {
      const created = await client.create(doc)
      console.log(`  ✓ ${m.title} → ${created._id}`)
    } catch (err) {
      console.error(`  ✗ ${m.title}:`, err.message)
    }
  }
}

async function migrateMerch() {
  const data = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'store.json'), 'utf8'))
  console.log(`\n👕 Merch: ${data.length}`)
  for (const m of data) {
    const image = await uploadImage(m.src)
    const doc = {
      _type: 'merchItem',
      caption: m.caption,
      alt: m.alt,
      price: m.price,
      category: m.category,
      active: m.active !== false,
      soldOut: !!m.soldOut,
      sizes: m.sizes || {S: true, M: true, L: true, XL: true},
      ...(image && {image}),
    }
    try {
      const created = await client.create(doc)
      console.log(`  ✓ ${m.caption} (${m.category}) → ${created._id}`)
    } catch (err) {
      console.error(`  ✗ ${m.caption}:`, err.message)
    }
  }
}

async function run() {
  const args = process.argv.slice(2)
  const only = args[0] // "events" | "messages" | "merch" | undefined (tout)
  try {
    if (!only || only === 'events') await migrateEvents()
    if (!only || only === 'messages') await migrateMessages()
    if (!only || only === 'merch') await migrateMerch()
    console.log('\n✅ Migration terminée.')
  } catch (err) {
    console.error('\n❌ Migration échouée:', err)
    process.exit(1)
  }
}

run()
