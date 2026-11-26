# 2026-11-26 : MM-RYTM, chargement des samples et logo de l'en-tete

## Ce qui a ete fait

- `src/v4/audio/audiofile.ts` : `decodeWav`, un decodeur WAV non compresse en JS (PCM 8 a 32 bits, flottant, extensible), synchrone.
- `src/v4/audio/samples.ts` : dans le plugin, le fichier se lit d'un bloc (`res.arrayBuffer()`, plus de lecture par morceaux) et un WAV se decode avec `decodeWav` (plus de `decodeAudioData`) ; `prefetchFamily` charge toute la banque d'une famille, le sample choisi d'abord, deux a la fois.
- `src/v4/plugin/v3/Open.tsx` : la page SAMPLE precharge la banque de la piste montree.
- `src/v4/plugin/v3/Chrome.tsx`, `FaceB.tsx`, `v3.css` : `Brand`, le vrai logo (`public/logo/mauditemachine-logo-aligned.svg`, celui du MM-ARP) suivi de MM-RYTM, aux proportions du MM-ARP ; les onglets decales a droite.
- `plugin/mm-rytm/web/vite.config.ts` : le SVG du logo copie dans la face du VST3.

## Decisions prises et pourquoi

- Mesure (Chromium sans tete, face construite) : un changement de sample demandait 3 allers-retours (fetch, lecture par morceaux, decodeAudioData), environ 2 s entre le clic et la forme d'onde. Apres : la banque est deja la, la forme d'onde est affichee 120 ms apres le clic, sans aucune requete.
- Le decodeur JS seulement dans le plugin : la, le PCM ne sert qu'a l'ecran (le son est le moteur C++). Le site garde le decodeur du navigateur, son son ne change pas.
- Logo : tailles du MM-ARP (243.5 px de logo, 25 px d'ecart, nom en 15.3 px a 0.274 em sur sa face de 1100 px) x 1.1 dans la scene 1400 et x 1.2 sur la face B 1600.

## Ce qui reste a faire / points en suspens

- Mika : verifier dans Ableton que le changement de sample est instantane et que le logo est bien place.
- Le Chorus : en attente de la decision de Mika (remplacement possible par un compresseur de bus parallele).

## Commandes utiles ajoutees

- Aucune.
