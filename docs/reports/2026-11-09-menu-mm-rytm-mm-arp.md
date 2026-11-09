# 2026-11-09 - Menu : MM-RYTM et MM-ARP a la place de Studio

## 1. Ce qui a ete fait

- `src/v4/ui/Header.tsx` : `PAGE_LINKS` passe de 6 a 7 entrees : Tracks, Mixtapes, MM-RYTM, MM-ARP, Shows, Press, Contact (Studio retire) ; `MACHINE_LINKS` (adresses `/?m=mm-rytm`, `/?m=mm-arp`) et `goMachine()`.
- `src/v4/ui/MenuSheet.tsx` : MM-RYTM et MM-ARP sont de vrais liens `<a href>` ; un clic simple ferme le menu, ferme les sections et cadre la machine sans recharger ; Cmd/Ctrl/clic milieu ouvrent l'adresse directe dans un nouvel onglet. MM-ARP cache si `?voyager=0`.
- `src/v4/v4.css` : `a.v4-mm-page` sans soulignement, meme hauteur et couleur que les autres lignes.

## 2. Decisions prises et pourquoi

- Menu ouvert a l'arrivee : deja en place depuis le 2026-11-02 (`initialMenuOpen`), verifie de nouveau sur desktop et telephone. Il reste ferme quand on arrive par un lien direct (`/?m=...`, une section) : le visiteur va directement a ce qu'il a demande.
- Liens directs via `?m=` (deja gere par `src/v4/state/focus.ts`) : pas de nouvelle route a creer.

## 3. Ce qui reste a faire / points en suspens

- "Studio" reste visible ailleurs : la pastille Studio sous "Under the hood" (section setup, cours, impression), le bouton STUDIO du selecteur de machines dans l'en-tete desktop (vue d'ensemble), et le lien "How MM-STUDIO works" en pied de menu. A retirer ou renommer si Mika le demande.
- A 1280x720, la 7e ligne (Contact) touche le bas de l'ecran ; le menu defile, rien n'est perdu.

## 4. Commandes utiles ajoutees

- Aucune. Liens directs : `https://mauditemachine.com/?m=mm-rytm` et `https://mauditemachine.com/?m=mm-arp`.
