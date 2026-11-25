/**
 * Le navigateur de presets du plugin MM-ARP (v53, l'option C de la maquette, Mika : "je veux pouvoir scroller et choisir
 * en cliquant un preset, mieux vaut avoir plus de choix que pas assez") : PRESET ouvre un grand panneau par-dessus la face
 * (presetPanel.ts, voyager/presetHook.ts).
 *
 * - En haut : PRESETS (l'afficheur a points des ecrans, 'MM Dots'), le nombre de sons, les onglets FACTORY / USER, SAVE et
 *   la croix.
 * - FACTORY : la banque d'usine du VST3 (plugin/mm-arp/presets/factory.json, library.ts), une colonne par famille, lues
 *   telles quelles (LIB_CATS, puis toute famille de la banque qui n'y serait pas) : rien n'est fixe ni au nombre de
 *   familles, ni au nombre de presets. Chaque colonne defile (molette, glisser du trackpad, sa barre a tirer).
 * - USER : les presets du dossier de presets du disque (DiskPresets.tsx, disk.ts : la liste que le C++ envoie, mm_presets),
 *   et ceux gardes dans le projet par l'ecran d'avant v53 (state/presets.ts, s'il y en a) ; SAVE TO DISK et OPEN FROM
 *   DISK a cote.
 * - Un clic charge le preset tout de suite, par le meme chemin que LIBRARY (libLoad, arpBridge.factoryLoad ; le disque :
 *   arpBridge.diskLoad) : une etape d'UNDO, l'arpege continue de jouer, le panneau reste ouvert pour essayer le suivant.
 *   Les reglages de l'instance (QUALITY, ENGINE, LATENCY, la tonalite) ne bougent jamais (factoryLoad, applyExtra).
 * - Clavier (le pont prend le clavier a l'hote tant que le panneau est ouvert : mm_keys) : haut / bas le preset voisin
 *   (charge ; touche tenue, il se charge quand elle s'arrete), gauche / droite la colonne voisine, Entree garde et ferme,
 *   Echap ferme. Un clic hors du panneau ou la croix ferment aussi ; un second appui sur PRESET aussi.
 * - Le preset charge est surligne a l'accent ; c'est le meme que LIBRARY (libStore) et que la liste DISK (arpDisk) : le
 *   dernier charge des trois l'emporte.
 * - Ferme, rien n'est monte (la face au repos, v49) ; ouvert, la scene dessous ne rend plus rien (renderer.ts setCovered).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../../scene/renderer';
import { presets, type Preset } from '../../state/presets';
import { suggestName, typeChars } from '../../state/presetName';
import { undo } from '../../state/undo';
import { voyMsg } from '../../voyager/msg';
import { voyPatch } from '../../voyager/patch';
import { arpBridge } from './bridge';
import { arpDisk, DISK_NAME_MAX, type DiskItem } from './disk';
import { LIB_CATS, LIB_PRESETS, libLoad, libStore, type FactoryPreset } from './library';
import { presetPanel, type PresetTab } from './presetPanel';
import './presetBrowser.css';

/* ---------------- le preset charge : le dernier des trois sources (banque, disque, projet) ---------------- */

type Loaded = { kind: 'factory'; name: string } | { kind: 'disk'; path: string } | { kind: 'project'; id: string };

let loaded: Loaded | null = null;
const loadedListeners = new Set<() => void>();

function setLoaded(l: Loaded): void {
  loaded = l;
  loadedListeners.forEach((fn) => fn());
}

const loadedStore = {
  get: (): Loaded | null => loaded,
  subscribe(fn: () => void): () => void {
    loadedListeners.add(fn);
    return () => {
      loadedListeners.delete(fn);
    };
  },
};

// LIBRARY (OPEN) ou ce panneau : libLoad previent a chaque chargement, meme du preset deja charge
libStore.subscribe(() => {
  const n = libStore.get();
  if (n !== null) setLoaded({ kind: 'factory', name: n });
});
// Le disque : la ligne allumee de DISK (un clic, OPEN FROM DISK, SAVE TO DISK) ; un preset d'usine la remet a null
let seenDisk = arpDisk.get().current;
arpDisk.subscribe(() => {
  const c = arpDisk.get().current;
  if (c === seenDisk) return;
  seenDisk = c;
  if (c !== null) setLoaded({ kind: 'disk', path: c });
});

/** La fenetre rouverte (rien de charge depuis) : le nom en tete du grand ecran, s'il est celui d'un preset d'usine. */
function loadedByName(): Loaded | null {
  const name = voyPatch.label().replace(/\*$/, '');
  return LIB_PRESETS.some((p) => p.name === name) ? { kind: 'factory', name } : null;
}

