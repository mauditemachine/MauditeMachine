/**
 * Le nom court d'un echantillon du site, tire de son fichier (2026-10-05) :
 * sans extension, numero, "AT", ni le nom de la famille (01 AT BluePrint -
 * Kick F.wav : BLUEPRINT F ; Psy_Snares02.wav : PSY 02). A part de
 * samples.ts (2026-10-18) pour que l'admin (/mm-admin/samples) l'utilise sans
 * charger le moteur des samples ; samples.ts le reexporte, rien ne change
 * pour la machine. scripts/import-rytm-samples.mjs en garde une copie
 * conforme : a garder identiques.
 */
export function sampleLabel(file: string): string {
  let t = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
  t = t.replace(/^AT\s+/i, '');
  t = t.replace(/\b(master\s+)?(kicks?|snares?|claps?|hats?|hihats?|toms?|rims?|cymbals?|cyms?)\b/gi, ' ');
  t = t.replace(/(master\s+)?(kicks?|snares?)(?=\d)/gi, ' ');
  t = t.replace(/^\s*(BD|SD|CP|HH|CH|OH|HT|CY|RS)\s+/i, '');
  t = t.replace(/\s+-\s+/g, ' ').replace(/\s-\s*$/, '').replace(/\s+/g, ' ').trim();
  return (t || file).toUpperCase().slice(0, 18);
}
