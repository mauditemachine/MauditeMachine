# Plan de trafic : mauditemachine.com et MM-STUDIO (2026-10-21)

Ce plan part de l'audit SEO du 2026-10-21 (rapport complet : rapport-seo.md de l'audit) et du kit presse du 2026-10-11 (docs/seo/2026-10-11-README.md et les fichiers à côté). D'abord ce qui a été fait dans le code aujourd'hui, puis ce que toi seul peux faire avec tes comptes, dans l'ordre où ça rapporte le plus. Rien n'a été envoyé, posté ni soumis à un service extérieur : tout ce qui sort du dépôt passe par toi.

L'idée en une phrase : MM-STUDIO est un studio gratuit dans le navigateur, et le trafic viendra de l'outil (des beats qu'on s'envoie, des pages de motifs que les gens cherchent, des vidéos de la machine), pas de l'audience actuelle. Le code est maintenant prêt pour ça ; le reste, c'est toi.

---

## 1. Ce qui a été fait dans le code aujourd'hui

| Sujet | Ce qui change | Pourquoi |
|---|---|---|
| Accueil qui s'affiche tout de suite (F1) | Une coquille dans le HTML de l'accueil, des sections et des morceaux : le logo, le titre de la page, une ligne, une barre qui avance, peints avant le moindre script. Le chunk de la machine et three partent avec l'entrée (modulepreload), plus après elle. Les WAV du MM-RYTM et les photos du hoodie attendent la première image de la scène. L'intro et la 3D ne changent pas. | Au téléphone en 4G lente, l'écran restait noir environ 4 s : un visiteur venu d'un lien repartait. |
| Un titre et une description par page (F2, F3, F11) | En anglais, en français et en espagnol, 60 signes au plus. L'accueil : "MM-STUDIO by Maudite Machine: Free Drum Machine & Synth". /fr/ et /es/ dans leur langue. /shows/ dit sa prochaine date. Le titre reste le même une fois la page montée (sur /techrider/, la page React remettait le titre de tout le site). | 14 pages avaient le même titre ; l'accueil ne disait jamais "drum machine". |
| Carte de partage MM-STUDIO (F3) | L'accueil et les pages MM-STUDIO montrent la machine en grand avec "FREE · DRUM MACHINE, SYNTH & DJ DECKS" (public/press/mm-studio/og-mm-studio-card.jpg). Les pages artiste gardent ta photo. | Un partage de l'outil montrait une photo de DJ : rien ne disait qu'on peut jouer. |
| Balises justes (F9, F10, F16, F19) | og:locale de la langue de la page, og:type website, twitter:site @mauditemachine, recordLabel retiré du MusicGroup, albums sans l'année dans le nom, titres de morceaux coupés à 60 signes. | Avertissements des validateurs, partages lus dans la mauvaise langue. |
| Lien de partage de beat (IMP2) | Un bouton SHARE dans l'en-tête, à côté de UNDO (desktop et téléphone). Au téléphone, la feuille de partage du système ; sur ordinateur, le lien copié. L'écran du MM-RYTM dit LINK COPIED. Le lien ouvre le beat tel quel chez celui qui clique : pas, vélocités, tempo, sons, effets. Le beat d'avant de la personne est mis de côté (YOUR SOUND) et UNDO le rend. | La boucle virale : chaque beat fait sur le site devient un lien qui ramène du monde. Les P-locks et tes samples perso ne partent pas encore dans le lien (l'écran le dit). |
| Pages de motifs par style (IMP5) | 10 styles (acid house, dark disco, indie dance, minimal, rolling techno, techno, house, electro, EBM, italo disco), en anglais, français et espagnol : 33 pages. Chacune : la grille 16 pas avec les vélocités, pourquoi ça marche, deux variations, comment le programmer sur n'importe quelle machine, un fichier MIDI, un lien qui joue le motif dans MM-RYTM avec son kit, une image de partage de la grille. Adresse : /mm-studio/drum-patterns/. | La longue traîne "dark disco drum pattern", "italo disco drum pattern", "ebm drum pattern" est mal servie ; personne ne donne la grille, le MIDI et un motif jouable ensemble. |
| Pages machines tournées vers les recherches (IMP7) | "Free Online Drum Machine with P-Locks", "Free Online Synth with Arpeggiator", "Free Online DJ Mixer, 2 to 4 Decks", et en français et en espagnol ("Boîte à rythmes en ligne gratuite", "Caja de ritmos online gratis"...). Une vraie FAQ sur chaque page (gratuit, téléphone, MIDI, tes samples, où c'est gardé, partage, export), en FAQPage. | Les requêtes d'outil (online drum machine, boîte à rythmes en ligne) n'avaient aucune page qui les visait. |
| Maillage outil et artiste (IMP9) | Chaque page MM-STUDIO mène aux motifs et à tes morceaux ; chaque page de morceau mène aux motifs ; les motifs dark disco et indie dance citent Voodoo. | Transformer les joueurs en auditeurs. |
| Sitemap honnête et IndexNow (F5, IMP6) | lastmod change seulement quand le contenu d'une page change (comparé au site en ligne). Après chaque déploiement, les pages changées partent à IndexNow (Bing et les moteurs qui partagent ses envois), sans jamais bloquer le déploiement. La clé est le fichier public/f5ad40fa8b8068cef57269741d428937.txt. | Le rebuild de chaque matin faisait croire que tout changeait tous les jours : Google ignorait la date. |
| robots.txt (F12) | AhrefsBot et SemrushBot (et leurs robots d'audit) peuvent passer. | Pour que tu puisses brancher l'un des deux outils. |
| Anciennes adresses (F15) | /about, /archives, /v4, /v2/radar : de vraies pages de redirection au lieu d'un 404. | Un vieux lien garde sa valeur. |
| Événements (F13) | events.json accepte maintenant street, postalCode, region, price, currency, availability (en plus de startTime avec fuseau, ticketUrl, organizer). | Les résultats Événements de Google les demandent. Rien n'est inventé : c'est à toi de les remplir. |
| Police (F18) | Robot Radicals en WOFF2 (7 Ko au lieu de 33), une seule déclaration ; SF Pro n'est plus téléchargée deux fois. | Moins de poids au chargement. |
| Mesure (IMP4) | Événements GA4 avec ton gtag existant, aucun traceur de plus : machine_focus, play_start, preset_load, sample_choice, share_beat, open_shared_beat. Le nom d'un sample perso ne part jamais. | Savoir enfin combien de gens jouent, partagent, et ce qu'un post a donné. |

Mesuré sur un build de production propre, téléphone en 4G lente simulée (150 ms, 1,6 Mb/s) : voir la section 5 pour les chiffres avant et après.

---

## 2. Ce que toi seul peux faire, par ordre de priorité

Chaque ligne : quoi faire, où, combien de temps, ce que ça rapporte.

### Priorité 1 : cette semaine (sans ça, rien n'est mesurable)

1. **Google Search Console** (30 min). Ajoute une propriété de type Domaine pour mauditemachine.com, colle l'enregistrement TXT chez ton registraire, attends la validation. Puis : Sitemaps, soumets https://mauditemachine.com/sitemap.xml ; Inspection d'URL, demande l'indexation de /, /mm-studio/, /mm-studio/drum-machine/, /mm-studio/synth/, /mm-studio/dj-decks/, /mm-studio/drum-patterns/, /fr/mm-studio/, /es/mm-studio/.
   Impact : c'est la seule source des vraies requêtes qui t'amènent du monde et des Core Web Vitals de terrain. Sans elle, on travaille à l'aveugle.
2. **Bing Webmaster Tools** (10 min). Connecte-toi, choisis Importer depuis Google Search Console. Dans la partie IndexNow, vérifie après ton prochain push que les envois arrivent.
   Impact : Bing alimente aussi des moteurs et des assistants (réponses IA) ; IndexNow y fait entrer une nouvelle page en quelques minutes au lieu de quelques semaines.
3. **GA4** (20 min). Vérifie que la propriété G-HP92HGMNJT est bien à toi et reçoit des données. Dans Administration, Événements, marque share_beat, open_shared_beat et play_start comme événements clés. Crée les dimensions personnalisées machine, method, preset, voice et source (portée Événement). Relie la Search Console. Pour le tableau de bord /mm-admin/stats : pose GA4_PROPERTY_ID et le jeton OAuth dans les secrets GitHub.
   Impact : tu verras combien de visiteurs jouent, combien partagent un beat, et combien d'ouvertures chaque partage génère (le vrai compteur de la viralité).
4. **Décision consentement (F7)**. GA4 et le pixel Meta partent aujourd'hui sans consentement, y compris pour les visiteurs en France. Je n'ai rien changé, c'est à toi de choisir :
   - a) un petit bandeau et le Consent Mode v2 de Google (GA4 en mode limité tant qu'on n'a pas dit oui, le pixel seulement après accord) ;
   - b) une mesure sans cookie exemptée (Cloudflare Web Analytics, ou Matomo réglé en exemption CNIL) pour l'audience, et le pixel derrière un accord ;
   - c) rester comme ça, en connaissant le risque.
   Impact : conformité CNIL et RGPD, et un site que tu pourras pousser partout sans risque. Le bandeau a) fera baisser un peu les chiffres GA4 (les refus), la voie b) les garde complets pour l'audience.
