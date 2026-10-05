# Le son ne se coupe plus, MM-SMPL granulaire, MM-STUDIO (2026-10-05)

Demandes de Mika :
- « RYTM : avant, le EDIT affichait un écran en bas où je pouvais écrire les notes, voir les vélocités, le faire à la souris. Je voulais le voir à la place des steps du bas. C'est une régression. Je veux garder l'enchaînement et le changement de pattern là-dedans. »
- « Je lance le site et dès que je fais un petit truc, le son se coupe. Faut arranger ça une bonne fois pour toutes, optimise le tout ! »
- « Dans MENU, je veux voir combien de personnes sont connectées et depuis combien de temps. »
- « Enlève OPEN THE MACHINE dans le menu, ça sert à rien. »
- « Je veux appeler la session avec toutes les machines MM-STUDIO, pour Maudite Machine Studio. »
- « Pour le SCOPE, je voudrais que ce soit un bouton à l'intérieur de OPEN de MM-ARP. »
- « SMPL : plein de choses ne fonctionnent pas quand on tourne les knobs. Implémente la fonction granulaire. Un tout petit bouton INFO qui mène à un PDF complet, avec des captures d'écran, en français. »

## 1. Ce qui a été fait

- **Le son ne se coupe plus** (enquête mesurée d'abord : les coupures venaient du fil principal, pas du son lui-même) :
  - `src/v4/audio/sched.ts` (nouveau) : les trois séquenceurs voient 300 ms devant eux (450 ms au téléphone) au lieu de 100 ms ; `reserve()` programme d'avance avant un gros travail connu ;
  - `src/v4/audio/clock.ts` (MM-RYTM), `src/v4/voyager/arp.ts` (MM-ARP), `src/v4/smpl/seq.ts` (séquence du MM-SMPL) : chaque changement (un pas, un mute, un son, un potard, le tempo, le swing, un accord) re-programme tout de suite ce qui n'a pas encore sonné. On l'entend au pas suivant, pas après l'horizon ;
  - la chaîne des patterns avance une seule fois par mesure, même re-programmée ou après un pas sauté ; l'arpège ne se décale plus après une coupure ;
  - `src/v4/audio/moog.worklet.js`, `src/v4/audio/synth.ts`, `src/v4/smpl/smpl.worklet.js` : les moteurs oublient les notes annulées ;
  - `src/v4/audio/drums.ts` : un charley annulé rend au charley ouvert son extinction ; la nouvelle route branchée avant de débrancher l'ancienne ; les réverbes construites d'avance ; session audio « playback » sur iPhone ;
  - `src/v4/audio/shots.ts` : plus jamais de son calculé sur le fil principal pendant la lecture ; le préchauffage part dès le chargement (`src/v4/index.tsx`) ;
  - `src/v4/scene/renderer.ts`, `src/v4/scene/pcb.ts`, `src/v4/voyager/rig.ts` : les PCB préparés en temps libre (desktop), OPEN programme la musique d'avance, les shaders des machines qui arrivent compilés en parallèle, plus de vérification des shaders en production ;
  - `src/v4/index.tsx`, `src/v4/state/playLock.ts` : une autre fenêtre devant ou une autre app ne coupe plus la musique (le son ne dort que si rien ne joue) ; plus de rechargement de la page sous la musique ; la reconstruction de la scène (Dark / Light, ADD DECK) programme 3 s d'avance ;
  - `src/v4/dj/actions.ts`, `src/v4/dj/engine.ts` : l'analyse en fond de ta caisse de morceaux (décodage, BPM) attend que plus rien ne joue ; charger un morceau programme la musique d'avance.
- **MM-SMPL, les potards** (audit hors ligne : 12 potards dans 7 situations, avec le vrai moteur) :
  - RELEASE marche partout ; le second PLAY coupe bien ; plus de note bloquée au premier toucher ; plus de clic à chaque tour de LOOP ;
  - FILTER : deux filtres en série, plus de trou de 70 ms en passant le milieu ;
  - le nuage par défaut est plein et au même niveau que SLICE ; DENSITY répond tout de suite ; REV et LOOP suivent en direct ;
  - en SLICE, un potard de la rangée GRAIN le dit à l'écran : GRAIN ONLY: PRESS MODE.
- **MM-SMPL, le granulaire** (`smpl.worklet.js`, `params.ts`, `actions.ts`, `gestures.ts`, `screen.ts`, `seq.ts`, `theme.ts`, `Dock.tsx`) :
  - SCAN remplace SPREAD : la tête avance (de -2x à +2x, FREEZE au milieu) et boucle dans la slice ou la région. Time-stretch, hauteur sans la vitesse ;
  - POSITION joue enfin sur les trigs et la séquence (dans chaque slice) ;
  - l'écran devient un instrument : poser le doigt fait naître un nuage, il suit le doigt ;
  - SPRAY ouvre aussi l'image stéréo et désaccorde un peu chaque grain ;
  - l'écran montre POSITION dans chaque slice et SCAN dans la ligne d'état ;
  - `src/v4/midi/roto.ts` : setup SMPL, page 1 le son, page 2 les grains.
- **INFO et le mode d'emploi** :
  - `src/v4/ui/SmplInfo.tsx` (nouveau) : la touche INFO sur la tête du MM-SMPL ;
  - `public/docs/MM-SMPL-mode-emploi.pdf` : 14 pages en français, avec les captures de la machine (tour numéroté, écran, SLICE, GRAIN, recettes, séquence, téléphone, clavier, MIDI, dépannage) ;
  - `scripts/smpl-manual/` (nouveau) : de quoi le refaire (`npm run manual:smpl`).
- **RYTM, l'éditeur de notes revient** (`src/v4/ui/BeatEditor.tsx`, `src/v4/ui/editorPanel.ts`, `src/v4/v4.css`) : au desktop, EDIT pose l'éditeur sur la machine, à la place des steps du bas, la grille exactement au-dessus d'eux ; la rangée PTN (les 16 patterns : un toucher joue, deux enchaînent, tenir un vide copie), les dix voix, la vélocité à la souris.
- **MM-STUDIO et le menu** (`MenuSheet.tsx`, `MachineDrawer.tsx`, `Header.tsx`, `midi/targets.ts`, `midi/roto.ts`) : plus de OPEN THE MACHINE dans le menu ; la vue de toutes les machines s'appelle MM-STUDIO (STUDIO dans le sélecteur du haut).
- **SCOPE dans le OPEN du MM-ARP** (`src/v4/ui/MachineKey.tsx` nouveau, `Scope.tsx`, `voyager/theme.ts`, `voyager/tweaks.ts`) : une touche SCOPE posée sur la plaque TWEAKS, qui suit la caméra ; elle ouvre et ferme l'oscilloscope.
- **Écran du RYTM** (`src/v4/scene/pixels.ts`, `screen.ts`) : même image, dessinée d'un seul geste au lieu d'une boucle point par point.
- `docs/v4/spec.md` : R14-168 à R14-177.

## 2. Décisions prises et pourquoi

- **Les coupures : mesurer avant de corriger.** Une enquête a chronométré chaque geste :
  - le son lui-même avait de la marge (8 à 16 % d'un cœur) ;
  - c'était le fil principal qui gelait plus longtemps que l'avance des séquenceurs (100 ms) : premier RUN, premier OPEN de l'ARP (plusieurs secondes), Dark / Light, ADD DECK, première visite au téléphone, première REVERB, l'analyse de ta caisse de morceaux.
  - D'où trois étages : une avance plus longue, re-programmée à chaque changement (rien ne traîne) ; une réserve avant les gros travaux connus ; ces gros travaux allégés ou faits en temps libre.
  - Vérifié sans son : un gel de 250 ms ne fait plus perdre ni retarder une note (avant, dès 75 à 100 ms) ; 1,5 s de gel après une réserve, rien non plus.
- **Non fait, en réserve : séquencer dans le moteur audio lui-même.** C'est la solution ultime (même un gel de 5 s ne couperait plus que l'image), mais c'est une réécriture du MM-RYTM. À faire si des coupures restent au-delà de 300 ms.
- **SCAN plutôt que SPREAD.** Douze potards, pas de place pour un treizième. SCAN, la tête qui avance, est ce qui manquait pour un vrai granulaire (étirer, transposer sans changer le tempo, promener un nuage). L'image stéréo suit maintenant SPRAY.
- **Les trigs s'éteignent au lâcher (sur RELEASE).** Un tap court donne un coup sec, tenir laisse sonner. RELEASE passe à 122 ms par défaut pour garder des coups naturels.
- **Nouveaux réglages par défaut du SMPL.** Le nuage d'avant hachait et sonnait 6 dB trop bas : SIZE 86 ms, DENSITY 26 par seconde. Ce sont tes réglages SMPL d'avant qui repartent de zéro (nouvelle clé), pas ton son.
- **Le PDF généré, pas dessiné à la main.** Les captures viennent du vrai site, une boucle calculée exprès (rien d'enregistré ni de publié). Quand la machine change, une commande refait le PDF.
- **Au téléphone, pas de préparation d'avance des PCB** (la mémoire de l'iPhone) : la réserve suffit.
- **Les boutons RUN du Roto en bascule : laissés tels quels.** Rien ne prouve que le Roto renvoie un 0 tout seul ; à surveiller.
- **Le compteur de visiteurs : pas fait.** Tu as répondu « Pas maintenant » au projet Supabase qu'il demande.

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika, à tester sur ton Mac (sons réels, à toi de lancer) :**
  1. RUN, puis OPEN de l'ARP, Dark / Light, ADD DECK, le menu, une autre fenêtre devant Chrome : la musique doit continuer.
  2. Tourner les potards du SMPL en SLICE puis en GRAIN, SCAN, poser le doigt sur l'écran.
  3. Dire si une coupure reste, et pendant quel geste.
- **Roto-Control :** réimporter « MM SMPL (SETUP 15).json » (MIDI > DOWNLOAD THE 6 SETUPS) : SCAN y remplace SPREAD, la page 2 regroupe les grains.
- **Visiteurs connectés dans MENU :** quand tu veux, il faudra un petit service (Supabase Realtime, gratuit) : dis « go » et je le mets en place.
- **Tes kicks pour tous les visiteurs :** toujours en attente des fichiers WAV.
- La tâche « thème clair : SCOPE et ALL » que tu avais lancée à part : les deux points sont réglés dans cette session (SCOPE en os sur fond sombre, ALL devenu STUDIO lisible), elle n'a plus d'objet.
- Si des coupures restent malgré tout : séquencer dans le moteur audio (voir plus haut).

## 4. Commandes utiles ajoutées

- `npm run manual:smpl` : refait `public/docs/MM-SMPL-mode-emploi.pdf` (le site en dev, les captures, la mise en page, le PDF).
  - Il faut Playwright : `npm i --no-save playwright && npx playwright install chromium`.
  - Pour un serveur déjà lancé : `SITE_URL=http://localhost:5173 npm run manual:smpl`.
- `window.__v4.clock.rescheduled` (avec `?debug=1`) : le nombre de re-programmations du MM-RYTM.
