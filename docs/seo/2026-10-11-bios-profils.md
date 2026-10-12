# Bios et profils : textes à coller champ par champ

Consignes pour toi. Les bios sont celles de scripts/seo-shared.mjs, mot pour mot ; ne les réécris pas sur une plateforme, sinon les moteurs de recherche voient des versions différentes du même artiste. Partout : lieu Montpellier, France ; site https://mauditemachine.com/ (avec https et sans www) ; genres Indie Dance, Dark Disco. Les constats viennent de l'audit search du 2026-10-11 ; les limites de signes des plateformes ne sont pas vérifiées, regarde le compteur du champ.

## 1. Les textes

Bio courte EN (168 signes) :

```text
Indie dance and dark disco with a psychedelic edge. DJ, producer, founder of VRSTL Records. Fifteen years in the Montréal underground, now based in the south of France.
```

Bio courte FR (181 signes) :

```text
Indie dance et dark disco, à tendance psychédélique. DJ, producteur, fondateur de VRSTL Records. Quinze ans dans l'underground montréalais, maintenant basé dans le Sud de la France.
```

Bio courte ES (172 signes) :

```text
Indie dance y dark disco con un toque psicodélico. DJ, productor, fundador de VRSTL Records. Quince años en el underground de Montreal, ahora con base en el sur de Francia.
```

Bio très courte EN (112 signes), pour les champs limités (Instagram, X, Linktree, TikTok). C'est la bio courte avec le lieu à la place de la dernière phrase :

```text
Indie dance and dark disco with a psychedelic edge. DJ, producer, founder of VRSTL Records. Montpellier, France.
```

Bio longue EN (Bandcamp, SoundCloud, Spotify for Artists, Resident Advisor, gigmit, Mixcloud, YouTube) :

```text
Maudite Machine is a DJ and producer based in Montpellier, in the south of France, after fifteen years in the Montréal underground. He plays indie dance and dark disco with a psychedelic edge: rolling basslines, dark synths and long tension that builds over the set, as a DJ on CDJs or as a hybrid live with synths and grooveboxes.

He has played Techno Parade Paris, Okami Festival in France and Groove and Bass in Québec, and Montréal rooms from the SAT to Piknic Électronik, on bills with Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox and Perfect Stranger.

He runs VRSTL Records, an independent label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe. His own releases include Limbos (2025) and Voodoo (2026).
```

Bio longue FR (là où un deuxième champ ou une version française existe) :

```text
Maudite Machine est DJ et producteur, installé à Montpellier dans le Sud de la France après quinze ans dans l'underground montréalais. Il joue de l'indie dance et de la dark disco à tendance psychédélique : basses qui roulent, synthés sombres, tension qui monte sur la longueur du set. Il joue en DJ set sur CDJ ou en live hybride avec synthés et grooveboxes.

Il a joué à la Techno Parade de Paris, à Okami Festival en France, à Groove and Bass au Québec, et dans les salles de Montréal, de la SAT au Piknic Électronik, sur des plateaux avec Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox et Perfect Stranger.

Il dirige VRSTL Records, label indépendant de 21 EPs et 2 albums d'artistes du Québec, du Brésil, d'Argentine et d'Europe. Ses propres sorties comptent Limbos (2025) et Voodoo (2026).
```

Bio longue ES :

```text
Maudite Machine es DJ y productor, con base en Montpellier, en el sur de Francia, tras quince años en el underground de Montreal. Pincha indie dance y dark disco con un toque psicodélico: bajos que ruedan, sintes oscuros y una tensión que crece a lo largo del set, en DJ set con CDJ o en live híbrido con sintes y grooveboxes.

Ha tocado en la Techno Parade de París, en Okami Festival en Francia y en Groove and Bass en Quebec, y en las salas de Montreal, de la SAT al Piknic Électronik, junto a Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox y Perfect Stranger.

Dirige VRSTL Records, sello independiente con 21 EPs y 2 álbumes de artistas de Quebec, Brasil, Argentina y Europa. Sus lanzamientos propios incluyen Limbos (2025) y Voodoo (2026).
```

Champs communs :

| Champ | Valeur |
|---|---|
| Nom | Maudite Machine |
| Lieu | Montpellier, France |
| Site | https://mauditemachine.com/ |
| Genres | Indie Dance, Dark Disco |
| Booking international | vrstlrecords@gmail.com |
| Booking Canada et USA | mauditemachine@gmail.com |
| Label | VRSTL Records |

## 2. Plateforme par plateforme

