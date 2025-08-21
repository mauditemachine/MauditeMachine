/**
 * Utilitaires pour le stockage local avec TTL
 */

import type { CacheData } from '../types/discogs';

const CACHE_KEY = 'mauditemachine_discography';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 heure en millisecondes

export const storage = {
  /**
   * Sauvegarde des données en cache avec TTL
   */
  set: <T>(key: string, data: T, ttl: number = DEFAULT_TTL): void => {
    try {
      const cacheData: CacheData = {
        releases: data as any,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde en cache:', error);
    }
  },

  /**
   * Récupération des données du cache avec vérification TTL
   */
  get: <T>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData: CacheData = JSON.parse(cached);
      const now = Date.now();
      
      // Vérification du TTL
      if (now - cacheData.timestamp > cacheData.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.releases as T;
    } catch (error) {
      console.warn('Erreur lors de la lecture du cache:', error);
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Suppression d'une entrée du cache
   */
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Erreur lors de la suppression du cache:', error);
    }
  },

  /**
   * Nettoyage de tous les caches expirés
   */
  cleanup: (): void => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('mauditemachine_')) {
          const cached = localStorage.getItem(key);
          if (cached) {
            try {
              const cacheData: CacheData = JSON.parse(cached);
              const now = Date.now();
              if (now - cacheData.timestamp > cacheData.ttl) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        }
      });
    } catch (error) {
      console.warn('Erreur lors du nettoyage du cache:', error);
    }
  },
};

export const discographyCache = {
  get: () => storage.get(CACHE_KEY),
  set: (data: any) => storage.set(CACHE_KEY, data),
  remove: () => storage.remove(CACHE_KEY),
};
