/**
 * Le menu du clic droit sur un pas (le plugin, 2026-11-19, Mika : "quand je fais un clic droit sur un pas je voudrais aussi
 * avoir la possibilite de changer pour que ce pas joue 1x sur 2, 1x sur 4, random, comme Elektron le fait sur ses machines").
 * Le clic droit met toujours le pas en P-LOCK (les potards y ecrivent leurs verrous, actions/locks.ts stepLockRight) ; ce menu
 * s'ouvre a cote, avec les conditions de trig du pas, comme celles des Elektron :
 * - PLAYS, la COND : ALWAYS (aucune), A:B (le pas joue au A-ieme passage de chaque cycle de B : 1:2 un passage sur deux, le
 *   premier ; 2:2 le second...), 1ST (au premier passage seulement), !1ST (jamais au premier) ;
 * - RANDOM, la PROB : le pas joue avec cette chance a chaque passage.
 * Un choix a la fois, comme le potard COND des Elektron (ses % compris) : une COND remet la PROB a 100 %, une PROB remet la COND
 * a NONE. Des verrous du pas (audio/locks.ts cond, prob), que le moteur joue deja (dsp : ck, prob) ; une etape d'UNDO. Un pas
 * vide recoit sa note (une condition sur rien ne s'entendrait pas). Toutes les COND (FILL, PRE, NEI, LST, les !A:B) restent au
 * potard COND de la page TRIG, en P-LOCK. Echap, la croix, un second clic droit : ferme (et sort du P-LOCK).
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { pattern, isOn } from '../audio/pattern';
import { lockOf } from '../audio/locks';
import { CONDS } from '../audio/trig';
import { TRACK_NAMES, trackIndex } from '../audio/tracks';
import { lockTrack } from '../actions/internal/locks';
import { lcdMessage } from '../state/lcdMessage';
import { rytmLock } from '../state/rytmLock';
import { stepMenu } from '../state/stepMenu';
import { undo } from '../state/undo';
import { FONT_DISPLAY, PLUGIN_ACCENT } from '../theme';

const INK = '#F4F1EA';
const RED = '#F0463C';

const condIx = (label: string): number => Math.max(0, CONDS.findIndex((c) => c.label === label));
/** Les COND du menu (les plus jouees) et ce qu'elles font, en clair. */
const PLAYS: readonly { label: string; tip: string }[] = [
  { label: '1:2', tip: 'Plays every other loop: the 1st of every 2' },
  { label: '2:2', tip: 'Plays every other loop: the 2nd of every 2' },
  { label: '1:4', tip: 'Plays once every 4 loops: the 1st' },
  { label: '2:4', tip: 'Plays once every 4 loops: the 2nd' },
  { label: '3:4', tip: 'Plays once every 4 loops: the 3rd' },
  { label: '4:4', tip: 'Plays once every 4 loops: the 4th' },
  { label: '1:8', tip: 'Plays once every 8 loops: the 1st' },
  { label: '8:8', tip: 'Plays once every 8 loops: the 8th' },
  { label: '1ST', tip: 'Plays only the first time the pattern loops' },
  { label: '!1ST', tip: 'Plays every time except the first' },
];
const RANDOM: readonly number[] = [75, 50, 25, 10];

const subscribe = (fn: () => void): (() => void) => {
  const a = stepMenu.subscribe(fn);
  const b = rytmLock.subscribe(fn);
  const c = pattern.subscribe(fn);
  return () => {
    a();
    b();
    c();
  };
};
/** Ce que le menu montre : le pas, sa piste, sa COND et sa PROB ; null : ferme (ou le pas n'est plus en P-LOCK). */
const view = (): string => {
  const m = stepMenu.get();
  const inst = lockTrack();
  if (m.step < 0 || !inst || rytmLock.get().step !== m.step) return '';
  const l = lockOf(pattern.get().locks, inst, m.step);
  return JSON.stringify({ step: m.step, x: m.x, y: m.y, inst, cond: Math.round(Number(l?.cond ?? 0)), prob: Math.round(Number(l?.prob ?? 100)), on: isOn(pattern.get().steps, inst, m.step) });
};

function apply(step: number, cond: number, prob: number, say: string): void {
  const inst = lockTrack();
  if (!inst) return;
  undo.boundary('mm808', 'step');
  // un pas vide recoit sa note : une condition sur rien ne s'entendrait pas
  if ((cond > 0 || prob < 100) && !isOn(pattern.get().steps, inst, step)) pattern.toggle(inst, step);
  if (cond > 0) pattern.setLock(inst, [step], 'cond', cond);
  else pattern.clearLock(inst, [step], 'cond');
  if (prob < 100) pattern.setLock(inst, [step], 'prob', prob);
  else pattern.clearLock(inst, [step], 'prob');
  rytmLock.wrote();
  const name = TRACK_NAMES[trackIndex(inst)] ?? inst;
  lcdMessage.show(`STEP ${String(step + 1).padStart(2, '0')} ${name}: ${say}`, 2200, true);
}

const close = (): void => {
  stepMenu.close();
  rytmLock.leave();
};

