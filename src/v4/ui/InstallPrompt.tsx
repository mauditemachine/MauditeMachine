/**
 * L'invitation "Ajouter a l'ecran d'accueil" (2026-10-04, demande de Mika :
 * "Il est important de proposer d'avoir mauditemachine.com en icone sur
 * iPhone.. par defaut"). Une carte sombre en bas de l'ecran, au-dessus de
 * la zone sure, 4 s apres la fin de l'intro :
 * - iPhone / iPad : iOS n'a pas d'API, la carte decrit le geste en deux
 *   etapes (Partager, puis "Add to Home Screen" ; le libelle suit la langue
 *   du telephone en francais) ; sur iPhone Safari, elle pointe vers le
 *   bouton Partager de la barre du bas ;
 * - Chrome, Edge, Samsung Internet (Android, ordinateur) : un vrai bouton
 *   INSTALL ouvre la fenetre d'installation du navigateur
 *   (beforeinstallprompt, state/install.ts) ; sans cet evenement, rien.
 * Jamais une fois installee (standalone), ni par-dessus une section, le
 * press kit, un editeur, une machine ouverte, la playlist du MM-DECKS ou
 * un Dock deplie : elle s'efface et revient ensuite. Au telephone, tant
 * qu'elle est la, la machine remonte au-dessus d'elle (Stage.setInset, le
 * cadrage des editeurs) : rien n'est cache, et tout revient a la
 * fermeture. La croix (ou Echap) la ferme pour 30 jours. Position fixe en
 * style en ligne (piege connu : .page > * ecrase le fixed des classes).
 * Styles : v4.css, "ecran d'accueil".
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { explode, voyExplode } from '../state/explode';
import { focus, type MachineId } from '../state/focus';
import { IOS, install, isStandalone } from '../state/install';
import { intro } from '../state/intro';
import { useReducedMotion } from '../state/motion';
import { presskit } from '../state/presskit';
import { section } from '../state/section';
import { COARSE_QUERY } from '../theme';

/** Apres la fin de l'intro (ms) : la machine se montre d'abord. */
const DELAY_MS = 4000;
/** Le fondu de sortie (ms), v4.css v4-install-out. */
const LEAVE_MS = 200;
/** L'air entre la machine et la carte, comme ui/editorPanel.ts ; l'en-tete si le selecteur des machines manque. */
const GAP = 12;
const HEAD_PX = 56;

/** Le libelle exact de la feuille Partager d'iOS, dans la langue du telephone. */
const addLabel = (): string => {
  const lang = typeof navigator === 'undefined' ? '' : (navigator.language || '').toLowerCase();
  return lang.startsWith('fr') ? 'Sur l’écran d’accueil' : 'Add to Home Screen';
};

/* ---------- les petites icones (SVG en ligne, trait 1.8 comme le reste de la v4) ---------- */

const svg = {
  viewBox: '0 0 24 24',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** Partager d'iOS : le carre ouvert et la fleche vers le haut. */
const ShareIcon: React.FC = () => (
  <svg {...svg}>
    <path d="M8.5 9.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.5a2 2 0 0 0-2-2h-1.5" />
    <path d="M12 2.8v11.4" />
    <path d="M8.4 6.3 12 2.8l3.6 3.5" />
  </svg>
);

/** "Sur l'ecran d'accueil" : le carre arrondi et son plus. */
const AddIcon: React.FC = () => (
  <svg {...svg}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <path d="M12 8.4v7.2M8.4 12h7.2" />
  </svg>
);

/** Le bouton "..." de Safari 26. */
const MoreIcon: React.FC = () => (
  <svg {...svg} stroke="none" fill="currentColor">
    <circle cx="5.5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="18.5" cy="12" r="1.9" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Une icone dans sa pastille, comme le bouton qu'elle designe ; son nom (s'il n'est pas ecrit a cote) pour les lecteurs d'ecran. */
const Chip: React.FC<{ name?: string; children: React.ReactNode }> = ({ name, children }) => (
  <span className="v4-install-chip">
    {children}
    {name && <span className="v4-sr">{name}</span>}
  </span>
);

/** Un Dock deplie (celui du MM-RYTM ou du MM-ARP) occupe le bas : lu sur le DOM, comme ui/PcbClose.tsx. */
function useDockOpen(active: boolean, machine: string): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const root = document.querySelector('.v4-root');
    if (!root) return undefined;
    const read = (): void => setOpen(root.querySelector('.v4-dock[data-open="1"]') !== null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-open'] });
    return () => mo.disconnect();
  }, [active, machine]);
  return active && open;
}

interface Props {
  /** la scene : au telephone, la machine remonte au-dessus de la carte */
  stage: Stage | null;
  mobile: boolean;
}

