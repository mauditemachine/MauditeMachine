/**
 * Pose des fonctions sur le prototype d'une classe comme la classe y pose ses methodes (non enumerables, modifiables) :
 * l'ecran du MM-RYTM, decoupe en fichiers en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0), garde une seule classe.
 */
export function defineMethods(cls: { prototype: object }, methods: Readonly<Record<string, unknown>>): void {
  for (const [name, value] of Object.entries(methods)) Object.defineProperty(cls.prototype, name, { value, writable: true, configurable: true, enumerable: false });
}
