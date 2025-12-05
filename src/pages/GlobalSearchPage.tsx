import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Save, X, Clock, Star, TrendingUp, Users, FileText, Package, MapPin, AlertCircle, Building2, Truck, Calendar, Award, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Api, type SearchResult, type SavedFilter } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

// Types importés depuis api.ts

type SearchFilters = {
  types: string[];
  dateRange?: { start: string; end: string };
  status?: string;
  department?: string;
};

export default function GlobalSearchPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ types: [] });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [semanticQuery, setSemanticQuery] = useState('');

  useEffect(() => {
    loadSavedFilters();
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      loadSuggestions(searchQuery);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const loadSavedFilters = async () => {
    try {
      const filters = await Api.fetchSavedFilters();
      setSavedFilters(filters);
    } catch (error) {
      console.error('Erreur chargement filtres sauvegardés:', error);
    }
  };

  const loadRecentSearches = () => {
    const recent = localStorage.getItem('recent_searches');
    if (recent) {
      setRecentSearches(JSON.parse(recent));
    }
  };

  const saveRecentSearch = (query: string) => {
    const recent = recentSearches.filter(q => q !== query);
    recent.unshift(query);
    const updated = recent.slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const loadSuggestions = async (query: string) => {
    try {
      const suggestions = await Api.searchSuggestions(query);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Erreur chargement suggestions:', error);
    }
  };

  const performSearch = useCallback(async (query: string, useSemantic = false) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let searchResults: SearchResult[] = [];
      
      if (useSemantic && semanticQuery.trim()) {
        // Recherche sémantique
        const semanticResults = await Api.semanticSearch(semanticQuery, filters);
        searchResults = semanticResults;
      } else {
        // Recherche normale
        const results = await Api.globalSearch(query, filters);
        searchResults = results;
      }

      setResults(searchResults);
      saveRecentSearch(query);
    } catch (error: any) {
      console.error('Erreur recherche:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [filters, semanticQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleSemanticSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (semanticQuery.trim()) {
      performSearch(semanticQuery, true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  const handleSaveFilter = async () => {
    if (!searchQuery.trim()) {
      toast.error('Veuillez entrer une recherche');
      return;
    }

    const name = prompt('Nom de la vue personnalisée:');
    if (!name) return;

    try {
      await Api.saveFilter({
        name,
        query: searchQuery,
        filters,
        is_favorite: false
      } as CreateSavedFilterPayload);
      toast.success('Vue personnalisée sauvegardée');
      loadSavedFilters();
    } catch (error: any) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleLoadFilter = async (filter: SavedFilter) => {
    setSearchQuery(filter.query);
    setFilters(filter.filters);
    performSearch(filter.query);
  };

  const handleDeleteFilter = async (id: string) => {
    if (!confirm('Supprimer cette vue personnalisée ?')) return;
    try {
      await Api.deleteSavedFilter(id);
      toast.success('Vue supprimée');
      loadSavedFilters();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      customer: Users,
      invoice: FileText,
      intervention: AlertCircle,
      material: Package,
      employee: Users,
      vehicle: Truck,
      document: FileText,
      supplier: Building2,
      route: MapPin
    };
    return icons[type] || Search;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      customer: 'Client',
      invoice: 'Facture',
      intervention: 'Intervention',
      material: 'Matière',
      employee: 'Employé',
      vehicle: 'Véhicule',
      document: 'Document',
      supplier: 'Fournisseur',
      route: 'Route'
    };
    return labels[type] || type;
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(result => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [results]);

  return (
    <div className="page-container global-search-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recherche</p>
          <h1 className="page-title">Recherche Globale</h1>
          <p className="page-subtitle">Recherchez dans tout le système : clients, factures, interventions, matières, employés, etc.</p>
        </div>
      </div>

      <div className="destruction-card">
        {/* Recherche normale */}
        <form onSubmit={handleSearch} className="search-section">
          <div className="search-bar-wrapper">
            <div className="search-bar-large">
              <Search size={24} />
              <input
                type="text"
                placeholder="Rechercher dans tout le système..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setResults([]);
                  }}
                  className="btn-icon"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="suggestion-item"
                  >
                    <Search size={16} />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="search-actions">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? 'active' : ''}`}
            >
              <Filter size={16} />
              Filtres {filters.types.length > 0 && `(${filters.types.length})`}
            </button>
            <button
              type="button"
              onClick={handleSaveFilter}
              className="btn-secondary"
            >
              <Save size={16} />
              Sauvegarder la vue
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !searchQuery.trim()}>
              {loading ? 'Recherche...' : 'Rechercher'}
            </button>
          </div>
        </form>

        {/* Recherche sémantique */}
        <div className="semantic-search-section">
          <div className="section-header">
            <TrendingUp size={20} />
            <h3>Recherche Sémantique</h3>
          </div>
          <p className="section-description">
            Posez une question en langage naturel : "trouve-moi tous les clients dans le secteur X qui ont eu une intervention cette semaine"
          </p>
          <form onSubmit={handleSemanticSearch} className="semantic-search-form">
            <div className="search-bar-large">
              <Search size={24} />
              <input
                type="text"
                placeholder="Ex: Trouve-moi tous les clients qui ont eu une intervention cette semaine"
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !semanticQuery.trim()}>
              Recherche sémantique
            </button>
          </form>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="filters-panel">
            <h3>Filtres</h3>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Types d'entités</label>
                <div className="filter-checkboxes">
                  {['customer', 'invoice', 'intervention', 'material', 'employee', 'vehicle', 'document', 'supplier', 'route'].map(type => (
                    <label key={type} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.types.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, types: [...filters.types, type] });
                          } else {
                            setFilters({ ...filters, types: filters.types.filter(t => t !== type) });
                          }
                        }}
                      />
                      <span>{getTypeLabel(type)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <label>Date de début</label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, start: e.target.value } as any
                  })}
                />
              </div>
              <div className="filter-group">
                <label>Date de fin</label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, end: e.target.value } as any
                  })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Vues sauvegardées */}
        {savedFilters.length > 0 && (
          <div className="saved-filters-section">
            <div className="section-header">
              <Star size={20} />
              <h3>Vues Personnalisées</h3>
            </div>
            <div className="saved-filters-grid">
              {savedFilters.map(filter => (
                <div key={filter.id} className="saved-filter-card">
                  <div className="saved-filter-header">
                    <h4>{filter.name}</h4>
                    <div className="saved-filter-actions">
                      <button
                        onClick={() => handleLoadFilter(filter)}
                        className="btn-icon"
                        title="Charger"
                      >
                        <Clock size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteFilter(filter.id)}
                        className="btn-icon"
                        title="Supprimer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="saved-filter-query">{filter.query}</p>
                  <div className="saved-filter-meta">
                    <span>{new Date(filter.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recherches récentes */}
        {recentSearches.length > 0 && !searchQuery && (
          <div className="recent-searches-section">
            <div className="section-header">
              <Clock size={20} />
              <h3>Recherches Récentes</h3>
            </div>
            <div className="recent-searches-list">
              {recentSearches.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(query)}
                  className="recent-search-item"
                >
                  <Clock size={16} />
                  <span>{query}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Résultats */}
        {results.length > 0 && (
          <div className="search-results-section">
            <div className="results-header">
              <h3>{results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}</h3>
            </div>
            {Object.entries(groupedResults).map(([type, typeResults]) => {
              const Icon = getTypeIcon(type);
              return (
                <div key={type} className="results-group">
                  <div className="results-group-header">
                    <Icon size={20} />
                    <h4>{getTypeLabel(type)} ({typeResults.length})</h4>
                  </div>
                  <div className="results-list">
                    {typeResults.map((result) => {
                      const ResultIcon = result.icon;
                      return (
                        <div key={result.id} className="result-item">
                          <div className="result-icon">
                            <ResultIcon size={20} />
                          </div>
                          <div className="result-content">
                            <h5>{result.title}</h5>
                            <p>{result.subtitle}</p>
                            {result.metadata && result.metadata.length > 0 && (
                              <div className="result-metadata">
                                {result.metadata.map((meta, idx) => (
                                  <span key={idx} className="result-meta-tag">{meta}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {result.url && (
                            <a href={result.url} className="result-link">
                              Voir →
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && searchQuery && results.length === 0 && (
          <div className="empty-state">
            <Search size={48} />
            <h3>Aucun résultat trouvé</h3>
            <p>Essayez avec d'autres mots-clés ou utilisez la recherche sémantique</p>
          </div>
        )}
      </div>
    </div>
  );
}

