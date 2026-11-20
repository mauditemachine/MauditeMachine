/**
 * MAQUETTE v44 : le petit ecran des pages d'effets, du meme style que le grand ecran de la face (voyager/screen.ts :
 * noir profond, os en trois intensites INK / HALF / FAINT, la police d'affichage, peu de mots, des pastilles cernees),
 * en plus petit. Mika (2026-11-20) : "peut-etre faire comme un petit ecran comme l'ecran principal mais en plus petit,
 * ici dans cette fenetre delay".
 *
 * Il montre, comme la page HOME du grand ecran : en tete la lecture, le nom de l'effet, le preset, le tempo ; a gauche
 * la valeur principale en grand (le temps du DELAY, la duree de la reverbe...) ; a droite une fiche de reglages (le nom
 * a gauche en HALF, la valeur a droite en INK) ; en bas le message et la pastille PRESETS. Un potard touche prend la
 * place de la valeur principale (son nom, sa valeur en grand, une barre), comme l'echo d'un potard sur la face.
 */

import React, { useSyncExternalStore } from 'react';
import { hoodLcd } from './pcbui';

export interface MiniLcdProps {
  w: number;
  h: number;
  title: string;
  sub?: string;
  bpm?: number;
  big: string;
  bigUnit?: string;
  bigLabel?: string;
  rows: readonly (readonly [string, string])[];
  msg?: string;
  pill?: string;
  /** les reglages dont l'echo prend la place de la valeur principale (prefixe du nom, DELAY, REVERB...) */
  echoOf?: (name: string) => boolean;
  /** la part (0..1) montree par la barre de la valeur principale */
  bar?: number;
  onPill?: () => void;
}

export const MiniLcd: React.FC<MiniLcdProps> = ({ w, h, title, sub, bpm, big, bigUnit, bigLabel, rows, msg, pill, echoOf, bar, onPill }) => {
  const line = useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
  const echo = line && echoOf && echoOf(line.name) ? line : null;
  return (
    <div className="mm-fx2-lcd" style={{ width: w, height: h }}>
      <div className="mm-fx2-lcd-glass">
        <div className="mm-fx2-lcd-hd">
          <i className="mm-fx2-lcd-play" aria-hidden="true" />
          <b>{title}</b>
          {sub && <span>{sub}</span>}
          {bpm !== undefined && (
            <em>
              {Math.round(bpm)}
              <small>BPM</small>
            </em>
          )}
        </div>
        <div className="mm-fx2-lcd-big">
          <span className="mm-fx2-lcd-blab">{echo ? echo.name : (bigLabel ?? '')}</span>
          <span className="mm-fx2-lcd-bv">{echo ? echo.value.toUpperCase() : big}</span>
          {!echo && bigUnit && <span className="mm-fx2-lcd-bu">{bigUnit}</span>}
          {bar !== undefined && !echo && (
            <span className="mm-fx2-lcd-bar" aria-hidden="true">
              <i style={{ width: `${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%` }} />
            </span>
          )}
        </div>
        <dl className="mm-fx2-lcd-tab">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="mm-fx2-lcd-ft">
          <span>{msg ?? ''}</span>
          {pill && (
            <button type="button" className="mm-fx2-lcd-pill" onClick={onPill}>
              {pill}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
