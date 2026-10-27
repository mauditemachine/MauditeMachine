// Les noms des presets (2026-10-27, la V.4.2) : les regles USER/NAME, le libelle, la migration des presets d'avant,
// le nom propose, l'edition au potard. node, sans dependance : src/v4/state/presetName.ts se charge tel quel (node 22
// efface les types). npm run presets:test
import assert from 'node:assert/strict';
import {
  CURSOR_MAX,
  abbreviate,
  NAME_CHARS,
  cleanName,
  cleanUser,
  draftLine,
  draftResult,
  migrateNames,
  migratedName,
  moveCursor,
  nameOk,
  nextName,
  presetLabel,
  suggestName,
  turnChar,
  typeChars,
  userOk,
} from '../src/v4/state/presetName.ts';

let n = 0;
const test = (name, fn) => {
  fn();
  n += 1;
  console.log(`ok ${n} ${name}`);
};

test('la frappe : majuscules, accents retires, caracteres refuses retires, longueur', () => {
  assert.equal(typeChars('deep kick', 10), 'DEEP KICK');
  assert.equal(typeChars('Éte à Montréal', 10), 'ETE A MONT');
  assert.equal(typeChars('a!b@c#d$', 10), 'ABCD');
  assert.equal(typeChars('mika_', 4), 'MIKA');
  assert.equal(typeChars('x-1 ', 10), 'X-1 ');
  assert.equal(typeChars('😀ok', 10), 'OK');
});

test('le nom : 1 a 10, nettoye, espaces fondus, rien au bout', () => {
  assert.equal(cleanName('  deep   kick  '), 'DEEP KICK');
  assert.equal(cleanName('hungry pancake'), 'HUNGRY PAN');
  assert.equal(cleanName('abcdefghi jk'), 'ABCDEFGHI');
  assert.equal(nameOk('DEEP KICK'), true);
  assert.equal(nameOk('A'), true);
  assert.equal(nameOk('ABCDEFGHIJ'), true);
  assert.equal(nameOk('ABCDEFGHIJK'), false);
  assert.equal(nameOk(''), false);
  assert.equal(nameOk(' DEEP'), false);
  assert.equal(nameOk('DEEP '), false);
  assert.equal(nameOk('DEEP  KICK'), false);
  assert.equal(nameOk('deep'), false);
  assert.equal(nameOk('DÉEP'), false);
  assert.equal(nameOk('ACID-2'), true);
  assert.equal(nameOk(42), false);
});

test("l'utilisateur : exactement 4, ni espace au bout, pas deux espaces", () => {
  assert.equal(userOk('MIKA'), true);
  assert.equal(userOk('DJ K'), true);
  assert.equal(userOk('MM-1'), true);
  assert.equal(userOk('MIK'), false);
  assert.equal(userOk('MIKAS'), false);
  assert.equal(userOk(' MIK'), false);
  assert.equal(userOk('MIK '), false);
  assert.equal(userOk('mika'), false);
  assert.equal(userOk(undefined), false);
  assert.equal(cleanUser('mika'), 'MIKA');
  assert.equal(cleanUser('mi'), 'MI');
  assert.equal(cleanUser('mikael'), 'MIKA');
});

test('le libelle : USER/NAME, le navigateur pour un preset d avant, USER sinon, usine tel quel', () => {
  assert.equal(presetLabel({ name: 'DEEP KICK', user: 'MIKA' }), 'MIKA/DEEP KICK');
  assert.equal(presetLabel({ name: 'DEEP KICK' }, 'ZOE1'), 'ZOE1/DEEP KICK');
  assert.equal(presetLabel({ name: 'DEEP KICK' }), 'USER/DEEP KICK');
  assert.equal(presetLabel({ name: 'DEEP KICK', user: 'bad' }, 'ZOE1'), 'ZOE1/DEEP KICK');
  assert.equal(presetLabel({ name: 'MONARK DRIVE', factory: true }, 'MIKA'), 'MONARK DRIVE');
  assert.equal(presetLabel({ name: 'acid', factory: true }), 'ACID');
});

