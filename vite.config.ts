import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
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
  server: { port: Number(process.env.PORT) || 5173, open: !process.env.PORT },
  publicDir: 'public'
}))


