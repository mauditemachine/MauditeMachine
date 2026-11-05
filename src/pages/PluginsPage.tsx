import React, { useState, useMemo, useEffect } from 'react';
import { PLUGINS_DATA, PLUGIN_CATEGORIES, PluginItem } from '../data/pluginsData';

export default function PluginsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [activePluginModal, setActivePluginModal] = useState<PluginItem | null>(null);

  // Retirer la coquille mm-boot et le SEO statique au montage
  useEffect(() => {
    document.getElementById('mm-boot')?.remove();
    document.getElementById('seo-static')?.remove();
  }, []);

  // Filtrage dynamique
  const filteredPlugins = useMemo(() => {
    return PLUGINS_DATA.filter(plugin => {
      if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
        return false;
      }
      if (onlyFavorites && !plugin.isFavorite) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = plugin.name.toLowerCase().includes(q);
        const matchBrand = plugin.brand.toLowerCase().includes(q);
        const matchRole = plugin.role.toLowerCase().includes(q);
        const matchDesc = plugin.description.toLowerCase().includes(q);
        const matchUsage = plugin.mikaUsage.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchRole && !matchDesc && !matchUsage) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, searchQuery, onlyFavorites]);

  return (
    <div id="plugins-page-root" className="min-h-screen bg-[#08080a] text-[#f2f2f2] font-sans selection:bg-[#ff2a5f] selection:text-white pb-32">
      <style>{`
        #mm-boot, #seo-static, .seo-static { display: none !important; }
        html, body { overflow: auto !important; height: auto !important; background: #08080a !important; }
      `}</style>
      {/* En-tete cyber-studio */}
      <header className="relative border-b border-white/10 bg-gradient-to-b from-[#111116] to-[#08080a] px-4 md:px-12 pt-16 pb-12 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#ff2a5f]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -top-10 left-10 w-80 h-80 bg-[#3b82f6]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#ff2a5f] tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#ff2a5f] animate-pulse" />
              Studio Maudite Machine // Ableton Live 12
            </div>
            <a
              href="/"
              className="text-xs font-mono text-white/50 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>←</span> Retour au site principal
            </a>
          </div>

          <h1 className="text-3xl md:text-6xl font-black tracking-tight text-white uppercase mb-4 font-mono">
            Arsenal Plugins <span className="text-[#ff2a5f]">&</span> Synthétiseurs
          </h1>

          <p className="text-white/70 max-w-3xl text-sm md:text-base leading-relaxed mb-8">
            Inventaire exhaustif des instruments virtuels, outils de dynamique, réverbes et processeurs modulaires configurés dans le setup de production de Mika. Cliquez sur une interface pour l'examiner à plat en haute résolution.
          </p>

          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
              <div className="text-2xl font-mono font-bold text-white">{PLUGINS_DATA.length}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Plugins analysés</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
              <div className="text-2xl font-mono font-bold text-[#ff2a5f]">
                {PLUGINS_DATA.filter(p => p.isFavorite).length}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Favoris Ableton</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
              <div className="text-2xl font-mono font-bold text-[#3b82f6]">
                {PLUGINS_DATA.filter(p => p.category === 'synths').length}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Synthétiseurs</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
              <div className="text-2xl font-mono font-bold text-[#10b981]">
                {PLUGINS_DATA.filter(p => p.category === 'dynamics' || p.category === 'eq-space').length}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Mix & Dynamique</div>
            </div>
          </div>
        </div>
      </header>

      {/* Barre de controle : recherche et filtres */}
      <nav aria-label="Filtres des plugins" className="sticky top-0 z-30 bg-[#08080a]/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Onglets categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {PLUGIN_CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#ff2a5f] text-white font-semibold shadow-lg shadow-[#ff2a5f]/20'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Barre recherche & filtre favoris */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setOnlyFavorites(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                onlyFavorites
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'
              }`}
              title="Filtrer uniquement les favoris Ableton"
            >
              <span>★</span>
              <span>Favoris ({PLUGINS_DATA.filter(p => p.isFavorite).length})</span>
            </button>

            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un plugin, marque, rôle..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff2a5f] font-mono transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Grille principale des plugins */}
      <main className="max-w-7xl mx-auto px-4 md:px-12 pt-8">
        {filteredPlugins.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <p className="text-white/40 font-mono text-sm mb-2">Aucun plugin ne correspond à votre filtre</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setOnlyFavorites(false);
              }}
              className="text-xs font-mono text-[#ff2a5f] hover:underline"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.map(plugin => (
              <article
                key={plugin.id}
                className="group relative bg-[#111116] border border-white/10 rounded-2xl overflow-hidden hover:border-[#ff2a5f]/50 transition-all duration-300 flex flex-col hover:shadow-2xl hover:shadow-[#ff2a5f]/5"
              >
                {/* Image Interface a plat */}
                <div
                  onClick={() => setActivePluginModal(plugin)}
                  className="relative aspect-[16/10] bg-[#0c0c10] border-b border-white/10 overflow-hidden cursor-pointer group/img"
                  title="Cliquer pour voir l'interface à plat en grand format"
                >
                  {plugin.image ? (
                    <img
                      src={plugin.image}
                      alt={`Interface à plat du plugin ${plugin.name}`}
                      loading="lazy"
                      className="w-full h-full object-contain p-2 group-hover/img:scale-[1.03] transition-transform duration-500"
                      onError={e => {
                        // Fallback visuel si l'image ne charge pas
                        (e.target as HTMLElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
                        if (parent) {
                          parent.classList.add('flex', 'items-center', 'justify-center');
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-white/5 to-transparent">
                      <span className="text-3xl mb-2 opacity-40">🎛</span>
                      <span className="text-xs font-mono text-white/40">{plugin.name}</span>
                    </div>
                  )}

                  {/* Badge Favoris */}
                  {plugin.isFavorite && (
                    <div className="absolute top-3 right-3 bg-amber-400/90 text-black text-[10px] font-bold font-mono px-2 py-0.5 rounded shadow flex items-center gap-1 backdrop-blur-sm">
                      <span>★</span> FAVORIS
                    </div>
                  )}

                  {/* Formats badges */}
                  <div className="absolute bottom-2.5 left-3 flex gap-1">
                    {plugin.formats.map(f => (
                      <span
                        key={f}
                        className="bg-black/80 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/70 px-1.5 py-0.5 rounded"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Hover indicateur de zoom */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <span className="bg-white/20 border border-white/40 text-white font-mono text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl">
                      🔍 Agrandir l'interface
                    </span>
                  </div>
                </div>

                {/* Contenu textuel */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Marque et Role */}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-widest text-[#ff2a5f] font-semibold">
                        {plugin.brand}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold font-mono text-white group-hover:text-[#ff2a5f] transition-colors mb-2">
                      {plugin.name}
                    </h2>

                    <div className="inline-block text-xs font-medium text-white/90 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 mb-3">
                      {plugin.role}
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed mb-4">
                      {plugin.description}
                    </p>

                    {/* Usage Mika / Maudite Machine */}
                    <div className="bg-black/40 border-l-2 border-[#ff2a5f] p-2.5 rounded-r-lg mb-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-white/50 mb-0.5">
                        Rôle dans Maudite Machine :
                      </div>
                      <div className="text-xs text-white/90 italic">
                        "{plugin.mikaUsage}"
                      </div>
                    </div>
                  </div>

                  {/* Caracteristiques cles */}
                  <div className="pt-3 border-t border-white/5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
                      Points techniques clés :
                    </div>
                    <ul className="space-y-1">
                      {plugin.keyFeatures.map((feat, idx) => (
                        <li key={idx} className="text-[11px] text-white/60 flex items-start gap-1.5 leading-snug">
                          <span className="text-[#ff2a5f] font-mono">›</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Modal Lightbox : Interface a plat en grand format */}
      {activePluginModal && (
        <div
          onClick={() => setActivePluginModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#111116] border border-white/20 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
          >
            {/* Header du modal */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
              <div>
                <span className="text-xs font-mono uppercase text-[#ff2a5f] font-semibold">
                  {activePluginModal.brand}
                </span>
                <h3 className="text-xl font-bold font-mono text-white">
                  {activePluginModal.name}
                </h3>
              </div>
              <button
                onClick={() => setActivePluginModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-mono text-sm transition-colors cursor-pointer"
                title="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Corps du modal : Interface a plat */}
            <div className="flex-1 overflow-auto p-4 md:p-6 flex flex-col items-center justify-center bg-[#0a0a0e]">
              {activePluginModal.image ? (
                <img
                  src={activePluginModal.image}
                  alt={`Vue complète de l'interface ${activePluginModal.name}`}
                  className="max-h-[60vh] w-auto object-contain rounded-lg border border-white/10 shadow-2xl"
                />
              ) : (
                <div className="p-12 text-center text-white/40 font-mono text-sm">
                  Interface haute résolution en cours d'optimisation
                </div>
              )}

              {/* Resume sous l'image */}
              <div className="mt-6 w-full max-w-3xl bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-xs font-mono text-[#ff2a5f] uppercase tracking-wider mb-1">
                  {activePluginModal.role}
                </div>
                <p className="text-xs text-white/80 leading-relaxed mb-3">
                  {activePluginModal.description}
                </p>
                <div className="text-xs text-white/90 bg-black/40 p-2.5 rounded-lg border-l-2 border-[#ff2a5f] italic">
                  <strong>Utilisation studio :</strong> {activePluginModal.mikaUsage}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
