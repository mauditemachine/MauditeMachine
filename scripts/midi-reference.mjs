#!/usr/bin/env node
/**
 * La reference MIDI du site (2026-10-05, Mika : "pourrais-tu me dire tout le
 * MIDI, comment c'est fait ? avoir une liste pour que je puisse faire mon
 * fichier json pour le Roto"). Lit le VRAI code (midi/targets.ts, midi/roto.ts,
 * les machines chargees a part) dans le site en developpement, et ecrit :
 *
 *   docs/midi/MIDI-roto-reference.md   les regles, les formats, les six setups, tout le catalogue
 *   docs/midi/MIDI-roto-setups.csv     un controle du Roto par ligne (canal, CC, nom, cible)
 *   docs/midi/MIDI-targets.csv         une cible du site par ligne (id, machine, type, crans)
 *   docs/midi/roto/MM <SETUP> (SETUP n).json   les setups pour ROTO-SETUP (2026-10-05, Mika :
 *                                      "donne-moi un json parfait pour mon Roto-Control"), les memes
 *                                      que DOWNLOAD THE 6 SETUPS du panneau MIDI
 *
 *   npm run docs:midi
 *
 * Playwright n'est pas une dependance du site : npm i --no-save playwright
 * (ou PLAYWRIGHT_MODULE et CHROMIUM_PATH vers une installation existante ;
 * SITE_URL=http://localhost:5173 pour un serveur deja lance).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/midi');
const require = createRequire(import.meta.url);

function playwright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean)) {
    try {
      return require(id);
    } catch {
      /* le suivant */
    }
  }
  console.error('Playwright est requis : npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

async function site() {
  if (process.env.SITE_URL) return { url: process.env.SITE_URL.replace(/\/$/, ''), close: async () => undefined };
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: false, open: false, hmr: false } });
  await server.listen();
  return { url: (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5198/').replace(/\/$/, ''), close: () => server.close() };
}

/** Ce que le site sait, lu dans le vrai code (dans la page : le code de dev s'y importe). */
async function readSite(chromium, url) {
  const linux = process.platform === 'linux';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--mute-audio', ...(linux ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${url}/?m=rytm&debug=1&mute=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);
    return await page.evaluate(async () => {
      // Les memes modules que ceux de la page (Vite les date apres une modification a chaud : une autre adresse serait une autre copie)
      const imp = (p) => {
        const e = performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(p));
        return import(e.length ? e[e.length - 1] : p);
      };
      const T = await imp('/src/v4/midi/targets.ts');
      const R = await imp('/src/v4/midi/roto.ts');
      const DL = await imp('/src/v4/state/djload.ts');
      await DL.djLoad.load();
      await new Promise((r) => setTimeout(r, 1500));
      const scopes = ['mm808', 'voy', 'dj', 'global'];
      const targets = scopes.flatMap((s) => T.targetsOf(s).map((t) => ({ id: t.id, scope: t.scope, label: t.label, kind: t.kind, steps: t.steps ?? 0 })));
      const setups = R.rotoSetups().map((s) => ({
        name: s.name,
        slot: s.slot,
        ch: s.ch,
        file: R.rotoFileName(s),
        json: JSON.parse(R.rotoSetupJson(s)),
        knobs: s.knobs.map((c, i) => (c ? { ...c, n: c.n, cc: R.rotoCc(i) } : null)),
        buttons: s.buttons.map((c, i) => (c ? { ...c, cc: R.rotoCc(i) } : null)),
      }));
      return { targets, setups, ccTable: Array.from({ length: 32 }, (_, n) => R.rotoCc(n)) };
    });
  } finally {
    await browser.close();
  }
}

/* ---------------- la mise en page ---------------- */

