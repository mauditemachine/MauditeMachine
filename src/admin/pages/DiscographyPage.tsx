/**
 * Admin — Discographie : le tableau des pistes /v2 en edition inline.
 * Reordonnancement par glisser-deposer (@dnd-kit), test d'ecoute par
 * piste (oEmbed via server.js), badge sur les pistes incompletes,
 * toggle selection (featured), ajout/suppression avec confirmation.
 * Sauvegarde automatique locale (useAdminData), publication a part.
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useAdminData, { saveLabel } from '../lib/useAdminData';
import { adminPost } from '../lib/api';

interface Track {
  id: string;
  title: string;
  project: string;
  artist: string;
  role: string;
  year: number;
  category: 'originals' | 'remixes' | 'vrstl';
  soundcloudUrl: string;
  link: string;
  featured?: boolean;
}

interface Disco {
  tracks: Track[];
}

const isIncomplete = (t: Track) =>
  !t.title || !t.project || !t.year || !t.link || !t.soundcloudUrl;

type CheckState = 'checking' | 'ok' | 'ko';

const Row: React.FC<{
  track: Track;
  check: CheckState | undefined;
  onChange: (patch: Partial<Track>) => void;
  onRemove: () => void;
  onCheck: () => void;
}> = ({ track, check, onChange, onRemove, onCheck }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`admx-trow${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="admx-drag"
        aria-label={`Déplacer ${track.title}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <div className="admx-trow-fields">
        <input
          className="admx-input admx-in-title"
          value={track.title}
          placeholder="Titre"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <input
          className="admx-input"
          value={track.project}
          placeholder="Projet"
          onChange={(e) => onChange({ project: e.target.value })}
        />
        <input
          className="admx-input admx-in-role"
          value={track.role}
          placeholder="Rôle"
          onChange={(e) => onChange({ role: e.target.value })}
        />
        <input
          className="admx-input admx-in-year"
          type="number"
          value={track.year || ''}
          placeholder="Année"
          onChange={(e) => onChange({ year: Number(e.target.value) || 0 })}
        />
        <select
          className="admx-input admx-in-cat"
          value={track.category}
          onChange={(e) => onChange({ category: e.target.value as Track['category'] })}
        >
          <option value="originals">Originals</option>
          <option value="remixes">Remixes</option>
          <option value="vrstl">VRSTL</option>
        </select>
        <input
          className="admx-input admx-in-url"
          value={track.soundcloudUrl}
          placeholder="Lien SoundCloud (écoute)"
          onChange={(e) => onChange({ soundcloudUrl: e.target.value })}
        />
        <input
          className="admx-input admx-in-url"
          value={track.link}
          placeholder="Lien plateforme (achat/écoute externe)"
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </div>

      <div className="admx-trow-side">
        <label className="admx-check" title="Dans la sélection affichée par défaut">
          <input
            type="checkbox"
            checked={!!track.featured}
            onChange={(e) => onChange({ featured: e.target.checked })}
          />
          Sélection
        </label>

        {isIncomplete(track) && <span className="admx-pill warn">incomplet</span>}

        {track.soundcloudUrl && (
          <button type="button" className="admx-btn admx-btn-sm" onClick={onCheck}>
            {check === 'checking' ? 'Test…' : "Tester l'écoute"}
          </button>
        )}
        {check === 'ok' && <span className="admx-pill ok">écoute OK</span>}
        {check === 'ko' && <span className="admx-pill danger">injouable</span>}

        <button
          type="button"
          className="admx-btn admx-btn-sm admx-btn-danger"
          onClick={onRemove}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};

const DiscographyPage: React.FC = () => {
  const { data, error, saveState, update } = useAdminData<Disco>('discography');
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !data) return;
    update((d) => {
      const from = d.tracks.findIndex((t) => t.id === active.id);
      const to = d.tracks.findIndex((t) => t.id === over.id);
      return { ...d, tracks: arrayMove(d.tracks, from, to) };
    });
  };

  const checkPlayback = async (t: Track) => {
    setChecks((c) => ({ ...c, [t.id]: 'checking' }));
    try {
      const r = await adminPost<{ ok: boolean }>(`/api/admin/sc-check`, {
        url: t.soundcloudUrl,
      });
      setChecks((c) => ({ ...c, [t.id]: r.ok ? 'ok' : 'ko' }));
    } catch {
      setChecks((c) => ({ ...c, [t.id]: 'ko' }));
    }
  };

  const addTrack = () => {
    update((d) => ({
      ...d,
      tracks: [
        {
          id: `piste-${Date.now()}`,
          title: '',
          project: '',
          artist: 'Maudite Machine',
          role: 'Producer',
          year: new Date().getFullYear(),
          category: 'originals' as const,
          soundcloudUrl: '',
          link: '',
          featured: false,
        },
        ...d.tracks,
      ],
    }));
  };

  if (error && !data) {
    return (
      <div>
        <div className="admx-head"><h1 className="admx-title">Discographie</h1></div>
        <div className="admx-card">Le serveur local ne répond pas ({error}).</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Discographie</h1>
          <span className="admx-sub">Chargement…</span>
        </div>
      </div>
    );
  }

  const incompleteCount = data.tracks.filter(isIncomplete).length;

  return (
    <div>
      <div className="admx-head">
        <h1 className="admx-title">Discographie</h1>
        <span className="admx-sub">
          {data.tracks.length} pistes · {data.tracks.filter((t) => t.featured).length} en
          sélection
          {incompleteCount > 0 && ` · ${incompleteCount} incomplète${incompleteCount > 1 ? 's' : ''}`}
          {'  '}
          <b>{saveLabel(saveState)}</b>
        </span>
      </div>

      <p style={{ marginTop: 0 }}>
        <button type="button" className="admx-btn primary" onClick={addTrack}>
          Ajouter une piste
        </button>
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={data.tracks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {data.tracks.map((t) => (
            <Row
              key={t.id}
              track={t}
              check={checks[t.id]}
              onChange={(patch) =>
                update((d) => ({
                  ...d,
                  tracks: d.tracks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
                }))
              }
              onRemove={() => {
                if (window.confirm(`Supprimer « ${t.title || 'cette piste'} » ?`)) {
                  update((d) => ({ ...d, tracks: d.tracks.filter((x) => x.id !== t.id) }));
                }
              }}
              onCheck={() => checkPlayback(t)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default DiscographyPage;
