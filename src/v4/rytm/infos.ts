/**
 * Le contenu des INFOS du MM-RYTM (2026-10-08, Mika : "excellent pour le
 * bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !"). Une carte par commande, en francais, dans la voix des INFOS du
 * MM-BASS (bass/infos.ts : tutoiement, typo quebecoise, espace insecable
 * avant le deux-points et entre un nombre et son unite, apostrophe
 * typographique ; jamais de tiret cadratin) : sa section (l'ecran et la
 * lettre de son bloc : ENV C), son nom tel qu'il est a l'ecran, ce qu'elle
 * fait DANS cette machine (les lois de audio/voicefx.ts, kit.ts,
 * shotsdsp.ts, sampledsp.ts, tone.ts, time.ts, fx.ts, sends.ts, chorus.ts,
 * pattern.ts et de actions.ts), sa course et son unite, et une astuce pour la
 * dark disco, l'indie dance ou le minimal. Les dessins, les ids et la table
 * des blocs : rytm/diagrams.ts et rytm/infoIds.ts.
 *
 * infoOf(id, ctx) rend la carte d'une commande :
 * - id : un id de rytm/infoIds.ts (vdecay, r:tune, voice, pad:SD, lock...),
 *   ou un bloc de l'ecran p:0 a p:7, resolu pour l'ecran affiche et la voix
 *   choisie ;
 * - ctx.voice : la voix choisie ; un texte qui depend de la voix suit
 *   (SOUND sur BD parle des kicks, sur CY d'un seul son) ;
 * - ctx.plate : un potard de la plaque TWEAKS (OPEN) : son nom et sa section
 *   de plaque ; ctx.step : le pas montre (STEP 05, P-LOCK 05) ;
 * - ctx.lockable : ce que dit rytm/pages.ts du bloc (slot.lock, scope ALL) ;
 *   il passe avant la table d'ici ; sauf pour une voix qui n'a rien a y
 *   verrouiller (MACHINE sur CY : pas de phrase).
 *
 * L'etape 2 (2026-10-09, Mika : "je veux merge SRC SMPL et TRIG ! ... AMP
 * doit s'appeler ENV et doit etre plus complet ; on doit ensuite avoir les FX
 * du Voice selectionne mais aussi les FX Globaux" ; "les encodeurs ne servent
 * qu'a faire les modifs des FX globaux de la machine" ; "j'aimerais autant en
 * mobile qu'en desktop pouvoir modifier les choses directement sur l'ecran") :
 * les cartes des pages VOICE (et son onglet SYNTH), FLTR (le vrai filtre),
 * ENV (ATK HOLD DEC), FX (VOICE FX et GLOBAL FX), de SOUND, MIX, FINE, du
 * filtre, de DLY TIME et DLY FB ; le P-LOCK se fait a l'ecran (les encodeurs
 * du desktop sont les FX globaux, jamais verrouilles) ; MUTE et SOLO a trois
 * etats (une voix, plusieurs, tenu : toutes reviennent). Les renvois d'une
 * carte a l'autre nomment l'ecran (VOICE SYNTH), pas une lettre : les blocs
 * changent de place d'une voix a l'autre.
 *
 * Les pages des FX globaux (2026-10-10, Mika : "quand je touche a un FX, par
 * exemple DELAY, dans l'ecran, ca doit afficher les configurations que je peux
 * avoir pour DELAY") : une carte par reglage (TONE de DIST, RATE et DEPTH du
 * CHORUS, TIME FEEDBACK TONE du DELAY, SIZE TONE PRE de la REVERB, RATE de BIT,
 * ATTACK et RELEASE du COMP), leurs lois dans audio/pattern.ts fxLaw ; GLOBAL FX
 * dit comment les ouvrir.
 */

// Decoupe en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : un fichier par domaine dans rytm/infos/, la table
// assemblee dans rytm/infos/index.ts ; ce baril garde la liste des exports d'avant (aucun import du site ne change).
export * from './infos/index';
export type { RytmInfoAvail, RytmInfoId } from './diagrams';
export { rytmInfoHit, resolveRytmId, soonInfoId } from './diagrams';