5. **Valider les titres**. Ils reviennent sur le brief B2 du 2026-10-10 (un seul titre pour tout le site). Relis src/data/seo-meta.json et dis-moi si tu veux une autre formule pour l'accueil (par exemple "Maudite Machine | MM-STUDIO, Free Drum Machine and Synth").
   Impact : chaque page sort sur sa propre requête au lieu de se faire concurrence.

### Priorité 2 : les deux semaines qui suivent

6. **Brancher Semrush ou Ahrefs à Claude** (15 min, abonnement payant). Dans claude.ai, Réglages, Connecteurs : ajoute le connecteur officiel Semrush (lecture seule) ou Ahrefs (clé MCP dans les réglages de ton compte Ahrefs). OpenSEO est l'option la moins chère pour commencer. robots.txt les laisse déjà passer.
   Ensuite, une mission Claude Code pourra chiffrer les requêtes (online drum machine, boîte à rythmes en ligne, caja de ritmos online gratis, dark disco drum pattern...), lire les positions des concurrents (drumbit, iO-808, Roland50.studio, Splice Beat Maker) et sortir la liste des sites qui font des liens vers eux : ta liste de prospection.
   Impact : on arrête de deviner les volumes ; on sait quelle page pousser.
7. **Bios et profils** (1 h, voir docs/seo/2026-10-11-bios-profils.md). Bandcamp, RA et SoundCloud donnent encore Montréal comme base actuelle : passe à Montpellier, avec Montréal comme historique, et mets un lien vers https://mauditemachine.com/mm-studio/ partout (YouTube, SoundCloud, Instagram, TikTok, Linktree).
   Impact : la recherche de ton nom sort aujourd'hui Bandcamp et RA, pas ton site ; ces liens sont les premiers que Google suit.
