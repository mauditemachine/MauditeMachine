# MM-ARP, installation sur Mac (VST3)

## Installer ou mettre a jour

1. Dans le Terminal, rien a telecharger avant :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
```

   Le script (`update.sh`) telecharge le dernier build vert (la release **mm-arp-latest** du depot, que le CI remplace a chaque build) et l'installe dans `/Library/Audio/Plug-Ins/VST3/MM-ARP.vst3` (ou remplace celui de `~/Library` s'il n'y a que lui). Il affiche le commit et l'heure du build, retire la quarantaine et re-signe le plugin sur ton Mac (sans compte Apple Developer, macOS le bloquerait sinon). Le mot de passe demande est celui de ta session Mac.
2. Quitte Ableton s'il etait ouvert (Cmd + Q) et rouvre-le. Reglages > Plug-ins, "Use VST3 Plug-in System Folders" active, puis **Option + clic sur Rescan** la premiere fois.
3. Dans le navigateur : **Plug-Ins > Maudite Machine > MM-ARP**. Glisse-le sur une piste MIDI.

Un artefact telecharge a la main (onglet **Actions**, workflow **Plugin MM-ARP**, artefact **MM-ARP-macOS**) s'installe pareil : `bash update.sh ~/Downloads/MM-ARP-macOS.zip` (`update.sh` est dans l'artefact).

Si macOS dit encore "MM-ARP.vst3 was blocked" (un plugin copie a la main) :

```bash
P=/Library/Audio/Plug-Ins/VST3/MM-ARP.vst3; [ -d "$P" ] || P=~/Library/Audio/Plug-Ins/VST3/MM-ARP.vst3; sudo xattr -cr "$P" && sudo codesign --force --deep --sign - "$P" && echo "OK : $P"
```

## Utilisation

- **La face** : c'est ton MM-ARP du site, le meme (potards, pads d'accords, suite EDIT, ecran, presets). Le son vient du plugin, jamais de la page.
- **L'arpege** : Ableton qui joue fait jouer la progression des pads, une mesure par accord, calee sur les mesures du morceau. Ableton arrete, RUN de la face lance l'horloge interne (au tempo de la face), STOP l'arrete. Le parametre **Arpeggiator** (automatisable) le coupe.
- **MIDI** : un clip ou un clavier joue le synthe directement (polyphonique, 12 voix), la velocite fait l'accent (100 = l'accent normal). Avec l'arpege coupe (ou sans accord), le MM-ARP est un synthe classique.
- **Le projet** : tout ce que tu regles dans la face est sauve dans le projet Ableton, et le plugin joue meme fenetre fermee. Le hasard (RAND, DRIFT) a sa graine dans le projet : un export rejoue les memes notes.
- **Les parametres** : deplie le plugin (le triangle de la barre du plugin) : Arpeggiator, Master et les 62 potards du site (face et TWEAKS), avec le texte de l'ecran. Automation, MIDI Map (Cmd + M, clique un parametre, tourne ton controleur), meme fenetre fermee. Un potard tourne dans la face bouge le parametre (et s'enregistre en automation), l'automation bouge le potard de la face.
- **Presets sur le disque** : OPEN (le tiroir), colonne DISK : SAVE TO DISK (tu le nommes, puis la fenetre du Mac pour choisir ou), OPEN FROM DISK, et la liste des presets de `Musique/Maudite Machine/MM-ARP Presets` (fichiers `.mmarp`, a copier, partager, sauvegarder).
