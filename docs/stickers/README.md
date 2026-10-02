# QR code des stickers

Le QR code mène à `https://mauditemachine.com/qr/`, qui renvoie à l'accueil
avec `utm_source=sticker&utm_medium=qr&utm_campaign=stickers` : Google
Analytics compte les visites venues des stickers à part.

Fichiers :

- `qr-mauditemachine.svg` : noir sur fond transparent (vectoriel, pour l'imprimeur).
- `qr-mauditemachine-blanc.svg` : blanc, pour un sticker à fond foncé.
- `qr-mauditemachine-orange.svg` : orange du site (#FF6A13), sur fond clair seulement.
- `qr-mauditemachine.png` : noir sur blanc, 2624 px.

Correction d'erreur maximale (H, 30 % du code peut être abîmé ou couvert,
un petit logo au centre passe). Version 4, 33 x 33 modules.

Impression : 2 cm de côté au moins (2.5 cm conseillés), garder la marge
blanche autour (4 modules, déjà dans les fichiers), fort contraste. Tester
au téléphone sur un tirage avant la série.

Voir les visites : Google Analytics, Rapports, Acquisition, Acquisition de
trafic, filtre « Source de la session = sticker ».

Le lien est fixe : on peut changer la destination plus tard
(`public/qr/index.html`) sans réimprimer.
