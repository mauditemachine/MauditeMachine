/**
 * Le jumeau accessible de l'ecran (spec 5.5, 6.3 et 20.3.8) : une region
 * role=status, aria-live polite, visuellement masquee, avec les lignes de
 * l'ecran (state/lcd.ts). Le timecode qui defile n'y figure pas (une
 * annonce par seconde serait du bruit), ni la valeur de l'encodeur qu'on
 * tourne (son jumeau role slider l'annonce deja) ; la section, le tempo,
 * READY / RUN, le titre en cours et les messages passagers s'annoncent.
 * La vue PAGE du MM-RYTM (2026-10-08, state/rytmPage.ts) s'y ajoute : SRC
 * PAGE, tant que l'ecran la montre (pas en EDIT ni en mode presets) ; le
 * LOCK aussi (2026-10-08) : LOCK STEP 5.
 */

import React, { useSyncExternalStore } from 'react';
import { pageLabel } from '../rytm/pages';
import { editor } from '../state/editor';
import { lcd } from '../state/lcd';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { LCD_TEXT } from '../theme';

export const Lcd: React.FC = () => {
  const s = useSyncExternalStore(lcd.subscribe, lcd.get, lcd.get);
  const rp = useSyncExternalStore(rytmPage.subscribe, rytmPage.get, rytmPage.get);
  const ed = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const lockAt = useSyncExternalStore(rytmLock.subscribe, () => rytmLock.get().step, () => -1);
  const tail = s.r2 === LCD_TEXT.paused ? ` ${s.r2}` : '';
  const msg = s.l3 && !s.param ? `. ${s.l3}` : '';
  const page = (rp.view === 'page' || lockAt >= 0) && !s.keys && ed !== 'mm808' ? `. ${pageLabel(rp.page)} PAGE${lockAt >= 0 ? `. LOCK STEP ${lockAt + 1}` : ''}` : '';
  return (
    <div className="v4-sr" role="status" aria-live="polite" aria-atomic="true" data-v4-lcd="">
      {`${s.l1} ${s.r1}. ${s.l2}${tail}${msg}${page}`}
    </div>
  );
};

export default Lcd;
