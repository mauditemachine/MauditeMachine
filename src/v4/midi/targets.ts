/**
 * Tout ce qu'un controleur MIDI peut piloter (2026-10-05, Mika : "je
 * voudrais que toutes les actions, tous les parametres de toutes les
 * machines puissent etre assignes en MIDI ; j'ai un Roto-Control, je
 * voudrais selectionner un preset de mon Roto-Control, choisir la machine
 * que je veux et avoir les assignations"). Une cible : un parametre (une
 * valeur de 0 a 1, des crans s'il en a), ou une action (un appui ; tenue :
 * appui et relachement, CUE, un pad d'un sampler). Son id est stable (les
 * assignations retenues s'y referent) :
 * - MM-RYTM : rytm:enc:<encodeur>, rytm:voice:<voix>:<parametre> (le
 *   parametre d'une voix sans la choisir ; :mute, la voix coupee, 0 ou 1),
 *   rytm:kit:<tweak>, rytm:pad:<voix>, rytm:step:<0-15>, rytm:run, clear,
 *   random, mute, solo, edit, open ; rytm:running (en marche, 0 ou 1 : un
 *   bouton a bascule dont la LED suit) ; depuis le 2026-10-08 (la refonte
 *   facon Digitakt) rytm:knob:<1-8> (les potards de page A a H : ce que leur
 *   bloc regle sur la page affichee, 0 a 127 comme l'ecran ; une autre page,
 *   leurs valeurs repartent vers les potards motorises), rytm:page:<page>,
 *   rytm:page (six crans) et rytm:home ; les verrous (2026-10-08, l'etape R2)
 *   rytm:lock:<0-15> (le LOCK sur ce pas, encore : hors LOCK) et rytm:lock
 *   (le pas choisi) ; en LOCK, rytm:knob regle les verrous du pas ; les
 *   couches (revue de R3) rytm:layer:<famille>:<reglage> (mach, syn, sample,
 *   lev, tune, fine, start, len, rev : la couche d'une famille sans choisir
 *   sa voix) ; rytm:infos (la touche i de l'ecran, l'etape R4) ; le Roto en
 *   sequenceur (2026-10-09, midi/seqlink.ts) rytm:seq:<1-8> (les pas d'une
 *   fenetre, appui et lacher), rytm:seq:window, rytm:seq:follow,
 *   rytm:seq:voice:<voix> ; l'etape 2 (2026-10-09) : quatre pages,
 *   rytm:page:voice fltr env fx (la touche : la page, son onglet suivant,
 *   HOME), les anciennes rytm:page:trig src smpl amp restent (des alias : TRIG
 *   SRC SMPL ouvrent VOICE, AMP ouvre ENV), rytm:page a quatre crans,
 *   rytm:screen:<ecran> (un onglet : voice synth fltr env fxv fxg ; depuis le
 *   2026-10-10 la page d'un FX global : fxdist fxchorus fxdelay fxreverb fxbit
 *   fxcomp, ses reglages en rytm:enc:xtone, dtone, rsize... ; et sous la voix,
 *   l'onglet de la voix de ces pages : fxvdist fxvchorus fxvdelay fxvreverb) ;
 *   rytm:knob:<1-8> reste le bloc k de l'ecran affiche (en P-LOCK, son
 *   verrou) ; les encodeurs du desktop apprennent leur FX global
 *   (rytm:enc:dist... theme.ts GLOBAL_ENCODERS), avec rytm:enc:dtime et
 *   rytm:enc:dfb (DLY TIME, DLY FB) ; la face V.4.0 (2026-10-27) n'a plus de
 *   pads au desktop : rytm:pad:<voix> reste (les voix d'INSTRUMENTS), il
 *   choisit la voix, la joue a l'arret, la coupe ou la met en solo en MUTE et
 *   SOLO, sans pad 3D (MUTE arme son mode au desktop, actions.ts muteToggle) ;
 *   la phase 3 (2026-10-27, la spec de Mika, ajoutees sans rien renommer) : rytm:trk (tenue : une valeur > 0 enfonce
 *   TRK, 0 la lache, le meme chemin que la touche de la face), rytm:scene:a et rytm:scene:b (de meme), rytm:xfade (le
 *   crossfader, 0 a 127 de A a B) et rytm:voice:select:<voix> (la voix choisie comme TRK + un pas, sans un son) ;
 * - MM-ARP : voy:knob:<potard>, voy:pad:<0-7>, voy:run, clear, random,
 *   edit, open ; voy:running ; voy:infos (la touche i du grand ecran,
 *   2026-10-08) ;
 * - partout : nav:<all|mm808|voy|dj|prev|next>, nav:machines (PLAY/STOP
 *   du MM-RYTM et du MM-ARP ensemble) ;
 * - MM-DECKS (dj:<commande>, et dj:smpl:<platine>:... pour le sampler de
 *   chaque platine, 2026-10-07) : son code arrive a part (state/djload.ts)
 *   et inscrit ses cibles (dj/midi.ts) ; une assignation qui les vise le
 *   charge. Le MM-SMPL (smpl:...) est parti le 2026-10-07 ;
 * - MM-BASS (bass:knob:<potard>, bass:key:<touche>, bass:running,
 *   bass:trig:<0-15>, bass:lock:<0-15> et bass:lock, 2026-10-07) : de meme
 *   (state/bassload.ts, bass/midi.ts).
 */

// Decoupe en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : un fichier par groupe dans midi/targets/, l'ordre des
// groupes fige dans midi/targets/index.ts ; ce baril garde la liste des exports d'avant (aucun import du site ne change).
export * from './targets/types';
export * from './targets/stage';
export * from './targets/index';
