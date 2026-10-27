/**
 * Les noms des presets (2026-10-27, la V.4.2, Mika : "je voudrais que la gestion des presets soit plus simple ! et
 * aussi qu'on puisse nommer ses presets ! un nom d'utilisateur 4 lettres et le nom du preset jusqu'a 10 lettres, en
 * mobile et en desktop"). Un preset a toi s'ecrit USER/NAME (MIKA/DEEP KICK), comme l'ecran d'une machine :
 * - l'utilisateur : exactement 4 caracteres, ni le premier ni le dernier un espace (DJ K oui, " MIK" non) ;
 * - le nom : de 1 a 10 caracteres, sans espace au bout, jamais deux espaces de suite ;
 * - les caracteres : A a Z, 0 a 9, l'espace et le tiret ; une minuscule devient sa majuscule, une lettre accentuee sa
 *   lettre (E pour e accent aigu), le reste est refuse.
 * Un preset d'usine garde son nom tel quel (jusqu'a 12 lettres, MONARK DRIVE) et n'a pas d'utilisateur.
 *
 * La migration (un preset garde avant les noms : un nom au hasard, "Hungry Pancake", 9 a 18 lettres en casse mixte) :
 * son nom nettoye s'il tient en 10 et n'est pas deja pris ; sinon coupe a 10 (HUNGRY PAN) s'il n'est pas pris ; sinon
 * USER et un numero (USER 1, USER 2...). L'ancien nom reste dans was ; ses donnees ne bougent pas (il se charge a
 * l'identique) ; son utilisateur reste absent : il s'affiche sous celui de ce navigateur (USER tant qu'il n'est pas
 * choisi). Un nom deja aux regles ne change jamais : la migration est idempotente.
 *
 * Pur, sans import (scripts/presets-name.test.mjs le charge tel quel dans node) : les regles, le libelle, la migration,
 * le nom propose au premier SAVE, l'edition au potard (le repli materiel, facon Elektron : le potard A la lettre, le
 * potard B le curseur).
 */

/** Les caracteres permis, dans l'ordre du potard A (l'espace d'abord, comme une case vide). */
export const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
export const NAME_MAX = 10;
export const USER_LEN = 4;
/** L'utilisateur d'un preset d'avant les noms, tant que ce navigateur n'en a pas choisi. */
export const USER_DEFAULT = 'USER';

const ALLOWED = new Set(NAME_CHARS);

/**
 * Ce qu'on tape, aux regles : les accents retires, en majuscules, les caracteres refuses retires, n au plus. Les espaces
 * restent tels quels (la frappe est en cours : un espace au bout attend le mot suivant).
 */
export function typeChars(raw: string, n: number): string {
  const s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
  let out = '';
  for (const ch of s) {
    if (out.length >= n) break;
    if (ALLOWED.has(ch)) out += ch;
    else if (ch === '_' || ch === '\t') out += ' ';
  }
  return out;
}

/** Un nom aux regles : nettoye, les espaces de suite fondus en un, sans espace au bout, 10 au plus. */
export function cleanName(raw: string): string {
  return typeChars(String(raw ?? '').replace(/\s+/g, ' '), 64)
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trimEnd();
}

/** Le nom est-il aux regles (1 a 10, deja nettoye) ? */
export const nameOk = (s: unknown): s is string => typeof s === 'string' && s.length >= 1 && s.length <= NAME_MAX && cleanName(s) === s;

/** Un utilisateur nettoye (4 au plus, sans espace au bout) ; il n'est bon que s'il en a exactement 4 (userOk). */
export const cleanUser = (raw: string): string => typeChars(raw, USER_LEN).trim().replace(/ {2,}/g, ' ');

/** L'utilisateur est-il aux regles : exactement 4 caracteres, ni le premier ni le dernier un espace, pas deux espaces ? */
export const userOk = (s: unknown): s is string => typeof s === 'string' && /^[A-Z0-9-][A-Z0-9 -]{2}[A-Z0-9-]$/.test(s) && !s.includes('  ');

/** Ce que les regles reprochent (le dialogue et l'ecran le disent) ; '' : bon. */
export function userProblem(s: string): string {
  if (userOk(s)) return '';
  return 'USER: 4 CHARACTERS';
}
export function nameProblem(raw: string): string {
  return nameOk(cleanName(raw)) ? '' : 'NAME: 1 TO 10 CHARACTERS';
}