| Plateforme | Ce qu'il faut corriger (constat du 2026-10-11) | Quoi coller |
|---|---|---|
| Bandcamp, https://mauditemachine.bandcamp.com | La bio dit encore que tu vis à Montréal depuis 2008 ; lieu Montréal, Québec ; le lien du site pointe vers www.mauditemachine.com | Bio longue EN ; lieu Montpellier, France ; lien https://mauditemachine.com/ |
| SoundCloud, https://soundcloud.com/mauditemachine | Bio écrite pour Montréal, avec un adjectif de ta liste interdite | Bio longue EN puis bio courte FR ; ville Montpellier, pays France ; liens : site, Bandcamp, Spotify, Instagram |
| Resident Advisor, https://ra.co/dj/mauditemachine | Page bloquée d'ici (403) : bio et lieu à vérifier. Les dates du 16, 30 et 31 octobre doivent y être | Bio longue EN ; lieu Montpellier ; dates d'octobre ; lien du site |
| gigmit, https://www.gigmit.com/maudite-machine | Genres de ta liste interdite et Montréal. Le profil est retiré du JSON-LD du site tant qu'il n'est pas refait (scripts/seo-shared.mjs, SAME_AS_EXCLUDED) | Bio longue EN ; genres Indie Dance et Dark Disco (s'ils sont dans leur liste, à vérifier) ; lieu Montpellier ; formats DJ set et live hybride. Une fois refait, demande à Claude Code de le remettre dans le JSON-LD |
| Discogs, https://www.discogs.com/artist/5831599-Maudite-Machine | 35 sorties (Pimp's Tits Records 2015 à 2017, VRSTL 2024 à 2026), alias Locomote, champ du nom civil rempli. Discogs est édité par la communauté : le profil se modifie comme une fiche | Profile : bio courte EN ; Sites : https://mauditemachine.com/ , Bandcamp, SoundCloud, Resident Advisor. Le nom civil : à toi de décider s'il reste, le kit ne le reprend nulle part |
| YouTube, https://www.youtube.com/@mauditemachine-official | Bio "Canada 15 years" ; des titres de vidéos (VRSTL Studio Session de Kris Tin) contiennent un genre de ta liste interdite, sur ta chaîne | Description : bio longue EN ; pays France ; lien du site. Pour les titres de Kris Tin : à toi de voir (c'est son genre à lui) |
| Beatport, https://www.beatport.com/artist/maudite-machine/500537 | Profil confirmé par la recherche, bio non lue | Bio courte EN ; la bio passe sans doute par l'outil du label (à vérifier) |
| Mixcloud, https://www.mixcloud.com/mauditemachine/ | Lieu Montréal | Bio courte EN ; lieu Montpellier, France ; lien du site |
| X, https://x.com/mauditemachine | Lieu Montréal | Bio très courte EN ; lieu Montpellier, France ; site https://mauditemachine.com/ |
| Linktree, https://linktr.ee/mauditemachine | Lien vers le site déjà là | Bio très courte EN ; le site en premier lien |
| Instagram, https://www.instagram.com/mauditemachine/ | Email de contact à vérifier | Bio très courte EN avec la ligne booking (ci-dessous) ; lien https://mauditemachine.com/ ; email de contact vrstlrecords@gmail.com |
| Songkick, https://www.songkick.com/artists/10363218-maudite-machine | Aucune date à venir | Les trois dates d'octobre ; la façon de les ajouter (directement ou par un service relié) est à vérifier |
| Bandsintown | Pas de profil trouvé | Créer le profil (Bandsintown for Artists), bio courte EN, lieu Montpellier, les trois dates d'octobre |
| Spotify for Artists, https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4 | Bio à vérifier dans Spotify for Artists | Bio longue EN ; liens Instagram et site |
| Apple Music for Artists, https://music.apple.com/us/artist/maudite-machine/1028417516 | Profil en ligne ; ce qu'on peut y modifier est à vérifier | Si un champ bio existe : bio courte EN |
| TikTok, https://www.tiktok.com/@mauditemachine | Bio réduite à un lien SoundCloud | Bio très courte EN ; lien https://mauditemachine.com/ |
| Deezer, https://www.deezer.com/fr/artist/8651600 | Bio non lue | Si Deezer for Creators le permet : bio courte FR |
| Facebook, https://facebook.com/MauditeMachine | Non vérifié (la page renvoie vers la connexion) | Bio courte FR ; lieu Montpellier ; site |

Bio Instagram avec la ligne booking (144 signes) :

```text
Indie dance and dark disco with a psychedelic edge. DJ, producer, founder of VRSTL Records. Montpellier, France.
Booking: vrstlrecords@gmail.com
```

## 3. VRSTL Records

| Profil | Constat du 2026-10-11 | À faire |
|---|---|---|
| https://vrstlrecords.com/ | Coquille vide pour les robots (application sans texte statique) | Une page HTML statique avec le nom, la description du label, les sorties et les liens (chantier à part) |
| https://vrstlrecords.bandcamp.com | Lieu Montréal, aucun lien externe | Lien vers https://vrstlrecords.com/ et vers https://mauditemachine.com/ |
| https://soundcloud.com/vrstlrecords | Profil actif | Lien vers le site du label |
| https://www.discogs.com/label/3752945-VRSTL-Records | Profil rempli (contact vrstlrecords@gmail.com, liens Bandcamp, SoundCloud, Facebook) | Rien d'urgent |
| https://www.beatport.com/label/vrstl/123149 | Existe | Absent du JSON-LD du site (à ajouter une fois vérifié) |
| https://www.labelradar.com/labels/VRSTLRecords/portal | Lien trouvé dans le site du label | Rien |

Description du label, telle que le site l'écrit (scripts/seo-shared.mjs) :

```text
Independent electronic music label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe.
```