test('la migration : le nom d avant s il tient, abrege mot par mot sinon, l abrege numerote en dernier', () => {
  const taken = new Set();
  assert.equal(migratedName('Lazy Moose', taken), 'LAZY MOOSE');
  assert.equal(migratedName('Hungry Pancake', taken), 'HNGRY PNCK');
  // Deja pris en entier, deja pris abrege : l'abrege numerote (2026-10-27, la revue : USER 1 avant)
  assert.equal(migratedName('Hungry Pancake', taken), 'HNGRY PNC2');
  assert.equal(migratedName('Lazy Moose', taken), 'LAZY MOSE2');
  // Rien de lisible : USER, puis USER 2
  assert.equal(migratedName('😀😀', taken), 'USER');
  assert.equal(migratedName('😀', taken), 'USER 2');
  // Abrege sans couper un mot au milieu quand les voyelles suffisent (2026-10-27, la revue : MOODY MANG, LAZY PICKL)
  assert.equal(migratedName('Moody Mango', new Set()), 'MOODY MNGO');
  assert.equal(migratedName('Lazy Pickle', new Set()), 'LAZY PCKLE');
  assert.equal(migratedName('Majestic Goblin', new Set()), 'MJSTC GBLN');
  assert.equal(migratedName('Wobbly Llama', new Set()), 'WOBBLY LMA');
  assert.equal(migratedName('Cursed Banana', new Set()), 'CURSED BNA');
});

test('l abrege : voyelles du milieu puis lettres doublees du dernier mot au premier, puis la fin des mots, 3 lettres au moins', () => {
  assert.equal(abbreviate('Gentle Jellyfish'), 'GNTLE JLYF');
  assert.equal(abbreviate('Rubber Taco'), 'RUBBER TCO');
  assert.equal(abbreviate('Suspicious Spaghetti 42'), 'SPC SPG 42');
  assert.equal(abbreviate('DEEP KICK'), 'DEEP KICK');
  assert.equal(abbreviate('DEEP KICK', 8), 'DEEP KCK');
  assert.equal(abbreviate('ABCDEFGHIJKLMNOP'), 'ABCDFGHJKL');
  for (const s of ['Lemurdumpling', 'Croissantplatypus', 'Midnight Spaceship', 'Enormous Croissant', 'Electric Goblin']) {
    const a = abbreviate(s);
    assert.equal(nameOk(a), true, `${s} -> ${a}`);
  }
});

test('la migration d une liste : ids, donnees et ordre intacts, le plus ancien numerote d abord, was garde', () => {
  const data = { steps: { BD: [1, 0, 0, 0] }, bpm: 124 };
  const list = [
    { id: 'c', name: 'Sweaty Goblin 12', at: 30, data },
    { id: 'b', name: 'Sweaty Goblin', at: 20, data: { x: 1 } },
    { id: 'a', name: 'Sweaty Goblin', at: 10, data: { x: 2 } },
    { id: 'f', name: 'ACID', at: 0, data: {}, factory: true },
    { id: 'd', name: 'DEEP KICK', user: 'MIKA', at: 40, data: {} },
  ];
  const { list: out, changed } = migrateNames(list);
  assert.equal(changed, true);
  assert.deepEqual(out.map((p) => p.id), ['c', 'b', 'a', 'f', 'd']);
  const by = Object.fromEntries(out.map((p) => [p.id, p]));
  assert.equal(by.a.name, 'SWETY GBLN');
  assert.equal(by.b.name, 'SWTY GBLN2');
  assert.equal(by.c.name, 'SWT GBL 12');
  assert.equal(by.a.was, 'Sweaty Goblin');
  assert.equal(by.c.was, 'Sweaty Goblin 12');
  assert.equal(by.c.data, data);
  assert.equal(by.a.at, 10);
  assert.equal(by.a.user, undefined);
  // L'usine et un preset deja aux regles ne bougent pas
  assert.equal(by.f, list[3]);
  assert.equal(by.d, list[4]);
  for (const p of out) if (!p.factory) assert.equal(nameOk(p.name), true);
});

