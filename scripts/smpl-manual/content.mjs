/**
 * Le texte et la mise en page du mode d'emploi du MM-SMPL (2026-10-05) :
 * une page HTML au format A4, ses images (les captures de shots.mjs) et
 * ses polices (Inter, Space Mono, sous licence OFL, du dossier
 * node_modules/@fontsource) dedans ; make.mjs l'imprime en PDF.
 * Tutoiement, francais, jamais de tiret cadratin.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FONTS = [
  ['Inter', 400, '@fontsource/inter/files/inter-latin-400-normal.woff2'],
  ['Inter', 600, '@fontsource/inter/files/inter-latin-600-normal.woff2'],
  ['Inter', 700, '@fontsource/inter/files/inter-latin-700-normal.woff2'],
  ['Inter', 800, '@fontsource/inter/files/inter-latin-800-normal.woff2'],
  ['Space Mono', 400, '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2'],
  ['Space Mono', 700, '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2'],
];

async function fontFaces(root) {
  const out = [];
  for (const [family, weight, file] of FONTS) {
    const b64 = (await readFile(path.join(root, 'node_modules', file))).toString('base64');
    out.push(`@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
  }
  return out.join('\n');
}

/** Les espaces insecables du francais (Quebec) : avant le deux-points, entre un nombre et son unite, dans les guillemets. */
const fr = (s) =>
  s
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1\u2019$2')
    .replace(/ :/g, '&nbsp;:')
    .replace(/« /g, '«&nbsp;')
    .replace(/ »/g, '&nbsp;»')
    .replace(/(\d) (ms|s|Hz|kHz|%|demi-tons?|grains|mesures?|pas|slices|BPM|Mo|Ko)\b/g, '$1&nbsp;$2');

/** Une touche ou un potard de la machine, comme il est ecrit dessus. */
const k = (t) => `<span class="k">${t}</span>`;
const p = (t) => `<span class="p">${t}</span>`;

/** Une image et ses pastilles : [numero, x, y] en parts de l'image. */
function figure(img, { badges = [], caption = '', cls = '' } = {}) {
  if (!img) return '';
  const marks = badges
    .filter((b) => Number.isFinite(b[1]) && Number.isFinite(b[2]))
    .map(([n, x, y]) => `<span class="badge" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%">${n}</span>`)
    .join('');
  return `<figure class="${cls}"><div class="shot"><img src="${img.src}" width="${img.w}" height="${img.h}" alt="">${marks}</div>${caption ? `<figcaption>${fr(caption)}</figcaption>` : ''}</figure>`;
}

/** Un point d'une commande (ses reperes) : c le centre, l le milieu du bord gauche, tl le coin haut gauche ; decale (parts de l'image). */
function at(img, id, dx = 0, dy = 0, edge = 'c') {
  const m = img?.marks?.[id];
  if (!m) return [NaN, NaN];
  const x = edge === 'c' ? m.x + m.w / 2 : m.x;
  const y = edge === 'tl' ? m.y : m.y + m.h / 2;
  return [x + dx, y + dy];
}

/** Un point de l'ecran (u, v : parts de sa largeur et de sa hauteur), dans une capture qui le contient. */
function onScreen(img, u, v) {
  const m = img?.marks?.['smpl-screen'];
  if (!m) return [NaN, NaN];
  return [m.x + m.w * u, m.y + m.h * v];
}

const page = (title, body, n) => `
<section class="page">
  <header class="run"><span>MM-SMPL &middot; MODE D'EMPLOI</span><span>${title}</span></header>
  ${body}
  <footer class="run"><span>mauditemachine.com</span><span>${n}</span></footer>
</section>`;

