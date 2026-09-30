/**
 * Le jumeau accessible de l'ecran (spec 5.5, 6.3 et 20.3.8) : une region
 * role=status, aria-live polite, visuellement masquee, avec les lignes de
 * l'ecran (state/lcd.ts). Le timecode qui defile n'y figure pas (une
 * annonce par seconde serait du bruit), ni la valeur de l'encodeur qu'on
 * tourne (son jumeau role slider l'annonce deja) ; la section, le tempo,
 * READY / RUN, le titre en cours et les messages passagers s'annoncent.
 */

import React, { useSyncExternalStore } from 'react';
import { lcd } from '../state/lcd';
import { LCD_TEXT } from '../theme';

export const Lcd: React.FC = () => {
  const s = useSyncExternalStore(lcd.subscribe, lcd.get, lcd.get);
  const tail = s.r2 === LCD_TEXT.paused ? ` ${s.r2}` : '';
  const msg = s.l3 && !s.param ? `. ${s.l3}` : '';
  return (
    <div className="v4-sr" role="status" aria-live="polite" aria-atomic="true" data-v4-lcd="">
      {`${s.l1} ${s.r1}. ${s.l2}${tail}${msg}`}
    </div>
  );
};

export default Lcd;
