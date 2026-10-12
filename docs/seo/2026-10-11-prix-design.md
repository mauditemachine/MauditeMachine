# Prix de design : dossier de soumission MM-STUDIO

Les textes pour les jurys sont en anglais. Les règles et les frais ont été lus le 2026-10-11 sur les pages citées (audit awards) ; relis-les avant de payer, ils changent. Les faits viennent de 2026-10-11-fiche-faits-mm-studio.md.

## 1. Textes à coller

Titre (25 signes, convient à CSS Winner qui en accepte 35) :

```text
Maudite Machine MM-STUDIO
```

Description courte (162 signes, CSS Winner en accepte 170) :

```text
Website of DJ and producer Maudite Machine: a 3D studio you can play in the browser, with a drum machine, a synth and DJ decks, built with Three.js and Web Audio.
```

Description longue (Awwwards, Webby, Behance ; 147 mots, la cible est 120 à 150) :

```text
MM-STUDIO is the website of Maudite Machine, a DJ and producer of indie dance and dark disco based in Montpellier, in the south of France. The home page is a 3D studio you can play, with three machines that share one tempo: MM-RYTM, a drum machine with parameter locks and 16 patterns; MM-ARP, a two-oscillator synth with an arpeggiator and chord pads; MM-DECKS, two to four DJ decks and a mixer that load his tracks from SoundCloud, Creative Commons tracks, your own SoundCloud account or your own files. Each control has a labelled HTML twin reachable with the keyboard, MIDI controllers can be mapped to every parameter, and the scene comes in a dark and a light version. On a phone, the machines come one at a time. Tracks, mixtapes, shows, the press kit and booking open as panels over the studio. Designed and built by Mika.
```

Crédits :

| Champ | Valeur |
|---|---|
| Nom affiché | Maudite Machine (Mika) |
| Rôle | Design and development |
| Pays | France |
| Site | https://mauditemachine.com/ |
| Crédits additionnels (Awwwards, "Additional credits") | aucun, sauf si quelqu'un a travaillé sur les photos ou le son [A CONFIRMER PAR MIKA] |

Couleurs (src/v4/theme.ts et src/v4/v4.css) : ink #0A0A0B, graphite #141417, bone #F6F1E7, yellow #F2C230, orange #FF6A13, red #C8442F, fond de page #0C0B09.

