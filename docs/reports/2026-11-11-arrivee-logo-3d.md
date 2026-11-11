# 2026-11-11 - Arrivee du site : logo 3D, menu, MM-RYTM

Demande de Mika : a l'arrivee, le logo MAUDITE MACHINE arrive en 3D, de gros a centre, puis devient 2D ; on defile et on arrive dans le menu ; on defile encore et le MM-RYTM arrive de tres zoome jusqu'a son cadrage, sur ordi comme au telephone, dans les couleurs du site.

## 1. Ce qui a ete fait

- `src/v4/state/arrival.ts` (nouveau) : l'etat de l'arrivee (`logo`, `menu`, `machine`, `done`, `off`). Elle se joue sur l'accueil seul ; jamais sur une adresse profonde, avec un parametre de machine ou de debug, sous la reduction des animations, ni dans le plugin.
- `src/v4/arrival/logo3d.ts` (nouveau) : le logo en relief (three.js), extrude depuis les traces SVG officiels, biseaute, eclaire ; il arrive enorme et de biais, se redresse, se pose, puis son epaisseur tombe a zero et sa couleur rejoint la teinte exacte du logo plat.
- `src/v4/arrival/logoPaths.ts` (nouveau) : les traces du logo et du logotype, copies de `public/logo/`.
- `src/v4/arrival/Arrival.tsx` + `arrival.css` (nouveaux) : la couche au-dessus du site. Entree du logo sans geste, puis trois arrets menes par la molette, le doigt ou les fleches : logo, menu, machine. Le logo plat file du centre vers sa place exacte dans l'en-tete pendant que le menu se deploie.
- `src/v4/scene/renderer.ts`, `src/v4/theme.ts` : camera d'arrivee (`arrivalCamera`, `ARRIVAL_CAM`) : le MM-RYTM part d'un plan tres rapproche et recule jusqu'a son cadrage normal. Le premier geste ne coupe plus l'intro pendant l'arrivee.
- `src/v4/index.tsx`, `ui/Header.tsx`, `ui/MobileHeader.tsx`, `ui/MenuSheet.tsx` : le menu s'ouvre et se ferme avec l'arrivee ; un clic dans le menu ou sur CLOSE y met fin.
- `src/v4/ui/InstallPrompt.tsx` : la carte "Add to Home Screen" attend 14 s apres l'arrivee (4 s sinon), pour ne pas retrecir la machine en plein zoom.
- `src/v4/firmware.json` : empreinte reposee (`firmware:stamp`), versions inchangees.
- Retour de Mika le meme jour ("je voudrais que le dezoom de rytm se fasse aussi avec le scroll") : dans `Arrival.tsx`, le recul du MM-RYTM suit maintenant le geste. La camera recule tant qu'on defile, s'arrete ou on s'arrete, revient si on remonte. `arrival.css` : SCROLL reste affiche pendant le recul.

## 2. Decisions prises et pourquoi

- Couleurs du site : faces `#FFA600` (logotype) et `#F2C230` (logo), flancs orange `#FF6A13`, fond `--ink`. En theme clair : gris `#434343` et `#737373` sur creme, comme l'en-tete clair.
- Le logo 3D a son propre canevas WebGL, au-dessus du site : la scene des machines se charge dessous sans que l'entree en depende.
- Le passage 3D vers 2D se fait sur place : le logo plat (SVG) remplace le relief au pixel pres, puis c'est lui qui vole vers l'en-tete. Aucun saut visible entre les deux.
- Vers le menu : un geste = un arret (le menu ne se saute jamais), et on peut remonter du menu au logo. Au telephone le menu garde le doigt tant qu'il peut defiler ; une touche MM-RYTM en bas mene a la suite.
- Le recul du MM-RYTM se mene au geste : 900 px de molette pour tout le trajet (7 crans de souris environ apres le passage), un peu plus d'une hauteur d'ecran au doigt, avec un leger elan au lacher. Seul le passage du menu a la machine (le fondu) se joue d'un trait, pour ne jamais rester sur un fond plein ; il a une vitesse plafond, meme sur un grand geste.
- Dans les derniers 20 % du trajet le recul se finit seul et le site reprend la main : on ne reste pas a un cheveu du cadrage avec la couche encore au-dessus. Un clic ou un tap en plein recul le finit aussi ; les fleches vont d'un arret a l'autre.
- L'elan de la molette (pave tactile) apres la fin est avale jusqu'au premier silence : sinon il zoomait la machine.
- SKIP, Echap ou un clic dans le menu terminent l'arrivee ; elle ne bloque jamais le site.
- Entre le menu et la machine : un fondu court dans la couleur du fond, sous l'en-tete qui reste en place.
- Sans WebGL pour le logo : le logo plat arrive seul, de gros a pose.
- Verifie par captures dans un navigateur sans carte graphique, ordi 1440x900 et iPhone 13, themes sombre et clair, sequence complete a la molette et au doigt, retour du menu au logo, bascule du theme pendant l'arrivee : aucune erreur JS. `tsc` reste a 105 erreurs (celles d'avant).

## 3. Ce qui reste a faire / points en suspens

- Mika : juger la fluidite et le rythme sur un vrai appareil (ordi et telephone). L'environnement de test n'a pas de carte graphique : les images sont justes, la fluidite n'a pas pu etre mesuree.
- Reglages faciles si le rythme ne plait pas : duree de l'entree (`ENTRANCE_MS`, 3,6 s), taille de depart du logo (`S0`), plan de depart sur la machine (`ARRIVAL_CAM`), longueur de defilement du recul (`SCRUB.WHEEL_K`, `TOUCH.machine`), part finale qui se finit seule (`SCRUB.END`).
- L'arrivee se joue a chaque visite de l'accueil. Si elle doit ne se jouer qu'une fois par visiteur, c'est un petit ajout.
- Au telephone, au menu, l'entree CONTACT est sous la touche MM-RYTM tant qu'on n'a pas fait defiler le menu.
- `scripts/smoke-v4.mjs` n'a pas ete relance.

## 4. Commandes utiles ajoutees

- `?arrival=1` force l'arrivee (meme avec d'autres parametres) et pose `window.__mmArrival` pour les sondes ; `?arrival=0` l'ecarte.
