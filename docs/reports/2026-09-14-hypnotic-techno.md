# Bascule de genre : hypnotic techno

Date : 2026-09-14
Commit : `a5f70c0` content(genre): hypnotic techno partout a la place de indie dance / dark disco

## 1. Ce qui a ete fait

Demande de Mika : « je fais de l'hypnotic techno maintenant, plus de indie
dance / dark disco, change ca partout sur le site ». Inventaire complet des
occurrences puis remplacement, en distinguant ce qui parle de LUI de ce qui
parle des AUTRES artistes.

### Site actuel (v2)

| Fichier | Changement |
| --- | --- |
| `src/v2/V2App.tsx` | Titre du document : `DJ Montreal - Hypnotic Techno` |
| `src/v2/components/Intro.tsx` | Lead du bloc About reecrit : « pushes techno into its most hypnotic territory » |
| `src/v2/components/EPK.tsx` | Bio EN : « the future of North American hypnotic techno » / Bio FR : « le futur de la techno hypnotique nord-americaine » |

### Referencement (`index.html`)

- `<title>` : `Maudite Machine | DJ Montreal - Hypnotic Techno`
- `meta description` : « Hypnotic techno, minimal, sets immersifs »
- `meta keywords` : `DJ indie dance` / `DJ dark disco` remplaces par
  `DJ hypnotic techno`, `DJ techno hypnotique`, `DJ techno melodique`
- JSON-LD `description`, `genre` (`["Hypnotic Techno", "Techno", "Minimal", "Electronic"]`),
  `knowsAbout`, description du label VRSTL Records
- `og:title` / `og:description` / `twitter:title` / `twitter:description`
- `public/manifest.json` : description PWA

### v1 archivee et admin local

- `src/translations.ts` : 24 remplacements sur les trois langues (bio, genres,
  meta SEO par page, description du Radar, description du catalogue, texte du
  label)
- `src/data/seo-meta.json` : 6 remplacements (titles + descriptions FR/EN/ES)
- `src/components/Admin.tsx` : bio par defaut proposee dans l'admin
- `src/components/AdminEvents.tsx` : placeholder du champ genre d'une release
- `src/styles/radar.css` : commentaire « rouge dark disco » devenu « rouge profond »

## 2. Decisions prises et pourquoi

**`public/releases.json` volontairement NON modifie.** Ce fichier alimente le
Radar : ce sont les sorties d'autres artistes (Tronik Youth, Kiki & Local
Suicide, Curses, Darlyn Vlys, Damon Jee...). Leurs genres reels sont bien
indie dance et dark disco, les reecrire serait une fausse information sur le
travail de tiers. Verification faite entree par entree : aucune sortie de
Maudite Machine ne portait ces genres.

