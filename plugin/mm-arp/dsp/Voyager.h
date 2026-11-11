// MM-ARP : le moteur du synthe (port C++17 de src/v4/audio/moog.worklet.js, l'AudioWorklet 'mm-voyager' du site).
//
// Port ligne a ligne, meme ordre d'operations, calcul en double comme le JS ; les tableaux Float32Array du JS
// (le bloc surechantillonne, l'etage intermediaire et l'historique des decimateurs, la sortie) sont des float ici
// aussi : l'arrondi en float se fait aux memes endroits. Le hasard : mulberry32 a graine, la meme suite que le JS.
// Verifie contre le vrai worklet par plugin/mm-arp/tests/voyager-ref.mjs + tests/voyager_compare.cpp.
//
// Les fonctions de Math sont celles de V8 (son fdlibm, Voyager.fdlibm.inc) : la libm du systeme differe d'un ulp sur
// 1 a 10 % des valeurs. IMPORTANT (identite au bit pres) : pas de contraction FMA ni de fast-math. Voyager.cpp coupe
// la contraction par pragma (clang : fp contract(off), GCC : optimize("fp-contract=off"), verifie avec -march=native
// et -ffp-contract=fast/on) ; garder quand meme -ffp-contract=off dans le CMake, et jamais -ffast-math / -Ofast.
//
// ----------------------------------------------------------------------------------------------------------------
// API (tout est en "temps du contexte" : secondes depuis la frame 0 du moteur ; frame = round(t * sampleRate),
// arrondi JS Math.round). Les messages s'appliquent tout de suite, c'est-a-dire "entre deux blocs" comme le port du
// worklet : appeler note/beat/params/... entre deux process(). currentFrame() avance de n a chaque process(n).
//
//   mmarp::VoyagerOptions o;            // sampleRate, os (1, 2, 4 ou 8), maxVoices (1..12), maxStack (1..3),
//                                       // wideVoices (>= 0), seed (mulberry32), seeded (false : graine tiree au hasard)
//   mmarp::Voyager v(o, {{"cutoff", 800}, {"res", 0.3}});   // params initiaux = processorOptions.params
//   v.params({{"cutoff", 1200}});       // message 'params' partiel (cles inconnues ou non finies ignorees, bornees)
//   v.params(kv, n);                    // la meme chose sans chaine (ids : Voyager::paramIndex("cutoff")), temps reel
//   v.note(t, midi, gate, accent, from) // gate en s (+inf : jusqu'au noteOff), accent 0/NaN -> 1, from NaN = null
//                                       // (+ glideSec, velocity, le plugin seul : voir LES EXTENSIONS DU 2026-11-11)
//   v.pitchBend(x); v.modWheel(x); v.aftertouch(x);   // le plugin seul (LES EXTENSIONS DU 2026-11-11, SUITE)
//   v.beat(t, beat, bpm, run)           // ancre du transport (LFO MOD cale) ; bpm NaN ou <= 0 -> le bpm des params
//   v.noteOff(midi, t)                  // t NaN = maintenant
//   v.cancel(t); v.stop(t);             // t NaN = 0 (comme "m.time || 0" du JS)
//   v.process(L, R, n);                 // n de 1 a 4096 (le JS : 128), sortie stereo float, aucune allocation
//   v.latencySamples();                 // retard fixe des decimateurs, arrondi (x8 : 21, x4 : 19, x2 : 16, x1 : 0)
//
// Capacites fixes (aucune allocation apres le constructeur) : 1024 notes en attente, 512 ancres ; au-dela, le
// nouvel element est ignore (le JS n'a pas de limite). Le mode 'probe' (tests du site) n'est pas porte.
//
// ----------------------------------------------------------------------------------------------------------------
// LES EXTENSIONS DU PLUGIN (2026-11-10, Mika : "une qualite absolument eblouissante, quitte a prendre plus de
// processeur" ; le site ne les connait pas, moog.worklet.js ne change pas). Regle : chaque cle a son defaut rend le
// moteur du site AU BIT PRES (les 85 cas de voyager_compare), sans un tirage de hasard de plus ; verifie par
// tests/hq_test.cpp.
//
// 1. QUALITY HQ : os = 8 (surechantillonnage x8). Une demi-bande de plus x8 -> x4 (Kaiser, 23 coefficients, beta 10 :
//    -100 dB), puis les deux du site. Tout le moteur suit le taux interne (coefficients, lissages, rampes, ADAA) ; le
//    rythme du contexte reste le meme (bruit, coupure, hauteur, GLUE : une valeur par echantillon du contexte) ; le
//    MS-10 garde son plafond de 16 kHz et ne double ses pas qu'en x2, comme au site ; la FM garde la largeur de
//    bande du x4 (76.8 kHz a 48 kHz) : le meme son, sans le repliement. latencySamples() : 21 en x8.
//      v.setOs(8);      // thread audio, AUCUNE allocation (tout est alloue pour x8 au constructeur)
//      v.os();          // le taux en cours ; v.osPending() : un changement attend
//    setOs ne coupe rien net : les voix qui sonnent partent en 12 ms (comme stop) et le taux change au debut du
//    premier process() ou plus aucune voix ne sonne depuis 64 echantillons (au plus 0.3 s apres la demande ; ~0.1 s
//    en pratique). Pendant ce silence aucune note ne part. LA FILE EST GARDEE : les notes a venir jouent a leur
//    heure au nouveau taux ; une note dont l'heure est tombee pendant le silence part au changement si son gate court
//    encore (raccourci d'autant ; une note tenue repart donc), sinon elle est retiree. Les notes qui sonnaient au
//    moment de la demande sont perdues (a l'appelant de les rejouer s'il les tient). Les ancres, les reglages et la
//    suite du hasard restent. latencySamples() change avec le taux : le relire quand osPending() retombe.
//
// 2. LFO 1, SECONDE DESTINATION : le LFO MOD du site (meme phase, meme forme, memes ancres, meme lissage de 2 ms)
//    module AUSSI une destination de la liste ci-dessous. Cles : xl1Dest (0 OFF, 1..10), xl1Amt (0..1).
//
// 3. LFO 2, independant, cale sur les memes ancres 'beat' que le LFO 1. Cles :
//      l2Beats  la duree du cycle en temps, 0.125 a 32 (defaut 4)
//      l2Shape  0 SINE (-cos : part du bas comme le triangle), 1 TRI, 2 SAW descendante, 3 RAMP montante, 4 SQR,
//               5 S&H, 6 RND lisse
//      l2Dest   0 OFF, 1 WAVE, 2 CUTOFF, 3 FM, 4 PITCH (les lois du LFO 1 du site : WAVE 2 formes d'onde, CUTOFF
//               3 octaves, FM +/-0.6, PITCH +/-100 cents), puis 5..14 : la liste ci-dessous dans le meme ordre
//      l2Amt    0..1
//    Son hasard (S&H, RND) : une valeur par cycle tiree de (graine derivee de options.seed, numero du cycle), jamais du
//    generateur du moteur ; il ne depend donc que de la position du transport (une boucle ou un export le rejouent).
//    Un saut d'au moins 0.5 d'un cycle au suivant comme le LFO 1 (sauf un cycle sur 64, l'ancre de la chaine).
//
// Les destinations etendues (xl1Dest / l2Dest - 4) et leur profondeur a amt = 1, le LFO allant de -1 a +1 :
//    1 RES          +/-0.35 autour du potard, borne a 0..1
//    2 AMP          tremolo : plein niveau LFO en haut, -100 % (silence) LFO en bas ; sur le VCA de chaque voix,
//                   avant la saturation et le bus
//    3 PAN          plein gauche (LFO en bas) a plein droite, a puissance constante (1 au centre, racine de 2 au bord),
//                   sur la sortie du bus
//    4 OSC 2 PITCH  +/-12 demi-tons sur OSC 2 seul (avec SYNC : le balayage de sync)
//    5 OSC MIX      la balance : LFO en haut OSC 2 seul, en bas OSC 1 seul (aucun des deux ne depasse son niveau)
//    6 NOISE        +/-1 autour du potard, borne a 0..1 (potard a 0 : de 0 au plein niveau sur la moitie haute)
//    7 SUB          +/-0.88 (le plein niveau du site) autour du potard, borne a 0..0.88
//    8 DRIVE        +/-0.5 autour d'OVERDRIVE, borne a 0..1
//    9 STACK        +/-15 cents autour de l'ecart, borne a 0..30 ; n'agit que si STACK est engage (stack > 0 a la note)
//   10 ENV AMT      +/-3 octaves autour d'ENV AMT, borne a 0..6
//    Deux LFO sur la meme destination s'additionnent avant la borne. Rien ne clique : la quantite glisse (15 ms), une
//    destination ne change que quand sa quantite est revenue a 0, et la modulation se calcule la ou le moteur calcule
//    deja la sienne (LFO et quantite a chaque echantillon interne ; hauteur, coupure, PAN, DRIVE, STACK a chaque
//    echantillon du contexte).
//
// ----------------------------------------------------------------------------------------------------------------
// LES EXTENSIONS DU 2026-11-11 (Mika : "le top du top", "pas assez de fonctions" ; le plugin seul). Meme regle :
// chaque cle a son neutre rend le moteur du site AU BIT PRES, sans un tirage de hasard de plus (aucun de ces chemins
// ne tourne) ; verifie par tests/hq2_test.cpp (empreintes du moteur d'avant, 85 cas de voyager_compare). Engagees ou
// reglees en cours de jeu, les quantites glissent (15 ms) : aucun clic. Aucune allocation apres le constructeur.
//
// 4. LE GLISSEMENT PAR NOTE : v.note(t, midi, gate, accent, from, glideSec). glideSec > 0 (et from fini) : la note
//    glisse depuis from en glideSec (la loi de GLIDE : l'ecart decroit en exp(-3 t / glideSec), 95 % du chemin en
//    glideSec), meme si GLIDE est a 0, et a la place de GLIDE pour cette voix. 0 : le GLIDE du patch (le site).
//    L'arpegiateur s'en sert pour SLIDE (dsp/Arp.h : ArpSink::noteGlide, kSlideSec = 0.06).
//
// 5. Les cles (params) :
//      xRing      0..1 (0 : absent)    OSC 1 x OSC 2 (de chaque exemplaire de STACK / UNISON), ajoute au melange, au
//                                      centre ; independant des niveaux OSC 1 / OSC 2 (les deux a 0 : le produit seul)
//      xFold      0..1 (0 : absent)    repliement d'onde du melange (oscillateurs, RING, SUB, bruit) avant le filtre :
//                                      y = s sin(a x), a = 8 fold^1.5 (a 1 : 2.5 plis pour une entree de 1), s = 1 / a
//                                      sous a = 1 (petit FOLD : le son d'origine a peine arrondi) puis a^-0.3 (sonie
//                                      tenue). Antirepliement : ADAA d'ordre 2 au taux interne (x4 / x8). Mesure
//                                      (hq2_test) : scie do 5 repliee a fond -64 dBc en x4, -72 en x8 ; sinus : -130.
//      xNoiseCol  0..1 (0.5 : neutre)  la couleur du bruit : 0 rouge (-6 dB / octave au-dessus de 100 Hz), 0.25 rose
//                                      (-3 dB / octave), 0.5 le blanc du site, 1 bleu (+6 dB / octave) ; a sonie egale
//      xUnison    0, 5 ou 7            5 ou 7 exemplaires desaccordes par oscillateur au lieu des 3 de STACK (toute
//                                      autre valeur : 0 sous 3, 5 de 3 a 5, 7 au-dessus). La logique de STACK : gain
//                                      1 / racine(n), ecart = le reglage STACK (cents ; ecarts inegaux, pas de
//                                      battement regulier), repartition stereo par WIDE. S'engage meme si STACK est a
//                                      0 (les exemplaires sont alors a l'unisson, phases a part : mettre STACK > 0).
//                                      Pris a la note suivante, comme STACK. Les exemplaires neufs tirent leur phase
//                                      du hasard du moteur (comme ceux de STACK).
//      xHpf       0 ou 20..2000 Hz     (0 : absent ; sous 20 : 20) un passe-haut 12 dB / octave (Butterworth) par
//                                      voix apres le filtre et le peigne, avant le VCA ; pas de suivi du clavier
//      xComb      0..1 (0 : absent)    la dose d'un peigne accorde sur la note jouee (sa periode, GLIDE et SLIDE
//                                      compris ; pas TUNE ni FINE), apres le filtre de la voix : une ligne a retard
//                                      par voix et par canal au taux interne, lue en Lagrange d'ordre 3, la boucle
//                                      amortie a 10 kHz ; sous 27.5 Hz, une octave plus haut
//      xCombFb    -1..1 (0 : aucune)   sa reinjection (x0.97). 0 : entree + ligne (un peigne simple, bosses sur les
//                                      harmoniques de la note) ; positive : les bosses se resserrent et resonnent
//                                      (du bruit devient la note) ; negative (sous -0.2) : entree - ligne, les bosses
//                                      entre les harmoniques (creux, une octave dessous). Sans xComb : rien.
//    Le cout (12 voix, une machine lente ; hq2_test --cpu) : RING, NOISE COLOR, HIGH PASS, COMB : 0 a 2 % d'un
//    coeur ; FOLD : +10 % en x4, +13 % en x8 ; UNISON 5 / 7 : +16 / +21 % en x4, +34 / +47 % en x8 (STACK 3 :
//    +7 / +19 %).
//
// ----------------------------------------------------------------------------------------------------------------
// LES EXTENSIONS DU 2026-11-11, SUITE (Mika : "toutes les fonctions possibles", a la maniere des grands synthes
// analogiques modulaires ; le plugin seul). Meme regle : chaque cle a son neutre, les controleurs a 0 (ou tournes
// sans ligne qui les lise) et la velocite donnee ou non rendent le moteur d'avant AU BIT PRES, sans un tirage de
// hasard de plus ; verifie par tests/hq3_test.cpp (les empreintes de hq2_test, les 85 cas de voyager_compare).
//
// 6. LES CONTROLEURS (entre deux process(), comme les messages ; lisses 5 ms au taux interne, aucun clic) :
//      v.pitchBend(x)    -1..1 ; il deplace TOUJOURS la hauteur de toutes les voix (OSC 1, OSC 2, SUB, COMB) de
//                        x fois pbRange demi-tons, et il est la source PITCH BEND de la matrice
//      v.modWheel(x)     0..1, la source MOD WHEEL     v.aftertouch(x)   0..1, la source AFTERTOUCH (de canal)
//    cle pbRange 1..24 demi-tons (defaut 2 ; continu).
//    La velocite : v.note(t, midi, gate, accent, from, glideSec, velocity). velocity 0..1 est la source VELOCITY, par
//    voix ; negative ou NaN (le defaut) : accent x 100 / 127 (borne a 1). Elle ne touche a rien d'autre (le niveau et
//    le filtre suivent accent, comme avant).
//
// 7. LA MATRICE DE MODULATION, 6 lignes : cles mNSrc, mNDst, mNAmt (N = 1..6 ; amt -1..1). Une ligne est neutre si
//    sa source ou sa destination est a 0 ou sa quantite a 0.
//    Sources (mNSrc) :
//       0 OFF
//       1 VELOCITY     0..1, par voix (la velocite brute de la note)
//       2 MOD WHEEL    0..1                  3 AFTERTOUCH   0..1                  4 PITCH BEND   -1..1
//       5 KEY          par voix : la hauteur de la note (son glissement compris), 0 au do central (midi 60), +/-1 a
//                      +/-2 octaves ((midi - 60) / 24), bornee a +/-2.5
//       6 LFO 1        -1..1 : la forme du LFO MOD de la face, quelle que soit sa profondeur (lfoAmt) et sa destination
//       7 LFO 2        -1..1 : la forme du LFO 2 ; il tourne pour la matrice meme si l2Dest est a OFF
//       8 FILTER ENV   0..1, par voix        9 AMP ENV      0..1, par voix
//      10 S&H          -1..1, par voix : un tirage par note jouee (une note liee en LEGATO tire aussi), tenu ; tire
//                      de (graine derivee, position de la note en 1/96 de temps, numero de la note) : jamais du
//                      generateur du moteur ; une boucle ou un export rejouent les memes tirages
//      11 RANDOM       -1..1, par voix : un bruit lisse lent, une valeur par temps (decale par voix) reliee a la
//                      suivante en S ; tire de (graine derivee, voix, position) : meme regle
//    Destinations (mNDst) et leur course a amt = 1 pour une source a +/-1 (les lois et les bornes des destinations
//    de LFO) :
//       0 OFF
//       1 PITCH        +/-12 demi-tons (OSC 1, OSC 2, SUB)          2 OSC 2 PITCH  +/-12 demi-tons, OSC 2 seul
//       3 WAVE         +/-2 formes d'onde (OSC 2 : x0.8)            4 FM           +/-0.6, borne a 0..1
//       5 OSC MIX      la balance (+1 : OSC 2 seul, -1 : OSC 1 seul)
//       6 NOISE        +/-1, borne a 0..1                           7 SUB          +/-0.88, borne a 0..0.88
//       8 RING         +/-1 autour de xRing, borne a 0..1           9 FOLD         +/-1 autour de xFold, borne a 0..1
//      10 CUTOFF       +/-4 octaves                                11 RES          +/-0.35, borne a 0..1
//      12 ENV AMT      +/-3 octaves, borne a 0..6
//      13 DRIVE        +/-0.5, borne a 0..1. Une source commune pousse tout OVERDRIVE (l'etage du bus compris,
//                      comme la destination de LFO) ; une source par voix pousse l'entree du filtre et le VCA de sa
//                      voix, l'etage du bus reste celui du potard
//      14 AMP          un VCA par voix : gain = 1 + somme, borne a 0..1, ou une ligne compte amt x (u - 1) si amt > 0
//                      (plein niveau quand la source est en haut, -100 % en bas a amt 1) et amt x u si amt < 0 (la
//                      source en haut : moins fort) ; u = la source ramenee a 0..1 (une source a deux signes : (s + 1) / 2)
//      15 PAN          par voix : +/-1 autour de la place de la note (WIDTH), borne aux bords, a puissance constante
//      16 STACK        +/-15 cents autour de l'ecart, borne a 0..30 (si STACK ou UNISON est engage a la note)
//      17 LFO 1 DEPTH  multiplie la profondeur du LFO 1 (sa destination de la face ET sa seconde destination) par
//                      1 + somme, borne a 0..1, avec la loi d'AMP : MOD WHEEL -> LFO 1 DEPTH a +1 : la molette dose
//                      le vibrato de 0 a la profondeur du potard. La source LFO 1 de la matrice n'est pas touchee.
//      18 LFO 2 DEPTH  de meme pour le LFO 2
//      19 COMB         +/-1 autour de xComb, borne a 0..1 (le peigne tourne alors meme si xComb est a 0)
//    Plusieurs lignes vers la meme destination s'additionnent, et avec les LFO, avant la borne. Une source par voix
//    module par voix (deux notes, deux velocites : deux coupures) ; tout est calcule la ou le moteur calcule deja ses
//    modulations : les sommes a chaque echantillon interne, la hauteur, la coupure, RES, DRIVE, FOLD, PAN, STACK a
//    chaque echantillon du contexte. Rien ne clique : la quantite d'une ligne glisse (15 ms), une ligne ne change de
//    source ou de destination que quand sa quantite est revenue a 0 ; la velocite et S&H sont posees a l'attaque (et
//    lissees 5 ms sur une note liee) ; PAN est pose au debut de la note.
//    Limites : LFO 1 / 2 DEPTH, d'une source par voix, prennent la valeur de la voix la plus recente (les LFO sont
//    communs a toutes les voix).
//
// 8. VOICE MODE : cle voiceMode 0 POLY (le site), 1 MONO, 2 LEGATO. Le mode est lu au depart de chaque note.
//      MONO    une seule voix : une note neuve reprend la voix, redeclenche les enveloppes (depuis leur niveau : pas de
//              clic) et fait taire en 12 ms ce qui restait de POLY ; avec GLIDE (ou un glissement propre), la hauteur
//              part d'ou elle est.
//      LEGATO  une seule voix : une note jouee pendant qu'une autre est tenue ne redeclenche rien, la hauteur glisse
//              vers elle (le glissement propre de la note, sinon GLIDE, 60 ms au moins) ; sinon comme MONO.
//    Dans les deux : quand la note en cours finit (sa duree, ou noteOff), la voix revient a la derniere note encore
//    tenue (priorite a la derniere ; 24 notes retenues), sans redeclencher (MONO : la hauteur saute, ou suit GLIDE ;
//    LEGATO : elle glisse). "Tenue" vaut pour les notes a duree connue de l'arpegiateur comme pour celles du clavier
//    (duree infinie + noteOff) : des pas dont le GATE depasse le pas se chevauchent, donc se lient en LEGATO et se
//    coupent en MONO. stop() et setOs() vident la pile. MONO / LEGATO consomment le hasard du moteur autrement que
//    POLY (moins de voix, pas de tirage sur une note liee) : revenu a POLY, le moteur est celui du site, pas la meme
//    suite de DRIFT.
//
// 9. FEEDBACK : cle xFeedback 0..1 (0 : absent). La sortie de chaque voix (apres son VCA, un echantillon interne plus
//    tot), sans son continu (25 Hz), revient a l'entree de son filtre (apres LOAD) a travers une tanh, x xFeedback. La
//    boucle est bornee deux fois (la tanh, le VCA qui est lui-meme une tanh) : elle ne s'emballe jamais, et elle se
//    tait avec la note (son gain suit l'enveloppe). Par canal quand la voix est large (WIDE, SPACE).
//
// 10. AMP MODE : cle ampMode 0 CLEAN (le site), 1 TRIODE, 2 PENTODE, 3 SATURATED. Un etage de sortie du bus, au taux
//    interne (apres GLUE, avant l'ecreteur de VOLUME), par sa primitive (ADAA d'ordre 1), suivi d'un bloqueur de
//    continu (8 Hz) :
//      TRIODE     (tanh(0.5 u + 0.35) - tanh 0.35), asymetrique doux : harmoniques paires (H2 3 % a 6 %)
//      PENTODE    z - z^3 / 3 puis plat (z = 1.5 u) : impaires, genou plus dur
//      SATURATED  tanh(5 u) : l'ecrasement franc
//    chacune a gain unite aux petits signaux, puis COMPENSEE EN NIVEAU : le gain de sortie suit le rapport des
//    energies d'entree et de sortie (moyennes de 0.35 s, mesurees sous 10 kHz, borne a -12 .. +15.6 dB ; au depart : la
//    valeur mesuree sur l'arpege du patch par defaut). Le niveau moyen est donc celui de CLEAN quel que soit le son ;
//    c'est la dynamique courte (les attaques) qui est ecrasee. Changer de mode : la dose descend (15 ms), le mode
//    change, elle remonte.
//
//    Le cout. Le moteur est compile en deux exemplaires (Voyager.cpp, processBlockT<MX>) : sans controleur, sans ligne
//    et sans FEEDBACK, c'est le code d'avant, au meme cout (instructions comptees : -0.1 %, 1 et 12 voix, x4 et x8).
//    Engages, 12 voix tenues, en instructions (x4 / x8 ; au chronometre, hq3_test --cpu, memes ordres de grandeur a 3
//    points d'un coeur pres sur la machine de test) : les controleurs seuls ou une ligne commune (MOD WHEEL -> LFO 1
//    DEPTH) +3 % ; une ligne par voix (VELOCITY -> CUTOFF) +9 / +10 % ; 6 lignes legeres (CUTOFF, PAN, AMP, PITCH,
//    ENV AMT, OSC MIX) +24 / +26 % ; 6 lignes par voix dont WAVE et RES +46 / +50 % ; FEEDBACK +6 % ; AMP MODE +1 %.
// ----------------------------------------------------------------------------------------------------------------
#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace mmarp {

