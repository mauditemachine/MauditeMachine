/**
 * PLUGINS dans GOODIES (2026-11-24, Mika : "mettre a disposition les plugins RYTM et ARP au telechargement ; ils
 * doivent laisser leur adresse courriel, ils recoivent un lien de telechargement par courriel, et si possible une
 * donation, sur la base du volontariat"). Guide complet : docs/vst-download.md.
 *
 * - Le visiteur laisse son courriel ; EmailJS (le compte du formulaire de CONTACT, src/data/emailjs.ts) lui envoie
 *   le modele "VST download" : un contenu FIXE (les deux liens vers /download/?p=rytm et ?p=arp), seul {{to_email}}
 *   varie, pour que la cle publique ne puisse pas servir a envoyer un texte libre a n'importe qui. Le modele met
 *   Mika en copie cachee : la liste des courriels arrive dans sa boite.
 * - Case "nouvelles" (facultative, decochee : consentement explicite) : un second envoi, a Mika seulement, par le
 *   modele du formulaire de CONTACT.
 * - Le don (donateUrl) : jamais obligatoire, montre sous le formulaire et apres l'envoi.
 * - Un seul zip par plugin, un dossier par systeme (2026-11-24, Mika : Windows "dans le meme package, c'est aux gens
 *   de faire ce choix") : chaque carte dit lesquels (platforms de vst.json).
 * - La configuration vient de public/data/vst.json (lu a la premiere ouverture de GOODIES) : tant que
 *   emailjsTemplateId est vide, le bloc reste cache (sauf ?vst=1, pour l'apercu).
 */

import React, { useEffect, useState } from 'react';
import { EMAILJS } from '../../../data/emailjs';
import { track } from '../../state/analytics';

interface VstPlugin {
  id: string;
  name: string;
  kind: string;
  text: string;
  platforms?: string[];
}

interface VstConfig {
  emailjsTemplateId: string;
  donateUrl: string;
  plugins: VstPlugin[];
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FALLBACK_EMAIL = 'mauditemachine@gmail.com';

let cache: Promise<VstConfig | null> | null = null;
const loadConfig = (): Promise<VstConfig | null> => {
  if (!cache) {
    cache = fetch('/data/vst.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<VstConfig>) : null))
      .catch(() => null);
  }
  return cache;
};

const preview = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has('vst');
  } catch {
    return false;
  }
};

const Donate: React.FC<{ url: string; tab: number; strong?: boolean }> = ({ url, tab, strong }) => (
  <a
    className={strong ? 'v4-vst-donate v4-vst-donate--strong' : 'v4-vst-donate'}
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    tabIndex={tab}
    onClick={() => track('vst_donate_click', { place: strong ? 'after_send' : 'form' })}
  >
    Buy me a coffee
  </a>
);

export const VstDownload: React.FC<{ seen: boolean; tab: number }> = ({ seen, tab }) => {
  const [cfg, setCfg] = useState<VstConfig | null>(null);
  const [email, setEmail] = useState('');
  const [news, setNews] = useState(false);
  const [trap, setTrap] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    void loadConfig().then((c) => {
      if (alive) setCfg(c);
    });
    return () => {
      alive = false;
    };
  }, [seen]);

  if (!cfg || (!cfg.emailjsTemplateId && !preview())) return null;

  const send = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (status === 'sending') return;
    const to = email.trim();
    if (trap) {
      setSentTo(to);
      setStatus('sent');
      return;
    }
    if (!cfg.emailjsTemplateId) {
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      const { default: emailjs } = await import('@emailjs/browser');
      await emailjs.send(EMAILJS.serviceId, cfg.emailjsTemplateId, { to_email: to }, { publicKey: EMAILJS.publicKey });
      if (news) {
        // A Mika seulement : un echec ici ne gache pas l'envoi des liens
        try {
          await emailjs.send(
            EMAILJS.serviceId,
            EMAILJS.templateId,
            {
              from_name: 'VST download',
              from_email: to,
              email: to,
              user_email: to,
              reply_to: to,
              object: 'Newsletter opt-in (VST download)',
              subject: 'Newsletter opt-in (VST download)',
              message: `${to} downloaded the free plugins and wants news about new plugins and releases.\n\n--\nFrom: <${to}>`,
            },
            { publicKey: EMAILJS.publicKey },
          );
        } catch {
          /* le courriel des liens est parti, c'est l'essentiel */
        }
      }
      setSentTo(to);
      setStatus('sent');
      setEmail('');
      track('vst_request', { news });
      const w = window as Window & { fbq?: (...args: unknown[]) => void };
      w.fbq?.('track', 'Lead', { content_name: 'VST download' });
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'sending';
  return (
    <div className="v4-vst">
      <h3 className="v4-sec-sub">Plugins, VST3</h3>
      <ul className="v4-vst-list">
        {cfg.plugins.map((p) => (
          <li key={p.id} className="v4-vst-item">
            <span className="v4-vst-name">{p.name}</span>
            <span className="v4-vst-kind">{p.kind}</span>
            <span className="v4-vst-text">{p.text}</span>
            <span className="v4-vst-os">{(p.platforms ?? ['macOS']).join(' · ')}</span>
          </li>
        ))}
      </ul>
      <p className="v4-vst-note">
        Free. Leave your email and the download links land in your inbox. One zip per plugin, with a folder for each
        system: macOS 11 or later (Apple Silicon and Intel), Windows 10 or 11 (64-bit) where listed. Any VST3 host:
        Ableton Live, Bitwig, Reaper, Cubase, FL Studio.
      </p>
      <form className="v4-form v4-vst-form" onSubmit={send} noValidate={false}>
        <label className="v4-field">
          <span className="v4-field-label">Email</span>
          <input
            className="v4-input"
            type="email"
            name="to_email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={200}
            value={email}
            tabIndex={tab}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== 'sending') setStatus('idle');
            }}
          />
        </label>
        <label className="v4-check">
          <input type="checkbox" name="news" checked={news} tabIndex={tab} onChange={(e) => setNews(e.target.checked)} />
          <span>Also send me news about new plugins and releases (optional)</span>
        </label>
        {/* Piege a robots : hors ecran, hors tabulation, ignore des lecteurs d'ecran */}
        <label className="v4-trap" aria-hidden="true">
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
        <div className="v4-form-foot">
          <button type="submit" className="v4-send" disabled={busy} tabIndex={tab}>
            {busy ? 'Sending' : 'Get the plugins'}
          </button>
          <p className="v4-form-status" role="status" aria-live="polite" data-status={status}>
            {status === 'sent' && `Sent to ${sentTo}. Check your inbox, and the spam folder just in case.`}
            {status === 'error' && (
              <>
                Could not send. Try again, or write to{' '}
                <a className="v4-contact-mail" href={`mailto:${FALLBACK_EMAIL}`} tabIndex={tab}>
                  {FALLBACK_EMAIL}
                </a>
                .
              </>
            )}
          </p>
        </div>
      </form>
      {cfg.donateUrl &&
        (status === 'sent' ? (
          <div className="v4-vst-thanks">
            <p className="v4-sec-text">
              The plugins are free and stay free. If they end up in your tracks, you can buy me a coffee. Never required.
            </p>
            <Donate url={cfg.donateUrl} tab={tab} strong />
          </div>
        ) : (
          <p className="v4-vst-note">
            Donations are welcome, never required: <Donate url={cfg.donateUrl} tab={tab} />
          </p>
        ))}
    </div>
  );
};

export default VstDownload;
