# 2026-10-01 : nouvelle image d'aperçu des liens

## 1. Ce qui a été fait

- public/images/og-image.jpg : la photo de scène du press kit (la salle pleine) remplace l'illustration orange ; logo blanc, VRSTL Records et les adresses gardés.
- docs/og-image/ : og.html (la composition), build.sh (rendu Chrome sans tête, JPEG 85), README.
- index.html, scripts/prerender-seo.mjs, src/lib/seo.ts : adresse de l'image en `?v=2027` pour forcer les réseaux à la recharger.

## 2. Décisions prises et pourquoi

- Visuel choisi par Mika : la photo de scène (plutôt que la machine ou le portrait).
- Même mise en page que l'ancienne image : Mika trouvait les infos et le logo bons, seul le fond changeait.

## 3. Ce qui reste à faire / points en suspens

- Messenger garde l'ancien aperçu en cache : le rafraîchir dans le débogueur de partage de Facebook (Scrape Again), côté Mika.

## 4. Commandes utiles ajoutées

- `sh docs/og-image/build.sh` : refait l'image d'aperçu.