Polices : en attente de ta décision sur les licences. Aujourd'hui le studio utilise SF Pro Display et Robot Radicals, les pages v2 utilisent Larsseit (licence à toi d'après src/v2/v2.css). Ne déclare aucune police tant que SF Pro n'est pas remplacée ou couverte, et que la licence de Robot Radicals n'est pas vérifiée (correctif P0 de l'audit awards).

Technologies : Three.js, WebGL 2, Web Audio API, AudioWorklet, Web MIDI, React 18, TypeScript, Vite, GitHub Pages.

Tags : Music, 3D, WebGL, Interactive, Sound, Dark, Animation, Audio. Pour CSS Winner (5 tags au plus, dans leur liste) : catégorie Music, tags Animated, Artistic, Full Screen, Responsive, Retro-Vintage.

## 2. Formats des visuels

| Plateforme | Format demandé (source) |
|---|---|
| Awwwards | Vignette principale 1600x1200 ; vidéos recommandées (https://www.awwwards.com/faqs/) |
| CSS Winner | Capture 1100x770, JPG seulement (https://csswinner.com/submitsite) |
| Behance | Couverture d'au moins 808x632 (help.behance.net, article 204483484) |
| Dribbble | 1600 px de large au moins, ratio libre ; image de 10 Mo au plus ; vidéo mp4 ou mov de 20 Mo au plus (help.dribbble.com, article 11062601) |
| Product Hunt | Galerie 1270x760, 2 images au moins ; vignette 240x240, GIF de moins de 3 Mo ; vidéo YouTube seulement (https://help.producthunt.com/en/articles/479557-how-to-post-a-product) |

Visuels à faire toi-même sur un vrai GPU, en 2x (les captures SwiftShader de l'audit ne servent que de repère de cadrage ; les quatre images provisoires de public/press/mm-studio/, déjà sur /press/, sont de ce type, à remplacer avant tout envoi à un jury) :

- 1600x1200 : vue d'ensemble des trois machines en sombre, MM-ARP de près, PCB ouvert du MM-RYTM, machine blanche en clair, menu, panneau TRACKS ;
- 1100x770 en JPG pour CSS Winner, et une couverture Behance d'au moins 808x632 ;
- trois captures téléphone 390x844 : MM-RYTM en portrait, MM-ARP, menu.

Vidéo (c'est toi qui l'enregistres, avec le son, jamais pendant nos tests) : 45 à 60 secondes, desktop puis téléphone. L'arrivée, un pattern MM-RYTM avec un P-lock, des accords MM-ARP, un mix sur MM-DECKS, le passage de DARK à LIGHT, puis MENU et TRACKS. Export mp4 de moins de 20 Mo pour Dribbble, une version 1600x1200 pour Awwwards, une version sur YouTube pour Product Hunt.

## 3. Règles et frais (lus le 2026-10-11)

| Prix ou vitrine | Frais | Ce qu'il faut savoir | Source |
|---|---|---|---|
| Awwwards | 65 $ (Standard, 1 site) ou 165 $ par an (User Pro) ; aucun remboursement | Critères : Design 40 %, Usability 30 %, Creativity 20 %, Content 10 %. Au moins 18 jurés, les 3 notes les plus éloignées de la moyenne sont retirées, 5 jours de vote. Honorable Mention à partir de 6,5. Developer Award réservé aux sites du jour, note supérieure à 7. Brouillon modifiable puis figé en revue, approbation sous une semaine au plus, éligibilité au site du jour pendant 3 mois après approbation. Seuil de Mobile Excellence : à vérifier. | https://www.awwwards.com/submit/ , https://www.awwwards.com/faqs/ , https://www.awwwards.com/about-evaluation/ |
| Webby Awards | Creator Single 395 $ ou 455 $ ; General Single 525 $ ou 595 $ (l'écart dépend de la date limite, à vérifier) | Date limite early : 30 octobre 2026. Le site doit rester en ligne jusqu'à mi-2027. Catégorie à choisir sur leur site (à vérifier). Contact : evey@webbyawards.com | https://www.webbyawards.com/eligibility-and-guidelines/ , https://www.webbyawards.com/judging-criteria/ |
| CSS Winner | 15 $, remboursés si le site est refusé | Titre de 35 signes, description de 170, 5 tags au plus, catégorie, nom du designer et pays | https://csswinner.com/submitsite |
| CSS Design Awards | Environ 50 $ (à vérifier, site bloqué d'ici) | D'après une source secondaire : critères UI, UX, Innovation ; site du jour au-dessus de 8,0 ; jugement en 96 h | webdesignawards.io/awards/cssda (revu le 2026-08-24), à vérifier sur cssdesignawards.com |
| The FWA | Environ 70,50 GBP (à vérifier) | Critères cités ailleurs : Innovation, Design, Creativity, Content, User experience ; seuil du site du jour à vérifier | sources secondaires, à vérifier sur thefwa.com |
| Muzli (publication Medium) | Gratuit | Une étude de cas déjà publiée, envoyée à medium@muz.li avec une phrase ; pas d'article commercial ni signé par une marque ; l'article reste 6 mois ; réponse sous 3 jours ouvrés environ | https://muz.li/submit-to-muzli-on-medium/ |
| Forum three.js | Gratuit | Publication après approbation d'un modérateur (post prêt dans 2026-10-11-lancement-posts.md) | https://discourse.threejs.org/c/showcase/7 |
| One Page Love | Gratuit | Sites d'une seule page seulement ; MM-STUDIO a des pages séparées (/press/, /techrider/), donc peu de chances | onepagelove.com/submit |
| Httpster | | Soumissions fermées | httpster.net/about/ |
| Godly | | godly.website redirige vers recent.design, aucune soumission trouvée : à vérifier | |
| Siteinspire, Land-book, Lapa Ninja | | Pages bloquées d'ici : à vérifier (Lapa Ninja vise les landing pages) | |
| Behance, Dribbble | Gratuit | Projet sur ton profil, formats ci-dessus | help.behance.net, help.dribbble.com |

## 4. Ordre conseillé

1. Les correctifs d'abord : polices (P0), puis les P1 de l'audit, en ligne.
2. Les canaux gratuits ou peu chers, pour avoir des retours : forum three.js, Behance, Dribbble, étude de cas Muzli, CSS Winner (15 $).
3. CSS Design Awards (environ 50 $), puis Awwwards (65 $, une seule tentative utile, sans remboursement) quand l'étude de cas et la vidéo sont prêtes.
4. The FWA.
5. Webby : décision avant le 30 octobre 2026 pour le tarif early.

## 5. Liste de contrôle avant chaque soumission payante

- [ ] Licences des polices réglées (SF Pro Display remplacée ou couverte, Robot Radicals vérifiée).
- [ ] https://mauditemachine.com/mm-studio/ en ligne (404 le 2026-10-11).
- [ ] Une URL inconnue rend bien la page 404 du site.
- [ ] Favicon visible dans l'onglet (public/favicon.ico est en cours d'ajout dans le dépôt).
- [ ] Console du navigateur propre sur l'accueil, en sombre et en clair.
- [ ] PageSpeed Insights mobile mesuré sur la prod (les mesures de l'audit sont locales, en SwiftShader, sans valeur pour un jury).
- [ ] Vidéo prête, visuels aux formats ci-dessus.
- [ ] Un seul h1 sur l'accueil (l'audit en a trouvé deux : le h1 caché "MAUDITE MACHINE MM-RYTM" et le h1 statique "Maudite Machine").
- [ ] Décision sur le libellé MOOG du sélecteur MODE du filtre du MM-ARP (le remplacer par LADDER évite une marque visible à l'écran).
- [ ] Description relue par toi, aucun terme de la liste interdite, aucun chiffre ajouté.
