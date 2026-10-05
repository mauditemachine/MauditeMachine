/**
 * Orbite maison (revision 2, spec 20.2) : la camera orthographique tourne
 * autour de la machine. Glisser = rotation (azimut libre, elevation 18 a
 * 78 deg), molette et pincement = camera.zoom (0.55 a 2.4), aucun
 * decalage lateral. Inertie douce 0.08 : chaque geste s'ajoute a un reste
 * que chaque frame consomme (independant du framerate) ; relache, un pas
 * sous 0.001 arrete tout net (le reste est abandonne), la boucle a la
 * demande ne tourne jamais pour rien. Un petit reste tout frais de la
 * molette (defilement lent, pincement doux d'un pave tactile) s'applique
 * d'un coup au lieu d'etre abandonne ; un nouvel appui arrete la glisse
 * sous le doigt. N'ecoute que pointerdown, pointermove, pointerup,
 * pointercancel, lostpointercapture (un relachement perdu) et wheel sur
 * l'element de la scene, en bouillonnement : la couche de saisie
 * (.v4-hit, son enfant) voit chaque evenement AVANT, juge au relachement
 * si c'etait une tape (isTap) et garde par gate un glisser parti d'un
 * encodeur, dans toutes les directions. Aucune allocation par frame.
 *
 * Au doigt (2026-10-01, demande de Mika : on n'attrapait pas les potards
 * au telephone) : un seul doigt ne tourne jamais la vue, il reste aux
 * potards, aux pads et aux pas ; deux doigts tournent la vue (leur milieu
 * qui glisse) et la pincent. Souris et stylet : inchanges.
 *
 * En lecture (2026-10-04, lock) : un geste parti sur une machine qui joue
 * ne tourne ni ne zoome plus la vue ; parti du fond, il la bouge.
 * A la souris (2026-10-05, Mika : "dans la vue par defaut je ne veux pas
 * bouger la machine en 3D, je veux le curseur normal ; je veux toujours
 * pouvoir bouger en 3D en dehors de la machine") : la machine qu'on utilise
 * ne tourne la vue que depuis le fond, meme quand elle ne joue pas.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import { view } from '../state/view';
import { ORBIT } from '../theme';
import { easeOutCubic } from './tween';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const AZ0 = ORBIT.azDeg * DEG;
const EL0 = ORBIT.elDeg * DEG;
const EL_MIN = ORBIT.elMinDeg * DEG;
const EL_MAX = ORBIT.elMaxDeg * DEG;
const LZ_MIN = Math.log(ORBIT.zoomMin);
const LZ_MAX = Math.log(ORBIT.zoomMax);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
/** ecart d'angle ramene dans [-pi, pi] : le plus court chemin */
const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);

export interface OrbitOpts {
  camera: PerspectiveCamera;
  /** element des pointeurs : .v4-stage (les evenements de .v4-hit y remontent) */
  input: HTMLElement;
  /** reveil de la boucle a la demande */
  wake: () => void;
  /** le zoom a change : le Stage recalcule le frustum (decalages / zoom) */
  onZoom: () => void;
  reduced: () => boolean;
}

/**
 * Un pointeur pose : depart (x0, y0, t0), position, plus grand ecart (max) ;
 * orbiting : il tourne la vue ; foreign : la couche de saisie le garde
 * (potard) ; multi : un deuxieme doigt est venu (pincement, ni tape ni
 * rotation).
 */
interface Ptr {
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  max: number;
  orbiting: boolean;
  foreign: boolean;
  multi: boolean;
  /** doigt : seul, il ne tourne pas la vue */
  touch: boolean;
  /** parti sur une machine qui joue (lock) : ses commandes repondent, la vue ne bouge pas */
  locked: boolean;
}

