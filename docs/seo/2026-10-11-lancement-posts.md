# Posts de lancement : Show HN, Product Hunt, Reddit, three.js, Elektronauts, awesome-webaudio, The Exchange

Consignes pour toi. Ces posts sont en anglais. Tu les postes toi-même, depuis tes comptes, et tu réponds toi-même aux commentaires. Les règles de Show HN interdisent de demander des votes : ne le fais nulle part, ni sur HN, ni sur Product Hunt, ni sur Reddit. Poste quand /mm-studio/ est en ligne, la vidéo prête, et quand tu as deux heures devant toi pour répondre. Un lieu par jour suffit.

Une décision avant de poster : sur Hacker News et Reddit, on te demandera peut-être comment tu as codé le site. Le kit dit "built" (ta phrase du site : "I built this website and every machine on it myself."). Si tu veux parler de l'aide de Claude Code, c'est à toi de le dire, avec tes mots. r/WeAreTheMusicMakers bannit le contenu IA (source secondaire) : lis la règle avant d'y poster.

## 1. Show HN

Règles : https://news.ycombinator.com/showhn.html (quelque chose qu'on peut essayer sans inscription, fait par toi, titre qui commence par "Show HN").

Titre (61 signes, la limite est 80) :

```text
Show HN: A 3D drum machine, synth and DJ decks in the browser
```

URL du post : https://mauditemachine.com/

Premier commentaire, à poster tout de suite après :

```text
I'm a DJ and producer (Maudite Machine). On stage I play a hybrid live set with an Ableton Push 3, a Dreadbox Typhon and a Roto-Control, and I wanted visitors to be able to play my website, so its home page is a small studio of three machines I designed and built:

- MM-RYTM: drum machine, 8 voices, 16 steps, 16 patterns, parameter locks per step (hold a step, then drag a value on the screen), a synth layer and a sample layer per voice.
- MM-ARP: two oscillators and a sub into a ladder filter, an arpeggiator, eight chord pads in F sharp minor.
- MM-DECKS: two to four decks and a mixer. Tracks come from my SoundCloud, Creative Commons tracks, your own SoundCloud account, or local files that stay on your device.

How it is made: Three.js 0.186 on WebGL 2, React 18, TypeScript and Vite, served as static files from GitHub Pages. The sound is Web Audio, with AudioWorklets for the filter, chorus, compressor, limiter and scope; the sequencer schedules notes ahead on the audio clock, and the arpeggiator follows the drum machine's grid. The scene only renders when something changes, and the shadow map is redrawn only when something that casts a shadow moves. Every control has a labelled HTML twin, so it works with the keyboard and a screen reader.

Things to try: https://mauditemachine.com/?m=rytm , ?m=arp , ?m=decks. Hold a step on MM-RYTM. Plug in a MIDI controller and use MIDI LEARN.

Known limits: it needs WebGL 2 (without it you get a static fallback). Web MIDI works in Chrome, Edge, Opera and Firefox, not in Safari. Browsers only start audio after a click or a tap. On a phone you get one machine at a time.

I'll be around to answer questions about the audio engine or the 3D.
```

## 2. Product Hunt

Guide : https://help.producthunt.com/en/articles/479557-how-to-post-a-product (compte perso après l'onboarding).

| Champ | Texte |
|---|---|
| Nom | MM-STUDIO by Maudite Machine |
| Tagline (53 signes, limite 60) | A 3D drum machine, synth and DJ decks in your browser |
| Lien | https://mauditemachine.com/ |
| Prix | Free |
| Sujets | Music, Audio, Web App, Design Tools (à vérifier dans la liste des sujets Product Hunt au moment de poster) |
| Vignette | 240x240, GIF de moins de 3 Mo [A FAIRE] |
| Galerie | 1270x760, deux images au moins [CAPTURE 1] [CAPTURE 2] [CAPTURE 3] |
| Vidéo | YouTube seulement [VIDEO] |

Description (246 signes, limite 260) :

```text
A free 3D studio in the browser by DJ and producer Maudite Machine: a drum machine with parameter locks, a synth with an arpeggiator and chord pads, and DJ decks with a mixer. No account, nothing to install. Every parameter can be mapped to MIDI.
```

Premier commentaire du maker :

