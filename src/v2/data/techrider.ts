/**
 * Contenu de la fiche technique 2026/27, EN et FR.
 *
 * Source unique de la page /techrider : le PDF telechargeable dit la meme
 * chose, la page evite au promoteur d'ouvrir un fichier pour six lignes.
 * Ajouter un bloc = ajouter une entree dans les deux langues.
 */

export interface RiderBlock {
  num: string;
  title: string;
  /** Sous-titre des en-tetes de format (DJ set, live hybride), brief de Mika du 2026-10-10 */
  subtitle?: string;
  items: { term: string; text: string }[];
}

export interface RiderCopy {
  title: string;
  subtitle: string;
  back: string;
  download: string;
  downloadMeta: string;
  edition: string;
  ctaFooter: string;
  plotTitle: string;
  plotNote: string;
  blocks: RiderBlock[];
}

export const RIDER: { en: RiderCopy; fr: RiderCopy } = {
  en: {
    title: 'Tech Rider',
    subtitle:
      'DJ setup, hybrid live, hospitality and travel. Everything a promoter needs to book the machine.',
    back: '← Back to site',
    download: 'Download Tech Rider',
    downloadMeta: 'PDF · EN',
    edition: 'Edition 2026 / 27',
    ctaFooter: 'DJ set · hybrid live · stage plot · hospitality · travel',
    plotTitle: 'Stage plot · hybrid live',
    plotNote: 'Top view. Measurements in centimetres. Audience at the bottom.',
    blocks: [
      {
        num: '01',
        title: 'Hybrid live',
        subtitle: 'Indie dance and dark disco. 60 to 75 minutes.',
        items: [
          {
            term: 'Artist brings',
            text: 'Ableton Push 3, Dreadbox Typhon, Melbourne Instruments Roto-Control, MacBook Pro with Ableton Live, audio interface with 2 balanced outputs, all cables between his own devices.',
          },
          {
            term: 'Venue provides',
            text: '2 active DI boxes or 2 balanced XLR lines (stereo L/R) from the artist’s interface to FOH.',
          },
          {
            term: 'Power',
            text: 'One clean circuit with 4 grounded outlets at the table, total draw under 300 W.',
          },
          {
            term: 'Table',
            text: 'At least 180 x 70 cm, 90 to 100 cm high, stable, separate from the DJ mixer when the space allows.',
          },
          {
            term: 'Transitions',
            text: 'A CDJ and mixer setup next to the live table when the live set is followed or preceded by a DJ set.',
          },
          {
            term: 'Soundcheck',
            text: '30 minutes of line check before doors, or a 15-minute changeover for a mid-night slot.',
          },
        ],
      },
      {
        num: '02',
        title: 'DJ set',
        subtitle: 'Indie dance and dark disco. 90 minutes to 4 hours.',
        items: [
          {
            term: 'Players',
            text: '2 x Pioneer DJ CDJ-3000 (CDJ-2000NXS2 accepted as a minimum), linked with Pro DJ Link, firmware updated before the show. A third player is welcome.',
          },
          {
            term: 'Mixer',
            text: 'Pioneer DJ DJM-A9 preferred. DJM-V10 or DJM-900NXS2 accepted. Any other mixer only with prior agreement.',
          },
          { term: 'Playback', text: 'USB, rekordbox export. No laptop for DJ sets.' },
          {
            term: 'Booth monitors',
            text: '2 x active full-range monitors (12" or 15" with horn) at ear height on both sides of the mixer, level control at the booth, independent from the main mix.',
          },
          {
            term: 'Booth',
            text: 'Stable table 90 to 100 cm high, free of vibration, at least 140 x 60 cm of free surface, two grounded outlets, a small light if the booth is dark.',
          },
          { term: 'Artist brings', text: '2 USB sticks, headphones.' },
        ],
      },
      {
        num: '03',
        title: 'Hospitality',
        items: [
          {
            term: 'Storage',
            text: 'A private, lockable space or secure storage for bags and equipment from arrival to load out.',
          },
          { term: 'Water', text: 'Still and sparkling water at the booth and in the green room.' },
          {
            term: 'Meal',
            text: 'A hot meal before the set, or a meal allowance, on show days that follow travel.',
          },
          { term: 'Guest list', text: 'Two guest list spots.' },
          {
            term: 'On site',
            text: 'One contact person on site, reachable by phone from arrival to departure.',
          },
        ],
      },
      {
        num: '04',
        title: 'Set length & fees',
        items: [
          { term: 'DJ set', text: '90 minutes to 4 hours, longer sets on request.' },
          {
            term: 'Hybrid live',
            text: '60 to 75 minutes, followed by a DJ set if the slot allows.',
          },
          {
            term: 'Fee',
            text: 'On request, set per territory, date and format. 50% deposit at contract signature, balance as agreed in the contract. Flights, hotel and ground transport are separate from the fee.',
          },
        ],
      },
      {
        num: '05',
        title: 'Travel',
        items: [
          {
            term: 'Departure',
            text: 'Canada, France or Spain.',
          },
          {
            term: 'Flights',
            text: 'Economy class, booked by the promoter and confirmed at least 3 weeks before the show. The artist travels alone.',
          },
          {
            term: 'Ground transport',
            text: 'Airport to hotel, hotel to venue and back, arranged by the promoter.',
          },
          {
            term: 'Hotel',
            text: '3 stars minimum, single room, non smoking, quiet floor. Late check-out when the set ends after 4 am.',
          },
          {
            term: 'Documents',
            text: 'Canadian and French passports. No visa or work permit needed for EU dates.',
          },
        ],
      },
      {
        num: '06',
        title: 'Advancing & contact',
        items: [
          {
            term: 'Advancing',
            text: 'Send set time, running order, booth photos, mixer and player models, monitor setup and the on-site contact to mauditemachine@gmail.com at least 7 days before the show.',
          },
          {
            term: 'Recording',
            text: 'Recording of the set for promotional use is welcome. Please share the file afterwards.',
          },
          {
            term: 'Contact',
            text: 'Booking international: Diane, vrstlrecords@gmail.com. Booking Canada and USA: Mika, mauditemachine@gmail.com, +1 514 653 1423. Label: VRSTL Records, vrstlrecords@gmail.com. Languages: French, English, Spanish.',
          },
        ],
      },
    ],
  },
  fr: {
    title: 'Fiche technique',
    subtitle:
      'Setup DJ, live hybride, hospitalité et déplacements. Tout ce qu’il faut à un promoteur pour booker la machine.',
    back: '← Retour au site',
    download: 'Télécharger la fiche technique',
    downloadMeta: 'PDF · EN',
    edition: 'Édition 2026 / 27',
    ctaFooter: 'DJ set · live hybride · stage plot · hospitalité · déplacements',
    plotTitle: 'Stage plot · live hybride',
    plotNote: 'Vue de dessus. Mesures en centimètres. Public en bas.',
    blocks: [
      {
        num: '01',
        title: 'Live hybride',
        subtitle: 'Indie dance et dark disco. 60 à 75 minutes.',
        items: [
          {
            term: 'Apporté par l’artiste',
            text: 'Ableton Push 3, Dreadbox Typhon, Melbourne Instruments Roto-Control, MacBook Pro avec Ableton Live, interface audio avec 2 sorties symétriques, tous les câbles entre ses propres machines.',
          },
          {
            term: 'Fourni par la salle',
            text: '2 boîtes de direct actives ou 2 lignes XLR symétriques (stéréo G/D) de l’interface de l’artiste jusqu’à la façade.',
          },
          {
            term: 'Alimentation',
            text: 'Un circuit propre avec 4 prises avec terre à la table, consommation totale sous 300 W.',
          },
          {
            term: 'Table',
            text: '180 x 70 cm au minimum, 90 à 100 cm de haut, stable, séparée de la table de mixage DJ quand la place le permet.',
          },
          {
            term: 'Transitions',
            text: 'Un setup CDJ et mixeur à côté de la table live quand le live est suivi ou précédé d’un DJ set.',
          },
          {
            term: 'Balances',
            text: '30 minutes de line check avant l’ouverture des portes, ou 15 minutes de changement de plateau pour un créneau en pleine nuit.',
          },
        ],
      },
      {
        num: '02',
        title: 'DJ set',
        subtitle: 'Indie dance et dark disco. 90 minutes à 4 heures.',
        items: [
          {
            term: 'Platines',
            text: '2 x Pioneer DJ CDJ-3000 (CDJ-2000NXS2 accepté au minimum), reliées en Pro DJ Link, firmware mis à jour avant le show. Une troisième platine est bienvenue.',
          },
          {
            term: 'Table de mixage',
            text: 'Pioneer DJ DJM-A9 de préférence. DJM-V10 ou DJM-900NXS2 acceptées. Toute autre table uniquement après accord.',
          },
          { term: 'Lecture', text: 'USB, export rekordbox. Pas d’ordinateur pour les DJ sets.' },
          {
            term: 'Retours de cabine',
            text: '2 x enceintes actives large bande (12" ou 15" avec pavillon) à hauteur d’oreille de chaque côté de la table, réglage de niveau en cabine, indépendant de la façade.',
          },
          {
            term: 'Cabine',
            text: 'Table stable de 90 à 100 cm de haut, sans vibration, au moins 140 x 60 cm de surface libre, deux prises avec terre, une petite lampe si la cabine est sombre.',
          },
          { term: 'Apporté par l’artiste', text: '2 clés USB, casque.' },
        ],
      },
      {
        num: '03',
        title: 'Hospitalité',
        items: [
          {
            term: 'Rangement',
            text: 'Un espace privé qui ferme à clé, ou un rangement sécurisé pour les sacs et le matériel, de l’arrivée au chargement.',
          },
          { term: 'Eau', text: 'Eau plate et pétillante en cabine et en loge.' },
          {
            term: 'Repas',
            text: 'Un repas chaud avant le set, ou une indemnité repas, les jours de show qui suivent un déplacement.',
          },
          { term: 'Guest list', text: 'Deux places en guest list.' },
          {
            term: 'Sur place',
            text: 'Une personne de contact sur place, joignable par téléphone de l’arrivée au départ.',
          },
        ],
      },
      {
        num: '04',
        title: 'Durée et cachets',
        items: [
          { term: 'DJ set', text: 'De 90 minutes à 4 heures, plus long sur demande.' },
          {
            term: 'Live hybride',
            text: 'De 60 à 75 minutes, suivi d’un DJ set si le créneau le permet.',
          },
          {
            term: 'Cachet',
            text: 'Sur demande, fixé selon le territoire, la date et le format. 50 % d’acompte à la signature du contrat, solde selon le contrat. Vols, hôtel et transport terrestre sont hors cachet.',
          },
        ],
      },
      {
        num: '05',
        title: 'Déplacements',
        items: [
          {
            term: 'Départ',
            text: 'Canada, France ou Espagne.',
          },
          {
            term: 'Vols',
            text: 'Classe économique, réservés par le promoteur et confirmés au moins 3 semaines avant le show. L’artiste voyage seul.',
          },
          {
            term: 'Transport terrestre',
            text: 'Aéroport vers hôtel, hôtel vers salle et retour, organisés par le promoteur.',
          },
          {
            term: 'Hôtel',
            text: '3 étoiles minimum, chambre simple, non-fumeur, étage calme. Départ tardif quand le set se termine après 4 h.',
          },
          {
            term: 'Documents',
            text: 'Passeports canadien et français. Ni visa ni permis de travail pour les dates dans l’Union européenne.',
          },
        ],
      },
      {
        num: '06',
        title: 'Préparation et contact',
        items: [
          {
            term: 'Préparation',
            text: 'Envoyer l’heure du set, le running order, des photos de la cabine, les modèles de table et de platines, la configuration des retours et le contact sur place à mauditemachine@gmail.com au moins 7 jours avant le show.',
          },
          {
            term: 'Captation',
            text: 'L’enregistrement du set pour un usage promotionnel est bienvenu. Merci de partager le fichier ensuite.',
          },
          {
            term: 'Contact',
            text: 'Booking international : Diane, vrstlrecords@gmail.com. Booking Canada et États-Unis : Mika, mauditemachine@gmail.com, +1 514 653 1423. Label : VRSTL Records, vrstlrecords@gmail.com. Langues : français, anglais, espagnol.',
          },
        ],
      },
    ],
  },
};