/** Ce qu'un preset dit de lui pour son libelle. */
export interface Named {
  name: string;
  user?: string;
  factory?: boolean;
}

/**
 * Le libelle d'un preset : MIKA/DEEP KICK (un preset a toi : son utilisateur, ou celui du navigateur s'il est d'avant
 * les noms, USER tant qu'aucun n'est choisi), ACID (un preset d'usine, tel quel).
 */
export function presetLabel(p: Named, browserUser: string | null = null): string {
  const name = String(p.name ?? '').toUpperCase();
  if (p.factory) return name;
  const user = userOk(p.user) ? p.user : userOk(browserUser) ? browserUser : USER_DEFAULT;
  return `${user}/${name}`;
}

/** Un preset tel que la migration le lit (le reste passe tel quel). */
export interface Migratable {
  id: string;
  name: string;
  at: number;
  user?: string;
  was?: string;
  factory?: boolean;
}

/**
 * Le nom d'un preset d'avant les noms (voir plus haut) ; taken : les noms deja pris (ceux deja aux regles, puis ceux
 * donnes avant lui), il y ajoute le sien.
 */
export function migratedName(old: string, taken: Set<string>): string {
  const full = cleanName(String(old ?? '').replace(/\s+/g, ' ').slice(0, 64));
  const whole = typeChars(String(old ?? '').replace(/\s+/g, ' '), 64).replace(/ {2,}/g, ' ').trim();
  // Il tient en entier : lui
  if (whole.length >= 1 && whole.length <= NAME_MAX && !taken.has(whole)) {
    taken.add(whole);
    return whole;
  }
  // Coupe a 10 (sans espace ni tiret au bout)
  const cut = full.replace(/[ -]+$/, '');
  if (cut.length >= 1 && !taken.has(cut)) {
    taken.add(cut);
    return cut;
  }
  for (let n = 1; n < 1000; n += 1) {
    const u = `USER ${n}`;
    if (!taken.has(u)) {
      taken.add(u);
      return u;
    }
  }
  return 'USER';
}

/**
 * La migration d'une liste de presets (ceux d'une machine) : chaque preset a toi dont le nom n'est pas aux regles en
 * recoit un (le plus ancien d'abord : les numeros suivent l'age), l'ancien dans was ; l'ordre de la liste, les ids et
 * les donnees ne bougent pas. changed : au moins un nom a change (la liste est a reecrire).
 */
export function migrateNames<T extends Migratable>(list: readonly T[]): { list: T[]; changed: boolean } {
  const taken = new Set<string>();
  for (const p of list) if (!p.factory && nameOk(p.name)) taken.add(p.name);
  const order = list
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.factory && !nameOk(p.name))
    .sort((a, b) => (a.p.at ?? 0) - (b.p.at ?? 0) || a.i - b.i);
  if (order.length === 0) return { list: [...list], changed: false };
  const out = [...list];
  for (const { p, i } of order) {
    const name = migratedName(p.name, taken);
    out[i] = { ...p, name, ...(p.was === undefined ? { was: String(p.name ?? '') } : {}) };
  }
  return { list: out, changed: true };
}

/* ---------------- le nom propose au premier SAVE ---------------- */

const SHORT_ADJ = [
  'ACID', 'NEON', 'LAZY', 'FUNKY', 'MOODY', 'RUSTY', 'FUZZY', 'SHINY', 'TURBO', 'WILD', 'DISCO', 'LUCKY', 'JAZZY',
  'LUNAR', 'TOXIC', 'HOLY', 'WONKY', 'SALTY', 'DUSTY', 'ROGUE', 'GREASY', 'SPICY', 'FERAL', 'COSMIC', 'VELVET', 'SNEAKY',
];
const SHORT_NOUN = [
  'MOOSE', 'TACO', 'YETI', 'KICK', 'SNARE', 'LASER', 'OTTER', 'GOOSE', 'BAGEL', 'MANGO', 'LLAMA', 'SQUID', 'ROBOT',
  'OWL', 'HIPPO', 'GECKO', 'WIZARD', 'PICKLE', 'NOODLE', 'WAFFLE', 'GROOVE', 'BEAVER', 'LEMUR', 'KEBAB', 'DISCO',
];

