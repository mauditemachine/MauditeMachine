/**
 * Le build de la face du plugin MM-ARP (2026-11-09) : la machine du site (src/v4), une page (plugin/mm-arp/web/index.html),
 * vers plugin/mm-arp/build-web (embarque dans le VST3, plugin/mm-arp/CMakeLists.txt). Copie adaptee de celui du MM-RYTM
 * (plugin/mm-rytm/web/vite.config.ts) : sans aucun sample (le MM-ARP n'en joue pas ; le module virtual:rytm-samples, que
 * le code du MM-RYTM importe, rend une liste vide), avec les polices de la face et les logos de sa serigraphie.
 * npm run plugin:arp:web
 */
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const REPO = resolve(__dirname, '../../..');
const OUT = resolve(__dirname, '../build-web');
const SAMPLE_ID = 'virtual:rytm-samples';
const FONTS = ['RobotRadicals.woff2', 'SF-Pro-Display-Regular.woff2', 'SF-Pro-Display-Medium.woff2', 'SF-Pro-Display-Semibold.woff2', 'SF-Pro-Display-Bold.woff2', 'SF-Pro-Display-Black.woff2'];
// Le wordmark et le logotype serigraphies sur le panneau du MM-ARP (scene/silk.ts whenLogos, theme.ts SILK_LOGOS)
const LOGOS = ['mauditemachine-logotype.svg', 'mauditemachine-logo-aligned.svg'];

export default defineConfig({
  root: REPO,
  base: '/',
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'rytm-samples-none',
      resolveId: (id) => (id === SAMPLE_ID ? `\0${SAMPLE_ID}` : undefined),
      load: (id) => (id === `\0${SAMPLE_ID}` ? 'export default [];' : undefined),
    },
    {
      name: 'plugin-fonts',
      closeBundle() {
        // La page a la racine du build (Vite la place sous son chemin depuis la racine du depot) ; ses liens sont absolus
        const nested = resolve(OUT, 'plugin/mm-arp/web/index.html');
        if (existsSync(nested)) {
          renameSync(nested, resolve(OUT, 'index.html'));
          rmSync(resolve(OUT, 'plugin'), { recursive: true, force: true });
        }
        mkdirSync(resolve(OUT, 'fonts'), { recursive: true });
        for (const f of FONTS) copyFileSync(resolve(REPO, 'public/fonts', f), resolve(OUT, 'fonts', f));
        mkdirSync(resolve(OUT, 'logo'), { recursive: true });
        for (const f of LOGOS) copyFileSync(resolve(REPO, 'public/logo', f), resolve(OUT, 'logo', f));
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