export class Orbit {
  /** rad, dans [0, 2 pi) ; elevation bornee ; zoom = camera.zoom */
  azimuth = AZ0;
  elevation = EL0;
  zoom: number = ORBIT.zoom;
  /**
   * Distance camera - pivot (2026-10-01, camera perspective) : le Stage la
   * calcule pour que le cadrage tienne (renderer.updateCamera) ; place()
   * la lit.
   */
  distance: number = ORBIT.distance;
  /** pivot : le Stage le monte avec la vue eclatee */
  readonly target = new Vector3(0, ORBIT.targetY, 0);
  /** appele une fois par pointeur au seuil de 6 px ; false = la couche de saisie le garde */
  gate: (pointerId: number, dx: number, dy: number) => boolean = () => true;
  /**
   * La vue verrouillee (2026-10-04, state/playLock.ts) : un geste parti de
   * ce point (px de la fenetre) ne tourne ni ne zoome la vue (une machine
   * qui joue) ; le Stage le pose.
   */
  lock: (x: number, y: number, mouse: boolean) => boolean = () => false;
  /** derniere tape jugee (debug) ; quick : moins de 400 ms (double tape du fond) */
  readonly lastTap = { dist: 0, ms: 0, fired: false, quick: false };
  private ptrs = new Map<number, Ptr>();
  /** pointeurs qui tournent ou pincent (compte tenu aux evenements) */
  private held = 0;
  /** restes a consommer : rotation (rad) et log du zoom */
  private pAz = 0;
  private pEl = 0;
  private pZ = 0;
  /** pincement : ecart et log du zoom de depart ; hauteur du canvas (px), lue au pointerdown */
  private d0 = 0;
  private lz0 = 0;
  private h = 1;
  /** deux doigts : leur milieu a la derniere mesure (la vue tourne de son glissement) */
  private cx = 0;
  private cy = 0;
  /** transition (reset, set) : depart et arrivee [azimut, elevation, log du zoom] */
  private tw = false;
  private tw0 = 0;
  private twMs = 0;
  private from = new Float64Array(3);
  private goal = new Float64Array(3);
  /** saut immediat (set) : une frame a rendre */
  private jumped = false;
  private away = false;
  /** la molette a parle depuis la derniere frame */
  private wheelFresh = false;

  constructor(private opts: OrbitOpts) {
    opts.camera.up.set(0, 1, 0);
    view.set(false);
  }

