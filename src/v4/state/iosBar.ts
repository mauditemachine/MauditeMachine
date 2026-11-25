/**
 * Safari 26 et plus sur iPhone, hors ecran d'accueil (2026-10-01) : sa
 * barre d'onglets flotte par-dessus le bas de la page, sans zone sure
 * annoncee ; le Dock se pose au-dessus (v4.css, --ios-bar). Les autres
 * navigateurs iOS (CriOS, FxiOS, EdgiOS) ont leur propre barre.
 */
export const IOS_FLOATING_BAR = ((): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (!/iPhone|iPod/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return false;
  const m = /Version\/(\d+)/.exec(ua);
  return m !== null && Number(m[1]) >= 26;
})();

/**
 * Le cadrage au telephone sous cette barre (2026-11-10, Mika : "quelque chose d'ergonomique et de facile a utiliser en
 * mobile") : la languette du Dock se pose au-dessus de la barre (v4.css, --ios-bar), en plein sur la derniere rangee de
 * pas de la machine (les pas 12 et 13 dessous), et le selecteur des machines mord la premiere ligne de l'ecran. Au repos,
 * la machine tient entre ces deux marges (px CSS, scene/renderer.ts updateCamera) : 9 % plus petite, mais tout se voit et
 * se touche, de la premiere ligne de l'ecran aux numeros des pas 9 a 16.
 */
export const IOS_BAR_LIFT = { bottom: 50, top: 12 } as const;
