/**
 * Moteur SoundCloud du lecteur Radar : joue la VERSION COMPLETE d'une track
 * quand une release a un soundcloudUrl, la ou iTunes ne donne que 30 s.
 *
 * Une seule iframe cachee (allow="autoplay", sans quoi le play() par
 * postMessage est bloque par la politique autoplay des navigateurs), pilotee
 * par la Widget API officielle (w.soundcloud.com/player/api.js, deja utilisee
 * par la pilule du site, aucune cle requise).
 *
 * Le lecteur Radar garde une seule barre et une seule file : ce module est
 * l'un de ses deux moteurs, l'element <audio> natif (extraits iTunes) etant
 * l'autre. La page garantit qu'un seul des deux joue a la fois.
 */

export interface ScEvents {
  onPlay: () => void;
  onPause: () => void;
  onFinish: () => void;
  /** position et duree en millisecondes */
  onProgress: (positionMs: number, durationMs: number) => void;
  onError: () => void;
}

const SC_API_URL = 'https://w.soundcloud.com/player/api.js';

let widget: any = null;
let widgetReady: Promise<any> | null = null;
let currentUrl = '';
let durationMs = 0;
let handlers: ScEvents | null = null;
/** FINISH declenche aussi un PAUSE : on l'ignore pendant l'enchainement. */
let finishing = false;

export function setScHandlers(h: ScEvents | null): void {
  handlers = h;
}

function loadApiOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).SC?.Widget) return resolve();
    const existing = document.querySelector(`script[src="${SC_API_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('SC api load failed')));
      if ((window as any).SC?.Widget) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SC_API_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('SC api load failed'));
    document.head.appendChild(script);
  });
}

function ensureWidget(firstUrl: string): Promise<any> {
  if (!widgetReady) {
    widgetReady = (async () => {
      await loadApiOnce();
      const iframe = document.createElement('iframe');
      iframe.setAttribute('allow', 'autoplay');
      iframe.setAttribute('title', 'Radar SoundCloud engine');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      // Cachee mais PAS display:none (le widget refuse parfois de demarrer
      // dans une frame non rendue). Style inline : voir piege .page > *.
      iframe.style.cssText =
        'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;border:0;z-index:-1;';
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&auto_play=false&visual=false&show_artwork=false&download=false&sharing=false`;
      document.body.appendChild(iframe);

      const SC = (window as any).SC;
      const w = SC.Widget(iframe);
      await new Promise<void>((res) => w.bind(SC.Widget.Events.READY, () => res()));
      currentUrl = firstUrl;

      const E = SC.Widget.Events;
      w.bind(E.PLAY, () => {
        finishing = false;
        w.getDuration((d: number) => {
          durationMs = d || 0;
        });
        handlers?.onPlay();
      });
      w.bind(E.PAUSE, () => {
        if (!finishing) handlers?.onPause();
      });
      w.bind(E.FINISH, () => {
        finishing = true;
        handlers?.onFinish();
      });
      w.bind(E.ERROR, () => handlers?.onError());
      w.bind(E.PLAY_PROGRESS, (e: any) => {
        if (durationMs > 0) handlers?.onProgress(e.currentPosition || 0, durationMs);
      });
      widget = w;
      return w;
    })().catch((err) => {
      widgetReady = null; // un echec de chargement reste re-essayable
      throw err;
    });
  }
  return widgetReady;
}

/** Charge (si besoin) puis joue une URL SoundCloud. */
export async function scPlay(url: string): Promise<void> {
  const w = await ensureWidget(url);
  finishing = false;
  if (url !== currentUrl) {
    currentUrl = url;
    durationMs = 0;
    w.load(url, {
      auto_play: true,
      visual: false,
      show_artwork: false,
      callback: () => {
        // Certains navigateurs ignorent auto_play au premier load : on force.
        w.play();
      },
    });
  } else {
    w.play();
  }
}

export function scPause(): void {
  widget?.pause();
}

export function scResume(): void {
  finishing = false;
  widget?.play();
}

/** Seek relatif 0..1 (la barre de progression clique). */
export function scSeekRatio(ratio: number): void {
  if (widget && durationMs > 0) widget.seekTo(Math.max(0, Math.min(1, ratio)) * durationMs);
}

/** Volume 0..1, aligne sur l'element <audio>. */
export function scSetVolume(v: number): void {
  widget?.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100));
}