```text
Hi, I'm Mika. I make indie dance and dark disco as Maudite Machine, and I built my website as a studio you can play. MM-RYTM is the drum machine (hold a step to lock a parameter on it), MM-ARP the synth, MM-DECKS the decks and mixer, and they share one tempo. It runs on Three.js and Web Audio, and MIDI controllers work in Chrome, Edge, Opera and Firefox. A Roto-Control has ready-made setups in the MIDI panel. Tell me what breaks on your device.
```

## 3. Reddit

Reddit refuse l'accès depuis l'environnement de l'audit : aucune règle n'a été lue. Avant chaque post, lis la barre latérale et les règles du sub. Si l'autopromotion n'y est permise que dans un fil dédié, poste dans ce fil. Si elle est interdite, ne poste pas.

r/InternetIsBeautiful (règles à vérifier) :

```text
Title: A website where you can play a 3D drum machine, synth and DJ decks in the browser

https://mauditemachine.com/
```

r/WeAreTheMusicMakers (règles à vérifier, dont celle sur l'IA) :

```text
Title: I built a free browser studio with a drum machine (parameter locks), a synth and DJ decks

I'm a DJ and producer, and the home page of my website is three machines you can play: MM-RYTM (8 voices, 16 steps, a parameter lock on any step), MM-ARP (two oscillators and a sub, ladder filter, arpeggiator, chord pads) and MM-DECKS (decks and mixer). No account. MIDI LEARN on every parameter, in Chrome, Edge, Opera and Firefox.

https://mauditemachine.com/?m=rytm

I would like feedback on the sequencer workflow and on what is missing for you to sketch a beat with it.
```

r/synthesizers : d'après une copie d'avril 2025 des règles, l'autopromotion va dans le "Self-Promotion Roundup" hebdomadaire, avec l'obligation de commenter le post de quelqu'un d'autre (à vérifier). Texte pour ce fil :

```text
MM-ARP, a free browser synth with two oscillators and a sub, a ladder filter, an arpeggiator and eight chord pads, part of the studio on my website (with a drum machine and DJ decks). It takes MIDI LEARN on every knob. https://mauditemachine.com/?m=arp
```

## 4. Forum three.js

https://discourse.threejs.org/c/showcase/7 (publication après approbation d'un modérateur). Ajoute deux ou trois images et la vidéo dans le post.

```text
Title: MM-STUDIO: a playable drum machine, synth and DJ decks (Three.js, Web Audio, Web MIDI)

Hi all. The home page of my website is a 3D studio of three music machines that you can play in the browser: https://mauditemachine.com/

Some details from the build, in case they are useful:

- Three.js 0.186 on WebGL 2, with a perspective camera that orbits the table. ACES filmic tone mapping for the dark version, neutral tone mapping for the light one.
- The loop renders on demand: no frame at rest, nothing when the tab is hidden. During playback it reads the audio clock on each animation frame but only renders when a step changes.
- The shadow map is reused unless an object that casts a shadow has moved; LED, screen and pad changes only repaint.
- Encoders and pads are InstancedMesh; the silkscreen, screens and backplates are drawn on canvas textures.
- Each control has an HTML twin, placed from the same projection right after each render, so keyboard and screen reader users can reach everything.
- Without WebGL 2 the page falls back to a static version.
- The drawer of machines uses thumbnails rendered from the scene itself.

Direct links: ?m=rytm (drum machine), ?m=arp (synth), ?m=decks (DJ decks).

[VIDEO]
[CAPTURE 1] [CAPTURE 2] [CAPTURE 3]

Questions and critiques welcome, especially on performance on low-end phones.
```

## 5. Elektronauts

Catégorie "The Lounge > Other Gear" (ou "Sandbox"), vérifiée sur https://www.elektronauts.com/categories.json. Décris la machine par ses fonctions. Une seule mention du workflow Elektron, jamais le mot "clone", aucun nom de machine Elektron dans le titre.

```text
Title: MM-RYTM: a free browser drum machine with parameter locks on every step

I'm a DJ and producer, and I built a small studio into my website. The drum machine, MM-RYTM, is inspired by the Elektron workflow: 8 voices, 16 steps, 16 patterns, and a parameter lock on any step (hold the step, drag a value on the screen). Each voice has a synth layer and a sample layer and its own effects; the machine also has swing, bit reduction and a bus compressor. Next to it there is MM-ARP, a synth with an arpeggiator and chord pads, and MM-DECKS, two to four decks and a mixer.

Everything takes MIDI LEARN (Chrome, Edge, Opera, Firefox), and a Roto-Control has ready-made setups, including one that turns it into a step sequencer for MM-RYTM.

https://mauditemachine.com/?m=rytm

[VIDEO]
```

Vérification du dernier point : le setup RSEQ du Roto-Control montre huit pas du MM-RYTM à la fois (docs/midi/MIDI-roto-reference.md, "Les sequenceurs RSEQ et BSEQ").

## 6. awesome-webaudio (pull request)

Dépôt : https://github.com/notthetup/awesome-webaudio , section Apps. Format relevé dans le README le 2026-10-11 : une puce, le nom en lien, un trait d'union, une description courte terminée par un point. Les entrées ne sont pas triées par ordre alphabétique : ajoute la ligne à la fin de la section. Le contenu du fichier CONTRIBUTING n'a pas été lu : lis-le avant d'ouvrir la pull request.

Ligne à ajouter :

```text
*   [MM-STUDIO](https://mauditemachine.com/) - A 3D drum machine, synth and DJ decks in the browser, with parameter locks and Web MIDI.
```

Titre de la pull request : `Add MM-STUDIO to Apps`

Description de la pull request :

```text
Adds MM-STUDIO to the Apps section: a drum machine, a synth and DJ decks built with Web Audio (AudioWorklet) and Three.js, playable in the browser without an account.
```

## 7. The Exchange (Melbourne Instruments)

Formulaire : https://exchange.melbourneinstruments.com/submit.html (connexion obligatoire). Ce qui a été lu sur la page le 2026-10-11 :

- le critère : "whether it would be useless without a Roto-Control". MM-STUDIO marche sans Roto-Control, donc dépose les setups, pas le site ;
- un fichier par entrée, 5 Mo au plus (zippe les setups ensemble) ;
- "Everything here is CC BY 4.0" : n'importe qui pourra réutiliser et modifier tes setups en te créditant. Lis aussi les conditions des contributeurs (terms.html) avant d'envoyer ;
- contact : theexchange@melbourneinstruments.com.

Prends les fichiers dans le panneau MIDI du site en ligne (ce sont les versions à jour), et ne mets dans le zip que les setups RYTM, RSEQ, ARP, DECK, MIXER et LIVE : les deux autres fichiers du dossier docs/midi/roto visent une machine cachée.

| Champ du formulaire | À remplir |
|---|---|
| Your file | mm-studio-roto-setups.zip [A FAIRE] |
| What should it be called? | MM-STUDIO setups for Roto-Control |
| Who makes it? | Maudite Machine |
| Which one? | A MIDI setup (for gear, or a plugin you MIDI-learn) |
| How far have you tested it? | à choisir par toi (si tu joues avec : "I have used it with the gear it is for") |
| Which Roto-Control firmware have you tested it on? | [VERSION DU FIRMWARE, A REMPLIR] |
| A link, if there is one | https://mauditemachine.com/?m=rytm |
| What is this link to? | MM-STUDIO in the browser |
| Leave this empty | laisser vide |

Description :

```text
Six MIDI setups for MM-STUDIO, a drum machine, a synth and DJ decks that run in the browser over Web MIDI: RYTM (MM-RYTM drum machine), RSEQ (eight steps of MM-RYTM at a time, hold a step and turn a knob for a parameter lock), ARP (MM-ARP synth), DECK and MIXER (MM-DECKS), and LIVE (the mixer, the drum machine mutes, the synth chords and the effects on one setup). Each setup has its own MIDI channel, short control names and one colour per page, and the site sends values back so the motorised knobs and LEDs follow the screen. Import each file in ROTO-SETUP with File > Import. Works in Chrome, Edge, Opera and Firefox.
```

Vérifications de cette description : canaux, noms courts, couleurs par page et retour vers les potards motorisés dans src/v4/midi/roto.ts et docs/midi/MIDI-roto-reference.md ; contenu de LIVE dans l'en-tête de src/v4/midi/roto.ts ; RSEQ dans docs/midi/MIDI-roto-reference.md.
