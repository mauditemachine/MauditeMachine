# 2026-10-04 : son qui grésille, PLAY/STOP au mixer, REMOVE DECK, logotype, Dock MIXER au téléphone, référencement

Mika, en deux messages :
« Je voudrais un bouton playstop dans le mixer, bien placé, pas trop imposant,
et que ça se voie au téléphone ! En mobile tout doit être disponible avec des
knobs plus gros, la plupart des gens viendront en mobile. L'appli sur l'écran
d'accueil de l'iPhone, il faut le proposer aux visiteurs à chaque fois. Augmente
le référencement. Je ne sais toujours pas comment supprimer un deck ajouté. Le
logotype en haut à droite du logo Maudite Machine, en jaune, à la même taille. »
Puis : « SEMI et FINE sont d'une autre couleur, je veux la même chose que les
autres. Les waveformes, c'est pas beau, peut-être juste des barres fines. Le son
grésille, comme Ableton quand le CPU sature, et le CPU chauffe. »

## 1. Ce qui a été fait

- Son qui grésille :
  - audio/drums.ts : le contexte audio en latence `balanced` (environ 10 ms) au lieu de `interactive` (le plus petit tampon de la carte, 2,7 ms sur un Mac) ;
  - scene/renderer.ts : 60 images par seconde au plus (FRAME_MIN_MS) ;
  - audio/scope.worklet.js, audio/scope.ts : l'oscilloscope recycle ses tampons, plus aucune allocation sur le fil audio ;
  - ui/Scope.tsx : 60 images par seconde au plus sur desktop.
- MM-ARP, SEMI et FINE : le capuchon noir des autres potards (voyager/knobs.ts, voyager/theme.ts, voyager/rig.ts).
- MM-DECKS, formes d'onde en barres fines (dj/waveform.ts) : 150 barres par fenêtre, calées sur le temps, 200 sur la piste entière, dans les trois affichages.
- MM-DECKS, PLAY/STOP des machines au mixer :
  - actions.ts : machinesToggle ;
  - dj/theme.ts, dj/layout.ts : le bouton sous le VU du master ;
  - dj/controls.ts, dj/rig.ts, dj/silk.ts : l'aluminium, la lumière jaune, RYTM + ARP au-dessus ;
  - dj/gestures.ts, dj/keys.ts : la touche, et G au clavier ;
  - dj/Twins.tsx : le jumeau accessible ;
  - scene/renderer.ts : la vue reste à la table quand une machine part de là.
