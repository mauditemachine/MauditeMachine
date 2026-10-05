# 2026-10-05 : intro sur une machine, sans scintillement ; logotype à gauche, en jaune

Mika : « À l'intro, l'image flick un peu. J'aimerais aléatoirement qu'une seule
machine s'ouvre et se ferme et arrive en 3D zoom pour se mettre dans la vue par
défaut. Le logotype devrait être à gauche du logo Maudite Machine, et en
jaune. »

## 1. Ce qui a été fait

- Intro (scene/renderer.ts, theme.ts INTRO) :
  - une seule machine : celle de ?m= (MM-RYTM ou MM-ARP), sinon l'une des deux au hasard ;
  - son capot s'ouvre puis se referme ; l'autre reste fermée ;
  - la caméra arrive en 3D : tournée de 38 degrés (d'un côté ou de l'autre, au hasard), plus loin et plus bas, jusqu'à la vue par défaut de cette machine.
- Contre le scintillement (scene/renderer.ts) :
  - l'horloge de l'intro avance de 50 ms au plus par image : une image lente ralentit l'intro au lieu de la faire sauter ;
  - le MM-DECKS et le MM-SMPL, qui arrivent pendant l'intro, se posent à sa fin (plus de saccade ni de recadrage en plein milieu) ;
  - plus de vue d'ensemble pendant l'intro, donc plus de zoom vers le MM-RYTM juste après au téléphone.
- En-tête (ui/Header.tsx, ui/MobileHeader.tsx, v4.css) : le logotype à gauche du mot, en jaune (#F2C230 ; #E0A800 en thème clair).
- docs/v4/spec.md : R14-132 et R14-133.

## 2. Décisions prises et pourquoi

- Seuls le MM-RYTM et le MM-ARP ont un capot qui s'ouvre et se ferme. Avec ?m=dj ou ?m=smpl, pas d'intro : on arrive directement sur la machine demandée.
- L'intro finit sur la vue par défaut de la machine choisie, plus sur la vue d'ensemble (c'est ce que Mika décrit). Au premier geste, elle se termine tout de suite à cette vue.
- Scintillement : on ne peut pas le voir image par image ici (le navigateur de test rend en logiciel, une image par seconde environ). Les trois causes visibles dans le code sont traitées : les machines qui arrivent en cours d'intro, le temps qui saute après une image lente, le changement de cadrage.
- Le jaune du logotype est celui du site (#F2C230), distinct de l'or du mot (#FFA600) ; en thème clair, un ton plus soutenu pour se lire sur le crème.

## 3. Ce qui reste à faire / points en suspens

- Mika, sur sa machine et sur iPhone :
  - dire si le scintillement a disparu (sinon : à quel moment de l'intro, et sur quel appareil) ;
  - si l'arrivée en 3D lui plaît (angle, distance et durée réglables dans theme.ts INTRO : azFromDeg, zoomFrom, ms).
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, une voie du MM-SMPL au mixer, un séquenceur de 16 pas sur les trigs du MM-SMPL.

## 4. Commandes utiles ajoutées

- Aucune.
- Pour voir l'intro en local : le build de production (`npm run build`, puis `npx vite preview`). En `npm run dev`, React monte la scène deux fois et la reconstruction saute l'intro.