const CSS = `
.mm-step{position:fixed;z-index:44;box-sizing:border-box;min-width:21em;padding:.7em .8em .75em;background:#0b0b0d;border:1px solid rgba(244,241,234,.18);border-radius:.6em;box-shadow:0 .8em 2em rgba(0,0,0,.7);font-family:${FONT_DISPLAY};color:${INK};user-select:none;-webkit-user-select:none}
.mm-step-head{display:flex;align-items:baseline;justify-content:space-between;gap:1em;margin-bottom:.45em}
.mm-step-head b{font-size:.95em;font-weight:800;letter-spacing:.16em}
.mm-step-head b i{font-style:normal;color:${PLUGIN_ACCENT}}
.mm-step-x{font:inherit;font-size:.85em;font-weight:800;letter-spacing:.12em;background:none;border:0;color:rgba(244,241,234,.55);cursor:pointer;padding:.1em .2em}
.mm-step-x:hover{color:#fff}
.mm-step h4{margin:.5em 0 .3em;font-size:.72em;font-weight:800;letter-spacing:.18em;color:${PLUGIN_ACCENT}}
.mm-step-row{display:flex;flex-wrap:wrap;gap:.28em}
.mm-step-row button{font:inherit;font-size:.82em;font-weight:700;letter-spacing:.08em;padding:.34em .55em;border-radius:.4em;border:1px solid rgba(244,241,234,.2);background:rgba(244,241,234,.06);color:${INK};cursor:pointer;white-space:nowrap}
.mm-step-row button:hover{border-color:rgba(244,241,234,.5)}
.mm-step-row button[aria-pressed='true']{background:${RED};border-color:${RED};color:#0b0b0c}
.mm-step-foot{margin:.6em 0 0;font-size:.7em;letter-spacing:.06em;color:rgba(244,241,234,.45)}
`;

export const StepMenu: React.FC = () => {
  const raw = useSyncExternalStore(subscribe, view);
  useEffect(() => {
    if (!raw) return undefined;
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [raw]);
  if (!raw) return null;
  const v = JSON.parse(raw) as { step: number; x: number; y: number; inst: string; cond: number; prob: number; on: boolean };
  // a la taille de la fenetre (le plugin s'agrandit) ; pose au-dessus de la touche du pas (les pas sont en bas : le menu ne
  // la couvre jamais, un second clic droit l'atteint), centre sur elle, dans la fenetre
  const em = Math.max(11, Math.min(18, window.innerWidth / 92));
  const w = 23 * em;
  const key = document.querySelector(`.v4-twin[aria-label^="Trig ${v.step + 1},"]`)?.getBoundingClientRect();
  const cx = key ? key.left + key.width / 2 : v.x;
  const above = key ? key.top - 0.5 * em : v.y - 2 * em;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
  const name = TRACK_NAMES[trackIndex(v.inst as never)] ?? v.inst;
  const condLabel = CONDS[v.cond]?.label ?? 'NONE';
  const always = v.cond === 0 && v.prob >= 100;
  return (
    <>
      <style>{CSS}</style>
      <div
        className="mm-step"
        role="dialog"
        aria-label={`Step ${v.step + 1} trig condition`}
        style={{ position: 'fixed', left, top: above, width: w, fontSize: em, transform: 'translateY(-100%)' }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="mm-step-head">
          <b>
            STEP {String(v.step + 1).padStart(2, '0')} <i>{name}</i>
          </b>
          <button type="button" className="mm-step-x" title="Close (Esc): leaves the P-LOCK" onClick={close}>
            ✕
          </button>
        </div>
        <h4>PLAYS</h4>
        <div className="mm-step-row" role="group" aria-label="Trig condition">
          <button type="button" aria-pressed={always} title="Plays every time" onClick={() => apply(v.step, 0, 100, 'ALWAYS')}>
            ALWAYS
          </button>
          {PLAYS.map((p) => (
            <button key={p.label} type="button" aria-pressed={v.cond > 0 && condLabel === p.label} title={p.tip} onClick={() => apply(v.step, condIx(p.label), 100, p.label)}>
              {p.label}
            </button>
          ))}
        </div>
        <h4>RANDOM</h4>
        <div className="mm-step-row" role="group" aria-label="Trig probability">
          {RANDOM.map((pc) => (
            <button key={pc} type="button" aria-pressed={v.cond === 0 && v.prob === pc} title={`Plays with a ${pc} % chance each loop`} onClick={() => apply(v.step, 0, pc, `${pc} %`)}>
              {pc} %
            </button>
          ))}
          {v.cond > 0 && !PLAYS.some((p) => p.label === condLabel) && <button type="button" aria-pressed title="Set with the COND knob">{condLabel}</button>}
          {v.cond === 0 && v.prob < 100 && !RANDOM.includes(v.prob) && <button type="button" aria-pressed title="Set with the PROB knob">{v.prob} %</button>}
        </div>
        <p className="mm-step-foot">{v.on ? 'Knobs: P-LOCK this step. All conditions: TRIG page, COND.' : 'Empty step: a condition adds its trig.'}</p>
      </div>
    </>
  );
};
