/**
 * AdminNav — navigation commune des trois zones d'admin :
 * Contenu (/mm-admin), Radar (/mm-admin/radar), Stats (/mm-admin/stats).
 * Pills sobres, meme langage que le reste du site.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

const TABS = [
  { to: '/mm-admin', label: 'Contenu', end: true },
  { to: '/mm-admin/radar', label: 'Radar', end: false },
  { to: '/mm-admin/stats', label: 'Stats', end: false },
];

const AdminNav: React.FC = () => (
  <nav
    aria-label="Navigation admin"
    className="flex items-center gap-2 mb-6"
  >
    {TABS.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.end}
        style={{ textDecoration: 'none' }}
        className={({ isActive }) =>
          cn(
            'font-body text-xs md:text-sm font-semibold rounded-full px-3.5 py-1.5 border transition-colors',
            isActive
              ? 'bg-white text-black border-white'
              : 'text-white/70 border-white/15 bg-transparent hover:text-white hover:border-white/40',
          )
        }
      >
        {tab.label}
      </NavLink>
    ))}
  </nav>
);

export default AdminNav;
