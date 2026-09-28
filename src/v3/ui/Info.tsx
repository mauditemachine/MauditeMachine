/**
 * INFO : tagline, ligne d'identite, booking (BOOKING_CONTACTS, labels
 * affiches comme donnees), presse, ecoute, reseaux (SOCIALS), Calm mode,
 * lien vers le site principal. Chaque ancre externe : _blank + noopener.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_CONTACTS } from '../../v2/data/contacts';
import { SOCIALS } from '../../v2/data/socials';
import { SOUNDCLOUD_PROFILE_URL } from '../data/beads';
import { motion, useCalm } from '../state/motion';
import SocialIcon from './SocialIcon';

interface InfoProps {
  inline?: boolean;
}

const Info: React.FC<InfoProps> = ({ inline = false }) => {
  const calm = useCalm();
  return (
    <div className={`v3-info${inline ? ' is-inline' : ''}`}>
      {inline && <h2 className="v3-drawer-title">INFO</h2>}
      <p className="v3-info-brand">MAUDITE MACHINE</p>
      <p className="v3-info-line">raw machine grooves with a human pulse</p>
      <p className="v3-info-line v3-info-sub">Hypnotic techno. VRSTL Records. 8day.</p>

      <section className="v3-info-section" aria-labelledby="v3-info-booking">
        <h3 id="v3-info-booking" className="v3-info-head">
          BOOKING
        </h3>
        <ul className="v3-info-list">
          {BOOKING_CONTACTS.map((c) => (
            <li key={c.id}>
              <span className="v3-info-label">{c.label.en + (c.name ? `, ${c.name}` : '')}</span>
              <a className="v3-info-link" href={`mailto:${c.email}`}>
                {c.email}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="v3-info-section" aria-labelledby="v3-info-press">
        <h3 id="v3-info-press" className="v3-info-head">
          PRESS
        </h3>
        <ul className="v3-info-list">
          <li>
            <a className="v3-info-link" href="/Presskit_Maudite_Machine_2026-27.pdf" target="_blank" rel="noopener">
              Press kit (PDF)
            </a>
          </li>
          <li>
            <Link className="v3-info-link" to="/techrider">
              Tech rider
            </Link>
          </li>
          <li>
            <a className="v3-info-link" href="/press/">
              Press assets
            </a>
          </li>
        </ul>
      </section>

      <section className="v3-info-section" aria-labelledby="v3-info-listen">
        <h3 id="v3-info-listen" className="v3-info-head">
          LISTEN
        </h3>
        <ul className="v3-info-list">
          <li>
            <a className="v3-info-link" href={SOUNDCLOUD_PROFILE_URL} target="_blank" rel="noopener">
              SoundCloud profile
            </a>
          </li>
        </ul>
      </section>

      <section className="v3-info-section" aria-labelledby="v3-info-socials">
        <h3 id="v3-info-socials" className="v3-info-head">
          SOCIALS
        </h3>
        <ul className="v3-socials">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a className="v3-social" href={s.href} target="_blank" rel="noopener" aria-label={s.label} title={s.label}>
                <SocialIcon icon={s.icon} label={s.label} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="v3-info-section" aria-labelledby="v3-info-calm">
        <h3 id="v3-info-calm" className="v3-info-head">
          MOTION
        </h3>
        <label className="v3-calm">
          <input type="checkbox" checked={calm} onChange={(e) => motion.setCalm(e.target.checked)} />
          <span>Calm mode</span>
          <span className="v3-calm-note">No intro, no continuous animation.</span>
        </label>
      </section>

      <p className="v3-info-foot">
        <Link className="v3-info-link" to="/">
          Main site
        </Link>
      </p>
    </div>
  );
};

export default React.memo(Info);
