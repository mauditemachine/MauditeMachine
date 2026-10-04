/**
 * Ecran d'accueil (2026-10-04, demande de Mika : "Il est important de
 * proposer d'avoir mauditemachine.com en icone sur iPhone.. par defaut").
 * Ce que l'invitation (ui/InstallPrompt.tsx) doit savoir :
 * - la page est-elle deja ouverte depuis l'icone (standalone) ;
 * - iPhone / iPad : quel geste decrire (iOS n'a pas d'API d'installation) ;
 * - Chrome, Edge, Samsung Internet : l'evenement beforeinstallprompt, garde
 *   pour le bouton INSTALL (la mini-barre du navigateur est empechee) ;
 * - fermee : plus rien pendant 30 jours (localStorage mm.v4.install).
 * Importe des main.tsx : l'evenement peut partir avant le chunk de la v4.
 */

/** beforeinstallprompt (Chromium seulement, pas encore dans lib.dom) */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

/**
 * Le geste a decrire sur iOS, etape 1 :
 * - share : le bouton Partager est a l'ecran (Safari jusqu'a iOS 18, Safari
 *   sur iPad, Chrome iOS dans sa barre d'adresse) ;
 * - more : Safari 26 sur iPhone, Partager est sous le bouton "..." ;
 * - menu : Firefox, Edge, Opera... Partager est dans leur menu.
 */
export type IosHow = 'share' | 'more' | 'menu';

export interface IosInfo {
  how: IosHow;
  /** iPhone Safari jusqu'a iOS 18 : Partager est au centre de la barre du bas, la carte pointe vers lui */
  pointsDown: boolean;
}

const SNOOZE_KEY = 'mm.v4.install';
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

let deferred: InstallPromptEvent | null = null;
let installed = false;
/** fermee pendant cette visite (stockage indisponible : vaut au moins jusqu'au rechargement) */
let snoozedNow = false;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

/** Ouverte depuis l'icone de l'ecran d'accueil (ou installee sur ordinateur). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  const mm = window.matchMedia;
  if (typeof mm !== 'function') return false;
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => mm(`(display-mode: ${m})`).matches);
}

/**
 * iPhone, iPod ou iPad (iPadOS se presente en Macintosh tactile). null :
 * pas iOS, ou rien a proposer (navigateur integre d'une app, Instagram,
 * Facebook, TikTok... sans "Sur l'ecran d'accueil" ; autre navigateur que
 * Safari avant iOS 16.4).
 */
export const IOS: IosInfo | null = (() => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPod/.test(ua);
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  if (!iphone && !ipad) return null;
  if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|Line\//.test(ua)) return null;
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\//.test(ua);
  if (other) {
    // Les autres navigateurs iOS ont "Sur l'ecran d'accueil" depuis iOS 16.4
    const os = /OS (\d+)_(\d+)/.exec(ua);
    const major = os ? Number(os[1]) : 0;
    const minor = os ? Number(os[2]) : 0;
    if (os && (major < 16 || (major === 16 && minor < 4))) return null;
    return { how: /CriOS/.test(ua) ? 'share' : 'menu', pointsDown: false };
  }
  const v = /Version\/(\d+)/.exec(ua);
  const safari26 = v !== null && Number(v[1]) >= 26;
  if (iphone && safari26) return { how: 'more', pointsDown: false };
  return { how: 'share', pointsDown: iphone };
})();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Pas de mini-barre du navigateur : l'invitation du site propose INSTALL
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export const install = {
  /** Chromium a donne son evenement : INSTALL peut ouvrir la fenetre d'installation */
  canPrompt: (): boolean => deferred !== null,
  installed: (): boolean => installed,
  /** Fermee il y a moins de 30 jours ? */
  snoozed(): boolean {
    if (snoozedNow) return true;
    try {
      const t = Number(window.localStorage.getItem(SNOOZE_KEY));
      return Number.isFinite(t) && t > 0 && Date.now() - t < SNOOZE_MS;
    } catch {
      return false;
    }
  },
  /** La croix (ou un refus dans la fenetre du navigateur) : plus rien pendant 30 jours. */
  snooze(): void {
    snoozedNow = true;
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* stockage indisponible : fermee pour cette visite seulement */
    }
  },
  /** INSTALL : la fenetre du navigateur (un seul appel par evenement). */
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const e = deferred;
    if (!e) return 'unavailable';
    deferred = null;
    emit();
    try {
      await e.prompt();
      const choice = await e.userChoice;
      if (choice.outcome === 'accepted') {
        installed = true;
        emit();
      }
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