struct VoyagerOptions {
  double sampleRate = 48000;
  int os = 4;          // 1, 2, 4 ou 8 (autre valeur : 4, comme le JS ; 8 : QUALITY HQ, le plugin seul)
  int maxVoices = 12;  // 1..12 (autre valeur : 12)
  int maxStack = 3;    // 1..3 (autre valeur : 3)
  int wideVoices = 8;  // >= 0 (negatif : 12) ; le site sur ordinateur : 8
  uint32_t seed = 808;
  bool seeded = true;  // false : comme unseeded() du JS (graine tiree de std::random_device, non reproductible)
};

/** Un reglage par son id (Voyager::paramIndex) : le chemin temps reel des messages 'params'. */
struct ParamKV {
  int id;
  double value;
};

class Voyager {
 public:
  static constexpr int kMaxBlock = 4096;
  static constexpr int kQueueCap = 1024;
  static constexpr int kBeatCap = 512;

  explicit Voyager(const VoyagerOptions& opts, const std::vector<std::pair<std::string, double>>& initialParams = {});
  ~Voyager();
  Voyager(const Voyager&) = delete;
  Voyager& operator=(const Voyager&) = delete;

  /** L'id d'une cle du moteur ("cutoff", "res"...), -1 si inconnue ; paramCount() cles, paramName(id). */
  static int paramIndex(const std::string& key);
  static int paramCount();
  static const char* paramName(int id);