## 4. MusicBrainz (à créer)

Rien n'existe encore sur MusicBrainz. Il faut un compte ; les ajouts sont relus par la communauté. Crée d'abord le label, puis l'artiste, puis les sorties. Entre parenthèses après chaque URL : le type de lien à choisir (MusicBrainz le propose souvent tout seul, vérifie-le).

Label :

| Champ | Valeur |
|---|---|
| Name | VRSTL Records |
| Type | Original Production |
| Area | Montréal (adresse du label dans le JSON-LD et le press kit) |
| Begin date | [A CONFIRMER PAR MIKA] |
| Label code | aucun, sauf si tu en as un [A VERIFIER] |
| URLs | https://vrstlrecords.com/ (official homepage), https://vrstlrecords.bandcamp.com (Bandcamp), https://soundcloud.com/vrstlrecords (SoundCloud), https://www.discogs.com/label/3752945-VRSTL-Records (Discogs), https://www.beatport.com/label/vrstl/123149 (Beatport) |

Artiste :

| Champ | Valeur |
|---|---|
| Name | Maudite Machine |
| Sort name | Maudite Machine |
| Disambiguation | indie dance and dark disco DJ and producer, founder of VRSTL Records |
| Type | Person (projet solo) ; Gender : à toi de choisir ou de laisser vide |
| Area | Montpellier |
| Begin date, begin area | laisser vide (pour une personne, MusicBrainz y attend la naissance) |
| Legal name | ne rien mettre |
| Alias | Locomote, seulement si tu confirmes que c'est toi (Discogs le donne comme alias) |
| URLs | https://mauditemachine.com/ (official homepage), https://mauditemachine.bandcamp.com (Bandcamp), https://soundcloud.com/mauditemachine (SoundCloud), https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4 (streaming), https://music.apple.com/us/artist/maudite-machine/1028417516 (streaming), https://www.deezer.com/artist/8651600 (streaming), https://www.beatport.com/artist/maudite-machine/500537 (purchase for download), https://www.discogs.com/artist/5831599-Maudite-Machine (Discogs), https://ra.co/dj/mauditemachine (other databases, à vérifier), https://www.youtube.com/@mauditemachine-official (YouTube), https://www.instagram.com/mauditemachine/ (social network), https://www.songkick.com/artists/10363218-maudite-machine (Songkick) |

Album Limbos :

| Champ | Valeur |
|---|---|
| Release group | Limbos, type Album |
| Artist | Maudite Machine |
| Date | 2025-10-16 (src/v2/data/discography.json) |
| Label | VRSTL Records ; catalogue : [A VERIFIER] ; barcode : [A VERIFIER] ou "no barcode" |
| Status, packaging, medium | Official ; None ; Digital Media |
| Country | [Worldwide], sauf sortie limitée à un pays |
| Tracks (9) | 1 Abyss, 2 Cephal, 3 Limbos, 4 Reaper, 5 Nortkele, 6 Muld, 7 Simetra, 8 Zenith, 9 Chimie Électrique (Emotional Remix) ; durées : [A RELEVER SUR BANDCAMP] |
| Language | [No lyrics] seulement si aucun titre n'a de voix [A VERIFIER] |
| URL | https://mauditemachine.bandcamp.com/album/limbos |

Single Voodoo : release group de type Single, date 2026-02-11, label VRSTL Records, Digital Media, lien Bandcamp [A VERIFIER].

## 5. Wikidata (à décider)

Wikidata n'a aucun élément pour toi ni pour le label. Trois options, à toi de choisir :

1. Ne rien créer pour l'instant, et attendre un premier article de presse que l'élément pourra citer.
2. Créer seulement l'élément VRSTL Records (label), avec ses identifiants.
3. Créer l'élément Maudite Machine et l'élément VRSTL Records, reliés.

Pour l'option 3, les valeurs. Les numéros de propriété sont donnés de mémoire, vérifie-les dans Wikidata avant de saisir :

| Propriété | Valeur |
|---|---|
| Libellé | Maudite Machine |
| Description EN | indie dance and dark disco DJ and producer |
| Description FR | DJ et producteur d'indie dance et de dark disco |
| P31 nature de l'élément | à toi de choisir (personne, ou projet musical) |
| P856 site officiel | https://mauditemachine.com/ |
| P264 label | VRSTL Records (l'élément du label) |
| P136 genre | indie dance, dark disco, si les éléments existent (à vérifier) |
| P1953 Discogs artist ID | 5831599 |
| P1902 Spotify artist ID | 2FHPGWPEBQbCsgkLP9uuI4 |
| P2850 Apple Music artist ID | 1028417516 |
| P2722 Deezer artist ID | 8651600 |
| Resident Advisor artist ID (numéro à chercher) | mauditemachine |
| P434 MusicBrainz artist ID | une fois l'artiste créé sur MusicBrainz |
| Lieu de résidence, nom civil, date de naissance | ne rien mettre sans ta décision |

Pour le label : libellé VRSTL Records, nature "maison de disques", P856 https://vrstlrecords.com/, Discogs label ID 3752945, fondateur Maudite Machine si l'élément existe.
