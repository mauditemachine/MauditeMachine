/**
 * EmailJS (envoi de courriel depuis un site statique) : le service, le
 * modele et la CLE PUBLIQUE du compte de Mika. Rien de secret ici : la cle
 * publique d'EmailJS est faite pour etre dans le navigateur (le domaine
 * autorise et les quotas se reglent dans le tableau de bord EmailJS). Le
 * modele attend from_name, from_email, object et message. Lu par le
 * formulaire de /v1 (components/Message.tsx) et par CONTACT de la machine.
 */
export const EMAILJS = {
  serviceId: 'service_zeuwh04',
  templateId: 'template_zlot6be',
  publicKey: '_e6k6nftsmZZxs29b',
} as const;
