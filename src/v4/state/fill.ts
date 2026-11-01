/**
 * Le mode FILL du MM-RYTM (V.5.1, 2026-10-29, l'etape D2 facon Digitakt, docs/v4/digitakt-d2-spec.md section 3) : tant
 * qu'on le tient, les trigs a condition FILL jouent et ceux a !FILL se taisent. Tenir YES (plus de 250 ms) sans menu ouvert,
 * ou la cible MIDI rytm:fill (hold). Plusieurs mains peuvent le tenir a la fois (la souris, un controleur) : il reste tenu
 * tant qu'une le tient. L'horloge (audio/clock.ts) re-programme les pas a venir a chaque changement ; l'en-tete de l'ecran
 * affiche FILL. Jamais garde : une visite repart sans FILL.
 *
 * V.6.0 (2026-11-01, la face DT2 derriere ?face=dt2, cahier dt2 1.4 et 3.1) : FILL passe sur la touche PAGE, en trois
 * gestes. PAGE tenue : FILL tant qu'on la tient (une main de plus, hold) ; YES puis PAGE : un cycle du pattern (arme, il
 * part au debut de la mesure suivante et finit a celle d'apres : armCycle, puis cycleBar) ; PAGE puis YES : verrouille
 * (latch), PAGE encore le leve. mode dit ce que montre la touche PAGE (rouge : actif, clignotant : un cycle en attente).
 * Toujours pur, sans minuteur : l'horloge passe par actions/face.ts. Sans le drapeau, rien de neuf ne s'appelle.
 */

/** La touche PAGE : 'on' (FILL tenu, verrouille ou un cycle en cours), 'armed' (un cycle en attente), 'off'. */
export type FillMode = 'off' | 'on' | 'armed';

const holders = new Set<string>();
const listeners = new Set<() => void>();
let on = false;
let mode: FillMode = 'off';
/** le FILL d'un cycle : arme (attend le debut de la mesure suivante), en cours, ou rien */
let cycle: 'off' | 'armed' | 'on' = 'off';
let latched = false;

function update(): void {
  const nextOn = holders.size > 0 || latched || cycle === 'on';
  const nextMode: FillMode = nextOn ? 'on' : cycle === 'armed' ? 'armed' : 'off';
  if (nextOn === on && nextMode === mode) return;
  on = nextOn;
  mode = nextMode;
  listeners.forEach((fn) => fn());
}

export const fill = {
  get on(): boolean {
    return on;
  },
  /** Ce que montre la touche PAGE (V.6.0). */
  get mode(): FillMode {
    return mode;
  },
  /** FILL verrouille (PAGE puis YES, V.6.0). */
  get latched(): boolean {
    return latched;
  },
  /** Le FILL d'un cycle (YES puis PAGE, V.6.0) : 'armed', 'on' ou 'off'. */
  get cycle(): 'off' | 'armed' | 'on' {
    return cycle;
  },
  /** Une main (who : 'yes', 'midi', 'page:<src>'...) tient FILL ou le lache. */
  hold(who: string, down: boolean): void {
    if (down) holders.add(who);
    else holders.delete(who);
    update();
  },
  /** PAGE puis YES : FILL verrouille (true) ; PAGE encore : leve (false). Un cycle en attente s'en va. */
  latch(v: boolean): void {
    latched = v;
    if (v) cycle = 'off';
    update();
  },
  /** YES puis PAGE : un cycle arme ; il part au prochain debut de mesure (cycleBar). */
  armCycle(): void {
    if (cycle !== 'off') return;
    cycle = 'armed';
    update();
  },
  /** Le debut d'une mesure (actions/face.ts, l'horloge) : le cycle arme part, celui en cours finit. */
  cycleBar(): void {
    if (cycle === 'armed') cycle = 'on';
    else if (cycle === 'on') cycle = 'off';
    else return;
    update();
  },
  /** Le cycle s'en va (STOP : la lecture s'arrete) ; le verrou et les tenues restent. */
  cancelCycle(): void {
    if (cycle === 'off') return;
    cycle = 'off';
    update();
  },
  /** Tout lache (la page perd le focus, un test). */
  release(): void {
    holders.clear();
    update();
  },
  /** Tout s'arrete, le verrou et le cycle compris (une autre machine, un test). */
  reset(): void {
    holders.clear();
    latched = false;
    cycle = 'off';
    update();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
