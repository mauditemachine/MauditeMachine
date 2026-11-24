# Plugins VST3 gratuits contre un courriel (MM-RYTM, MM-ARP)

2026-11-24, Mika : "mettre a disposition les plugins RYTM et ARP au telechargement ; ils doivent laisser leur adresse courriel, ils recoivent un lien de telechargement par courriel, et si possible une donation, sur la base du volontariat".

## Le circuit

1. **GOODIES** (`/goodies/`, `src/v4/ui/sections/VstDownload.tsx`) : les deux plugins (avec leurs systemes), un champ courriel, une case facultative "nouvelles" (decochee), le bouton GET THE PLUGINS.
2. **EmailJS** (le compte deja utilise par CONTACT, `src/data/emailjs.ts`) envoie au visiteur le modele **VST download** : un contenu fixe avec les deux liens. Toi, tu es en copie cachee : chaque demande arrive dans ta boite (c'est ta liste).
3. Case "nouvelles" cochee : un second courriel, a toi seulement, par le modele de CONTACT (objet `Newsletter opt-in (VST download)`). Seuls ceux-la ont dit oui aux nouvelles (loi canadienne anti-pourriel : ne pas ecrire aux autres pour autre chose que les plugins).
4. Les liens du courriel menent a **`/download/?p=rytm`** et **`/download/?p=arp`** (`public/download/index.html`, noindex, hors sitemap) : le zip part tout seul, l'installation est expliquee, le bouton de don est la.
5. Les zips viennent des releases **fixes** `mm-rytm-public` et `mm-arp-public`, remplies par le workflow **Plugin public** (jamais des releases `-latest`, que chaque build de chantier ecrase).
6. **Un seul zip par plugin** (`MM-RYTM-VST3.zip`, `MM-ARP-VST3.zip`, 2026-11-24, Mika : "dans le meme package, c'est aux gens de faire ce choix") : un dossier `macOS/` et, quand le plugin en a une, un dossier `Windows/`. La page `/download/` montre d'abord l'installation du systeme du visiteur. MM-RYTM : Mac et Windows (beta). MM-ARP : Mac (Windows quand sa branche sera fusionnee et son CI aura un job Windows).

Tant que `emailjsTemplateId` est vide dans `public/data/vst.json`, le bloc reste cache dans GOODIES (apercu : `/goodies/?vst=1`).

## A faire par Mika (une fois, environ 15 minutes)

### 1. Le modele EmailJS "VST download"

Tableau de bord EmailJS > Email Templates > Create New Template :

- **Template name** : `VST download`
- **Subject** : `Your free plugins: MM-RYTM and MM-ARP`
- **To Email** : `{{to_email}}`
- **From Name** : `Maudite Machine`
- **Reply To** : `mauditemachine@gmail.com`
- **Bcc** : `mauditemachine@gmail.com`
- **Content** (bouton "Edit Content", editeur de code), a coller tel quel. Ne pas ajouter d'autre variable que `{{to_email}}` : un modele au texte fixe ne peut pas servir a envoyer un message libre a n'importe qui avec la cle publique.

```html
<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#191919;max-width:560px">
  <p>Hi,</p>
  <p>Here are your free plugins (VST3). Each zip holds the Mac version and, when there is one, the Windows version:</p>
  <p>
    <a href="https://mauditemachine.com/download/?p=rytm" style="color:#ff6a13;font-weight:bold">Download MM-RYTM</a>, the drum machine<br>
    <a href="https://mauditemachine.com/download/?p=arp" style="color:#ff6a13;font-weight:bold">Download MM-ARP</a>, the synth and arpeggiator
  </p>
  <p>Each page has the install steps for Mac and Windows.</p>
  <p>The plugins are free and stay free. If they end up in your tracks, you can
    <a href="https://mauditemachine.com/download/#donate" style="color:#191919">buy me a coffee</a>. Never required.</p>
  <p>Send me what you make with them.<br>Mika, Maudite Machine<br>
    <a href="https://mauditemachine.com" style="color:#191919">mauditemachine.com</a></p>
</div>
```

Enregistre, puis copie le **Template ID** (`template_xxxxxxx`).

Securite (si ton plan l'offre, Account > Security) : limiter l'envoi au domaine `mauditemachine.com`. Quota du plan gratuit d'EmailJS : environ 200 courriels par mois, a verifier dans ton tableau de bord (chaque demande compte pour 1, plus 1 si la case "nouvelles" est cochee).

### 2. Le lien de don

Recommande : **Ko-fi** (ko-fi.com, page "Buy me a coffee", 0 % de commission sur les dons, seulement les frais PayPal ou Stripe, paiement par carte ou PayPal). Cree la page "Maudite Machine" et note l'adresse (`https://ko-fi.com/...`). Alternative : Buy Me a Coffee (5 % de commission).

### 3. Publier les plugins

Quand un build te va (teste dans Ableton) : GitHub > Actions > **Plugin public (MM-RYTM, MM-ARP)** > Run workflow > `rytm`, puis encore une fois avec `arp`. Le workflow reunit le dernier build vert Mac (`MM-<PLUGIN>-macOS.zip`) et Windows (`MM-<PLUGIN>-Windows.zip`, s'il existe et si la case `windows` est cochee) de `mm-rytm-latest` / `mm-arp-latest` dans un seul zip, avec un README public (`plugin/public/README.txt`). A refaire a chaque nouvelle version a donner au public : l'adresse du zip ne change pas, les courriels deja envoyes restent bons.

### 4. Mettre en ligne

Envoie le Template ID et le lien Ko-fi a Claude (ou mets-les dans `public/data/vst.json`, champs `emailjsTemplateId` et `donateUrl`) : le bloc PLUGINS apparait dans GOODIES au deploiement suivant, et `/goodies/` mentionne les plugins pour Google.

## Fichiers

| Fichier | Role |
| --- | --- |
| `public/data/vst.json` | Template ID, lien de don, noms, textes, systemes (`platforms`) et zips des plugins (changer ce fichier ne demande pas de `firmware:stamp`) |
| `src/v4/ui/sections/VstDownload.tsx` | Le bloc PLUGINS de GOODIES (formulaire, envoi EmailJS, don) |
| `public/download/index.html` | La page des liens du courriel (zip automatique, installation, don) |
| `.github/workflows/plugin-public.yml` | Copie un build valide dans `mm-<plugin>-public` |
| `plugin/public/README.txt` | Le guide d'installation public glisse dans le zip (Mac, et Windows entre `[[WIN]]` ; `[[NOWIN]]` sinon) |
| `.github/workflows/plugin.yml` | Job `windows` : le VST3 Windows x64 de MM-RYTM (MSVC, WebView2 en statique), `MM-RYTM-Windows.zip` dans `mm-rytm-latest` |

Mesures GA4 : `vst_request { news }` (formulaire envoye), `vst_donate_click { place }`, `vst_download { plugin }` (zip lance depuis /download/). Pixel Meta : `Lead`.

## Limites connues

- **VST3 seulement** (pas d'AU pour Logic). **Windows en beta pour MM-RYTM** : compile et teste par le CI (test moteur), jamais essaye dans un logiciel sur PC avant publication ; la face passe par Microsoft Edge WebView2 (livre avec Windows 10 et 11 a jour ; sinon le plugin affiche un message et joue quand meme). MM-ARP : Mac seulement pour l'instant.
- **Pas de notarisation Apple** : signature ad hoc, d'ou la ligne de Terminal a coller. Pour l'enlever : compte Apple Developer (99 USD par an), signature Developer ID et notarisation dans le CI (voir `docs/vst3/2026-10-21-etude-mm-arp-vst3.md`, section 3.4).
- **Les samples du MM-RYTM** sont embarques dans le binaire (`public/samples/rytm`, tires de ta bibliotheque). Verifier que leurs licences permettent de les redistribuer dans un instrument gratuit ; sinon publier une version sans ces samples.
- Le lien du zip est public (release GitHub) : le courriel sert a construire ta liste, pas a proteger le fichier.
