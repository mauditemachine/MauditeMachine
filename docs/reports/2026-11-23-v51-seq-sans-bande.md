# 2026-11-23 : MM-ARP v51, page SEQ sans bande vide

Demande de Mika apres v50 : "enleve aussi la bande vide dans la page SEQ". La matrice xM etait partie dans l'encart
d'EDIT et laissait environ 210 unites vides sous la rangee RANDOM / ARP / LFO 1 + / LFO 2.

## 1. Ce qui a ete fait

- src/v4/plugin/arp/pages2.tsx : hauteur des touches du sequenceur 108 -> 298 (constante PAD_H, zone de dessin et
  aide derivees), cadre STEP SEQUENCER 250 -> 440 (SEQ_H), rangee du bas placee sous le cadre (y 330 -> 520), dessin
  RATCHET mis a l'echelle de la nouvelle hauteur.
- src/v4/plugin/arp/pages2.css : onglets de piste 18 -> 26 de haut, repartis sur toute la hauteur des touches.
- docs/reports/2026-11-09-plugin-mm-arp.md (section v51), CLAUDE.md (etat v51).

## 2. Decisions prises et pourquoi

- Remplir par le sequenceur plutot que centrer le contenu : la fenetre du plugin a une taille fixe pour toutes les
  pages, et des touches plus hautes donnent plus de precision au crayon et a NOTE (8,5 unites par degre au lieu
  de 2,4, sur 31 degres).
- Pas de maquette A / B / C : la demande est explicite et n'ajoute aucun element, la capture est envoyee avec la
  publication. Les cadres LFO 1 + et LFO 2 restent sur la page SEQ (Mika n'a demande que la bande).

## 3. Ce qui reste a faire / points en suspens

- Mika : installer v51, verifier la page SEQ (taille des touches, onglets espaces) ; retours v50 (HELL MIX / MASTER
  VOLUME modules vite, LFO 3 et DISTO, viseur, menu DESTINATION, NOTE dans SQ, CPU avec 8 emplacements) et v49
  (LATENCY 0 dans Live, PRO ECO).

## 4. Commandes utiles ajoutees

- Aucune. Installation : curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