**Description du label VRSTL Records elargie plutot que basculee.** Le
catalogue VRSTL (21 EPs, 2 albums, artistes d'Argentine, du Quebec et
d'Europe) n'est pas que de la techno hypnotique. Formulation retenue :
« label independant canadien dedie aux musiques electroniques hypnotiques »,
qui couvre le catalogue sans mentir ni rester coince sur l'ancien positionnement.
Si Mika veut coller strictement « hypnotic techno » sur le label aussi, c'est
une ligne a changer.

**v1 archivee mise a jour elle aussi.** La regle du repo protege la DA de la
v1 (fond noir), pas ses textes. Comme `/v1` reste accessible en ligne et que
la demande etait « partout sur le site », les bios y ont ete alignees.

**Le mot « hypnotic » etait deja present** dans le lead et le hero
(« RAW. HYPNOTIC. UNDERGROUND. ») : le lead a ete reecrit pour eviter la
repetition « hypnotic techno ... raw and hypnotic », pas juste substitue mot
a mot.

## 3. Ce qui reste a faire / points en suspens

Cote Mika :

- **Description du label VRSTL** : valider la formulation elargie ou demander
  un alignement strict sur hypnotic techno (`index.html` ligne 131 +
  `src/translations.ts` `labelDescMain` x3 langues).
- **Profils externes** : le genre est aussi ecrit sur SoundCloud, Bandcamp,
  Spotify for Artists, Beatport, Gigmit, Songkick, Linktree, Hypeddit. Le site
  est a jour, pas les plateformes.
- **Presskit PDF** (`Presskit_Maudite_Machine_2026.pdf`) : il contient encore
  l'ancien positionnement, il est telecharge depuis la page Press Kit.
- **Image OG** (`/images/og-image.jpg`) : verifier qu'aucun texte de genre n'y
  est incruste.

Items plus anciens toujours ouverts : tech riders PDF
(`public/techrider-en.pdf`, `techrider-fr.pdf`), profil Bandsintown, licence
de la webfont Larsseit, nettoyage des images (176 Mo), etapes 4-5 de l'admin
(Medias, Textes, Publier), arbitrage SEO Montreal vs Canada.

## 4. Commandes utiles ajoutees

Aucun script nouveau. Controle de non-regression utilise apres chaque passe :

```bash
grep -rniE "indie[ -]?dance|dark[ -]?disco" --include="*.ts" --include="*.tsx" \
  --include="*.json" --include="*.html" --include="*.css" src public index.html \
  | grep -v "public/releases.json"
```

Doit ne rien retourner. Les seules occurrences legitimes restantes sont dans
`public/releases.json` (genres d'autres artistes sur le Radar).

---

# Suite de session : retrait des Archives, survol des reseaux, lead

Commits : `97e30f5` (les trois changements) + `0132c02` (fix sitemap)

## 1. Ce qui a ete fait

### Page Archives supprimee

Verdict de Mika : « enleve Archives c'est de la marde ». Retrait complet :

- `src/v2/pages/ArchivePage.tsx` et `src/v2/data/archive.json` supprimes
- `public/images/archive/` (3 captures webp) supprime
- `src/v2/components/Nav.tsx` : entree de menu retiree (8 entrees restantes)
- `src/v2/v2.css` : bloc `.v2-arc-*` retire, 144 lignes
- `src/App.tsx` : import lazy et route retires, remplaces par une
  redirection `/archives` -> `/`
- `scripts/generate-sitemap.mjs` + `public/sitemap.xml` : entree retiree,
  sitemap de nouveau a 2 URLs

### Nom du reseau en gros au survol

`src/v2/components/SocialLinks.tsx` : l'attribut `title` natif est
remplace par `data-label`. `src/v2/v2.css` : `.v2-social-icons a::after`
affiche `attr(data-label)` en `clamp(20px, 2.6vw, 34px)` juste au-dessus
du rond, fond opaque et `z-index: 6` pour rester lisible quand la rangee
passe sur deux lignes. Vaut pour le footer ET le menu overlay, les deux
utilisent le meme composant.

### Lead de l'intro

« built for dark rooms and long nights » devient « built for the floor
and the small hours ».

## 2. Decisions prises et pourquoi

**Redirection plutot que suppression seche de la route.** Sans route
catch-all dans `src/App.tsx`, `/archives` aurait rendu une page blanche.
La page a ete en ligne et indexable, donc redirection vers l'accueil.

**`title` natif retire des icones.** Le laisser aurait fait doublon : le
tooltip du navigateur par-dessus le nom en gros. L'`aria-label` reste,
l'accessibilite n'est pas touchee.

**Survol desactive sur tactile** (`@media (hover: none)`) : sur telephone
le nom geant reste colle apres le tap et masque la rangee d'icones.

**Le lien « Archive v1 » du footer est conserve.** C'est le vrai ancien
site sous `/v1`, pas le musee de captures Wayback qui vient d'etre
retire. A confirmer avec Mika s'il veut le retirer aussi.

## 3. Ce qui reste a faire / points en suspens

- Confirmer si le lien « Archive v1 » du footer reste ou part
- La formulation « the small hours » est une proposition, a valider
- Points de la premiere partie de session toujours ouverts (description
  du label VRSTL, presskit PDF, profils externes, image OG)

## 4. Piege repere

`public/sitemap.xml` est **regenere a chaque build** par
`scripts/generate-sitemap.mjs`. Editer le XML a la main ne sert a rien,
l'entree revient au build suivant : c'est le tableau `PAGES` du script
qu'il faut modifier.