8. **Captures GPU et vidéo** (2 h). Les captures de public/press/mm-studio/ et la carte de partage ont été faites sans vrai GPU. Refais-les sur ton Mac aux mêmes noms et dimensions (le build les reprend tout seul), et la vidéo de 45 à 60 s du kit.
   Impact : de meilleurs taux de clic sur chaque partage, et la matière de tous les posts.
9. **Données que toi seul connais**. Pour chaque date dans events.json (ou l'admin) : l'adresse (street, postalCode), l'heure avec le fuseau (startTime "22:00-04:00"), la billetterie (ticketUrl, price, currency). Pour les morceaux : l'histoire, le BPM, la tonalité, les crédits.
   Impact : éligibilité aux résultats Événements de Google ; des pages de morceaux qui peuvent sortir sur "Maudite Machine + titre".
10. **Relire les textes des pages de motifs** (30 min). Ils sont écrits d'après la construction de chaque preset d'usine, relus contre les grilles. Si tu changes un preset d'usine, le build le signale dans son journal ("texte de motif a relire").

### Priorité 3 : le lancement (seulement une fois 1 à 5 faits)

L'ordre compte : un pic de visites sans mesure est un pic perdu. Un lieu par jour, depuis tes comptes, en respectant les règles de chaque endroit. Mets toujours un paramètre utm dans tes liens (par exemple ?utm_source=reddit&utm_medium=post) : GA4 saura d'où viennent les gens. Un lien de beat garde son utm (seul le code b quitte l'adresse à l'arrivée).

| Où | Angle | Impact attendu |
|---|---|---|
| Hacker News, Show HN | "MM-STUDIO: a 3D drum machine, synth and DJ decks in the browser, and beats you share as links". Parle du code (Web Audio, AudioWorklets, three.js, le lien de partage). Texte prêt : docs/seo/2026-10-11-lancement-posts.md. | Fort si ça prend (un Show HN de boîte à rythmes a fait 74 points) ; des liens de blogs tech derrière. |
| r/InternetIsBeautiful | Le jouet gratuit qui marche tout de suite au téléphone : un lien de beat dark disco, pas la page d'accueil. | Le plus gros potentiel de trafic d'un coup, si les modérateurs acceptent. |
| r/WeAreTheMusicMakers, r/edmproduction | Dans les fils de retours prévus pour ça : "j'ai construit une groovebox dans le navigateur, vos avis ?", avec un lien de beat. | Des producteurs qui reviennent et partagent. |
| r/Elektron | L'angle P-locks et pages façon Digitakt, Roto-Control. | Un public qui connaît et juge le détail : des retours précis, des liens de forums. |
| r/DJs | MM-DECKS : une table qui prend une boîte à rythmes et un synthé calés au tempo. | Niche, mais personne d'autre ne le fait. |
| r/webdev (Showoff Saturday), r/threejs, forum three.js | La 3D et le son dans le navigateur. | Des liens de développeurs, des mentions dans des newsletters. |
| Product Hunt | Un lancement, la vidéo, la carte MM-STUDIO. | Un pic d'un jour et un lien durable. |
| AlternativeTo | Propose MM-STUDIO comme alternative à drumbit, iO-808, Splice Beat Maker, Roland50.studio, Chrome Music Lab, Viktor NV-1. | Ces pages sortent sur "alternative to X" : trafic régulier, long terme. |
| Presse tech musique (kit du 2026-10-11) | Synthtopia, Bedroom Producers Blog, CDM, Gearnews, MusicRadar, Rekkerd, KVR : "free browser drum machine with p-locks and shareable beats". | La presse amène du monde tout de suite, et Google suit. |
| Korben (FR), wwwhatsnew (ES) | Les versions française et espagnole : boîte à rythmes en ligne gratuite, caja de ritmos online gratis. | Très lus dans leur langue ; les recherches FR et ES sont mal servies. |
| Elektronauts, Gearspace, la communauté Melbourne Instruments (The Exchange) | Les setups Roto-Control prêts à importer. | Un public matériel qui reste. |
| Listes "best free drum machine online" (hiphopmakers, Amped Studio...) | Écris à l'auteur pour être ajouté, avec un lien vers /mm-studio/drum-machine/. | Des liens durables sur la requête principale. |
| awesome-webaudio (GitHub) | La ligne prête dans le kit. | Un lien de qualité, des développeurs. |

### Priorité 4 : le contenu vidéo (en continu)

Le trafic viendra de la machine filmée. Format vertical, téléphone en portrait sur la machine, texte à l'écran, le lien exact du beat dans la description et en commentaire épinglé, le mot-clé dans le titre.

1. **"Un style en 30 secondes"** (Shorts, TikTok, Reels) : un style par vidéo, les 10 pages de motifs = 10 vidéos. Texte : "Dark disco beat, free, in your browser". Lien : la page du motif (elle a le MIDI et le bouton pour jouer). Trois par semaine. Impact : la recherche "dark disco drum pattern" et ses voisines, sur YouTube comme sur Google.
2. **"Remix mon beat"** : tu postes un lien de beat, les gens le changent, appuient sur SHARE et répondent avec leur lien ; tu reposts les meilleurs (duo TikTok, story Instagram). C'est la boucle du partage : le compteur open_shared_beat de GA4 te dira si elle tourne.
3. **"Du morceau au motif"** : tu reconstruis le groove de Voodoo ou d'un titre de Limbos dans MM-RYTM, puis le vrai morceau part. L'outil amène à ta musique.
4. **Carrousels Instagram** : les images des grilles (dans chaque dossier /mm-studio/drum-patterns/<style>/) en carrousel "10 drum patterns for 10 styles", lien en bio vers /mm-studio/drum-patterns/.
5. **"Roto-Control et studio dans le navigateur"** (8 à 12 min) pour le public matériel.
6. **"Jam en direct dans le navigateur"** : 15 min RYTM, ARP et DECKS, chapitres YouTube.
7. **Journal de fabrication** pour le public développeur (HN, dev.to) : à toi de dire si et comment tu parles de l'aide de Claude Code.

---

## 3. Hébergement (une décision, plus tard)

GitHub Pages ne permet ni vraies redirections 301, ni en-têtes de cache longs, ni fonction au bord. Passer le domaine derrière Cloudflare (DNS proxy devant GitHub Pages) donnerait : un cache long des fichiers de /assets/, des redirections 301, et un petit Worker qui ferait une image de partage par beat (le partage d'un lien de beat afficherait SA grille dans WhatsApp, X ou Discord, au lieu de la carte MM-STUDIO). C'est une décision DNS, donc la tienne ; le code du lien de partage est prêt pour ça.

---

## 4. Comment lire les résultats

- **Search Console, Performances** : filtre les pages qui commencent par /mm-studio/drum-patterns/ (les motifs), /mm-studio/ (l'outil) et le reste (l'artiste) : trois courbes.
- **GA4, Événements** : play_start (des gens jouent), share_beat (ils partagent ; method dit share ou copy), open_shared_beat (des gens arrivent par un beat partagé ; ok false veut dire un lien abîmé), preset_load (quels styles d'usine plaisent), sample_choice (quels sons), machine_focus (quelles machines).
- **Le ratio à suivre** : open_shared_beat divisé par share_beat. Au-dessus de 1, chaque partage ramène plus d'une personne : la boucle tourne.

---

## 5. Mesures du 2026-10-21 (build de production local, Chromium sans son)

Téléphone 390 x 844, réseau 4G lente simulée (150 ms, 1,6 Mb/s), rendu logiciel (les temps CPU sont plus lents qu'un vrai téléphone, les temps réseau sont fiables) :

| Page | Appareil | Premier affichage (FCP) avant | après | Plus grand affichage (LCP) avant | après | La machine à l'écran avant | après |
|---|---|---|---|---|---|---|---|
| Accueil | téléphone, 4G lente | 3,9 s (écran noir jusque-là) | 0,87 s | 5,7 s | 0,87 s | 5,6 s | 5,7 s |
| /tracks/limbos/ | téléphone, 4G lente | 4,0 s | 0,89 s | 5,2 s | 0,89 s | 4,4 s | 4,5 s |
| Accueil | ordinateur, 10 Mb/s | 0,95 s | 0,20 s | 3,0 s | 0,20 s | 3,0 s | 2,3 s |
| /tracks/limbos/ | ordinateur, 10 Mb/s | 0,93 s | 0,21 s | 0,93 s | 0,21 s | 1,4 s | 1,5 s |

Ce que ça veut dire : au téléphone, le visiteur voit tout de suite MM-STUDIO, son titre et ce que c'est, au lieu d'un écran noir ; la machine arrive au même moment qu'avant (le réseau lent reste le frein : 560 Ko de JavaScript). Sur ordinateur, la machine arrive 0,7 s plus tôt (le chunk de la machine part avec l'entrée). Le chunk de la machine fait toujours environ 350 Ko compressés : le découper (MIDI et Roto, éditeurs, presets d'usine chargés à la demande) est la prochaine étape technique, pour une autre mission.