export async function renderManual({ root, img, date }) {
  const I = img;
  const fonts = await fontFaces(root);
  const pages = [];
  let n = 1;

  /* ---------------- couverture ---------------- */
  pages.push(`
<section class="page cover">
  <div class="kicker">MAUDITE MACHINE STUDIO</div>
  <h1 class="title">MM-SMPL</h1>
  <div class="subtitle">Mode d'emploi</div>
  <p class="tagline">${fr('Sampler, slicer et granulaire. Le poste des sons du MM-STUDIO, dans ton navigateur : coupe une boucle en seize, joue-la, fige-la en nuages de grains, séquence-la avec le MM-RYTM et le MM-ARP.')}</p>
  ${figure(I.cover, { cls: 'hero' })}
  <div class="cover-foot"><span>mauditemachine.com</span><span>${fr(`Version du ${date}`)}</span></div>
</section>`);
  n += 1;

  /* ---------------- en deux minutes ---------------- */
  pages.push(
    page(
      'EN DEUX MINUTES',
      `
<h2>En deux minutes</h2>
<ol class="steps">
  <li>${fr(`Va au MM-SMPL : ${k('SMPL')} en haut à droite, ou les flèches gauche et droite du clavier d'une machine à l'autre.`)}</li>
  <li>${fr(`Mets un son : glisse un fichier audio sur la machine, ou ${k('FILE')}. Tu peux aussi enregistrer ce que joue le site (${k('REC')}) ou envoyer la boucle d'une platine depuis le MIXER du MM-DECKS (${k('LOOP &gt; SMPL')}).`)}</li>
  <li>${fr(`Le son est coupé en 8 slices, une par trig. Tape les trigs 1 à 8, ou au clavier les touches du bas à gauche (Z X C V, A S D F).`)}</li>
  <li>${fr(`${k('SLICES')} change la découpe : 4, 8, 16 parts égales, ou AUTO (sur les coups du son).`)}</li>
  <li>${fr(`${k('MODE')} passe en GRAIN : chaque trig joue un nuage de grains. Tourne ${p('POSITION')}, ${p('SCAN')}, ${p('SIZE')}, ${p('DENSITY')} et ${p('SPRAY')}. Pose le doigt (ou la souris) sur l'écran : un nuage naît sous lui.`)}</li>
  <li>${fr(`${k('RANDOM')} lance une séquence, ${k('EDIT')} la modifie sur les trigs, ${k('PLAY')} la joue, en rythme avec le MM-RYTM et le MM-ARP.`)}</li>
  <li>${fr(`${k('SAVE')} télécharge la région en WAV, à la hauteur choisie.`)}</li>
</ol>
<div class="note">${fr(`Rien ne sort ? Le navigateur attend un premier clic dans la page avant de jouer du son. Ton son reste sur ton appareil : il n'est envoyé nulle part, et il revient à ta prochaine visite.`)}</div>
<h3>Dans ce mode d'emploi</h3>
<ol class="toc">
  <li><span>Le tour de la machine</span><span>3</span></li>
  <li><span>Mettre un son dans la machine</span><span>4</span></li>
  <li><span>Lire et toucher l'écran</span><span>5</span></li>
  <li><span>Découper : le mode SLICE</span><span>6</span></li>
  <li><span>Le mode GRAIN</span><span>7</span></li>
  <li><span>Façonner le son</span><span>9</span></li>
  <li><span>La séquence</span><span>10</span></li>
  <li><span>SAVE, et ce que la machine retient</span><span>11</span></li>
  <li><span>Au téléphone</span><span>12</span></li>
  <li><span>Clavier, MIDI et Roto-Control</span><span>13</span></li>
  <li><span>Si quelque chose ne va pas</span><span>14</span></li>
</ol>`,
      n
    )
  );
  n += 1;

  /* ---------------- le tour ---------------- */
  const O = I.overview;
  pages.push(
    page(
      'LE TOUR DE LA MACHINE',
      `
<h2>Le tour de la machine</h2>
${figure(O, {
  badges: [
    [1, ...at(O, 'smpl-screen', 0.012, 0.03, 'tl')],
    [2, ...at(O, 'smpl-knob-level', -0.05, 0)],
    [3, ...at(O, 'smpl-knob-start', -0.035, -0.07)],
    [4, ...at(O, 'smpl-knob-position', -0.035, 0.07)],
    [5, ...at(O, 'smpl-key-rec', -0.03, -0.055, 'l')],
    [6, ...at(O, 'smpl-key-file', -0.03, -0.055, 'l')],
    [7, ...at(O, 'smpl-key-random', -0.03, -0.055, 'l')],
    [8, ...at(O, 'smpl-pad-1', -0.02, -0.045, 'tl')],
    [9, ...at(O, 'info', -0.022, 0, 'l')],
  ],
  caption: 'Le MM-SMPL au desktop, de face. Au téléphone, la même machine en hauteur (page 12).',
})}
<ol class="legend">
  <li><b>1</b><span>${fr(`<em>L'écran.</em> Le nom du son, sa durée, les réglages en cours, la forme d'onde, les slices numérotées et ce qui joue (page 5).`)}</span></li>
  <li><b>2</b><span>${fr(`${p('LEVEL')} et ${p('PITCH')}, en aluminium : le volume et la hauteur, ceux qu'on tient en jouant.`)}</span></li>
  <li><b>3</b><span>${fr(`La rangée SAMPLE : ${p('START')} et ${p('END')} (la région), ${p('ATTACK')} et ${p('RELEASE')} (l'enveloppe), ${p('FILTER')} en orange (page 9).`)}</span></li>
  <li><b>4</b><span>${fr(`La rangée GRAIN : ${p('POSITION')}, ${p('SCAN')}, ${p('SIZE')}, ${p('DENSITY')}, ${p('SPRAY')}. Elle ne joue qu'en mode GRAIN (page 7).`)}</span></li>
  <li><b>5</b><span>${fr(`Le transport : ${k('REC')}, ${k('PLAY')} (en jaune quand il y a de quoi jouer), ${k('STOP')}.`)}</span></li>
  <li><b>6</b><span>${fr(`Le son : ${k('FILE')}, ${k('SLICES')}, ${k('MODE')}, ${k('REV')} (à l'envers), ${k('LOOP')} (en boucle tant qu'on tient).`)}</span></li>
  <li><b>7</b><span>${fr(`La séquence : ${k('RANDOM')}, ${k('CLEAR')}, ${k('EDIT')}, puis ${k('SAVE')}.`)}</span></li>
  <li><b>8</b><span>${fr(`Les seize trigs, 1 à 8 en haut, 9 à 16 dessous : chacun joue sa slice. Orange pâle : il a une slice ; or : il sonne. En EDIT, ce sont les pas de la séquence.`)}</span></li>
  <li><b>9</b><span>${fr(`${k('INFO')} : ce mode d'emploi.`)}</span></li>
</ol>
<div class="note">${fr(`<b>Tourner un potard :</b> glisse vers le haut ou vers la droite (avec Maj, dix fois plus fin), ou la molette au-dessus de lui. Deux tapes rapides le remettent à sa valeur de départ. L'écran dit toujours sa valeur.`)}</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- un son ---------------- */
  pages.push(
    page(
      'METTRE UN SON',
      `
<h2>Mettre un son dans la machine</h2>
<p class="lead">${fr(`Trois chemins mènent au MM-SMPL. Quel que soit le chemin, le son se pose en entier (60 s au plus), la région le couvre tout, et la découpe se fait aussitôt.`)}</p>
<div class="cols">
  <div>
    <h3>FILE, ou glisser un fichier</h3>
    <p>${fr(`${k('FILE')} ouvre le choix d'un fichier de ton ordinateur ou de ton téléphone. Au desktop, tu peux aussi glisser un fichier audio directement sur la machine.`)}</p>
    <p>${fr(`WAV, AIFF, MP3, M4A, FLAC, OGG : tout ce que ton navigateur sait lire. Un son de plus de 60 s garde son début (l'écran le dit : KEPT THE FIRST 60 S).`)}</p>
    <h3>REC : enregistrer le site</h3>
    <p>${fr(`${k('REC')} enregistre ce que joue le site : le MM-RYTM, le MM-ARP, les platines. L'écran passe au rouge et compte les secondes ; un second ${k('REC')} arrête et pose la prise dans la machine.`)}</p>
    <p class="tip">${fr(`<b>Astuce :</b> lance un rythme sur le MM-RYTM, appuie sur ${k('REC')} juste avant le 1, laisse passer deux mesures, ${k('REC')} de nouveau. Règle ensuite ${p('START')} et ${p('END')} pour tomber pile sur la mesure.`)}</p>
  </div>
  <div>
    <h3>LOOP &gt; SMPL : une boucle des platines</h3>
    <p>${fr(`Sur le MIXER du MM-DECKS, ${k('LOOP &gt; SMPL')} envoie au MM-SMPL la boucle de la platine (sa boucle si elle en a une, sinon la fenêtre autour de la tête de lecture). Le MM-SMPL s'ouvre avec elle.`)}</p>
    ${figure(I.mixer, { caption: 'Le MIXER du MM-DECKS : LOOP > SMPL à côté de ADD DECK.' })}
    <h3>Ton son reste chez toi</h3>
    <p>${fr(`Le dernier son posé est gardé dans ton navigateur, sur cet appareil : il revient à ta prochaine visite, avec sa découpe. Rien n'est envoyé sur internet.`)}</p>
  </div>
</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- l'ecran ---------------- */
  const SC = I.screenSlice;
  pages.push(
    page(
      "L'ÉCRAN",
      `
<h2>Lire et toucher l'écran</h2>
${figure(SC, {
  badges: [
    ['a', ...onScreen(SC, 0.012, 0.072)],
    ['b', ...onScreen(SC, 0.975, 0.072)],
    ['c', ...onScreen(SC, 0.012, 0.18)],
    ['d', ...onScreen(SC, 0.14, 0.305)],
    ['e', ...onScreen(SC, 0.5, 0.92)],
  ],
})}
<ol class="legend alpha">
  <li><b>a</b><span>${fr(`Le nom du son.`)}</span></li>
  <li><b>b</b><span>${fr(`La durée de la région, puis celle du son entier.`)}</span></li>
  <li><b>c</b><span>${fr(`La ligne d'état : le mode (SLICE ou GRAIN), la découpe, PITCH, REV, LOOP (SCAN en GRAIN), EDIT. Allumé en orange : actif. Quand tu tournes un potard ou appuies sur une touche, cette ligne te répond en jaune quelques instants.`)}</span></li>
  <li><b>d</b><span>${fr(`Les slices : un trait orange au début de chacune, et le numéro du trig qui la joue.`)}</span></li>
  <li><b>e</b><span>${fr(`La forme d'onde : la région en or, entre ses deux bornes claires (${p('START')} et ${p('END')}) ; le reste du son en or éteint. Ce qui joue passe dessus en traits fins : jaune pour une slice, cyan pour un nuage.`)}</span></li>
</ol>
<div class="cols">
  <div>
    ${figure(I.screenMessage, { caption: 'FILTER tourné : sa valeur, en jaune.' })}
  </div>
  <div>
    <h3>Toucher l'écran</h3>
    <ul class="dots">
      <li>${fr(`<b>En SLICE</b>, un toucher joue la slice sous le doigt, comme son trig. Glisser dessine une nouvelle région, du point de départ au doigt.`)}</li>
      <li>${fr(`<b>Près d'une borne</b> de la région, tu la prends et la déplaces.`)}</li>
      <li>${fr(`<b>En GRAIN</b>, poser le doigt fait naître un nuage à cet endroit ; il suit le doigt, et s'éteint quand tu le lèves (page 7).`)}</li>
    </ul>
  </div>
</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- SLICE ---------------- */
  pages.push(
    page(
      'LE MODE SLICE',
      `
<h2>Découper : le mode SLICE</h2>
<p class="lead">${fr(`En SLICE, le mode de départ, la région est coupée en parts et chaque trig joue la sienne, du début à la fin. C'est le découpage d'une boucle façon MPC : on rejoue les coups dans un autre ordre.`)}</p>
<div class="cols">
  <div>
    <h3>SLICES : la découpe</h3>
    <p>${fr(`Chaque appui sur ${k('SLICES')} passe à la découpe suivante : 4, 8 et 16 parts égales, puis AUTO. En AUTO, la machine cherche les attaques du son (les coups d'une batterie, les notes d'une basse) et coupe juste avant, jusqu'à 16 slices.`)}</p>
    ${figure(I.screenEight, { caption: 'SLICES 8 : huit parts égales.' })}
  </div>
  <div>
    ${figure(I.screenAuto, { caption: 'SLICES AUTO : une slice par coup de la boucle.' })}
    <h3>La région</h3>
    <p>${fr(`${p('START')} et ${p('END')} choisissent la partie du son qui compte : la découpe se refait dans cette région, tout de suite.`)}</p>
    ${figure(I.screenRegion, { caption: 'START et END resserrés : les 16 slices tiennent dans la région.' })}
  </div>
</div>
<h3>Jouer</h3>
<ul class="dots">
  <li>${fr(`<b>Un trig</b> joue sa slice. Le lâcher l'éteint sur ${p('RELEASE')} : un tap court donne un coup sec, tenir laisse sonner la slice jusqu'au bout.`)}</li>
  <li>${fr(`<b>${k('LOOP')}</b> : la slice tourne en boucle tant que tu tiens son trig (un fondu de 5 ms au point de boucle, pas de clic).`)}</li>
  <li>${fr(`<b>${k('REV')}</b> : tout part à l'envers, y compris ce qui joue déjà.`)}</li>
  <li>${fr(`<b>${k('PLAY')}</b> sans séquence joue la région entière ; un second appui l'arrête.`)}</li>
</ul>`,
      n
    )
  );
  n += 1;

  /* ---------------- GRAIN ---------------- */
  const SG = I.screenGrain;
  pages.push(
    page(
      'LE MODE GRAIN',
      `
<h2>Le mode GRAIN</h2>
<p class="lead">${fr(`Un grain, c'est un tout petit morceau du son (de 10 à 500 ms), adouci au début et à la fin. La machine en joue des dizaines par seconde, qui se chevauchent : un nuage. On peut ainsi figer un instant d'un son, l'étirer, le promener, changer sa hauteur sans changer sa vitesse.`)}</p>
<h3>Trois façons de jouer un nuage</h3>
<ul class="dots">
  <li>${fr(`<b>Les trigs.</b> ${k('MODE')} passe en GRAIN : chaque trig joue un nuage dans sa slice, à ${p('POSITION')}, tant que tu le tiens.`)}</li>
  <li>${fr(`<b>L'écran.</b> Pose le doigt (ou clique et tiens) sur la forme d'onde : un nuage naît sous lui et le suit. Lève le doigt, il s'éteint sur ${p('RELEASE')}.`)}</li>
  <li>${fr(`<b>${k('PLAY')}.</b> Sans séquence, un nuage dans toute la région, à ${p('POSITION')}, jusqu'au prochain appui.`)}</li>
</ul>
${figure(SG, {
  badges: [
    ['f', ...onScreen(SG, 0.02 + 0.96 * 0.34 + 0.02, 0.36)],
    ['g', ...onScreen(SG, 0.045, 0.86)],
  ],
  caption: 'En GRAIN : f, POSITION pour PLAY et le doigt (le pointillé cyan) ; g, POSITION dans chaque slice (une encoche par trig).',
})}
<h3>La rangée GRAIN</h3>
<table class="knobs">
  <tr><th>${p('POSITION')}</th><td>${fr(`Où le nuage prend ses grains : dans la slice pour un trig, dans la région pour PLAY et l'écran. 0 % au début, 100 % à la fin.`)}</td></tr>
  <tr><th>${p('SCAN')}</th><td>${fr(`La tête qui avance. Au milieu, FREEZE : le nuage reste figé. Vers la droite, elle avance de plus en plus vite (1.00X vers les trois quarts : la vitesse d'origine ; 2X à fond) ; vers la gauche, elle recule. Arrivée au bout, elle repart du début : la slice ou la région tourne en boucle.`)}</td></tr>
  <tr><th>${p('SIZE')}</th><td>${fr(`La longueur des grains, de 10 ms à 500 ms. Court : un grain de sable, une texture ; long : un son lisse, presque intact.`)}</td></tr>
  <tr><th>${p('DENSITY')}</th><td>${fr(`Combien de grains par seconde, de 2 à 80. Peu : un nuage qui pétille, rythmique ; beaucoup : une nappe continue.`)}</td></tr>
  <tr><th>${p('SPRAY')}</th><td>${fr(`Le désordre : les grains s'écartent de leur place, s'ouvrent dans l'image stéréo et se désaccordent un peu. À zéro, un nuage net et centré.`)}</td></tr>
</table>`,
      n
    )
  );
  n += 1;

  pages.push(
    page(
      'LE MODE GRAIN',
      `
<h3>Le reste de la machine, en GRAIN</h3>
<ul class="dots">
  <li>${fr(`${p('PITCH')} change la hauteur des grains sans changer la vitesse de ${p('SCAN')} : avec SCAN à 1.00X, la boucle garde son tempo et monte ou descend.`)}</li>
  <li>${fr(`${p('ATTACK')} et ${p('RELEASE')} sont l'enveloppe du nuage entier : il apparaît, il s'efface.`)}</li>
  <li>${fr(`${p('LEVEL')} et ${p('FILTER')} agissent comme en SLICE. ${k('REV')} joue chaque grain à l'envers.`)}</li>
  <li>${fr(`En SLICE, les potards de la rangée GRAIN ne changent rien : l'écran te le rappelle (GRAIN ONLY: PRESS MODE).`)}</li>
</ul>
${figure(I.knobs, { cls: 'narrow', caption: 'La grille de droite : la rangée SAMPLE en haut, la rangée GRAIN dessous.' })}
<h3>Recettes</h3>
<div class="recipes">
  <div><h4>Figer un instant</h4><p>${fr(`SCAN au milieu (FREEZE), SIZE 150 ms, DENSITY 40 grains, SPRAY 10 %. Tiens un trig : sa slice devient une nappe immobile. Joue avec POSITION.`)}</p></div>
  <div><h4>Étirer une boucle</h4><p>${fr(`PLAY, SCAN à 0.50X, SIZE 100 ms, DENSITY 30 grains : la boucle joue deux fois plus lentement, à la même hauteur.`)}</p></div>
  <div><h4>Transposer sans changer le tempo</h4><p>${fr(`SCAN à 1.00X, puis PITCH : +7, -5, +12. La boucle suit le tempo, sa hauteur change.`)}</p></div>
  <div><h4>Une texture</h4><p>${fr(`SIZE 300 ms, DENSITY 60 grains, SPRAY 60 %, un FILTER passe-bas. Pose le doigt sur l'écran et promène-le lentement.`)}</p></div>
  <div><h4>Le bégaiement</h4><p>${fr(`SIZE 20 ms, DENSITY 8 grains, SPRAY 0 : des petits coups secs. Monte DENSITY pour accélérer.`)}</p></div>
  <div><h4>À reculons</h4><p>${fr(`SCAN vers la gauche (-1.00X), REV allumé : la boucle se rembobine, chaque grain à l'envers.`)}</p></div>
</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- faconner ---------------- */
  pages.push(
    page(
      'FAÇONNER LE SON',
      `
<h2>Façonner le son</h2>
<div class="cols narrow-left">
  <div>${figure(I.perf, { caption: 'LEVEL et PITCH, à gauche de l\'écran.' })}</div>
  <div>
<table class="knobs">
  <tr><th>${p('LEVEL')}</th><td>${fr(`Le volume du MM-SMPL. La course suit l'oreille ; à fond, un peu plus que le son d'origine.`)}</td></tr>
  <tr><th>${p('PITCH')}</th><td>${fr(`La hauteur, de -24 à +24 demi-tons, un cran par demi-ton ; 0 au milieu. En SLICE, la vitesse change avec (comme un vinyle) ; en GRAIN, seulement la hauteur.`)}</td></tr>
  <tr><th>${p('START')} ${p('END')}</th><td>${fr(`Le début et la fin de la région, en secondes à l'écran. La découpe se refait dedans ; ce qui joue en GRAIN suit.`)}</td></tr>
  <tr><th>${p('ATTACK')}</th><td>${fr(`La montée du son, de 0.5 ms (une attaque franche) à 1 s (un fondu).`)}</td></tr>
  <tr><th>${p('RELEASE')}</th><td>${fr(`L'extinction au lâcher d'un trig, de PLAY ou du doigt, de 5 ms à 3 s.`)}</td></tr>
  <tr><th>${p('FILTER')}</th><td>${fr(`Au milieu, OFF. Vers la gauche, un passe-bas qui assombrit (de 20 kHz à 200 Hz) ; vers la droite, un passe-haut qui amincit (de 20 Hz à 4 kHz).`)}</td></tr>
</table>
  </div>
</div>
<div class="note">${fr(`Ces réglages valent pour toute la machine, et se retiennent d'une visite à l'autre. Deux tapes sur un potard : sa valeur de départ.`)}</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- sequence ---------------- */
  pages.push(
    page(
      'LA SÉQUENCE',
      `
<h2>La séquence</h2>
<p class="lead">${fr(`Seize pas, une mesure en doubles croches, comme une piste d'Elektron : chaque pas est vide, ou joue une slice. Elle se cale sur le MM-RYTM s'il joue, sinon sur le MM-ARP, sinon sur son propre tempo (celui du MM-RYTM), avec son SWING.`)}</p>
${figure(I.edit, { caption: 'EDIT : les trigs sont les seize pas (les pas pleins allumés), l\'écran montre la suite sous la forme d\'onde.' })}
<div class="cols">
  <div>
    <ul class="dots">
      <li>${fr(`${k('RANDOM')} tire une suite musicale (le 1 toujours sur la première slice, les temps souvent, les autres pas une fois sur deux) et la lance.`)}</li>
      <li>${fr(`${k('PLAY')} joue la séquence s'il y a des pas ; un second appui l'arrête. ${k('STOP')} arrête tout.`)}</li>
      <li>${fr(`${k('CLEAR')} vide la séquence ; si elle jouait, elle continue, vide : tu peux la redessiner en EDIT.`)}</li>
    </ul>
  </div>
  <div>
    <ul class="dots">
      <li>${fr(`${k('EDIT')} fait des trigs les seize pas. Taper un trig pose ou enlève son pas ; glisser vers le haut ou le bas change sa slice (son numéro sur l'écran).`)}</li>
      <li>${fr(`À l'arrêt, régler un pas te fait entendre sa slice.`)}</li>
      <li>${fr(`En GRAIN, chaque pas joue un nuage de sa slice jusqu'au pas suivant.`)}</li>
    </ul>
  </div>
</div>
${figure(I.screenEdit, { cls: 'narrow', caption: 'La bande des seize pas : le numéro de la slice de chaque pas plein ; un trait sous le pas qui joue.' })}`,
      n
    )
  );
  n += 1;

  /* ---------------- SAVE ---------------- */
  pages.push(
    page(
      'SAVE',
      `
<h2>SAVE, et ce que la machine retient</h2>
<div class="cols">
  <div>
    <h3>SAVE</h3>
    <p>${fr(`${k('SAVE')} télécharge la région en WAV : à sa hauteur (${p('PITCH')}, qui change aussi sa durée) et à l'envers si ${k('REV')} est allumé. Le nom dit tout : MM-SMPL, le nom du son, la transposition, REV.`)}</p>
    <p>${fr(`Les effets du moment (LEVEL, FILTER, ATTACK, RELEASE, les grains) ne sont pas dans le fichier : c'est le morceau de son lui-même, prêt pour ton DAW ou une autre machine.`)}</p>
  </div>
  <div>
    <h3>Ce qui reste d'une visite à l'autre</h3>
    <ul class="dots">
      <li>${fr(`Le dernier son posé, dans ton navigateur, sur cet appareil.`)}</li>
      <li>${fr(`La découpe (SLICES), le mode, REV, LOOP.`)}</li>
      <li>${fr(`Les douze potards.`)}</li>
      <li>${fr(`La séquence.`)}</li>
    </ul>
    <p class="tip">${fr(`Navigation privée : tout cela vit le temps de la visite.`)}</p>
  </div>
</div>
${figure(I.keys, { caption: 'Les douze touches : le transport, le son, la séquence et SAVE.' })}`,
      n
    )
  );
  n += 1;

  /* ---------------- telephone ---------------- */
  pages.push(
    page(
      'AU TÉLÉPHONE',
      `
<h2>Au téléphone</h2>
<p class="lead">${fr(`Au téléphone, le MM-SMPL se tient en hauteur : l'écran sur toute la largeur, les douze potards en trois rangées de quatre, les touches en deux rangées de six, les seize trigs dessous. Tout se joue au doigt sur la machine elle-même.`)}</p>
<div class="phones">
  ${figure(I.phoneMachine, { caption: 'La machine.' })}
  ${figure(I.phonePads, { caption: 'Le Dock, PADS.' })}
  ${figure(I.phoneSample, { caption: 'SAMPLE.' })}
  ${figure(I.phoneGrain, { caption: 'GRAIN.' })}
</div>
<p>${fr(`Pour des commandes plus grosses, ouvre le Dock (sa languette, en bas). Il a trois pages :`)}</p>
<ul class="dots">
  <li>${fr(`<b>PADS</b> : les douze touches, la forme d'onde en petit (la région, les slices, ce qui joue), la ligne d'état, puis les seize trigs en gros. En EDIT, ce sont les pas : taper pose ou enlève, glisser vers le haut ou le bas change la slice.`)}</li>
  <li>${fr(`<b>SAMPLE</b> : LEVEL, PITCH, START, END, ATTACK, RELEASE, FILTER.`)}</li>
  <li>${fr(`<b>GRAIN</b> : POSITION, SCAN, SIZE, DENSITY, SPRAY.`)}</li>
</ul>`,
      n
    )
  );
  n += 1;

  /* ---------------- clavier, MIDI ---------------- */
  const cap = (a, b) => `<span class="cap"><b>${a}</b><i>${b}</i></span>`;
  pages.push(
    page(
      'CLAVIER ET MIDI',
      `
<h2>Clavier, MIDI et Roto-Control</h2>
<div class="cols">
  <div>
    <h3>Au clavier</h3>
    <p>${fr(`Quand le MM-SMPL est la machine que tu utilises, les seize touches du bas à gauche du clavier sont les trigs, comme les pads d'une MPC : le trig 1 en bas à gauche. C'est la place qui compte, pas la lettre : en AZERTY, la rangée du bas commence par W.`)}</p>
    <div class="keyboard">
      ${cap('1', '13')}${cap('2', '14')}${cap('3', '15')}${cap('4', '16')}
      ${cap('Q', '9')}${cap('W', '10')}${cap('E', '11')}${cap('R', '12')}
      ${cap('A', '5')}${cap('S', '6')}${cap('D', '7')}${cap('F', '8')}
      ${cap('Z', '1')}${cap('X', '2')}${cap('C', '3')}${cap('V', '4')}
    </div>
    <table class="keys">
      <tr><th>Espace</th><td>${fr(`PLAY (la séquence, la région ou le nuage)`)}</td></tr>
      <tr><th>M</th><td>MODE (SLICE, GRAIN)</td></tr>
      <tr><th>L</th><td>LOOP</td></tr>
      <tr><th>B</th><td>${fr(`REV (à l'envers)`)}</td></tr>
    </table>
    <p class="tip">${fr(`En EDIT, les mêmes touches posent ou enlèvent les pas.`)}</p>
  </div>
  <div>
    <h3>MIDI</h3>
    <p>${fr(`Dans Chrome ou Edge, ${k('MIDI')} en haut de la page, puis CONNECT. Toutes les commandes du MM-SMPL s'assignent : les douze potards, les douze touches, les seize trigs (tenus : un nuage ou une boucle jouent tant que tu tiens).`)}</p>
    <h3>Roto-Control</h3>
    <p>${fr(`Le panneau MIDI propose les six setups du Roto-Control. Celui du MM-SMPL (« MM SMPL (SETUP 15) ») s'importe dans ROTO-SETUP sur le setup 15 :`)}</p>
    <ul class="dots">
      <li>${fr(`<b>Page 1</b> : LEVEL, PITCH, START, END, ATTACK, RELEASE, FILTER.`)}</li>
      <li>${fr(`<b>Page 2</b> : POSITION, SCAN (un cran au milieu : FREEZE), GRAIN SIZE, DENSITY, SPRAY.`)}</li>
      <li>${fr(`<b>Boutons</b> : REC, PLAY, STOP, FILE, SLICES, MODE, REV, LOOP, RANDOM, CLEAR, EDIT, SAVE, PREV et NEXT MACHINE ; puis les seize trigs.`)}</li>
    </ul>
    <p class="tip">${fr(`Tu avais importé une version d'avant ? Importe de nouveau le setup 15 : SCAN y remplace SPREAD.`)}</p>
  </div>
</div>`,
      n
    )
  );
  n += 1;

  /* ---------------- depannage ---------------- */
  pages.push(
    page(
      'SI QUELQUE CHOSE NE VA PAS',
      `
<h2>Si quelque chose ne va pas</h2>
<table class="faq">
  <tr><th>${fr(`Aucun son ne sort.`)}</th><td>${fr(`Clique une fois dans la page : le navigateur attend un premier geste. Vérifie ${p('LEVEL')}, le volume de ton appareil, et qu'un son est bien posé (l'écran n'affiche pas PICK A FILE).`)}</td></tr>
  <tr><th>${fr(`PICK A FILE, REC, OR SEND A LOOP FROM THE MIXER`)}</th><td>${fr(`Il n'y a pas encore de son dans la machine : ${k('FILE')}, un fichier glissé, ${k('REC')} ou ${k('LOOP &gt; SMPL')} sur le MIXER.`)}</td></tr>
  <tr><th>${fr(`Un potard ne change rien.`)}</th><td>${fr(`La rangée GRAIN ne joue qu'en mode GRAIN (${k('MODE')}). L'écran le rappelle : GRAIN ONLY: PRESS MODE.`)}</td></tr>
  <tr><th>THIS FILE DOES NOT DECODE</th><td>${fr(`Ton navigateur ne lit pas ce format. Convertis-le en WAV ou en AIFF (16 ou 24 bits). Les fichiers Apple Lossless et les fichiers protégés ne se lisent pas.`)}</td></tr>
  <tr><th>KEPT THE FIRST 60 S</th><td>${fr(`Le son dépassait 60 s : seul son début est gardé. Coupe ton fichier avant, ou utilise ${p('START')} et ${p('END')}.`)}</td></tr>
  <tr><th>${fr(`Le nuage est trop haché.`)}</th><td>${fr(`Monte ${p('DENSITY')} ou ${p('SIZE')} : les grains se chevauchent et le nuage devient continu.`)}</td></tr>
  <tr><th>${fr(`Mon son a disparu.`)}</th><td>${fr(`Il vit dans le navigateur de cet appareil : un autre navigateur, la navigation privée ou un nettoyage des données du site repartent à vide.`)}</td></tr>
</table>
<div class="end">
  <div class="sig">MAUDITE MACHINE</div>
  <p>${fr(`Le MM-SMPL fait partie du MM-STUDIO, avec le MM-RYTM (la boîte à rythmes), le MM-ARP (le synthé arpégé) et le MM-DECKS (les platines et le MIXER). Tout joue ensemble, au même tempo.`)}</p>
  <p class="url">mauditemachine.com</p>
</div>`,
      n
    )
  );

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>MM-SMPL, mode d'emploi</title>
<style>
${fonts}
@page { size: A4; margin: 0; }
:root {
  --paper: #F6F1E7; --ink: #191919; --mute: #5d574e; --line: rgba(25,25,25,0.16);
  --orange: #FF6A13; --gold: #FFA600; --cyan: #1f8fc2; --night: #141416; --bone: #F6F1E7;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--paper); color: var(--ink); }
body { font-family: 'Inter', sans-serif; font-size: 9.6pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; padding: 19mm 16mm 18mm; overflow: hidden; page-break-after: always; break-after: page; background: var(--paper); }
.page:last-child { page-break-after: auto; break-after: auto; }
.run { position: absolute; left: 16mm; right: 16mm; display: flex; justify-content: space-between; font-family: 'Space Mono', monospace; font-size: 7pt; letter-spacing: 0.12em; color: var(--mute); }
header.run { top: 9mm; border-bottom: 0.4pt solid var(--line); padding-bottom: 2mm; }
footer.run { bottom: 9mm; }
h2 { font-weight: 800; font-size: 21pt; letter-spacing: -0.01em; margin: 0 0 4mm; line-height: 1.1; }
h3 { font-weight: 700; font-size: 11pt; margin: 4.5mm 0 1.6mm; }
h4 { font-weight: 700; font-size: 9.6pt; margin: 0 0 1mm; }
p { margin: 0 0 2.4mm; }
.lead { font-size: 10.6pt; color: #2c2925; margin-bottom: 4mm; }
.k { display: inline-block; font-family: 'Space Mono', monospace; font-weight: 700; font-size: 7.4pt; letter-spacing: 0.08em; color: var(--bone); background: var(--night); border-radius: 1.2mm; padding: 0.2mm 1.4mm; line-height: 1.5; white-space: nowrap; vertical-align: 0.4pt; }
.p { display: inline-block; font-family: 'Space Mono', monospace; font-weight: 700; font-size: 7.4pt; letter-spacing: 0.08em; color: var(--ink); border: 0.6pt solid var(--ink); border-radius: 3mm; padding: 0 1.6mm; line-height: 1.45; white-space: nowrap; vertical-align: 0.4pt; }
figure { margin: 0 0 3.5mm; }
figure.narrow { width: 76%; margin-left: auto; margin-right: auto; }
figure .shot { position: relative; line-height: 0; border-radius: 2mm; overflow: hidden; background: var(--night); }
figure img { display: block; width: 100%; height: auto; }
figcaption { font-size: 7.8pt; color: var(--mute); margin-top: 1.4mm; line-height: 1.4; }
.badge { position: absolute; transform: translate(-50%, -50%); width: 5.6mm; height: 5.6mm; border-radius: 50%; background: var(--orange); color: #fff; font-weight: 800; font-size: 8.4pt; line-height: 5.6mm; text-align: center; box-shadow: 0 0 0 0.7mm rgba(20,20,22,0.85); font-family: 'Inter', sans-serif; }
.legend { list-style: none; padding: 0; margin: 2mm 0 3mm; columns: 2; column-gap: 7mm; }
.legend li { break-inside: avoid; display: flex; gap: 2.4mm; margin-bottom: 2.2mm; }
.legend li > span { flex: 1 1 auto; min-width: 0; }
.legend li b { flex: 0 0 5mm; height: 5mm; border-radius: 50%; background: var(--orange); color: #fff; font-size: 7.6pt; line-height: 5mm; text-align: center; margin-top: 0.3mm; }
.legend.alpha { columns: 1; }
.legend em { font-style: normal; font-weight: 700; }
.note { background: #ebe4d6; border-radius: 2mm; padding: 3mm 4mm; margin: 3mm 0; font-size: 9pt; }
.tip { font-size: 8.8pt; color: #3a362f; border-left: 1mm solid var(--gold); padding-left: 3mm; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.cols.narrow-left { grid-template-columns: 52mm 1fr; }
.steps { padding-left: 6mm; margin: 0 0 3mm; }
.steps li { margin-bottom: 2.6mm; padding-left: 1mm; }
.steps li::marker { font-weight: 800; color: var(--orange); }
.toc { list-style: none; padding: 0; margin: 0; counter-reset: t; }
.toc li { display: flex; justify-content: space-between; border-bottom: 0.4pt solid var(--line); padding: 1.6mm 0; font-weight: 600; }
.toc li span:last-child { font-family: 'Space Mono', monospace; color: var(--mute); }
.dots { padding-left: 4.5mm; margin: 0 0 3mm; }
.dots li { margin-bottom: 1.8mm; }
.dots li::marker { color: var(--orange); }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 3mm; }
table th, table td { text-align: left; vertical-align: top; padding: 1.8mm 2mm; border-bottom: 0.4pt solid var(--line); }
table.knobs th { width: 30mm; white-space: nowrap; }
table.keys th { width: 20mm; font-family: 'Space Mono', monospace; font-size: 8pt; }
table.faq th { width: 52mm; font-weight: 700; font-size: 8.8pt; }
.recipes { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; }
.recipes > div { background: #ebe4d6; border-radius: 2mm; padding: 3mm 3.4mm; }
.recipes p { margin: 0; font-size: 8.8pt; }
.phones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 2mm 0 3mm; }
.phones figure .shot { border-radius: 3mm; }
.keyboard { display: grid; grid-template-columns: repeat(4, 13mm); gap: 1.6mm; margin: 2mm 0 3mm; }
.cap { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 11mm; border-radius: 1.6mm; background: var(--night); color: var(--bone); }
.cap b { font-family: 'Space Mono', monospace; font-size: 9.6pt; line-height: 1.1; }
.cap i { font-style: normal; font-size: 6.6pt; color: var(--gold); letter-spacing: 0.06em; }
.end { margin-top: 8mm; border-top: 0.6pt solid var(--ink); padding-top: 5mm; }
.end .sig { font-family: 'Space Mono', monospace; font-weight: 700; letter-spacing: 0.3em; font-size: 9pt; margin-bottom: 2mm; }
.end .url { font-family: 'Space Mono', monospace; color: var(--orange); font-weight: 700; }
/* couverture */
.cover { background: var(--night); color: var(--bone); padding: 22mm 16mm; }
.cover .kicker { font-family: 'Space Mono', monospace; font-weight: 700; letter-spacing: 0.32em; font-size: 8.4pt; color: var(--gold); }
.cover .title { font-weight: 800; font-size: 64pt; letter-spacing: 0.02em; line-height: 1; margin: 7mm 0 1mm; }
.cover .subtitle { font-weight: 600; font-size: 20pt; color: var(--orange); margin-bottom: 6mm; }
.cover .tagline { font-size: 11pt; max-width: 150mm; color: rgba(246,241,231,0.82); margin-bottom: 9mm; }
.cover figure.hero .shot { border-radius: 3mm; box-shadow: 0 2mm 8mm rgba(0,0,0,0.45); }
.cover .cover-foot { position: absolute; left: 16mm; right: 16mm; bottom: 14mm; display: flex; justify-content: space-between; font-family: 'Space Mono', monospace; font-size: 8pt; letter-spacing: 0.14em; color: rgba(246,241,231,0.6); }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}