const COLORS = [
  ['orange', 15],
  ['or', 1],
  ['jaune', 17],
  ['creme', 3],
  ['blanc', 13],
  ['rouge', 14],
  ['vert', 5],
  ['citron', 4],
  ['cyan', 21],
  ['bleu', 22],
  ['violet', 24],
  ['rose', 26],
  ['peche', 29],
  ['LED eteinte', 70],
];
const colorName = (n) => COLORS.find((c) => c[1] === n)?.[0] ?? String(n);
const MACHINE = { mm808: 'MM-RYTM', voy: 'MM-ARP', dj: 'MM-DECKS (table, platines, samplers, effets)', global: 'Partout (navigation)' };
const SCOPE_OF_PREFIX = { rytm: 'mm808', voy: 'voy', dj: 'dj', nav: 'global' };
const KIND = { value: 'valeur 0 a 127', press: 'appui', hold: 'maintenu (appui puis relachement)' };
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const csv = (rows) => rows.map((r) => r.map((c) => (/[",;\n]/.test(String(c ?? '')) ? `"${String(c ?? '').replace(/"/g, '""')}"` : String(c ?? ''))).join(',')).join('\n') + '\n';
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

function describe(c, isButton, byId) {
  const t = byId.get(c.t);
  const label = t?.label ?? '';
  const kind = t?.kind ?? '';
  const way = isButton
    ? c.toggle
      ? 'bascule (la LED suit le site)'
      : kind === 'hold'
        ? 'maintenu'
        : kind === 'value'
          ? 'valeur'
          : 'appui'
    : c.steps && c.steps.length >= 2 && c.steps.length <= 16
      ? `potard a ${c.steps.length} crans`
      : c.center
        ? 'bipolaire, cran au milieu (64)'
        : 'continu';
  return { label, way, steps: c.steps && c.steps.length >= 2 && c.steps.length <= 16 ? c.steps.join(' / ') : '' };
}

function build(data, date) {
  const byId = new Map(data.targets.map((t) => [t.id, t]));
  const inSetups = new Map();
  for (const s of data.setups) {
    s.knobs.forEach((c) => c && (inSetups.get(c.t) ?? inSetups.set(c.t, new Set()).get(c.t)).add(s.name));
    s.buttons.forEach((c) => c && (inSetups.get(c.t) ?? inSetups.set(c.t, new Set()).get(c.t)).add(s.name));
  }
  const L = [];
  L.push('# MM-STUDIO : le MIDI, tout pour faire ton fichier Roto-Control', '');
  L.push(`Genere le ${date} depuis le code du site (\`npm run docs:midi\`) : ${data.targets.length} cibles, ${data.setups.length} setups. Les fichiers CSV a cote (\`MIDI-roto-setups.csv\`, \`MIDI-targets.csv\`) ouvrent dans Numbers ou Excel.`, '');
  L.push('## 1. Comment c\'est fait', '');
  L.push('**Le principe.** Le site ecoute le MIDI du navigateur (Web MIDI : Chrome, Edge, Opera, Firefox ; pas Safari). Panneau MIDI > CONNECT. Chaque message est reconnu par une cle `type:canal:numero` (`cc:1:14` : CC 14 sur le canal 1 ; `note:10:36` ; `pb:2:0` pour le pitch bend). Une cle vise une **cible** du site (un potard, un bouton) par son id (`voy:knob:cutoff`).', '');
  L.push('**D\'ou vient la cible d\'une cle**, dans cet ordre :', '');
  L.push('1. ce que tu as appris (MIDI LEARN, ou un fichier d\'assignations importe) : la machine regardee d\'abord, puis les assignations de partout, puis les autres machines ;');
  L.push('2. sinon la **carte du Roto** (les six setups ci-dessous), si elle est allumee (par defaut oui).', '');
  L.push('**La carte du Roto.**', '');
  L.push('- Un setup par machine, chacun sur son canal : potards sur le canal N, boutons sur le canal N + 8.');
  L.push(`- Le potard ou bouton numero n (0 a 31, quatre pages de huit) envoie le CC **14 + n** (n de 0 a 17), puis **102 + (n - 18)** (n de 18 a 31). Soit : ${data.ccTable.map((cc, n) => `${n}:${cc}`).join(', ')}.`);
  L.push('- Ces CC n\'ont aucun role reserve dans la norme MIDI (ni 0 bank, 1 modulation, 6 et 38 data, 64 pedale, 96 a 101 RPN/NRPN, 120 a 127 messages de canal).');
  L.push('- Ce que dit le fichier JSON, c\'est seulement **canal + CC + nom + couleur + type**. La **cible** (ce que ca pilote) est dans le site : il retrouve la cible avec le canal et le CC. Changer l\'ordre dans le JSON sans changer le site ne deplace donc rien (voir le chapitre 5).', '');
  L.push('**Les valeurs.**', '');
  L.push('- Un potard va de 0 a 127 sur toute sa course. 64 est le neutre exact d\'un potard bipolaire (EQ a 0 dB, filtre ouvert, PITCH, TONE, STRETCH, TUNE, GAIN) : le Roto y met un cran.');
  L.push('- Un selecteur a crans du site est un potard a crans du Roto (hapticMode 1, jusqu\'a 16 crans, noms courts) : le cran i de n correspond a la valeur i/(n-1). Le choix de son du kit compte les echantillons du site : KICK SOUND a 9 crans (909, 808, MM, puis les 6 samples), SNARE SOUND a 7.');
  L.push('- **SAMPLE** (`rytm:enc:vsound`, a droite de VOLUME) choisit le son de la voix selectionnee : son nombre de crans suit la voix (BD 9, SD 7, les autres 3 ; CY et PC n\'ont qu\'un son). Il est donc continu sur le Roto : le site prend le cran le plus proche. La colonne Crans du catalogue donne son nombre pour la voix selectionnee a la generation (BD par defaut).');
  L.push('- Une **action** (RANDOM, CLEAR, OPEN, PLAY d\'une platine...) part au front montant : un CC qui passe au-dessus de 63, ou une note enfoncee. Une action **maintenue** (CUE, boucles, pads des samplers, bends) dure jusqu\'au relachement.');
  L.push('- Un **etat** (RUN, un mute, OSC ON) est une valeur 0 ou 1 : sur le Roto un bouton **bascule** (TOGGLE) dont la LED suit le site. Une note fait basculer un parametre.', '');
  L.push('**Le retour vers le Roto.** Les potards motorises et les LEDs recoivent la valeur du site (meme canal, meme CC) toutes les 50 ms quand elle change (souris, preset, RANDOM, changement de machine), jamais pendant 300 ms apres un geste sur le potard, et un echo qui revient aussitot est ignore. Seulement vers une sortie dont le nom contient « roto », ou un appareil sur lequel tu as appris. Pas de retour pour les boutons d\'action.', '');
  L.push('**FOLLOW.** Toucher un controle d\'un setup montre sa machine : RYTM > MM-RYTM, ARP > MM-ARP, DECK et MIXER > MM-DECKS. LIVE ne change pas de machine.', '');
  L.push('**Retenu** dans le navigateur (`mm.v4.midi.1`) : assignations apprises, appareils, ROTO (la carte), FEEDBACK, FOLLOW.', '');

  L.push('## 2. Le fichier ROTO-SETUP (JSON)', '');
  L.push('Format des exports de ROTO-SETUP (version 1), un fichier par setup, a importer (File > Import) sur le setup choisi avec SEL. Le panneau MIDI du site les telecharge tout faits (DOWNLOAD THE SETUPS), et ils sont aussi dans ce dossier : `docs/midi/roto/` (`MM RYTM (SETUP 11).json`...).', '');
  const ex = data.setups[1];
  const exK = ex.json.knobs[0];
  const exB = ex.json.buttons[0];
  L.push('```json', JSON.stringify({ version: ex.json.version, type: ex.json.type, name: ex.json.name, index: ex.json.index, knobs: [exK], buttons: [exB] }, null, 2), '```', '');
  L.push(
    table(
      ['Champ', 'Sens'],
      [
        ['version, type', '1 et "MIDI" (toujours)'],
        ['name, index', 'nom du setup ; index = numero de SETUP moins 1 (SETUP 12 : 11)'],
        ['controlIndex', 'le controle n, de 0 a 31 (page = n div 8 + 1, position = n mod 8 + 1)'],
        ['controlMode', '0 : CC'],
        ['controlChannel', 'canal MIDI 1 a 16 (potards N, boutons N + 8)'],
        ['controlParam', 'le numero de CC (14 + n, puis 102 + n - 18)'],
        ['nrpnAddress', '0 pour un potard, 65535 pour un bouton (sans objet en CC)'],
        ['minValue, maxValue', '0 et 127 : toute la course'],
        ['controlName', 'nom sur l\'ecran du Roto : 12 caracteres ASCII au plus'],
        ['colorScheme', 'couleur du controle (numero de la palette, tableau plus bas)'],
        ['hapticMode', 'potard : 0 continu, 1 a crans ; bouton : 0 poussoir, 1 bascule'],
        ['hapticIndent1, hapticIndent2', 'potard continu : 64 = un cran au milieu (bipolaire), 255 = aucun'],
        ['hapticSteps, stepNames', 'potard a crans : leur nombre (2 a 16) et leurs 16 noms (12 caracteres)'],
        ['ledOnColor, ledOffColor', 'bouton : couleur allumee (= colorScheme) et eteinte (70)'],
      ]
    ),
    ''
  );
  L.push('Couleurs utilisees (palette du Roto, 83 numeros) :', '', table(['Couleur', 'colorScheme'], COLORS.map((c) => [c[0], c[1]])), '');

  L.push('## 3. Les six setups, controle par controle', '');
  L.push('Le setup conseille sur le Roto (SETUP 11 a 16) laisse les premiers a toi. Un potard et un bouton partagent la meme page : ils vont ensemble.', '');
  L.push(table(['Setup', 'Fichier', 'SETUP', 'Canal potards', 'Canal boutons'], data.setups.map((s) => [s.name, s.file, s.slot, s.ch, s.ch + 8])), '');
  for (const s of data.setups) {
    L.push(`### ${s.name} (SETUP ${s.slot}, potards canal ${s.ch}, boutons canal ${s.ch + 8})`, '');
    const rows = (list, isButton) =>
      list.flatMap((c, n) => {
        if (!c) return [];
        const d = describe(c, isButton, byId);
        return [[n, `${Math.floor(n / 8) + 1}.${(n % 8) + 1}`, isButton ? s.ch + 8 : s.ch, c.cc, c.n, colorName(c.c), c.t, d.label, [d.way, d.steps].filter(Boolean).join(' : ')]];
      });
    const head = ['n', 'Page.pos', 'Canal', 'CC', 'Nom Roto', 'Couleur', 'Cible (id)', 'Ce que ca fait', 'Type'];
    L.push('**Potards**', '', table(head, rows(s.knobs, false)), '', '**Boutons**', '', table(head, rows(s.buttons, true)), '');
  }

  L.push('## 4. Le catalogue complet des cibles', '');
  L.push('Tout ce que le site sait piloter : chaque ligne est une cible assignable (MIDI LEARN, ou le fichier d\'assignations du chapitre 5). La colonne « Dans » dit dans quels setups du Roto elle est deja placee. La cible d\'un id est dans la machine de son prefixe : `rytm:` MM-RYTM (scope `mm808`), `voy:` MM-ARP (`voy`), `dj:` MM-DECKS (`dj`, `dj:smpl:<platine>:` pour le sampler de chaque platine), `nav:` navigation (`global`).', '');
  for (const scope of ['mm808', 'voy', 'dj', 'global']) {
    const list = data.targets.filter((t) => t.scope === scope);
    L.push(`### ${MACHINE[scope]} (scope \`${scope}\`, ${list.length} cibles)`, '');
    L.push(table(['id', 'Nom', 'Type', 'Crans', 'Dans'], list.map((t) => [`\`${t.id}\``, t.label, KIND[t.kind], t.steps || '', [...(inSetups.get(t.id) ?? [])].join(', ')])), '');
  }

  L.push('## 5. Faire ton propre fichier', '');
  L.push('**Voie 1, la plus simple : partir d\'un setup fait.** Panneau MIDI > DOWNLOAD THE 6 SETUPS, tu changes les noms et les couleurs dans le JSON (`controlName`, `colorScheme`), tu importes dans ROTO-SETUP. Ne change pas le canal ni le CC : c\'est eux que le site reconnait. (Apres l\'ajout des samples, retelecharge « MM RYTM (SETUP 11).json » : KICK SOUND a maintenant 9 crans, SNARE SOUND 7.)', '');
  L.push('**Voie 2, ta propre disposition.** Deux fichiers : celui du Roto (canal, CC, nom, couleur : tu l\'ecris comme au chapitre 2) et le fichier d\'assignations du site, qui dit quelle cible va avec quel canal et quel CC.', '');
  L.push('Le fichier d\'assignations (panneau MIDI > EXPORT ou IMPORT) :', '');
  L.push(
    '```json',
    JSON.stringify(
      {
        v: 1,
        maps: {
          voy: { 'cc:7:14': 'voy:knob:cutoff', 'cc:7:15': 'voy:knob:res', 'cc:15:14': 'voy:running' },
          mm808: { 'cc:7:22': 'rytm:enc:swing', 'cc:15:16': 'rytm:random' },
          dj: { 'cc:8:14': 'dj:dj-ch3-fader' },
        },
        devices: [],
      },
      null,
      2
    ),
    '```',
    ''
  );
  L.push('- `maps` : une entree par machine (`mm808`, `voy`, `dj`, `global`) ; chaque ligne est `"cc:CANAL:CC": "id de la cible"`, le canal de 1 a 16. Aussi `note:CANAL:NOTE` et `pb:CANAL:0`.');
  L.push('- La machine d\'une ligne est celle du prefixe de la cible (`rytm:` dans `mm808`, `voy:` dans `voy`, `dj:` dans `dj`, `nav:` dans `global`).');
  L.push('- Une cle vise une seule cible par machine, et une cible n\'a qu\'une seule cle : ne la mets pas deux fois.');
  L.push('- IMPORT **remplace** toutes les assignations du navigateur : exporte d\'abord les tiennes.');
  L.push('- Ce que tu as appris passe avant la carte du Roto : ta disposition l\'emporte sur les six setups, mais des canaux libres (7, 8, 15, 16) evitent tout melange. Tu peux aussi eteindre la carte (la case « ROTO-CONTROL map » du panneau MIDI).');
  L.push('- Dans le JSON du Roto, reutilise ce que fait la carte : potard a crans quand la cible a des crans (colonne Crans), bouton bascule pour un etat (RUN, mutes, OSC ON), cran au milieu (`hapticIndent1: 64`) pour un potard bipolaire.', '');
  L.push('**Pour qu\'un potard motorise suive le site**, la cle doit etre apprise ou dans la carte ; le retour part sur le meme canal et le meme CC, vers une sortie dont le nom contient « roto ».', '');
  L.push('Si tu veux, donne-moi ta disposition (page par page, ce que tu veux sur chaque potard et bouton) : je te genere les deux fichiers, prets a importer.', '');

  const setupsCsv = [['setup', 'slot', 'type', 'n', 'page', 'position', 'canal', 'cc', 'nom_roto', 'couleur', 'cible', 'ce_que_ca_fait', 'comportement', 'crans']];
  for (const s of data.setups) {
    for (const [list, isButton] of [[s.knobs, false], [s.buttons, true]]) {
      list.forEach((c, n) => {
        if (!c) return;
        const d = describe(c, isButton, byId);
        setupsCsv.push([s.name, s.slot, isButton ? 'bouton' : 'potard', n, Math.floor(n / 8) + 1, (n % 8) + 1, isButton ? s.ch + 8 : s.ch, c.cc, c.n, colorName(c.c), c.t, d.label, d.way, d.steps]);
      });
    }
  }
  const targetsCsv = [['id', 'scope', 'machine', 'nom', 'type', 'crans', 'dans_les_setups'], ...data.targets.map((t) => [t.id, t.scope, MACHINE[t.scope], t.label, t.kind, t.steps || '', [...(inSetups.get(t.id) ?? [])].join(' ')])];
  return { md: L.join('\n') + '\n', setupsCsv: csv(setupsCsv), targetsCsv: csv(targetsCsv) };
}

async function main() {
  const { chromium } = playwright();
  const srv = await site();
  let data;
  try {
    data = await readSite(chromium, srv.url);
  } finally {
    await srv.close();
  }
  const date = new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  const out = build(data, date);
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'MIDI-roto-reference.md'), out.md);
  await writeFile(path.join(OUT, 'MIDI-roto-setups.csv'), out.setupsCsv);
  await writeFile(path.join(OUT, 'MIDI-targets.csv'), out.targetsCsv);
  // Les fichiers a importer dans ROTO-SETUP (File > Import, sur le setup choisi avec SEL)
  await mkdir(path.join(OUT, 'roto'), { recursive: true });
  for (const st of data.setups) await writeFile(path.join(OUT, 'roto', st.file), `${JSON.stringify(st.json, null, 2)}\n`);
  console.log(`docs/midi : ${data.targets.length} cibles, ${data.setups.length} setups`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