  void params(const std::vector<std::pair<std::string, double>>& kv);
  void params(const ParamKV* kv, int n);
  /**
   * glideSec (le plugin seul) : le glissement propre de la note depuis fromMidi (0 : le GLIDE du patch).
   * velocity (le plugin seul) : la velocite brute 0..1, la source VELOCITY de la matrice ; negative ou NaN (le
   * defaut) : celle que dit l'accent (accent x 100 / 127, bornee a 1). Elle ne change rien d'autre au son.
   */
  void note(double timeSec, double midi, double gateSec, double accent, double fromMidi, double glideSec = 0, double velocity = -1);
  /** Les controleurs (le plugin seul ; entre deux process(), lisses 5 ms) : bend -1..1, molette et aftertouch 0..1. */
  void pitchBend(double v);
  void modWheel(double v);
  void aftertouch(double v);
  void beat(double timeSec, double beat, double bpm, bool run);
  void noteOff(double midi, double timeSec);
  void cancel(double timeSec);
  void stop(double timeSec);

  void process(float* L, float* R, int n);

  int64_t currentFrame() const;
  int latencySamples() const;
  /** Diagnostics : la valeur courante d'un reglage, les voix allumees, les remises au repos des gardes (heals). */
  double param(int id) const;
  int activeVoices() const;
  int heals() const;

  /** QUALITY : change le surechantillonnage (1, 2, 4, 8) depuis le thread audio, sans allocation (voir en tete). */
  void setOs(int os);
  int os() const;
  bool osPending() const;

 private:
  struct Impl;
  std::unique_ptr<Impl> m_;
};

}  // namespace mmarp
