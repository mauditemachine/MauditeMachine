/**
 * v49 (Mika : "soulager au max le CPU") : une animation a 30 images par seconde sans requestAnimationFrame a vide. Avant,
 * la tete du DELAY et les anneaux de HELL demandaient une image a chaque rafraichissement de l'ecran (60 ou 120 Hz) et
 * n'en dessinaient qu'une sur deux (ou sur quatre). Ici : apres chaque image, un minuteur jusqu'a la suivante, puis une
 * seule demande d'image ; la meme cadence de 33 ms, deux a quatre fois moins de reveils. step recoit l'heure de l'image,
 * comme avant. Rend la fonction d'arret.
 */

export const FRAME30_MS = 33;

export function loop30(step: (now: number) => void, ms = FRAME30_MS): () => void {
  let raf = 0;
  let timer = 0;
  let alive = true;
  const frame = (now: number): void => {
    raf = 0;
    if (!alive) return;
    step(now);
    // 4 ms d'avance : l'image suivante tombe au rafraichissement qui suit les 33 ms, comme le seuil d'avant
    timer = window.setTimeout(() => {
      timer = 0;
      if (alive) raf = window.requestAnimationFrame(frame);
    }, ms - 4);
  };
  raf = window.requestAnimationFrame(frame);
  return () => {
    alive = false;
    window.cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
}