- MM-DECKS, REMOVE DECK sous ADD DECK (dj/Twins.tsx, dj/dj.css, dj/theme.ts) : au survol du bord droit sur desktop, dans le bloc de fin au téléphone (aussi à 4 platines).
- En-tête, le logotype jaune à droite du mot (ui/Header.tsx, ui/MobileHeader.tsx, v4.css, public/logo/mauditemachine-logotype-mark.png).
- Invitation écran d'accueil à chaque visite (state/install.ts, ui/InstallPrompt.tsx) : fermée, elle revient à la visite suivante.
- Téléphone, le Dock du MM-DECKS (dj/MixDock.tsx, nouveau ; index.tsx ; v4.css) : la languette MIXER ouvre tous les réglages de la table en gros. ui/KnobPanel.tsx : le gros potard est devenu générique (KnobView).
- Référencement, travail de l'agent délégué, relu puis intégré :
  - scripts/prerender-seo.mjs, scripts/seo-shared.mjs (nouveau), scripts/generate-sitemap.mjs ;
  - index.html, src/data/seo-meta.json, src/App.tsx, state/sectionRoute.ts, v2/pages/RadarPage.tsx ;
  - public/press/index.html, public/llms.txt, public/sitemap.xml ;
  - .github/workflows/pages.yml (l'historique complet pour les dates du sitemap).
- docs/v4/spec.md : R14-103 à R14-111.

## 2. Décisions prises et pourquoi

- Le grésillement : la charge audio moyenne est raisonnable (13 % avec RYTM et ARP, 24 % avec deux platines, cinq effets et les deux machines, mesuré dans Chromium). En revanche, des pics montent jusqu'à 50-78 % d'un tampon. Avec le plus petit tampon de la carte, le moindre pic craque. `balanced` donne quatre fois plus de marge, pour environ 7 ms de latence en plus au toucher. Le synthé du MM-ARP reste suréchantillonné x4 : sa qualité n'a pas bougé.
- 60 images par seconde : un écran à 120 Hz (MacBook Pro) rendait deux fois plus d'images pendant la lecture, d'où la chauffe. Sur un écran à 60 Hz, rien ne change.
- Au téléphone, la densité de pixels reste à 3. Mika avait trouvé 1,5 pixellisé, et la cadence plafonnée suffit pour l'instant.
- Barres fines : calées sur le temps, et non sur les pixels, pour qu'elles défilent avec la musique sans scintiller. Chaque barre prend la crête de tout son pas, ce qui lisse le grain. Quand une barre ferait moins d'un pixel (vue de loin), le trait continu revient.
- PLAY/STOP au mixer : il lance les deux machines des voies 1 et 2 ensemble, l'arpège calé sur la grille de la boîte, et les platines continuent (c'est fait pour mixer par-dessus). Il est placé sous le VU du master, plus petit que le PLAY d'une platine. Espace reste le PLAY de la dernière platine (convention DJ), le mixer prend G.
- REMOVE DECK : sur desktop, les noms sont alignés contre le bord de la fenêtre. En perspective, l'écran de la dernière platine déborde sur la gauche de la zone et cachait le début de ADD DECK.
- Logotype : sa couleur suit celle du mot, l'or en sombre et l'encre en clair, où le jaune ne se lirait pas sur le crème.
- Invitation : sessionStorage, donc une fois fermée, elle ne revient pas à chaque rechargement du même onglet, mais elle revient à la visite suivante.
- Référencement :
  - le texte de chaque page reste dans le DOM, masqué. C'est le même texte que la machine affiche, lisible au lecteur d'écran, retiré à la navigation ;
  - mots-clés : l'agent a gardé « indie dance and psy prog », le positionnement fixé par Mika le 2026-10-01 (« dark disco » et « minimal hypnotique » le contredisaient).

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'oreille : le grésillement a-t-il disparu ? Si un pic craque encore sur le Mac, on peut passer le synthé en x2 sur desktop (14 % au lieu de 21 %) ou réduire les voix.
- Mika, sur un vrai iPhone :
  - le Dock MIXER du MM-DECKS ;
  - le PLAY/STOP sur la vue de droite du mixer ;
  - REMOVE DECK dans le bloc de fin ;
  - le logotype dans l'en-tête.
- Référencement, côté Mika :
  - Search Console : soumettre sitemap.xml, demander l'indexation de /radar/, /tracks/ et de quelques morceaux ;
  - Bing Webmaster Tools ;
  - tester les résultats enrichis sur /shows/ (une heure, un lien billetterie et l'organisateur dans events.json aideraient) ;
  - le débogueur de partage Facebook sur 2 ou 3 morceaux ;
  - confirmer la date et le label de Tati Cardi EP.
- Référencement, côté code :
  - les sections du menu en vrais liens `<a href>` ;
  - le titre de l'accueil (COPY.title) ;
  - le « Back to site » du Radar vers / ;
  - un rebuild quotidien pour que les dates passées quittent « Upcoming ».
- Toujours en suspens :
  - les secrets SoundCloud du worker Sonaa ;
  - le défilement de la playlist au doigt sur iPhone ;
  - l'équilibre RYTM / ARP ;
  - les sons 909 et 808 à l'oreille.

## 4. Commandes utiles ajoutées

- Aucune commande npm. Au clavier du MM-DECKS : G, PLAY/STOP des machines.
- Clés retenues dans le navigateur :
  - `mm.v4.djdock` (le Dock MIXER ouvert ou replié) ;
  - `mm.v4.knobtab.dj` (son onglet) ;
  - `mm.v4.install` (passée en sessionStorage, la visite).
