/**
 * Page Presskit — contenu du PDF officiel 2026, design liquid-glass.
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import SectionHeader from './ui/SectionHeader';
import { cn } from '../lib/cn';

interface PresskitProps {
  onNavigateToMessage?: () => void;
}

const PDF_URL = `${import.meta.env.BASE_URL}Presskit_Maudite_Machine_2026.pdf`;

const STATS = [
  { num: '15+', fr: 'Années de carrière', en: 'Years active' },
  { num: '21',  fr: 'EPs sur VRSTL',      en: 'EPs released' },
  { num: '02',  fr: 'Albums publiés',     en: 'Albums released' },
  { num: '70+', fr: 'Élèves formés',      en: 'Students taught' },
];

const FESTIVALS = [
  { name: 'OKAMI Festival (France)', year: '2026' },
  { name: 'Future Forest Festival', year: '2024' },
  { name: 'Piknic Electronik Angers', year: '2013' },
  { name: 'Piknic Electronik Montréal', year: "'10–'13" },
  { name: 'Khumeia Festival', year: '2023' },
  { name: 'Festival Illusion', year: "'17–'22" },
  { name: 'Eclipse Transformation', year: '2018' },
  { name: 'Festival TOTEM', year: "'13–'15" },
];

const VENUES = [
  { name: 'SAT — Montréal', year: '2018' },
  { name: 'Phi Centre (avec Agoria)', year: '2013' },
  { name: 'Igloofest After (R. Zonneveld)', year: '2017' },
  { name: 'Fonderie Darling', year: '2013' },
  { name: 'Théâtre Fairmount', year: '2023+' },
  { name: 'Cirque de Boudoir', year: '2023+' },
  { name: 'Groove & Bass (récurrent)', year: '2023+' },
  { name: 'Tesla Nights', year: "'17, '24" },
];

const LIMBOS_TRACKS = [
  'Abyss', 'Cephal', 'Limbos', 'Reaper', 'Nortkele',
  'Muld', 'Simetra', 'Zenith', 'Chimie Électrique (Emotional Remix)',
];

const CATALOGUE = [
  { title: 'Voodoo',        type: 'Single', date: 'Feb 2026', img: '/images/Voodoo.webp' },
  { title: 'Limbos',        type: 'Album',  date: 'Oct 2025', img: '/images/Limbos.webp' },
  { title: 'Sync Button',   type: 'Single', date: 'May 2025', img: '/images/SyncButton.webp' },
  { title: 'Kouklikou',     type: 'Single', date: 'May 2025', img: '/images/Kouklikou.webp' },
  { title: 'Anarchic',      type: 'Single', date: 'May 2025', img: '/images/Anarchic.webp' },
  { title: 'Autopsynth',    type: 'Single', date: 'Mar 2025', img: '/images/Autopsynth.webp' },
  { title: 'Back On Track', type: 'Single', date: 'Mar 2025', img: '/images/BackOnTrack.webp' },
  { title: 'Nocturne',      type: 'Single', date: 'Feb 2025', img: '/images/Nocturne.webp' },
  { title: 'Coagule',       type: 'Single', date: 'Feb 2025', img: '/images/Coagule.webp' },
  { title: 'Richie',        type: 'Single', date: 'Jan 2025', img: '/images/Richie.webp' },
  { title: 'Tati Cardi',    type: 'EP',     date: 'Dec 2024', img: '/images/Tati Cardi.webp' },
  { title: 'Drama Queen',   type: 'Single', date: 'Dec 2024', img: '/images/Drama Queen 1.webp' },
  { title: 'Discowriders',  type: 'Single', date: 'Jul 2024', img: '/images/Discowriders.webp' },
];

const CONTACTS = [
  { label: 'Site',      value: 'mauditemachine.com',        href: 'https://mauditemachine.com' },
  { label: 'Spotify',   value: '/artist/maudite-machine',    href: 'https://open.spotify.com/artist/maudite-machine' },
  { label: 'Beatport',  value: '/artist/maudite-machine',    href: 'https://beatport.com/artist/maudite-machine' },
  { label: 'Bandcamp',  value: 'mauditemachine.bandcamp.com', href: 'https://mauditemachine.bandcamp.com' },
  { label: 'SoundCloud',value: '/mauditemachine',            href: 'https://soundcloud.com/mauditemachine' },
  { label: 'Apple Music', value: '/artist/maudite-machine',  href: 'https://music.apple.com/artist/maudite-machine' },
  { label: 'Instagram', value: '@mauditemachine',            href: 'https://instagram.com/mauditemachine' },
  { label: 'Facebook',  value: '/mauditemachine',            href: 'https://facebook.com/mauditemachine' },
  { label: 'YouTube',   value: '@mauditemachine-official',   href: 'https://youtube.com/@mauditemachine-official' },
  { label: 'Mixcloud',  value: '/mauditemachine',            href: 'https://mixcloud.com/mauditemachine' },
  { label: 'TikTok',    value: '@mauditemachine',            href: 'https://tiktok.com/@mauditemachine' },
  { label: 'Linktree',  value: 'bit.ly/41mdgdg',              href: 'https://bit.ly/41mdgdg' },
];

function trackDownload() {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'Lead', {
      content_name: 'Press Kit Download 2026',
      content_category: 'Download',
    });
  }
}

const Presskit: React.FC<PresskitProps> = ({ onNavigateToMessage }) => {
  const { t } = useApp();

  return (
    <div className="pk-page">
      {/* Download button sticky (desktop) */}
      <a
        href={PDF_URL}
        download
        onClick={trackDownload}
        className="pk-download-sticky"
        aria-label="Download Press Kit 2026 (PDF)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Download PDF</span>
      </a>

      {/* === SECTION HEADER MAGAZINE === */}
      <div className="mb-12 md:mb-20 px-0">
        <SectionHeader
          number="02"
          kicker="Presskit · About"
          title="About"
        />
      </div>

      {/* === STORYTELLING MASSIF : RAW. HYPNOTIC. UNDERGROUND. === */}
      <section className="py-10 md:py-20 mb-8 md:mb-16">
        {['Raw.', 'Hypnotic.', 'Underground.'].map((word, i) => (
          <div
            key={word}
            className={cn(
              'font-display font-black uppercase text-ink-95',
              'text-[16vw] md:text-[13vw] lg:text-[12vw]',
              'leading-[0.85] tracking-[-0.045em]',
              'animate-fade-up',
              i === 0 && 'text-left',
              i === 1 && 'text-right',
              i === 2 && 'text-left md:text-center',
            )}
            style={{
              animationDelay: `${200 + i * 180}ms`,
              animationFillMode: 'both',
            }}
          >
            {word}
          </div>
        ))}
      </section>

      {/* === HERO PRESSKIT : meta en bloc asymetrique (image B&W retiree) === */}
      <section className="pk-section pk-hero">
        <div className="pk-hero-top">
          <div className="pk-hero-label">Press Kit / 2026</div>
          <div className="pk-hero-tags">
            <span>Minimal</span><span>Indie Dance</span><span>Dark Disco</span>
          </div>
        </div>
        <h1 className="pk-hero-title">MAUDITE MACHINE</h1>
        <div className="pk-hero-meta pk-glass">
          <div className="pk-hero-meta-col">
            <div>DJ · Producer · VRSTL Records</div>
            <div className="pk-dim">Montréal / Canada</div>
          </div>
          <div className="pk-hero-meta-col pk-right">
            <div>Dossier de presse</div>
            <div className="pk-dim">Press kit · EN / FR</div>
          </div>
        </div>
      </section>

      {/* === BIO === */}
      <section className="pk-section">
        <div className="pk-section-label">— Biographie / Biography</div>
        <div className="pk-bio-grid">
          <div className="pk-bio-col pk-glass">
            <div className="pk-lang-tag">FR</div>
            <p>
              Maudite Machine est un DJ et producteur canadien reconnu pour son approche
              brute et hypnotique de la minimal et de l'indie dance. Né de l'underground
              montréalais, il s'est produit dans des événements majeurs et des lieux
              emblématiques à travers le pays, livrant des sets qui brouillent la frontière
              entre intensité et atmosphère.
            </p>
            <p>
              En tant que fondateur de VRSTL Records, il cultive un son qui embrasse la
              tension, le groove et l'expérimentation. Ses collaborations avec des artistes
              influents de la scène électronique témoignent d'une volonté constante de
              repousser les limites et de redéfinir l'underground avec une signature sonore
              distinctive.
            </p>
          </div>
          <div className="pk-bio-col pk-glass">
            <div className="pk-lang-tag">EN</div>
            <p>
              Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic
              approach to minimal and indie dance. Born from the Montreal underground, he
              has performed at major events and iconic venues across the country, delivering
              sets that blur the line between intensity and atmosphere.
            </p>
            <p>
              As the founder of VRSTL Records, he curates a sound that embraces tension,
              groove, and experimentation. His collaborations with influential artists in the
              electronic music world reflect a constant drive to push boundaries and
              redefine the underground with a distinct sonic signature.
            </p>
          </div>
        </div>
        <blockquote className="pk-quote">
          « Un son qui embrasse la tension, le groove et l'expérimentation »
          <span className="pk-dim pk-quote-en">A sound that embraces tension, groove and experimentation</span>
        </blockquote>
      </section>

      {/* === STATS MASSIVES : chiffres magazine === */}
      <section className="pk-section">
        <div className="pk-section-label">— En chiffres / By the numbers</div>

        {/* Ligne massive : stats en gros caracteres */}
        <div className="flex flex-wrap items-baseline gap-x-8 md:gap-x-14 gap-y-6 md:gap-y-8 mb-10 md:mb-16">
          {STATS.map((s, i) => (
            <div
              key={s.num}
              className="flex items-baseline gap-3 md:gap-4 animate-fade-up"
              style={{
                animationDelay: `${150 + i * 120}ms`,
                animationFillMode: 'both',
              }}
            >
              <span className="font-display font-black text-ink-95
                               text-[clamp(4rem,13vw,11rem)]
                               leading-none tracking-[-0.04em]">
                {s.num}
              </span>
              <span className="font-body text-sm md:text-sm
                               uppercase tracking-[0.25em] text-ink-70
                               max-w-[140px] md:max-w-[170px] leading-tight">
                {s.fr}
              </span>
            </div>
          ))}
        </div>

        {/* Grille glass compacte en dessous pour detail EN */}
        <div className="pk-stats-grid">
          {STATS.map((s) => (
            <div className="pk-stat pk-glass" key={s.num}>
              <div className="pk-stat-num">{s.num}</div>
              <div className="pk-stat-label">{s.fr}</div>
              <div className="pk-stat-label pk-dim">{s.en}</div>
            </div>
          ))}
        </div>
      </section>

      {/* === PERFORMANCES === */}
      <section className="pk-section">
        <div className="pk-section-label">— Performances sélectives / Selected performances</div>
        <div className="pk-perf-grid">
          <div className="pk-perf-col pk-glass">
            <h3 className="pk-perf-title">Festivals &amp; Événements</h3>
            <ul className="pk-perf-list">
              {FESTIVALS.map((f) => (
                <li key={f.name}><span>{f.name}</span><span className="pk-dim">{f.year}</span></li>
              ))}
            </ul>
          </div>
          <div className="pk-perf-col pk-glass">
            <h3 className="pk-perf-title">Lieux emblématiques</h3>
            <ul className="pk-perf-list">
              {VENUES.map((v) => (
                <li key={v.name}><span>{v.name}</span><span className="pk-dim">{v.year}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pk-remix pk-glass">
          <div className="pk-section-label">Remix work for / Remixes pour</div>
          <div className="pk-remix-names">
            <span>Laurent Garnier</span>
            <span className="pk-sep">/</span>
            <span>Adam Beyer</span>
            <span className="pk-sep">/</span>
            <span>DVS1</span>
          </div>
        </div>
      </section>

      {/* === LATEST ALBUM === */}
      <section className="pk-section">
        <div className="pk-section-label">— Dernier album / Latest album</div>
        <div className="pk-album pk-glass">
          <img className="pk-album-cover" src="/images/Limbos.webp" alt="Limbos" loading="lazy" />
          <div className="pk-album-info">
            <h2 className="pk-album-title">LIMBOS</h2>
            <div className="pk-album-meta pk-dim">VRSTL Records · Octobre 2025 · 9 tracks</div>
            <p className="pk-album-desc">
              L'espace entre la fin et le recommencement. Cet album traduit en impulsions
              électroniques l'expérience d'un arrêt complet, le passage vers l'au-delà et le
              retour inattendu. Chaque titre explore ces territoires extrêmes où la conscience
              se dissout puis se reforme.
            </p>
            <ol className="pk-tracklist">
              {LIMBOS_TRACKS.map((tr, i) => (
                <li key={tr}><span className="pk-track-num">{String(i+1).padStart(2,'0')}</span> {tr}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* === FULL CATALOGUE === */}
      <section className="pk-section">
        <div className="pk-section-label">— Full catalogue / Catalogue complet</div>
        <div className="pk-catalogue-intro pk-glass">
          <h2 className="pk-section-title-huge">13 RELEASES.<br/>2024 — 2026.</h2>
          <p>
            De Discowriders (Jul 2024) à Voodoo (Feb 2026), un flux constant de productions
            originales sur VRSTL Records. Singles, EPs et un album, dans une esthétique dark
            disco, indie dance et minimal hypnotique.
          </p>
        </div>
        <div className="pk-catalogue-grid">
          {CATALOGUE.map((r) => (
            <div className="pk-release pk-glass" key={r.title}>
              <img className="pk-release-cover" src={r.img} alt={r.title} loading="lazy" />
              <div className="pk-release-info">
                <div className="pk-release-title">{r.title}</div>
                <div className="pk-release-meta pk-dim">{r.type} · VRSTL · {r.date}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* === VRSTL LABEL === */}
      <section className="pk-section">
        <div className="pk-section-label">— Label</div>
        <div className="pk-label pk-glass">
          <div className="pk-label-logo">VRSTL Records</div>
          <div className="pk-label-grid">
            <div className="pk-label-text">
              <p><span className="pk-lang-tag-inline">FR</span> VRSTL Records est un label indépendant canadien dédié à l'Indie Dance et au Dark Disco. Depuis sa fondation, le label a publié 21 EPs et 2 albums, signant des artistes émergents d'Argentine, du Québec et d'Europe.</p>
              <p><span className="pk-lang-tag-inline">EN</span> VRSTL Records is an independent Canadian label dedicated to Indie Dance and Dark Disco. Since its founding, the label has released 21 EPs and 2 albums, signing emerging artists from Argentina, Quebec and Europe.</p>
              <p className="pk-dim">Direction artistique : tension, groove, expérimentation. Un catalogue qui redéfinit les frontières de l'underground électronique.</p>
            </div>
          </div>
          <div className="pk-roster">
            <div className="pk-section-label">Roster / Artistes signés</div>
            <div className="pk-roster-names">
              <span>Julian Rocci</span>
              <span className="pk-sep">·</span>
              <span>Alex Decker</span>
              <span className="pk-sep">·</span>
              <span>Lealtica</span>
              <span className="pk-sep">·</span>
              <span>Jabba2.3</span>
              <span className="pk-sep">·</span>
              <span>Manüman</span>
              <span className="pk-sep">·</span>
              <span>Maudite Machine</span>
            </div>
          </div>
        </div>
      </section>

      {/* === CONTACT === */}
      <section className="pk-section">
        <div className="pk-section-label">— Contact</div>
        <div className="pk-contact-top">
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">Booking · Management</div>
            <div className="pk-contact-name">Michael Sanchez (Mika)</div>
            <a href="mailto:mauditemachine@gmail.com" className="pk-contact-link">mauditemachine@gmail.com</a>
            <a href="tel:+15146531423" className="pk-contact-link">+1 514 653 1423</a>
          </div>
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">Label</div>
            <div className="pk-contact-name">VRSTL Records</div>
            <a href="mailto:vrstlrecords@gmail.com" className="pk-contact-link">vrstlrecords@gmail.com</a>
            <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="pk-contact-link">vrstlrecords.com</a>
          </div>
        </div>
        <div className="pk-contact-grid">
          {CONTACTS.map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="pk-contact-cell pk-glass">
              <div className="pk-contact-cell-label pk-dim">{c.label}</div>
              <div className="pk-contact-cell-value">{c.value}</div>
            </a>
          ))}
        </div>
        {onNavigateToMessage && (
          <div className="pk-contact-footer">
            <p className="pk-dim">
              {t.presskit?.mediaText || 'Pour interviews, bookings et demandes média,'}{' '}
              <button onClick={onNavigateToMessage} className="pk-inline-link">
                {t.presskit?.mediaLink || 'écrire un message ici'}
              </button>
            </p>
          </div>
        )}
        <div className="pk-footer-version pk-dim">© 2026 Maudite Machine / VRSTL Records · Press Kit V.2026</div>
      </section>

      {/* === XXL DOWNLOAD BLOCK : le bloc "aimant a clics" === */}
      <a
        href={PDF_URL}
        download
        onClick={trackDownload}
        aria-label="Télécharger le press kit (PDF 10 MB)"
        className={cn(
          'group block relative mt-16 md:mt-28 mb-8 md:mb-16',
          'rounded-2xl md:rounded-3xl overflow-hidden',
          'border border-ink-10 hover:border-ink-30',
          'bg-glass backdrop-blur-heavy backdrop-saturate-glass',
          'transition-all duration-500 ease-out-expo',
          'hover:shadow-glow-white hover:bg-glass-strong',
          'no-underline text-inherit',
          'animate-fade-up',
        )}
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        <div className="relative p-8 md:p-14 lg:p-20">
          {/* Kicker top */}
          <div className="flex items-center justify-between mb-6 md:mb-10 text-sm md:text-sm uppercase tracking-[0.3em] text-ink-50 font-body">
            <span>PDF · 10 MB · EN / FR</span>
            <span>2026 Edition</span>
          </div>

          {/* Titre massif qui se remplit au hover (blanc dim → blanc pur) */}
          <div className="font-display font-black uppercase
                          text-[clamp(3rem,13vw,11rem)]
                          leading-[0.85] tracking-[-0.045em]
                          text-ink-30 group-hover:text-ink-95
                          transition-colors duration-700 ease-out-expo">
            Download
            <br />
            Presskit
          </div>

          {/* Footer : fleche + meta */}
          <div className="mt-8 md:mt-12 flex items-center justify-between">
            <span className="text-sm md:text-base text-ink-70 font-body">
              Full dossier · photos · bio · tech rider
            </span>
            <span
              className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20
                         rounded-full border border-ink-20 group-hover:border-ink-95
                         text-ink-85 group-hover:text-ink-95
                         transition-colors duration-500"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="transform group-hover:translate-y-1 transition-transform duration-400 ease-out-expo"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </span>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Presskit;
