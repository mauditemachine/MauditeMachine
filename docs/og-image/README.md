# Image d'aperçu des liens (Open Graph)

`public/images/og-image.jpg`, 1200 x 630, celle que Messenger, Facebook, X et
les messageries affichent sous un lien vers mauditemachine.com.

Depuis le 2026-10-01 : la photo de scène du press kit 2027
(`docs/presskit-2027/photos/stage-crowd.jpg`, la salle pleine), assombrie, le
logo MAUDITE MACHINE en blanc, VRSTL Records et les deux adresses dessous.
Avant : une illustration orange et violette.

Refaire l'image : modifier `og.html`, puis

    sh docs/og-image/build.sh

Après un changement, monter la version `?v=` de l'adresse de l'image
(index.html, scripts/prerender-seo.mjs, src/lib/seo.ts) : les réseaux gardent
l'ancienne en cache tant que l'adresse ne change pas.
