import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

/**
 * Les echantillons de Mika pour le MM-RYTM (2026-10-05) : chaque fichier
 * audio de public/samples/rytm/<famille>/ (bd, sd, cp, hh, tom, rs) entre
 * dans le choix de son de sa famille. La liste est un module virtuel
 * (virtual:rytm-samples, lu par src/v4/audio/samples.ts), refaite a chaque
 * build et, en dev, a chaque fichier ajoute ou retire : aucun script a
 * lancer, et n'importe quel nom de fichier (un # ou des espaces passent,
 * public/ les sert tels quels).
 */
const SAMPLE_DIR = resolve(__dirname, 'public/samples/rytm')
const SAMPLE_EXT = /\.(wav|mp3|ogg|flac|aiff?|m4a)$/i
const SAMPLE_ID = 'virtual:rytm-samples'
function listSamples(): { family: string; file: string }[] {
  if (!existsSync(SAMPLE_DIR)) return []
  return readdirSync(SAMPLE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(resolve(SAMPLE_DIR, d.name))
        .filter((f) => SAMPLE_EXT.test(f) && !f.startsWith('.'))
        .map((file) => ({ family: d.name, file }))
    )
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'rytm-samples',
      resolveId(id) {
        return id === SAMPLE_ID ? `\0${SAMPLE_ID}` : undefined
      },
      load(id) {
        return id === `\0${SAMPLE_ID}` ? `export default ${JSON.stringify(listSamples())};` : undefined
      },
      configureServer(server) {
        server.watcher.add(SAMPLE_DIR)
        const changed = (f: string): void => {
          if (!f.startsWith(SAMPLE_DIR)) return
          const m = server.moduleGraph.getModuleById(`\0${SAMPLE_ID}`)
          if (m) server.moduleGraph.invalidateModule(m)
          server.ws.send({ type: 'full-reload' })
        }
        server.watcher.on('add', changed)
        server.watcher.on('unlink', changed)
      },
    },
    // /press/ est une page statique de public/, hors routeur React. En prod
    // GitHub Pages sert public/press/index.html tel quel ; en dev le
    // fallback SPA de Vite l'avalait et affichait une page noire. On
    // reecrit l'URL avant le fallback pour que dev et prod concordent.
    {
      name: 'serve-press-index',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/press' || req.url?.startsWith('/press/?')) {
            req.url = '/press/index.html';
          } else if (req.url === '/press/') {
            req.url = '/press/index.html';
          }
          next();
        });
      },
    },
    // Plugin pour copier 404.html après le build
    {
      name: 'copy-404',
      closeBundle() {
        if (command === 'build') {
          try {
            copyFileSync(
              resolve(__dirname, 'dist/index.html'),
              resolve(__dirname, 'dist/404.html')
            )
            console.log('✅ 404.html créé pour GitHub Pages SPA routing')
          } catch (error) {
            console.error('❌ Erreur lors de la création de 404.html:', error)
          }
        }
      }
    }
  ],
  base: command === 'build' ? '/' : '/',
  // Les AudioWorklets restent de vrais fichiers (2026-10-03) : un petit
  // module serait inline en data: URL, que Safari peut refuser a addModule
  build: {
    assetsInlineLimit: (filePath: string) => (filePath.endsWith('.worklet.js') ? false : undefined),
  },
  server: { port: Number(process.env.PORT) || 5173, open: !process.env.PORT },
  publicDir: 'public'
}))


