/**
 * Contacts booking /v2, partages entre la section Contact et l'EPK.
 * Labels bilingues : l'EPK suit son toggle FR/EN, le footer affiche l'EN
 * (langue de la one-page).
 */

export interface BookingContact {
  id: string;
  name: string | null;
  email: string;
  label: { en: string; fr: string };
}

export const BOOKING_CONTACTS: BookingContact[] = [
  {
    id: 'intl',
    name: 'Diane',
    email: 'vrstlrecords@gmail.com',
    label: { en: 'International booking', fr: 'Booking international' },
  },
  {
    id: 'na',
    name: null,
    email: 'mauditemachine@gmail.com',
    label: { en: 'Canada / USA booking', fr: 'Booking Canada - États-Unis' },
  },
];