/* ---------------- les colonnes ---------------- */

interface Row {
  key: string;
  name: string;
  /** a droite de la ligne : le tempo d'un preset d'usine */
  meta: string;
  /** le pied du panneau, au survol */
  info: string;
  title?: string;
  load: () => void;
}

interface Col {
  id: string;
  title: string;
  rows: Row[];
  /** une colonne vide : ce qu'elle dit */
  empty?: string;
}

const sameLoaded = (l: Loaded | null, key: string): boolean =>
  !!l && key === (l.kind === 'factory' ? `f:${l.name}` : l.kind === 'disk' ? `d:${l.path}` : `p:${l.id}`);

/** Les familles : celles de LIB_CATS dans leur ordre, puis toute famille de la banque qui n'y serait pas. */
function factoryCols(): Col[] {
  const cats: string[] = LIB_CATS.map(String);
  for (const p of LIB_PRESETS) if (!cats.includes(String(p.cat))) cats.push(String(p.cat));
  return cats
    .map((c) => ({
      id: `f:${c}`,
      title: c,
      rows: LIB_PRESETS.filter((p) => String(p.cat) === c).map(
        (p: FactoryPreset): Row => ({
          key: `f:${p.name}`,
          name: p.name,
          meta: Number.isFinite(p.bpm) ? String(p.bpm) : '',
          info: [String(p.cat), Number.isFinite(p.bpm) ? `${p.bpm} BPM` : '', p.desc].filter(Boolean).join(' · '),
          title: p.desc,
          load: () => libLoad(p),
        })
      ),
    }))
    .filter((c) => c.rows.length > 0);
}

function loadProject(p: Preset): void {
  undo.boundary('voy', 'preset');
  if (!presets.load('voy', p.id)) return;
  setLoaded({ kind: 'project', id: p.id });
  voyMsg.show(`LOADED ${presets.label(p).toUpperCase()}`, 1800);
}

function userCols(items: readonly DiskItem[] | null, mine: readonly Preset[]): Col[] {
  const disk: Col = {
    id: 'u:disk',
    title: 'ON DISK',
    rows: (items ?? []).map((it) => ({
      key: `d:${it.path}`,
      name: it.name.toUpperCase(),
      meta: '',
      info: 'ON DISK · THE MM-ARP PRESETS FOLDER',
      title: it.path,
      load: () => arpBridge.diskLoad(it.path),
    })),
    empty: items === null ? '…' : 'NO PRESET SAVED YET',
  };
  if (mine.length === 0) return [disk];
  const proj: Col = {
    id: 'u:proj',
    title: 'IN THIS PROJECT',
    rows: mine.map((p) => ({
      key: `p:${p.id}`,
      name: presets.label(p).toUpperCase(),
      meta: '',
      info: 'SAVED IN THIS ABLETON PROJECT (THE SCREEN PRESETS OF EARLIER VERSIONS)',
      load: () => loadProject(p),
    })),
  };
  return [disk, proj];
}

/** Le nom propose par SAVE : celui du preset charge, sinon un nom au hasard (le dialogue de SAVE TO DISK le montre). */
function proposedName(l: Loaded | null): string {
  let base = '';
  if (l?.kind === 'factory') base = l.name;
  else if (l?.kind === 'disk') base = arpDisk.get().items?.find((i) => i.path === l.path)?.name ?? '';
  else if (l?.kind === 'project') {
    const p = presets.of('voy').find((x) => x.id === l.id);
    base = p ? (p.name ?? '') : '';
  }
  return typeChars(base.trim(), DISK_NAME_MAX) || suggestName();
}

/* ---------------- la geometrie (la maquette C : une fenetre de 1496 x 957) ---------------- */

const REF_W = 1496;
const PANEL = { x: 70, top: 96, bottom: 61 } as const;
/** La hauteur d'une ligne (presetBrowser.css .mm-pb-row) */
const ROW_H = 25;
/** La touche tenue : le preset se charge quand elle s'arrete */
const REPEAT_MS = 160;
/** Le panneau pose (son apparition) : la scene dessous s'arrete */
const COVER_MS = 180;

