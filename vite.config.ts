import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
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
  server: { port: 5173, open: true },
  publicDir: 'public'
}))