test('la migration est idempotente et garde le premier was', () => {
  const list = [
    { id: 'a', name: 'Hungry Pancake', at: 1, data: {} },
    { id: 'b', name: 'Moosetaco', at: 2, data: {} },
  ];
  const once = migrateNames(list).list;
  const twice = migrateNames(once);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.list, once);
  assert.equal(once[1].name, 'MOOSETACO');
  // Un nom remis hors regles (un ancien onglet qui renomme) : migre de nouveau, was reste le premier
  const again = migrateNames([{ ...once[0], name: 'Grumpy Waffle' }]).list[0];
  assert.equal(again.name, 'GRMPY WFLE');
  assert.equal(again.was, 'Hungry Pancake');
});

test('un nom d avant deja aux regles reste le sien, et ne se fait pas prendre par un autre', () => {
  const list = [
    { id: 'x', name: 'Lazy Moosey', at: 1, data: {} },
    { id: 'y', name: 'LAZY MOOSE', at: 2, data: {} },
  ];
  const out = migrateNames(list).list;
  assert.equal(out[1].name, 'LAZY MOOSE');
  assert.equal(out[0].name, 'LAZY MOOSY');
});

test('le nom propose : court, aux regles, jamais pris', () => {
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const taken = new Set();
  for (let i = 0; i < 200; i += 1) {
    const name = suggestName(taken, rnd);
    assert.equal(nameOk(name), true, name);
    assert.equal(taken.has(name), false);
    taken.add(name);
  }
});

test('AS NEW : le nom libre, sinon numerote, jamais un mot coupe au milieu', () => {
  assert.equal(nextName('DEEP KICK', new Set()), 'DEEP KICK');
  assert.equal(nextName('ACID', new Set(['ACID'])), 'ACID 2');
  assert.equal(nextName('ACID', new Set(['ACID', 'ACID 2'])), 'ACID 3');
  assert.equal(nextName('DEEP KICK', new Set(['DEEP KICK'])), 'DEEP KICK2');
  assert.equal(nextName('HUNGRY PAN', new Set(['HUNGRY PAN'])), 'HNGRY PAN2');
  assert.equal(nextName('MOODY MNGO', new Set(['MOODY MNGO'])), 'MODY MNGO2');
  assert.equal(nextName('ACID 2', new Set(['ACID 2'])), 'ACID 3');
  assert.equal(nameOk(nextName('ABCDEFGHIJ', new Set(['ABCDEFGHIJ']))), true);
});

test('le potard A tourne la lettre en boucle, le potard B deplace le curseur dans les 14 cases', () => {
  let d = { user: '', name: '', cursor: 0 };
  d = turnChar(d, 1);
  assert.equal(d.user, 'A');
  d = turnChar(d, -2);
  assert.equal(d.user, '-');
  d = turnChar(d, 1);
  assert.equal(d.user, '');
  d = moveCursor(d, -5);
  assert.equal(d.cursor, 0);
  // Le curseur va jusqu'a une case vide apres le nom, pas plus (jamais deux espaces de suite au potard)
  d = moveCursor(d, 99);
  assert.equal(d.cursor, 4);
  assert.equal(moveCursor({ user: 'MIKA', name: 'ONE', cursor: 7 }, 2).cursor, 8);
  assert.equal(moveCursor({ user: 'MIKA', name: 'ABCDEFGHI', cursor: 4 }, 99).cursor, CURSOR_MAX);
  assert.equal(CURSOR_MAX, 13);
  d = { user: '', name: '', cursor: 0 };
  // Une case au-dela du texte : des espaces jusqu'a elle
  d = { user: 'MIKA', name: 'DEEP', cursor: 4 + 6 };
  d = turnChar(d, NAME_CHARS.indexOf('K'));
  assert.equal(d.name, 'DEEP  K');
  assert.deepEqual(draftResult(d), { user: 'MIKA', name: 'DEEP K', problem: '' });
  assert.deepEqual(draftLine(d), { text: 'MIKA/DEEP  K', at: 11 });
  // Un utilisateur incomplet : OK refuse
  assert.equal(draftResult({ user: 'MI', name: 'X', cursor: 0 }).problem, 'USER: 4 CHARACTERS');
  assert.equal(draftResult({ user: 'MIKA', name: '   ', cursor: 0 }).problem, 'NAME: 1 TO 10 CHARACTERS');
  assert.deepEqual(draftLine({ user: 'MI', name: '', cursor: 1 }), { text: 'MI  /', at: 1 });
});

console.log(`${n} tests, tous bons`);
