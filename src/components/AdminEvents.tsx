import React, { useState, useEffect } from 'react';
import {
  loadEvents, saveEvents, Event,
  loadMessages, saveMessages, Message,
  loadMerchItems, saveMerchItems, MerchItem,
  loadReleases, saveReleases, Release, RELEASE_FORMATS, RELEASE_SECTIONS,
  prepareReleasesImport,
} from '../utils/adminApi';
import ImageUpload from './ImageUpload';
import { useTranslation } from '../lib/i18n';

type Tab = 'events' | 'merch' | 'news' | 'releases';

const EMPTY_RELEASE: Release = {
  id: 0,
  artist: '',
  title: '',
  label: '',
  releaseDate: '',
  genre: '',
  format: 'EP',
  link: '',
  soundcloudUrl: '',
  cover: '',
  section: 'labels',
  favorite: false,
  colorFrom: '#ff2e4d',
  colorTo: '#3a0d18',
  publishedRadar: true,
};

const AdminEvents: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  
  const [events, setEvents] = useState<Event[]>([]);
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState<Event>({ date: '', title: '', url: '', location: '', color: '#ff6d9e', image: '' });
  
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [editingMerchIndex, setEditingMerchIndex] = useState<number | null>(null);
  const [merchForm, setMerchForm] = useState<Partial<MerchItem>>({ src: '', alt: '', caption: '', price: '', category: 'tshirt', active: true, soldOut: false });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null);
  const [msgForm, setMsgForm] = useState<Partial<Message>>({ title: '', description: '', image: '', date: '', link: { label: '', href: '' }, main: false });

  const [releases, setReleases] = useState<Release[]>([]);
  const [editingReleaseIndex, setEditingReleaseIndex] = useState<number | null>(null);
  const [releaseForm, setReleaseForm] = useState<Release>({ ...EMPTY_RELEASE });

  // Import en lot : le JSON de la veille hebdo colle tel quel
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [importFailed, setImportFailed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [evts, merch, msgs, rels] = await Promise.all([
        loadEvents(true).catch(() => []),
        loadMerchItems(true).catch(() => []),
        loadMessages(true).catch(() => []),
        loadReleases(true).catch(() => [])
      ]);
      setEvents([...evts].sort((a, b) => b.date.localeCompare(a.date)));
      setMerchItems(merch);
      setMessages(msgs);
      setReleases([...rels].sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')));
    } finally { setLoading(false); }
  };

  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 3000); };

  // Events
  const saveEvent = async () => {
    if (!eventForm.title || !eventForm.date) { flash('Title and date required'); return; }
    setSaving(true);
    const updated = editingEventIndex !== null ? events.map((e, i) => i === editingEventIndex ? eventForm : e) : [...events, eventForm];
    updated.sort((a, b) => b.date.localeCompare(a.date));
    const res = await saveEvents(updated);
    if (res.success) { setEvents(updated); resetEventForm(); flash('Event saved'); } else flash('Error saving');
      setSaving(false);
  };
  const deleteEvent = async (i: number) => { if (!confirm('Delete this event?')) return; const updated = events.filter((_, idx) => idx !== i); await saveEvents(updated); setEvents(updated); flash('Event deleted'); };
  const resetEventForm = () => { setEventForm({ date: '', title: '', url: '', location: '', color: '#ff6d9e', image: '' }); setEditingEventIndex(null); };

  // Merch
  const saveMerch = async () => {
    if (!merchForm.caption || !merchForm.price) { flash('Name and price required'); return; }
    setSaving(true);
    const item: MerchItem = { id: editingMerchIndex !== null ? merchItems[editingMerchIndex].id : Date.now(), src: merchForm.src || '', alt: merchForm.alt || merchForm.caption || '', caption: merchForm.caption || '', price: merchForm.price || '', category: merchForm.category || 'tshirt', active: merchForm.active !== false, soldOut: merchForm.soldOut || false };
    const updated = editingMerchIndex !== null ? merchItems.map((m, i) => i === editingMerchIndex ? item : m) : [...merchItems, item];
    const res = await saveMerchItems(updated);
    if (res.success) { setMerchItems(updated); resetMerchForm(); flash('Merch saved'); } else flash('Error saving');
    setSaving(false);
  };
  const deleteMerch = async (i: number) => { if (!confirm('Delete this item?')) return; const updated = merchItems.filter((_, idx) => idx !== i); await saveMerchItems(updated); setMerchItems(updated); flash('Item deleted'); };
  const resetMerchForm = () => { setMerchForm({ src: '', alt: '', caption: '', price: '', category: 'tshirt', active: true, soldOut: false }); setEditingMerchIndex(null); };

  // News
  const saveMsg = async () => {
    if (!msgForm.title) { flash('Title required'); return; }
    setSaving(true);
    const item: Message = { id: editingMsgIndex !== null ? messages[editingMsgIndex].id : `msg-${Date.now()}`, title: msgForm.title || '', description: msgForm.description || '', image: msgForm.image || '', date: msgForm.date || new Date().toISOString().split('T')[0], link: msgForm.link?.href ? msgForm.link : undefined, main: !!msgForm.main };
    const updated = (editingMsgIndex !== null ? messages.map((m, i) => i === editingMsgIndex ? item : m) : [...messages, item])
      .map(m => ({ ...m, main: m.id === item.id ? !!msgForm.main : false })); // Une seule main
    const res = await saveMessages(updated);
    if (res.success) { setMessages(updated); resetMsgForm(); flash('News saved'); } else flash('Error saving');
      setSaving(false);
  };
  const deleteMsg = async (i: number) => { if (!confirm('Delete this news?')) return; const updated = messages.filter((_, idx) => idx !== i); await saveMessages(updated); setMessages(updated); flash('News deleted'); };
  const resetMsgForm = () => { setMsgForm({ title: '', description: '', image: '', date: '', link: { label: '', href: '' }, main: false }); setEditingMsgIndex(null); };

  // Releases (Radar)
  const saveRelease = async () => {
    if (!releaseForm.artist || !releaseForm.label || !releaseForm.releaseDate) { flash('Artist, label and date required'); return; }
    setSaving(true);
    const item: Release = {
      ...releaseForm,
      id: editingReleaseIndex !== null ? releases[editingReleaseIndex].id : Date.now(),
    };
    const updated = (editingReleaseIndex !== null
      ? releases.map((rel, i) => (i === editingReleaseIndex ? item : rel))
      : [...releases, item]
    ).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
    const res = await saveReleases(updated);
    if (res.success) { setReleases(updated); resetReleaseForm(); flash('Release saved'); } else flash('Error saving');
    setSaving(false);
  };
  const deleteRelease = async (i: number) => { if (!confirm('Delete this release?')) return; const updated = releases.filter((_, idx) => idx !== i); await saveReleases(updated); setReleases(updated); flash('Release deleted'); };
  const resetReleaseForm = () => { setReleaseForm({ ...EMPTY_RELEASE }); setEditingReleaseIndex(null); };

  /**
   * Import en lot. Une seule sauvegarde pour tout le lot : soit tout le
   * merge part sur le disque, soit rien (JSON invalide ou echec d'ecriture).
   */
  const runImport = async () => {
    const ti = t.adminImport;
    if (!importText.trim() || importBusy) return;

    const prep = prepareReleasesImport(importText, releases);
    if (!prep.ok) {
      setImportFailed(true);
      setImportResult(prep.reason === 'invalid-json' ? ti.invalidJson : ti.notArray);
      return;
    }

    setImportBusy(true);
    try {
      if (prep.added > 0) {
        const res = await saveReleases(prep.merged);
        if (!res.success) {
          setImportFailed(true);
          setImportResult(res.message);
          return;
        }
        setReleases(
          [...prep.merged].sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')),
        );
        setImportText('');
      }
      setImportFailed(false);
      setImportResult(
        ti.recap
          .replace('{added}', String(prep.added))
          .replace('{dups}', String(prep.duplicates))
          .replace('{invalid}', String(prep.invalid)),
      );
    } finally {
      setImportBusy(false);
    }
  };

  if (loading) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-title">MM ADMIN</h1>

        <div className="admin-tabs">
          {(['events', 'merch', 'news', 'releases'] as Tab[]).map(tab => {
            const counts: Record<Tab, number> = {
              events: events.length,
              merch: merchItems.length,
              news: messages.length,
              releases: releases.length,
            };
            return (
              <button key={tab} className={`admin-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab} ({counts[tab]})
              </button>
            );
          })}
        </div>

        {status && <div className={`admin-status ${status.includes('Error') ? 'error' : 'success'}`}>{status}</div>}

        {/* EVENTS */}
        {activeTab === 'events' && (
          <>
            <div className="admin-form-card">
              <h3 className="admin-form-title">{editingEventIndex !== null ? 'Edit Event' : 'New Event'}</h3>
              <div className="admin-form-grid">
                <div className="admin-field-full">
                  <label className="admin-label">Title *</label>
                  <input className="admin-input" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="LUMIERE NOIRE" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Date *</label>
                  <input type="date" className="admin-input" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Location *</label>
                  <input className="admin-input" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} placeholder="Théâtre du Lion d'Or" />
                </div>
                <div className="admin-field-full">
                  <label className="admin-label">Event URL</label>
                  <input className="admin-input" value={eventForm.url} onChange={e => setEventForm({...eventForm, url: e.target.value})} placeholder="https://facebook.com/events/..." />
                </div>
                <div className="admin-field-color">
                  <label className="admin-label">Color</label>
                  <input type="color" className="admin-color-input" value={eventForm.color} onChange={e => setEventForm({...eventForm, color: e.target.value})} />
          </div>
                <div className="admin-field-image">
                  <label className="admin-label">Image</label>
                  <ImageUpload value={eventForm.image} onChange={v => setEventForm({...eventForm, image: v})} placeholder="events/photo.webp" useButton={true} folder="events" />
            </div>
                <div className="admin-actions">
                  <button className="admin-btn-primary" onClick={saveEvent} disabled={saving}>{saving ? 'Saving...' : editingEventIndex !== null ? 'Update' : 'Add Event'}</button>
                  {editingEventIndex !== null && <button className="admin-btn-secondary" onClick={resetEventForm}>Cancel</button>}
              </div>
              </div>
            </div>
            {events.map((ev, i) => (
              <div key={i} className="admin-list-item">
                <div className="admin-color-bar" style={{ background: ev.color }} />
                <div className="admin-item-info">
                  <div className="admin-item-title">{ev.title}</div>
                  <div className="admin-item-meta">{ev.date} · {ev.location}</div>
                </div>
                <button className="admin-btn-secondary" onClick={() => { setEventForm(ev); setEditingEventIndex(i); window.scrollTo(0,0); }}>Edit</button>
                <button className="admin-btn-danger" onClick={() => deleteEvent(i)}>Del</button>
              </div>
            ))}
          </>
        )}

        {/* MERCH */}
        {activeTab === 'merch' && (
          <>
            <div className="admin-form-card">
              <h3 className="admin-form-title">{editingMerchIndex !== null ? 'Edit Item' : 'New Item'}</h3>
              <div className="admin-form-grid">
                <div className="admin-field-half">
                  <label className="admin-label">Name *</label>
                  <input className="admin-input" value={merchForm.caption} onChange={e => setMerchForm({...merchForm, caption: e.target.value})} placeholder="T-shirt" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Price *</label>
                  <input className="admin-input" value={merchForm.price} onChange={e => setMerchForm({...merchForm, price: e.target.value})} placeholder="30$ CAD" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Category</label>
                  <select className="admin-input" value={merchForm.category} onChange={e => setMerchForm({...merchForm, category: e.target.value})}>
                    <option value="tshirt">T-shirt</option>
                    <option value="sweatshirt">Sweatshirt</option>
                    <option value="hoodie">Hoodie</option>
                    <option value="bag">Bag</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="admin-field-half admin-checkboxes">
                  <label className="admin-checkbox-label"><input type="checkbox" checked={merchForm.active !== false} onChange={e => setMerchForm({...merchForm, active: e.target.checked})} /> Active</label>
                  <label className="admin-checkbox-label"><input type="checkbox" checked={merchForm.soldOut || false} onChange={e => setMerchForm({...merchForm, soldOut: e.target.checked})} /> Sold Out</label>
                </div>
                <div className="admin-field-full">
                  <label className="admin-label">Image</label>
                  <ImageUpload value={merchForm.src || ''} onChange={v => setMerchForm({...merchForm, src: v, alt: merchForm.caption || ''})} placeholder="images/Merch_Tshirt-Front.webp" useButton={true} />
                </div>
                <div className="admin-actions">
                  <button className="admin-btn-primary" onClick={saveMerch} disabled={saving}>{saving ? 'Saving...' : editingMerchIndex !== null ? 'Update' : 'Add Item'}</button>
                  {editingMerchIndex !== null && <button className="admin-btn-secondary" onClick={resetMerchForm}>Cancel</button>}
                </div>
              </div>
            </div>
            {merchItems.map((item, i) => (
              <div key={i} className="admin-list-item">
                {item.src && <img src={item.src} alt={item.alt} className="admin-item-thumb" />}
                <div className="admin-item-info">
                  <div className="admin-item-title">{item.caption} {item.soldOut && <span className="admin-badge-danger">SOLD OUT</span>} {!item.active && <span className="admin-badge-muted">HIDDEN</span>}</div>
                  <div className="admin-item-meta">{item.price} · {item.category}</div>
                </div>
                <button className="admin-btn-secondary" onClick={() => { setMerchForm(item); setEditingMerchIndex(i); window.scrollTo(0,0); }}>Edit</button>
                <button className="admin-btn-danger" onClick={() => deleteMerch(i)}>Del</button>
              </div>
            ))}
          </>
        )}

        {/* NEWS */}
        {activeTab === 'news' && (
          <>
            <div className="admin-form-card">
              <h3 className="admin-form-title">{editingMsgIndex !== null ? 'Edit News' : 'New News'}</h3>
              <div className="admin-form-grid">
                <div className="admin-field-full">
                  <label className="admin-label">Title *</label>
                  <input className="admin-input" value={msgForm.title} onChange={e => setMsgForm({...msgForm, title: e.target.value})} placeholder="New album out now" />
            </div>
                <div className="admin-field-full">
                  <label className="admin-label">Description</label>
                  <textarea className="admin-input admin-textarea" value={msgForm.description} onChange={e => setMsgForm({...msgForm, description: e.target.value})} placeholder="Album description..." />
          </div>
                <div className="admin-field-half">
                  <label className="admin-label">Date</label>
                  <input type="date" className="admin-input" value={msgForm.date} onChange={e => setMsgForm({...msgForm, date: e.target.value})} />
        </div>
                <div className="admin-field-half admin-checkboxes">
                  <label className="admin-checkbox-label"><input type="checkbox" checked={!!msgForm.main} onChange={e => setMsgForm({...msgForm, main: e.target.checked})} /> Main news (20s first)</label>
            </div>
                <div className="admin-field-half">
                  <label className="admin-label">Image</label>
                  <ImageUpload value={msgForm.image || ''} onChange={v => setMsgForm({...msgForm, image: v})} placeholder="images/news-photo.webp" useButton={true} />
                    </div>
                <div className="admin-field-half">
                  <label className="admin-label">Link Label</label>
                  <input className="admin-input" value={msgForm.link?.label || ''} onChange={e => setMsgForm({...msgForm, link: {...(msgForm.link || { label: '', href: '' }), label: e.target.value}})} placeholder="Bandcamp" />
                      </div>
                <div className="admin-field-half">
                  <label className="admin-label">Link URL</label>
                  <input className="admin-input" value={msgForm.link?.href || ''} onChange={e => setMsgForm({...msgForm, link: {...(msgForm.link || { label: '', href: '' }), href: e.target.value}})} placeholder="https://..." />
                  </div>
                <div className="admin-actions">
                  <button className="admin-btn-primary" onClick={saveMsg} disabled={saving}>{saving ? 'Saving...' : editingMsgIndex !== null ? 'Update' : 'Add News'}</button>
                  {editingMsgIndex !== null && <button className="admin-btn-secondary" onClick={resetMsgForm}>Cancel</button>}
                </div>
              </div>
            </div>
            {messages.map((msg, i) => (
              <div key={i} className="admin-list-item">
                {msg.image && <img src={msg.image} alt={msg.title} className="admin-item-thumb" />}
                <div className="admin-item-info">
                  <div className="admin-item-title">{msg.title} {msg.main && <span className="admin-badge-main">MAIN</span>}</div>
                  <div className="admin-item-meta">{msg.date} {msg.description && `· ${msg.description.substring(0, 60)}...`}</div>
        </div>
                <button className="admin-btn-secondary" onClick={() => { setMsgForm({...msg, link: msg.link || { label: '', href: '' }}); setEditingMsgIndex(i); window.scrollTo(0,0); }}>Edit</button>
                <button className="admin-btn-danger" onClick={() => deleteMsg(i)}>Del</button>
        </div>
            ))}
          </>
        )}

        {/* RELEASES (Radar / veille musicale) */}
        {activeTab === 'releases' && (
          <>
            <div className="admin-form-card">
              <h3 className="admin-form-title">{editingReleaseIndex !== null ? 'Edit Release' : 'New Release'}</h3>
              <div className="admin-form-grid">
                <div className="admin-field-half">
                  <label className="admin-label">Artist *</label>
                  <input className="admin-input" value={releaseForm.artist} onChange={e => setReleaseForm({...releaseForm, artist: e.target.value})} placeholder="Damon Jee &amp; Darlyn Vlys" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Title</label>
                  <input className="admin-input" value={releaseForm.title} onChange={e => setReleaseForm({...releaseForm, title: e.target.value})} placeholder="Club Scenes" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Label *</label>
                  <input className="admin-input" value={releaseForm.label} onChange={e => setReleaseForm({...releaseForm, label: e.target.value})} placeholder="Surefire" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Release date *</label>
                  <input type="date" className="admin-input" value={releaseForm.releaseDate} onChange={e => setReleaseForm({...releaseForm, releaseDate: e.target.value})} />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Genre</label>
                  <input className="admin-input" value={releaseForm.genre} onChange={e => setReleaseForm({...releaseForm, genre: e.target.value})} placeholder="Indie Dance" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Format</label>
                  <select className="admin-input" value={releaseForm.format} onChange={e => setReleaseForm({...releaseForm, format: e.target.value as Release['format']})}>
                    {RELEASE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Section</label>
                  <select className="admin-input" value={releaseForm.section} onChange={e => setReleaseForm({...releaseForm, section: e.target.value as Release['section']})}>
                    {RELEASE_SECTIONS.map(s => <option key={s} value={s}>{s === 'feature' ? 'Coup de cœur' : s === 'labels' ? 'Radar labels' : 'Radar artistes'}</option>)}
                  </select>
                </div>
                <div className="admin-field-half admin-checkboxes">
                  <label className="admin-checkbox-label"><input type="checkbox" checked={releaseForm.favorite} onChange={e => setReleaseForm({...releaseForm, favorite: e.target.checked})} /> Coup de cœur</label>
                  <label className="admin-checkbox-label"><input type="checkbox" checked={releaseForm.publishedRadar} onChange={e => setReleaseForm({...releaseForm, publishedRadar: e.target.checked})} /> Visible</label>
                </div>
                <div className="admin-field-full">
                  <label className="admin-label">Link (Beatport / Bandcamp / SoundCloud)</label>
                  <input className="admin-input" value={releaseForm.link} onChange={e => setReleaseForm({...releaseForm, link: e.target.value})} placeholder="https://www.beatport.com/..." />
                </div>
                <div className="admin-field-full">
                  <label className="admin-label">SoundCloud URL (optionnel, joue la track complète sur /radar)</label>
                  <input className="admin-input" value={releaseForm.soundcloudUrl || ''} onChange={e => setReleaseForm({...releaseForm, soundcloudUrl: e.target.value})} placeholder="https://soundcloud.com/artiste/track" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Gradient from</label>
                  <input className="admin-input" value={releaseForm.colorFrom} onChange={e => setReleaseForm({...releaseForm, colorFrom: e.target.value})} placeholder="#ff2e4d" />
                </div>
                <div className="admin-field-half">
                  <label className="admin-label">Gradient to</label>
                  <input className="admin-input" value={releaseForm.colorTo} onChange={e => setReleaseForm({...releaseForm, colorTo: e.target.value})} placeholder="#3a0d18" />
                </div>
                <div className="admin-field-full">
                  <label className="admin-label">Cover (optionnel — sinon dégradé + initiales)</label>
                  <ImageUpload value={releaseForm.cover || ''} onChange={v => setReleaseForm({...releaseForm, cover: v})} placeholder="images/releases/cover.webp" useButton={true} />
                </div>
                <div className="admin-actions">
                  <button className="admin-btn-primary" onClick={saveRelease} disabled={saving}>{saving ? 'Saving...' : editingReleaseIndex !== null ? 'Update' : 'Add Release'}</button>
                  {editingReleaseIndex !== null && <button className="admin-btn-secondary" onClick={resetReleaseForm}>Cancel</button>}
                </div>
              </div>
            </div>

            {/* Import en lot : coller le JSON de la veille hebdo tel quel */}
            <div className="admin-form-card">
              <h3 className="admin-form-title">{t.adminImport.title}</h3>
              <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
                {t.adminImport.hint}
              </p>
              <textarea
                className="admin-textarea"
                rows={8}
                spellCheck={false}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='[{"artist":"Damon Jee","title":"Club Scenes","label":"Surefire","releaseDate":"2026-07-24"}]'
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                aria-label={t.adminImport.title}
              />
              <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  className="admin-btn-primary"
                  onClick={runImport}
                  disabled={importBusy || !importText.trim()}
                >
                  {importBusy ? t.adminImport.importing : t.adminImport.button}
                </button>
              </div>
              {importResult && (
                <div
                  className={`admin-status ${importFailed ? 'error' : 'success'}`}
                  role="status"
                  style={{ marginTop: '0.75rem' }}
                >
                  {importResult}
                </div>
              )}
            </div>

            {releases.map((rel, i) => (
              <div key={rel.id} className="admin-list-item">
                <div
                  className="admin-item-thumb"
                  style={{ background: `linear-gradient(150deg, ${rel.colorFrom}, ${rel.colorTo})` }}
                  aria-hidden="true"
                />
                <div className="admin-item-info">
                  <div className="admin-item-title">
                    {rel.artist} {rel.favorite && <span className="admin-badge-main">COUP DE CŒUR</span>} {!rel.publishedRadar && <span className="admin-badge-muted">HIDDEN</span>}
                  </div>
                  <div className="admin-item-meta">{rel.releaseDate} · {rel.label} · {rel.format} · {rel.section}</div>
                </div>
                <button className="admin-btn-secondary" onClick={() => { setReleaseForm(rel); setEditingReleaseIndex(i); window.scrollTo(0,0); }}>Edit</button>
                <button className="admin-btn-danger" onClick={() => deleteRelease(i)}>Del</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminEvents;