function useFit(): { k: number; h: number } {
  const read = (): { k: number; h: number } => {
    if (typeof window === 'undefined') return { k: 1, h: 957 };
    const k = window.innerWidth / REF_W;
    return { k, h: window.innerHeight / k };
  };
  const [fit, setFit] = useState(read);
  useLayoutEffect(() => {
    const on = (): void => setFit(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return fit;
}

const isTyping = (): boolean => {
  const a = document.activeElement;
  return a instanceof HTMLElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
};

/* ---------------- une colonne qui defile, sa barre ---------------- */

const ScrollCol: React.FC<{
  col: Col;
  loaded: Loaded | null;
  cursor: string | null;
  listRef: (el: HTMLUListElement | null) => void;
  onHover: (r: Row | null) => void;
  onPick: (r: Row) => void;
}> = ({ col, loaded: l, cursor, listRef, onHover, onPick }) => {
  const list = useRef<HTMLUListElement | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLElement>(null);

  const sync = (): void => {
    const el = list.current;
    const b = bar.current;
    const t = thumb.current;
    if (!el || !b || !t) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      b.dataset.none = '1';
      return;
    }
    delete b.dataset.none;
    const th = Math.max(28, (clientHeight * clientHeight) / scrollHeight);
    const top = ((clientHeight - th) * scrollTop) / (scrollHeight - clientHeight);
    t.style.height = `${th}px`;
    t.style.transform = `translateY(${top}px)`;
  };

  useLayoutEffect(sync);

  // La barre : le pouce se tire ; un clic a cote tourne une page
  const onBarDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = list.current;
    const b = bar.current;
    const t = thumb.current;
    if (!el || !b || !t || e.button !== 0) return;
    e.preventDefault();
    // L'echelle du panneau (transform) : un pixel de l'ecran en pixels du panneau
    const k = b.getBoundingClientRect().height / Math.max(1, b.offsetHeight);
    if (e.target !== t) {
      const r = t.getBoundingClientRect();
      el.scrollTop += (e.clientY < r.top ? -1 : 1) * el.clientHeight * 0.9;
      return;
    }
    const y0 = e.clientY;
    const s0 = el.scrollTop;
    const span = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - t.offsetHeight);
    b.setPointerCapture(e.pointerId);
    b.dataset.drag = '1';
    const move = (ev: PointerEvent): void => {
      el.scrollTop = s0 + ((ev.clientY - y0) / k) * span;
    };
    const up = (): void => {
      delete b.dataset.drag;
      b.removeEventListener('pointermove', move);
      b.removeEventListener('pointerup', up);
      b.removeEventListener('pointercancel', up);
    };
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  };

  return (
    <section className="mm-pb-col" aria-label={col.title}>
      <header className="mm-pb-colhd">
        <b>{col.title}</b>
        <span>{col.rows.length}</span>
      </header>
      <div className="mm-pb-wrap">
        <ul
          className="mm-pb-list"
          ref={(el) => {
            list.current = el;
            listRef(el);
          }}
          onScroll={sync}
        >
          {col.rows.length === 0 && col.empty ? <li className="mm-pb-empty">{col.empty}</li> : null}
          {col.rows.map((r) => {
            const on = sameLoaded(l, r.key);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  className="mm-pb-row"
                  data-key={r.key}
                  data-on={on ? '1' : undefined}
                  data-cur={cursor === r.key && !on ? '1' : undefined}
                  aria-current={on ? 'true' : undefined}
                  title={r.title}
                  onPointerEnter={() => onHover(r)}
                  onPointerLeave={() => onHover(null)}
                  onClick={() => onPick(r)}
                >
                  <span className="mm-pb-name">{r.name}</span>
                  {r.meta ? <span className="mm-pb-meta">{r.meta}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mm-pb-bar" ref={bar} data-none="1" aria-hidden="true" onPointerDown={onBarDown}>
          <i ref={thumb} />
        </div>
      </div>
    </section>
  );
};

/* ---------------- le panneau ---------------- */

const Chip: React.FC<{ on?: boolean; label: string; onClick: () => void; aria?: string }> = ({ on, label, onClick, aria }) => (
  <button type="button" className="mm-pb-chip" data-on={on ? '1' : undefined} aria-pressed={on === undefined ? undefined : on} aria-label={aria} onClick={onClick}>
    {label}
  </button>
);

const Panel: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const { tab } = useSyncExternalStore(presetPanel.subscribe, presetPanel.get, presetPanel.get);
  const disk = useSyncExternalStore(arpDisk.subscribe, arpDisk.get, arpDisk.get);
  const presetsAll = useSyncExternalStore(presets.subscribe, presets.get, presets.get);
  const ld = useSyncExternalStore(loadedStore.subscribe, loadedStore.get, loadedStore.get);
  const l = useMemo(() => ld ?? loadedByName(), [ld]);
  const fit = useFit();
  const [hover, setHover] = useState<Row | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lists = useRef<Map<string, HTMLUListElement>>(new Map());
  const pending = useRef(0);

  const factory = useMemo(factoryCols, []);
  const mine = presetsAll.voy;
  const user = useMemo(() => userCols(disk.items, mine), [disk.items, mine]);
  const cols = tab === 'factory' ? factory : user;
  const nFactory = LIB_PRESETS.length;
  const nUser = (disk.items?.length ?? 0) + mine.length;
  // La grille : autant de places que de familles d'usine (au moins quatre), les colonnes de USER a la meme largeur
  const places = Math.max(4, factory.length);

  // Le dossier des presets a jour a l'ouverture (le nombre de USER aussi)
  useEffect(() => {
    arpBridge.diskList();
  }, []);

  // Le panneau pose, la scene dessous ne rend plus rien ; il part, elle se redessine aussitot
  useEffect(() => {
    if (!stage) return undefined;
    const t = window.setTimeout(() => stage.setCovered(true), COVER_MS);
    return () => {
      window.clearTimeout(t);
      stage.setCovered(false);
    };
  }, [stage]);

  // Le clavier va au panneau ; il revient ou il etait a la fermeture
  useLayoutEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.current?.focus({ preventScroll: true });
    return () => {
      if (pending.current) window.clearTimeout(pending.current);
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, []);

  // A l'ouverture et a chaque onglet : chaque colonne montre son preset charge (au milieu), sinon son debut
  useLayoutEffect(() => {
    for (const c of cols) {
      const el = lists.current.get(c.id);
      if (!el) continue;
      const i = c.rows.findIndex((r) => sameLoaded(l, r.key));
      el.scrollTop = i < 0 ? 0 : Math.max(0, i * ROW_H - (el.clientHeight - ROW_H) / 2);
    }
    setCursor(null);
    setHover(null);
  }, [tab]);

  // Le curseur du clavier toujours visible dans sa colonne
  useLayoutEffect(() => {
    if (!cursor) return;
    for (const c of cols) {
      const i = c.rows.findIndex((r) => r.key === cursor);
      const el = lists.current.get(c.id);
      if (i < 0 || !el) continue;
      const row = el.querySelectorAll<HTMLElement>('.mm-pb-row')[i];
      if (!row) return;
      const top = row.offsetTop;
      if (top < el.scrollTop) el.scrollTop = top - 4;
      else if (top + row.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + row.offsetHeight - el.clientHeight + 4;
      return;
    }
  }, [cursor]);

  // Le clavier : haut / bas, gauche / droite, Entree, Echap (avant hooks/useKeys.ts : en capture)
  const live = useRef({ cols, l, cursor });
  live.current = { cols, l, cursor };
  useEffect(() => {
    const pick = (r: Row, now: boolean): void => {
      setCursor(r.key);
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = 0;
      if (now) r.load();
      else
        pending.current = window.setTimeout(() => {
          pending.current = 0;
          r.load();
        }, REPEAT_MS);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || arpDisk.get().naming !== null || isTyping()) return;
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        presetPanel.close();
        return;
      }
      const { cols: cs, l: ld, cursor: cur } = live.current;
      const full = cs.filter((c) => c.rows.length > 0);
      const at = (key: string | null): { c: number; r: number } | null => {
        if (!key) return null;
        for (let c = 0; c < full.length; c += 1) {
          const r = full[c].rows.findIndex((x) => x.key === key);
          if (r >= 0) return { c, r };
        }
        return null;
      };
      const loadedKey = ld ? (ld.kind === 'factory' ? `f:${ld.name}` : ld.kind === 'disk' ? `d:${ld.path}` : `p:${ld.id}`) : null;
      const here = at(cur) ?? at(loadedKey);
      if (k === 'Enter' || k === 'NumpadEnter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (pending.current && here) {
          window.clearTimeout(pending.current);
          pending.current = 0;
          full[here.c].rows[here.r].load();
        }
        presetPanel.close();
        return;
      }
      if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (full.length === 0) return;
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        // La banque a la suite, colonne apres colonne (l'ordre de PREV / NEXT de LIBRARY : library.ts libStep)
        const flat = full.flatMap((c) => c.rows);
        const i = here ? full.slice(0, here.c).reduce((n, c) => n + c.rows.length, 0) + here.r : -1;
        const d = k === 'ArrowDown' ? 1 : -1;
        const j = i < 0 ? (d > 0 ? 0 : flat.length - 1) : (i + d + flat.length) % flat.length;
        pick(flat[j], !e.repeat);
        return;
      }
      const d = k === 'ArrowRight' ? 1 : -1;
      const c = here ? (here.c + d + full.length) % full.length : d > 0 ? 0 : full.length - 1;
      const rows = full[c].rows;
      pick(rows[Math.min(here ? here.r : 0, rows.length - 1)], !e.repeat);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const onPick = (r: Row): void => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = 0;
    setCursor(r.key);
    r.load();
  };

  const loadedRow = (): Row | null => {
    for (const c of [...factory, ...user]) {
      const r = c.rows.find((x) => sameLoaded(l, x.key));
      if (r) return r;
    }
    return null;
  };
  const shown = hover ?? loadedRow();
  const save = (): void => {
    presetPanel.setTab('user');
    arpDisk.set({ naming: proposedName(l) });
  };

  const h = Math.max(320, fit.h - PANEL.top - PANEL.bottom);
  return (
    <div className="mm-pb" style={{ position: 'fixed' }} data-tab={tab}>
      <div className="mm-pb-back" aria-hidden="true" onClick={() => presetPanel.close()} />
      <div className="mm-pb-page" style={{ width: REF_W, height: fit.h, transform: `scale(${fit.k})` }}>
        <div
          ref={root}
          className="mm-pb-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Presets"
          tabIndex={-1}
          style={{ left: PANEL.x, top: PANEL.top, width: REF_W - 2 * PANEL.x, height: h }}
        >
          <div className="mm-pb-head">
            <b className="mm-pb-title">PRESETS</b>
            <span className="mm-pb-count">{tab === 'factory' ? `FACTORY · ${nFactory} SOUNDS` : `USER · ${nUser} ${nUser === 1 ? 'PRESET' : 'PRESETS'}`}</span>
            <span className="mm-pb-tabs" role="group" aria-label="Bank">
              {(['factory', 'user'] as PresetTab[]).map((t) => (
                <Chip key={t} on={tab === t} label={t.toUpperCase()} onClick={() => presetPanel.setTab(t)} />
              ))}
            </span>
            <span className="mm-pb-tools">
              <Chip label="SAVE" aria="Save the current sound to disk" onClick={save} />
              <button type="button" className="mm-pb-x" aria-label="Close the presets" title="Close" onClick={() => presetPanel.close()}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5" />
                </svg>
              </button>
            </span>
          </div>
          <div className="mm-pb-cols" style={{ gridTemplateColumns: `repeat(${places}, minmax(0, 1fr))` }}>
            {cols.map((c) => (
              <ScrollCol
                key={c.id}
                col={c}
                loaded={l}
                cursor={cursor}
                listRef={(el) => {
                  if (el) lists.current.set(c.id, el);
                  else lists.current.delete(c.id);
                }}
                onHover={setHover}
                onPick={onPick}
              />
            ))}
            {tab === 'user' ? (
              <aside className="mm-pb-side" style={{ gridColumn: `span ${Math.max(1, places - cols.length)}` }}>
                <p className="mm-pb-side-t">YOUR PRESETS</p>
                <p>SAVE keeps the sound you hear in the MM-ARP presets folder on your disk, under the name you choose. It shows up here, in every project.</p>
                <p>OPEN FROM DISK opens a preset from anywhere else (a .mmarp file).</p>
                <span className="mm-pb-side-keys">
                  <Chip label="SAVE TO DISK" onClick={save} />
                  <Chip label="OPEN FROM DISK" onClick={() => arpBridge.diskOpen()} />
                </span>
              </aside>
            ) : null}
          </div>
          <div className="mm-pb-foot">
            <p className="mm-pb-info" role="status" aria-live="polite">
              {shown ? (
                <>
                  <b>{shown.name}</b>
                  <span>{shown.info}</span>
                </>
              ) : (
                <span>PICK A SOUND : IT LOADS AT ONCE, THE ARPEGGIO KEEPS PLAYING. UNDO BRINGS YOUR SOUND BACK.</span>
              )}
            </p>
            <p className="mm-pb-hint">WHEEL : SCROLL · CLICK : LOAD · ↑ ↓ : PREVIOUS / NEXT · ← → : COLUMN · ENTER : KEEP · ESC : CLOSE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Monte seulement ouvert : ferme, rien ne se rend ni n'ecoute (la face au repos). */
export const PresetBrowser: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const open = useSyncExternalStore(presetPanel.subscribe, presetPanel.isOpen, presetPanel.isOpen);
  return open ? <Panel stage={stage} /> : null;
};