/**
 * Un nom drole et court pour un nouveau preset (le premier SAVE le propose, deja selectionne : Entree le garde, une
 * lettre le remplace) : un adjectif et un nom qui tiennent en 10, jamais un nom deja pris. rnd : le hasard (les tests
 * le fixent).
 */
export function suggestName(taken: ReadonlySet<string> = new Set(), rnd: () => number = Math.random): string {
  const pick = (xs: readonly string[]): string => xs[Math.floor(rnd() * xs.length) % xs.length];
  for (let i = 0; i < 60; i += 1) {
    const a = pick(SHORT_ADJ);
    const n = pick(SHORT_NOUN);
    if (a === n) continue;
    const s = `${a} ${n}`;
    if (s.length <= NAME_MAX && !taken.has(s)) return s;
  }
  return nextName('PRESET', taken);
}

/**
 * Le nom d'un preset garde AS NEW depuis base (DEEP KICK) : base s'il est libre, sinon base numerote (ACID 2,
 * DEEP KICK2, HUNGRY PA2), le premier libre.
 */
export function nextName(base: string, taken: ReadonlySet<string>): string {
  const b = cleanName(base) || 'PRESET';
  if (!taken.has(b)) return b;
  const stem = b.replace(/ ?[0-9]+$/, '') || b;
  for (let n = 2; n < 1000; n += 1) {
    const sfx = String(n);
    const s = stem.length + 1 + sfx.length <= NAME_MAX ? `${stem} ${sfx}` : `${stem.slice(0, NAME_MAX - sfx.length).trimEnd()}${sfx}`;
    if (!taken.has(s)) return s;
  }
  return b;
}

/* ---------------- l'edition au potard (le repli materiel) ---------------- */

/**
 * Un nom en cours d'edition : l'utilisateur (4 au plus) et le nom (10 au plus) tels qu'on les tape ou qu'on les tourne
 * (un espace peut attendre au bout), et le curseur du potard B : 0 a 3 l'utilisateur, 4 a 13 le nom (la barre entre les
 * deux n'est pas une case).
 */
export interface NameDraft {
  user: string;
  name: string;
  cursor: number;
}

export const CURSOR_MAX = USER_LEN + NAME_MAX - 1;

/** Le curseur deplace de d cases (potard B), dans les 14 cases. */
export function moveCursor(n: NameDraft, d: number): NameDraft {
  const cursor = Math.max(0, Math.min(CURSOR_MAX, n.cursor + Math.round(d)));
  return cursor === n.cursor ? n : { ...n, cursor };
}

/**
 * La lettre sous le curseur tournee de d crans (potard A) dans NAME_CHARS, en boucle ; une case au-dela du texte se
 * remplit d'espaces jusqu'a elle.
 */
export function turnChar(n: NameDraft, d: number): NameDraft {
  const inUser = n.cursor < USER_LEN;
  const at = inUser ? n.cursor : n.cursor - USER_LEN;
  const max = inUser ? USER_LEN : NAME_MAX;
  const text = (inUser ? n.user : n.name).padEnd(at + 1, ' ').slice(0, max);
  const k = NAME_CHARS.indexOf(text[at]);
  const len = NAME_CHARS.length;
  const next = NAME_CHARS[(((k < 0 ? 0 : k) + Math.round(d)) % len + len) % len];
  const s = (text.slice(0, at) + next + text.slice(at + 1)).replace(/ +$/, '');
  return inUser ? { ...n, user: s } : { ...n, name: s };
}

/** Ce que l'edition donnera a OK : l'utilisateur et le nom aux regles, et ce qui ne va pas ('' : bon). */
export function draftResult(n: NameDraft): { user: string; name: string; problem: string } {
  const user = cleanUser(n.user);
  const name = cleanName(n.name);
  const problem = userProblem(user) || nameProblem(name);
  return { user, name, problem };
}

/** La ligne de l'ecran : USER/NAME aux places du curseur (l'utilisateur sur 4, le nom tel quel), sans rien couper. */
export function draftLine(n: NameDraft): { text: string; at: number } {
  const user = n.user.padEnd(USER_LEN, ' ').slice(0, USER_LEN);
  const name = n.name.padEnd(Math.max(n.name.length, n.cursor >= USER_LEN ? n.cursor - USER_LEN + 1 : 0), ' ');
  const text = `${user}/${name}`;
  return { text, at: n.cursor < USER_LEN ? n.cursor : n.cursor + 1 };
}
