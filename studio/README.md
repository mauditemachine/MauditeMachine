# Maudite Machine — Sanity Studio

## Setup initial (une fois)

```bash
cd studio
npx sanity login       # ouvre le browser, login Sanity
```

## Lancer le Studio en local

```bash
npm run dev            # http://localhost:3333
```

## Déployer le Studio (hébergement sanity.studio)

```bash
npm run deploy         # choisir un nom de hostname (ex: mauditemachine)
                       # → accessible sur https://mauditemachine.sanity.studio
```

## Migration JSON → Sanity (one-shot)

1. Générer un token **Editor** sur https://www.sanity.io/manage/project/ofkhqlly/api
2. Lancer :

```bash
SANITY_WRITE_TOKEN=<token> node scripts/migrate.mjs
```

Options :
- `node scripts/migrate.mjs events` — migrer seulement les events
- `node scripts/migrate.mjs messages` — seulement les messages
- `node scripts/migrate.mjs merch` — seulement le merch

Le script upload les images locales depuis `public/` vers Sanity et crée les documents.

## Config

- Project ID: `ofkhqlly`
- Dataset: `production`
- Schémas: `event`, `message`, `merchItem`
