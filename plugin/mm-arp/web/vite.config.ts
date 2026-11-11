/**
 * Le build de la face du plugin MM-ARP (2026-11-09) : la machine du site (src/v4), une page (plugin/mm-arp/web/index.html),
 * vers plugin/mm-arp/build-web (embarque dans le VST3, plugin/mm-arp/CMakeLists.txt). Copie adaptee de celui du MM-RYTM
 * (plugin/mm-rytm/web/vite.config.ts) : sans aucun sample (le MM-ARP n'en joue pas ; le module virtual:rytm-samples, que
 * le code du MM-RYTM importe, rend une liste vide), avec les polices de la face et les logos de sa serigraphie.
 * npm run plugin:arp:web
 */
import react from '@vitejs/plugin-react';
import { execFileSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const REPO = resolve(__dirname, '../../..');
const OUT = resolve(__dirname, '../build-web');
const SAMPLE_ID = 'virtual:rytm-samples';
const FONTS = ['RobotRadicals.woff2', 'SF-Pro-Display-Regular.woff2', 'SF-Pro-Display-Medium.woff2', 'SF-Pro-Display-Semibold.woff2', 'SF-Pro-Display-Bold.woff2', 'SF-Pro-Display-Black.woff2'];
// Le wordmark et le logotype serigraphies sur le panneau du MM-ARP (scene/silk.ts whenLogos, theme.ts SILK_LOGOS)
const LOGOS = ['mauditemachine-logotype.svg', 'mauditemachine-logo-aligned.svg'];

/**
 * La version du build (2026-11-11, Mika : "mets a jour le numero a chaque mise a jour, comme ca je saurai si ca a
 * fonctionne") : « VST3 · BUILD 11 NOV 14:32 · a1b2c3d », la date UTC du build et le commit court (git ; sans git : la
 * variable GITHUB_SHA ; sans rien : la date seule). Serigraphiee en haut a droite de la face et dans le REV du panneau
 * du capot (src/v4/firmware.ts ARP_BUILD), et ecrite dans build-web/version.txt (une ligne) pour update.sh et le C++.
 */
function buildVersion(): string {
  const now = new Date();
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const date = `${p2(now.getUTCDate())} ${MONTHS[now.getUTCMonth()]} ${p2(now.getUTCHours())}:${p2(now.getUTCMinutes())}`;
  let sha = '';
  try {
    sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    sha = '';
  }
  if (!/^[0-9a-f]{7,}$/.test(sha)) sha = /^[0-9a-f]{7,}$/i.test(process.env.GITHUB_SHA ?? '') ? (process.env.GITHUB_SHA as string).slice(0, 7).toLowerCase() : '';
  return `VST3 · BUILD ${date}${sha ? ` · ${sha}` : ''}`;
}
const BUILD = buildVersion();

export default defineConfig({
  root: REPO,
  base: '/',
  publicDir: false,
  define: { __MM_ARP_BUILD__: JSON.stringify(BUILD) },
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
        // La version du build, une ligne (update.sh, le C++)
        writeFileSync(resolve(OUT, 'version.txt'), `${BUILD}\n`);
        console.log(`\nMM-ARP ${BUILD}`);
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