export const InstallPrompt: React.FC<Props> = ({ stage, mobile }) => {
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const canPrompt = useSyncExternalStore(install.subscribe, install.canPrompt, install.canPrompt);
  const installed = useSyncExternalStore(install.subscribe, install.installed, install.installed);
  const openSection = useSyncExternalStore(section.subscribe, section.get, section.get);
  const kitOpen = useSyncExternalStore(presskit.subscribe, presskit.get, presskit.get);
  const kitHint = useSyncExternalStore(presskit.subscribe, presskit.hint, presskit.hint);
  const editing = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const hood808 = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const hoodVoy = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const machine = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const reduced = useReducedMotion();

  // Deja installee : jamais ; fermee il y a moins de 30 jours : rien non plus
  const [closed, setClosed] = useState(() => isStandalone() || install.snoozed());
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);

  const kind: 'ios' | 'prompt' | null = IOS ? 'ios' : canPrompt ? 'prompt' : null;
  const wanted = kind !== null && !closed && !installed;

  // Quelques secondes apres la fin de l'intro (le Stage la remet en attente des sa creation : le compte repart)
  useEffect(() => {
    if (!wanted || introState !== 'done') return undefined;
    const t = window.setTimeout(() => setReady(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, [wanted, introState]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const dockOpen = useDockOpen(wanted && ready, machine);
  const busy =
    openSection !== null ||
    kitOpen ||
    kitHint ||
    editing !== null ||
    hood808 !== 'closed' ||
    hoodVoy !== 'closed' ||
    machine === 'dj' ||
    dockOpen;

  const dismiss = useCallback((): void => {
    install.snooze();
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setClosed(true), reduced ? 0 : LEAVE_MS);
  }, [reduced]);

  const onInstall = async (): Promise<void> => {
    const outcome = await install.prompt();
    // Refusee dans la fenetre du navigateur : comme la croix
    if (outcome === 'dismissed') install.snooze();
    setClosed(true);
  };

  const shown = wanted && ready && !busy;
  const cardRef = useRef<HTMLElement>(null);
  const lift: MachineId | null = shown && !leaving && mobile && stage && (machine === 'mm808' || machine === 'voy') ? machine : null;

  // Au telephone : le cadrage de la machine tient entre le selecteur des machines et la carte (200 ms)
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!lift || !el || !stage) return undefined;
    const apply = (): void => {
      // offsetHeight et bottom : sans la translation de l'animation d'entree
      const bottom = parseFloat(window.getComputedStyle(el).bottom) || 0;
      const sw = document.querySelector('.v4-mswitch');
      const top = sw ? sw.getBoundingClientRect().bottom + GAP / 2 : HEAD_PX;
      stage.setInset(lift, el.offsetHeight + bottom + GAP, top);
    };
    apply();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      // Un editeur qui s'ouvre pose son propre cadrage : on ne l'efface pas
      if (editor.get() === null) stage.setInset(lift, 0);
    };
  }, [lift, stage]);

  if (!shown) return null;

  const desk = kind === 'prompt' && typeof window !== 'undefined' && !window.matchMedia(COARSE_QUERY).matches;
  const title = desk ? 'Install Maudite Machine' : 'Add it to your Home Screen';
  const sub = desk ? 'Its own window, one click away.' : 'Full screen, one tap away.';

  return (
    <section
      ref={cardRef}
      className="v4-install"
      role="region"
      aria-labelledby="v4-install-title"
      data-kind={kind}
      data-caret={IOS?.pointsDown ? '1' : '0'}
      data-leaving={leaving ? '1' : '0'}
      style={{ position: 'fixed' }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        dismiss();
      }}
    >
      <div className="v4-install-head">
        <img
          className="v4-install-icon"
          src="/icons/apple-touch-icon.png"
          alt=""
          width={48}
          height={48}
          // Icone introuvable (reseau coupe) : sa place reste vide plutot qu'une image cassee
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
        <div className="v4-install-text">
          <h2 id="v4-install-title" className="v4-install-title">
            {title}
          </h2>
          <p className="v4-install-sub">{sub}</p>
        </div>
        <button type="button" className="v4-install-x" aria-label="Close the Home Screen tip" onClick={dismiss}>
          <CloseIcon />
        </button>
      </div>
      {kind === 'ios' && IOS && (
        <ol className="v4-install-steps">
          <li>
            <span className="v4-install-n" aria-hidden="true">
              1
            </span>
            <span className="v4-install-do">
              {IOS.how === 'more' ? (
                <>
                  Tap{' '}
                  <Chip name="More">
                    <MoreIcon />
                  </Chip>{' '}
                  then{' '}
                  <Chip>
                    <ShareIcon />
                  </Chip>{' '}
                  <b>Share</b>
                </>
              ) : (
                <>
                  {IOS.how === 'menu' ? 'Open the menu, tap' : 'Tap'}{' '}
                  <Chip>
                    <ShareIcon />
                  </Chip>{' '}
                  <b>Share</b>
                </>
              )}
            </span>
          </li>
          <li>
            <span className="v4-install-n" aria-hidden="true">
              2
            </span>
            <span className="v4-install-do">
              Choose{' '}
              <Chip>
                <AddIcon />
              </Chip>{' '}
              <b>{addLabel()}</b>
            </span>
          </li>
        </ol>
      )}
      {kind === 'prompt' && (
        <button type="button" className="v4-install-go" onClick={() => void onInstall()}>
          INSTALL
        </button>
      )}
    </section>
  );
};

export default InstallPrompt;
