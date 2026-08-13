/**
 * Donnees editables de l'admin : chargement + sauvegarde automatique
 * deboucee (800 ms apres la derniere frappe) vers server.js, avec etat
 * lisible pour l'indicateur « Enregistre » — le brouillon local, la
 * publication reste le bouton Publier.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminPut } from './api';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export default function useAdminData<T>(name: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<number | undefined>(undefined);
  const latestRef = useRef<T | null>(null);

  useEffect(() => {
    let alive = true;
    adminGet<{ success: boolean; data: T }>(`/api/admin/data/${name}`).then(
      (r) => {
        if (!alive) return;
        setData(r.data);
        latestRef.current = r.data;
      },
      (e) => alive && setError(String(e.message || e))
    );
    return () => {
      alive = false;
    };
  }, [name]);

  const flush = useCallback(async () => {
    if (!latestRef.current) return;
    setSaveState('saving');
    try {
      await adminPut(`/api/admin/data/${name}`, latestRef.current);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError(String((e as Error).message || e));
    }
  }, [name]);

  /** Applique une mutation et programme la sauvegarde. */
  const update = useCallback(
    (mutate: (draft: T) => T) => {
      setData((cur) => {
        if (cur === null) return cur;
        const next = mutate(cur);
        latestRef.current = next;
        return next;
      });
      setSaveState('dirty');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, 800);
    },
    [flush]
  );

  // Dernier filet : flush au demontage si des changements attendent
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    []
  );

  return { data, error, saveState, update };
}

export const saveLabel = (s: SaveState) =>
  s === 'saving'
    ? 'Enregistrement…'
    : s === 'saved'
      ? 'Enregistré ✓'
      : s === 'dirty'
        ? 'Modifications en attente…'
        : s === 'error'
          ? 'Échec de l\'enregistrement'
          : '';
