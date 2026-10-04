# 2026-10-04 : menu mobile, RANDOM du MM-ARP, qualite d'ecoute

## 1. Ce qui a ete fait

- MM-ARP : RANDOM change tout le patch (arpegiateur, oscillateurs, filtre, enveloppes, effets ; VOLUME garde) en plages musicales, plus une progression (`voyager/random.ts`, `actions.ts`).
- Menu mobile plein ecran : pages en grands titres numerotes, pastilles du capot, six reseaux, grand bouton OPEN THE MACHINE, Reset view et Dark / Light ; arrivee ligne par ligne (`ui/MobileHeader.tsx`, `v4.css`).
- Curseur : la main de lien sur les potards, survoles ou tournes, plus de doubles fleches (`ui/Hotspots.tsx`).
- Qualite : le MM-ARP sort du compresseur de la batterie (plus de pompage a chaque kick), volume recale (`audio/drums.ts`, `audio/synth.ts`) ; TONE recalcule les one-shots a leur hauteur au lieu de les reechantillonner (`audio/shots.ts`) ; chorus en AudioWorklet a interpolation sinc 16 points (`audio/chorus.worklet.js`, `audio/chorus.ts`).
- Menu desktop : le bouton MENU ouvre le meme menu plein ecran que le telephone, mis a l'echelle (titres a gauche jusqu'a 96 px, capot, reseaux et pied a droite) ; un seul composant pour les deux (`ui/MenuSheet.tsx`, `ui/Header.tsx`, `ui/MobileHeader.tsx`, `v4.css`).
- `docs/v4/spec.md` : R14-59 a R14-63.

## 2. Decisions prises et pourquoi

- Les one-shots restent ceux calcules (choix de Mika).
- RANDOM : un hasard borne plutot que 0 a 1 partout, sinon une moitie des patchs serait inaudible (filtre ferme, attaque de 2 s) ; VOLUME exclu pour ne jamais faire sauter le niveau.
- Menu : plein ecran plutot qu'une carte : sur telephone le menu est une page, la scene derriere n'apporte rien ; les reseaux remplissent le vide et servent.
- Qualite : les trois points ou le navigateur degradait encore le son (le compresseur commun, le reechantillonnage lineaire, les retards modules lineaires) ; la reverbe (reponse stereo decorrelee) et le limiteur etaient deja propres. Les morceaux SoundCloud restent compresses par SoundCloud (hors de notre portee).
- Menu desktop : la barre de liens disparait au profit du bouton MENU (comme au telephone, demande de Mika) ; Dark / Light passe dans le menu.
- Interpolation sinc plutot qu'Hermite : mesure faite, Hermite perd encore pres de 3 dB a 16 kHz dans le pire cas.

## 3. Ce qui reste a faire / points en suspens

- Mika : ecouter aux IE900 (chorus a fond sur l'arpege, charleys transposes avec TONE, arpege et kick ensemble), juger le nouveau menu sur son iPhone, essayer RANDOM.
- Pour l'ecoute : sortie du Mac a 48 kHz (Configuration audio et MIDI) ; un DAC externe pour les IE900 plutot que la prise du Mac.

## 4. Commandes utiles ajoutees

- Aucune. Debug : `__v4.audio.shots()` (cache et calculs des one-shots), `__v4.audio.comp` (reglages du compresseur de la batterie).
