/**
 * CONTACT (spec 11.1 et 20.4). Depuis le 2026-11-13 (Mika : "Contact ne doit pas se voir a moins de cliquer dessus ;
 * quand je clique sur le bouton contact il y a la fenetre qui s'ouvre pour pouvoir envoyer un message, tout simple") :
 * la fenetre ne porte plus que le formulaire (ContactForm.tsx), un vrai courriel a Mika, l'objet pre-rempli selon d'ou
 * arrive le visiteur (Booking par le menu, une commande, une demande de presse). Les reseaux restent dans le menu
 * (FOLLOW, ui/MenuSheet.tsx) ; les contacts booking dans le press kit et la page /contact/ du referencement
 * (scripts/prerender-seo.mjs). Avant : les 15 reseaux, les liens (VRSTL, SONAA, Massive Medias), les deux contacts
 * booking, puis le formulaire.
 */

import React from 'react';
import { SectionFrame, tabOf, type SectionProps } from './common';
import { ContactForm } from './ContactForm';

export const Contact: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="contact" active={active}>
    <ContactForm tab={tabOf(focusable)} />
  </SectionFrame>
);

export default Contact;