  /** Branche les pointeurs (le Stage l'appelle une fois tout le travail GL reussi). */
  listen(): void {
    const el = this.opts.input;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    // Capture perdue sans pointerup (fenetre quittee en plein glisser) : un relachement
    el.addEventListener('lostpointercapture', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** un pointeur tourne ou pince (pas de survol pendant ce temps) */
  get dragging(): boolean {
    return this.held > 0;
  }

  /** la vue bouge encore : geste, reste au-dessus de l'arret, transition */
  get moving(): boolean {
    return this.held > 0 || this.tw || this.pAz !== 0 || this.pEl !== 0 || this.pZ !== 0;
  }

  /** hors de la vue par defaut */
  get moved(): boolean {
    return this.away;
  }

  /**
   * Tape, lue par la couche de saisie dans SON pointerup (avant celui de
   * l'orbite) : moins de 6 px entre le pointerdown et le pointerup, un seul
   * pointeur, sans rotation. La duree ne compte plus (revue de la revision
   * 2, test T1 "appuyer lentement") : un appui immobile ne peut pas etre
   * une orbite, il part, meme au-dela de 400 ms. quick (moins de 400 ms)
   * reste exige pour la double tape du fond.
   */
  isTap(e: PointerEvent): boolean {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return false;
    const dist = Math.max(p.max, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
    const ms = (e.timeStamp || performance.now()) - p.t0;
    const tap = !p.multi && !p.orbiting && !p.foreign && dist < ORBIT.tapPx;
    this.lastTap.dist = Math.round(dist * 10) / 10;
    this.lastTap.ms = Math.round(ms);
    this.lastTap.fired = tap;
    this.lastTap.quick = tap && ms < ORBIT.tapMs;
    return tap;
  }

  /** Retour a la vue par defaut : 500 ms easeOutCubic, azimut par le plus court (coupe en reduced motion). */
  reset(): void {
    this.to(AZ0, EL0, 0);
  }

  /** Tests : une vue (deg), bornee ; instant = posee tout de suite (camera comprise). */
  set(azDeg: number, elDeg: number, zoom: number, instant = false): void {
    const el = clamp(elDeg * DEG, EL_MIN, EL_MAX);
    const lz = clamp(Math.log(zoom), LZ_MIN, LZ_MAX);
    if (!instant) {
      this.to(azDeg * DEG, el, lz);
      return;
    }
    this.tw = false;
    this.pAz = this.pEl = this.pZ = 0;
    this.azimuth = azDeg * DEG;
    this.elevation = el;
    this.zoom = Math.exp(lz);
    this.commit();
    this.jumped = true;
    this.opts.wake();
  }

  private to(az: number, el: number, lz: number): void {
    const dAz = wrapPi(az - this.azimuth);
    const lz1 = Math.log(this.zoom);
    this.pAz = this.pEl = this.pZ = 0;
    // Deja la : ni transition ni frame (30 frames qui ne changeraient rien)
    if (Math.abs(dAz) < 1e-6 && Math.abs(el - this.elevation) < 1e-6 && Math.abs(lz - lz1) < 1e-6) {
      this.tw = false;
      return;
    }
    const f = this.from;
    const g = this.goal;
    f[0] = this.azimuth;
    f[1] = this.elevation;
    f[2] = lz1;
    g[0] = this.azimuth + dAz;
    g[1] = el;
    g[2] = lz;
    this.tw0 = performance.now();
    this.twMs = ORBIT.resetMs;
    this.tw = true;
    this.opts.wake();
  }

  /**
   * Animateur du Stage (avant tous les autres) : transition, ou pas
   * d'inertie sur les restes ; true si la camera a bouge cette frame.
   */
  update(now: number, dt: number): boolean {
    const fresh = this.wheelFresh;
    this.wheelFresh = false;
    if (this.tw) {
      // La transition gagne : un glisser pendant ce temps ne s'accumule pas
      // (il ne la defait pas d'un coup a son arrivee)
      this.pAz = this.pEl = this.pZ = 0;
      const t = this.opts.reduced() ? 1 : clamp((now - this.tw0) / this.twMs, 0, 1);
      const k = easeOutCubic(t);
      const f = this.from;
      const g = this.goal;
      this.azimuth = f[0] + (g[0] - f[0]) * k;
      this.elevation = f[1] + (g[1] - f[1]) * k;
      this.zoom = Math.exp(f[2] + (g[2] - f[2]) * k);
      if (t >= 1) {
        this.tw = false;
        // Un pincement en cours repart du zoom d'arrivee : aucun saut
        if (this.held > 0) this.pinchFrom();
      }
      this.commit();
      return true;
    }
    const j = this.jumped;
    this.jumped = false;
    if (this.pAz === 0 && this.pEl === 0 && this.pZ === 0) return j;
    // Reduced motion : aucune inertie, le geste s'applique dans la frame
    if (this.opts.reduced()) {
      this.step(1);
      return true;
    }
    // Pas d'une frame a 60 fps sous le seuil : relache, le reste tombe
    // (arret net) ; tenu immobile, ou tout frais de la molette (un
    // defilement lent envoie 1 a 6 px par frame), il s'applique d'un coup
    const lim = (this.held > 0 ? ORBIT.snap : ORBIT.stop) / ORBIT.damping;
    if (Math.abs(this.pAz) < lim && Math.abs(this.pEl) < lim && Math.abs(this.pZ) < lim) {
      if (this.held > 0 || fresh) {
        this.step(1);
        return true;
      }
      this.pAz = this.pEl = this.pZ = 0;
      return j;
    }
    this.step(1 - Math.pow(1 - ORBIT.damping, dt / 16.667));
    return true;
  }

  /** Consomme la fraction k des restes ; une borne atteinte vide le reste de son axe. */
  private step(k: number): void {
    const sAz = this.pAz * k;
    this.azimuth += sAz;
    this.pAz -= sAz;
    const el = this.elevation + this.pEl * k;
    this.elevation = clamp(el, EL_MIN, EL_MAX);
    this.pEl = el === this.elevation ? this.pEl * (1 - k) : 0;
    const lz = Math.log(this.zoom) + this.pZ * k;
    const lzc = clamp(lz, LZ_MIN, LZ_MAX);
    this.zoom = Math.exp(lzc);
    this.pZ = lz === lzc ? this.pZ * (1 - k) : 0;
    this.commit();
  }

  /** Azimut ramene dans [0, 2 pi), camera posee, bascule de view.moved publiee. */
  private commit(): void {
    this.azimuth = ((this.azimuth % TAU) + TAU) % TAU;
    this.apply();
    const lim = ORBIT.movedDeg * DEG;
    const away = Math.abs(wrapPi(this.azimuth - AZ0)) > lim || Math.abs(this.elevation - EL0) > lim || Math.abs(this.zoom - 1) > ORBIT.movedZoom;
    if (away !== this.away) {
      this.away = away;
      view.set(away);
    }
  }

  /** Camera posee (position, visee, zoom) ; le frustum est recalcule si le zoom change. */
  apply(): void {
    const c = this.opts.camera;
    if (c.zoom !== this.zoom) {
      c.zoom = this.zoom;
      this.opts.onZoom();
    }
    this.place();
  }

  /** Position a distance fixe autour de la cible, visee sur elle (le Stage l'appelle quand la cible monte). */
  place(): void {
    const c = this.opts.camera;
    const ce = Math.cos(this.elevation);
    const D = this.distance;
    const t = this.target;
    c.position.set(t.x + D * ce * Math.sin(this.azimuth), t.y + D * Math.sin(this.elevation), t.z + D * ce * Math.cos(this.azimuth));
    c.lookAt(t);
    c.updateMatrixWorld();
  }

  /* ---------------- pointeurs (evenements seulement, jamais par frame) ---------------- */

  private recount(): void {
    let n = 0;
    for (const p of this.ptrs.values()) if (p.orbiting || p.multi) n += 1;
    this.held = n;
  }

  /** Les deux premiers doigts du pincement : leur ecart, ou 0. */
  private spread(): number {
    let a: Ptr | null = null;
    for (const p of this.ptrs.values()) {
      if (!p.multi) continue;
      if (!a) a = p;
      else return Math.hypot(p.x - a.x, p.y - a.y);
    }
    return 0;
  }

  /** Le milieu des deux premiers doigts du pincement (cx, cy) ; false sans eux. */
  private centre(): boolean {
    let a: Ptr | null = null;
    for (const p of this.ptrs.values()) {
      if (!p.multi) continue;
      if (!a) a = p;
      else {
        this.cx = (a.x + p.x) / 2;
        this.cy = (a.y + p.y) / 2;
        return true;
      }
    }
    return false;
  }

  /** Pincement (re)pris a la position courante des doigts : aucun saut. */
  private pinchFrom(): void {
    this.d0 = this.spread();
    this.lz0 = Math.log(this.zoom) + this.pZ;
    this.centre();
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Premier doigt d'un geste : aucun reste d'un pointeur perdu, et la
    // glisse s'arrete sous lui (une tape vise ce qui est dessous, comme une
    // orbite native) ; tout nouveau geste coupe un retour en cours
    if (e.isPrimary) {
      this.ptrs.clear();
      this.pAz = this.pEl = this.pZ = 0;
    }
    this.tw = false;
    this.h = Math.max(1, this.opts.input.clientHeight);
    const x = e.clientX;
    const y = e.clientY;
    const p: Ptr = { x0: x, y0: y, t0: e.timeStamp || performance.now(), x, y, max: 0, orbiting: false, foreign: false, multi: false, touch: e.pointerType === 'touch', locked: this.lock(x, y, e.pointerType === 'mouse') };
    // Un deuxieme pointeur libre : pincement, plus de tape ni de rotation (pas sur une machine qui joue)
    for (const q of this.ptrs.values()) {
      if (q.foreign || q.locked || p.locked) continue;
      q.multi = p.multi = true;
      q.orbiting = false;
    }
    this.ptrs.set(e.pointerId, p);
    if (p.multi) this.pinchFrom();
    this.recount();
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    // Souris sans bouton mais encore tenue : son pointerup s'est perdu
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      this.onUp(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    p.max = Math.max(p.max, Math.hypot(p.x - p.x0, p.y - p.y0));
    if (p.multi) {
      const s = this.spread();
      if (s <= 0 || this.d0 <= 0) return;
      const raw = this.lz0 + Math.log(s / this.d0);
      const goal = clamp(raw, LZ_MIN, LZ_MAX);
      // Au-dela d'une borne, l'ancre suit les doigts : ils repartent dans
      // l'autre sens sans zone morte
      if (goal !== raw) this.lz0 = goal - Math.log(s / this.d0);
      this.pZ = goal - Math.log(this.zoom);
      // Deux doigts qui glissent ensemble : la vue tourne de leur milieu
      const px = this.cx;
      const py = this.cy;
      if (this.centre()) this.turn(this.cx - px, this.cy - py);
    } else if (p.orbiting) {
      this.turn(dx, dy);
    } else {
      if (p.foreign || p.max < ORBIT.tapPx) return;
      if (!this.gate(e.pointerId, p.x - p.x0, p.y - p.y0)) {
        p.foreign = true;
        return;
      }
      // Une machine qui joue : ses potards ont eu le geste (gate), la vue reste
      if (p.locked) return;
      // Un seul doigt ne tourne pas la vue : il faut le deuxieme
      if (p.touch) return;
      p.orbiting = true;
      this.recount();
      // Tout l'ecart depuis le pointerdown : pas de retard de zone morte
      this.turn(p.x - p.x0, p.y - p.y0);
    }
    this.opts.wake();
  };

  /** Glisser a droite : la machine tourne a droite (azimut qui baisse) ; vers le bas : plus de dessus. */
  private turn(dx: number, dy: number): void {
    const k = ORBIT.radPerHeight / this.h;
    this.pAz -= dx * k;
    this.pEl += dy * k;
  }

  /** Relache ou annule : le reste continue de glisser (la boucle tourne deja s'il y en a un). */
  private onUp = (e: PointerEvent): void => {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    // Un doigt du pincement se leve : les autres repartent d'ou ils sont
    if (p.multi) this.pinchFrom();
    this.recount();
  };

  private onWheel = (e: WheelEvent): void => {
    // Au-dessus d'un potard, la couche de saisie l'a deja pris
    if (e.defaultPrevented) return;
    e.preventDefault();
    // Au-dessus d'une machine qui joue : le zoom reste
    if (this.lock(e.clientX, e.clientY, true)) return;
    this.tw = false;
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
    this.pZ -= e.deltaY * unit * ORBIT.wheel * (e.ctrlKey ? ORBIT.wheelCtrl : 1);
    this.wheelFresh = true;
    this.opts.wake();
  };

  dispose(): void {
    const el = this.opts.input;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('lostpointercapture', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
    this.ptrs.clear();
    this.held = 0;
    view.set(false);
  }
}
