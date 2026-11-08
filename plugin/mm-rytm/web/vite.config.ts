/**
 * Le build de la face du plugin (2026-11-08) : la machine du site (src/v4), une page (plugin/mm-rytm/web/index.html),
 * vers plugin/mm-rytm/build-web (embarque dans le VST3, plugin/mm-rytm/CMakeLists.txt). Les samples ne sont pas copies :
 * le plugin les sert depuis sa banque (src/SampleBank.cpp) ; les polices de la face, si.
 * npm run plugin:web
 */
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const REPO = resolve(__dirname, '../../..');
const OUT = resolve(__dirname, '../build-web');
const SAMPLE_DIR = resolve(REPO, 'public/samples/rytm');
const SAMPLE_EXT = /\.(wav|mp3|ogg|flac|aiff?|m4a)$/i;
const SAMPLE_ID = 'virtual:rytm-samples';
const FONTS = ['RobotRadicals.woff2', 'SF-Pro-Display-Regular.woff2', 'SF-Pro-Display-Medium.woff2', 'SF-Pro-Display-Semibold.woff2', 'SF-Pro-Display-Bold.woff2', 'SF-Pro-Display-Black.woff2'];

function listSamples(): { family: string; file: string }[] {
  if (!existsSync(SAMPLE_DIR)) return [];
  return readdirSync(SAMPLE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(resolve(SAMPLE_DIR, d.name))
        .filter((f) => SAMPLE_EXT.test(f) && !f.startsWith('.'))
        .map((file) => ({ family: d.name, file }))
    );
}

export default defineConfig({
  root: REPO,
  base: '/',
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'rytm-samples',
      resolveId: (id) => (id === SAMPLE_ID ? `\0${SAMPLE_ID}` : undefined),
      load: (id) => (id === `\0${SAMPLE_ID}` ? `export default ${JSON.stringify(listSamples())};` : undefined),
    },
    {
      name: 'plugin-fonts',
      closeBundle() {
        // La page a la racine du build (Vite la place sous son chemin depuis la racine du depot) ; ses liens sont absolus
        const nested = resolve(OUT, 'plugin/mm-rytm/web/index.html');
        if (existsSync(nested)) {
          renameSync(nested, resolve(OUT, 'index.html'));
          rmSync(resolve(OUT, 'plugin'), { recursive: true, force: true });
        }
        mkdirSync(resolve(OUT, 'fonts'), { recursive: true });
        for (const f of FONTS) copyFileSync(resolve(REPO, 'public/fonts', f), resolve(OUT, 'fonts', f));
        // Le logotype serigraphie sur la machine (V.6.4)
        mkdirSync(resolve(OUT, 'logo'), { recursive: true });
        copyFileSync(resolve(REPO, 'public/logo/mauditemachine-logotype.svg'), resolve(OUT, 'logo/mauditemachine-logotype.svg'));
      },
    },
  ],
  build: {
    outDir: OUT,
    emptyOutDir: true,
    // Les AudioWorklets restent de vrais fichiers (comme le site)
    assetsInlineLimit: (filePath: string) => (filePath.endsWith('.worklet.js') ? false : undefined),
    rollupOptions: { input: resolve(__dirname, 'index.html') },
    chunkSizeWarningLimit: 4000,
  },
});
