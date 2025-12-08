export type Language = 'fr' | 'de' | 'en' | 'it';

export const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.inventory': 'Inventaires',
    'nav.rh': 'Ressources Humaines',
    'nav.calendar': 'Calendrier',
    'nav.employees': 'Employés',
    'nav.destruction': 'Destruction',
    'nav.alerts': 'Alertes',
    'nav.settings': 'Paramètres',
    'nav.users': 'Utilisateurs',
    'nav.customers': 'Clients',
    'nav.materials': 'Matières',
    'nav.finance': 'Finance',
    'nav.stocks': 'Stocks',
    'nav.crm': 'CRM',
    'nav.map': 'Carte',
    
    // Common
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.yes': 'Oui',
    'common.no': 'Non',
    
    // Sites
    'sites.title': 'Gestion des sites',
    'sites.create': 'Nouveau site',
    'sites.edit': 'Modifier le site',
    'sites.code': 'Code',
    'sites.name': 'Nom',
    'sites.address': 'Adresse',
    'sites.city': 'Ville',
    'sites.postal_code': 'Code postal',
    'sites.country': 'Pays',
    'sites.timezone': 'Fuseau horaire',
    'sites.currency': 'Devise',
    'sites.active': 'Actif',
    
    // Currencies
    'currencies.title': 'Gestion des devises',
    'currencies.create': 'Nouvelle devise',
    'currencies.code': 'Code',
    'currencies.name': 'Nom',
    'currencies.symbol': 'Symbole',
    'currencies.rate': 'Taux de change',
    'currencies.base': 'Devise de base',
    
    // Preferences
    'preferences.title': 'Préférences',
    'preferences.language': 'Langue',
    'preferences.timezone': 'Fuseau horaire',
    'preferences.currency': 'Devise',
    'preferences.site': 'Site',
  },
  de: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.inventory': 'Inventare',
    'nav.rh': 'Personalwesen',
    'nav.calendar': 'Kalender',
    'nav.employees': 'Mitarbeiter',
    'nav.destruction': 'Vernichtung',
    'nav.alerts': 'Warnungen',
    'nav.settings': 'Einstellungen',
    'nav.users': 'Benutzer',
    'nav.customers': 'Kunden',
    'nav.materials': 'Materialien',
    'nav.finance': 'Finanzen',
    'nav.stocks': 'Lager',
    'nav.crm': 'CRM',
    'nav.map': 'Karte',
    
    // Common
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.create': 'Erstellen',
    'common.search': 'Suchen',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.yes': 'Ja',
    'common.no': 'Nein',
    
    // Sites
    'sites.title': 'Standortverwaltung',
    'sites.create': 'Neuer Standort',
    'sites.edit': 'Standort bearbeiten',
    'sites.code': 'Code',
    'sites.name': 'Name',
    'sites.address': 'Adresse',
    'sites.city': 'Stadt',
    'sites.postal_code': 'Postleitzahl',
    'sites.country': 'Land',
    'sites.timezone': 'Zeitzone',
    'sites.currency': 'Währung',
    'sites.active': 'Aktiv',
    
    // Currencies
    'currencies.title': 'Währungsverwaltung',
    'currencies.create': 'Neue Währung',
    'currencies.code': 'Code',
    'currencies.name': 'Name',
    'currencies.symbol': 'Symbol',
    'currencies.rate': 'Wechselkurs',
    'currencies.base': 'Basiswährung',
    
    // Preferences
    'preferences.title': 'Einstellungen',
    'preferences.language': 'Sprache',
    'preferences.timezone': 'Zeitzone',
    'preferences.currency': 'Währung',
    'preferences.site': 'Standort',
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.inventory': 'Inventories',
    'nav.rh': 'Human Resources',
    'nav.calendar': 'Calendar',
    'nav.employees': 'Employees',
    'nav.destruction': 'Destruction',
    'nav.alerts': 'Alerts',
    'nav.settings': 'Settings',
    'nav.users': 'Users',
    'nav.customers': 'Customers',
    'nav.materials': 'Materials',
    'nav.finance': 'Finance',
    'nav.stocks': 'Stocks',
    'nav.crm': 'CRM',
    'nav.map': 'Map',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.yes': 'Yes',
    'common.no': 'No',
    
    // Sites
    'sites.title': 'Sites Management',
    'sites.create': 'New Site',
    'sites.edit': 'Edit Site',
    'sites.code': 'Code',
    'sites.name': 'Name',
    'sites.address': 'Address',
    'sites.city': 'City',
    'sites.postal_code': 'Postal Code',
    'sites.country': 'Country',
    'sites.timezone': 'Timezone',
    'sites.currency': 'Currency',
    'sites.active': 'Active',
    
    // Currencies
    'currencies.title': 'Currencies Management',
    'currencies.create': 'New Currency',
    'currencies.code': 'Code',
    'currencies.name': 'Name',
    'currencies.symbol': 'Symbol',
    'currencies.rate': 'Exchange Rate',
    'currencies.base': 'Base Currency',
    
    // Preferences
    'preferences.title': 'Preferences',
    'preferences.language': 'Language',
    'preferences.timezone': 'Timezone',
    'preferences.currency': 'Currency',
    'preferences.site': 'Site',
  },
  it: {
    // Navigation
    'nav.dashboard': 'Cruscotto',
    'nav.inventory': 'Inventari',
    'nav.rh': 'Risorse Umane',
    'nav.calendar': 'Calendario',
    'nav.employees': 'Dipendenti',
    'nav.destruction': 'Distruzione',
    'nav.alerts': 'Avvisi',
    'nav.settings': 'Impostazioni',
    'nav.users': 'Utenti',
    'nav.customers': 'Clienti',
    'nav.materials': 'Materiali',
    'nav.finance': 'Finanza',
    'nav.stocks': 'Magazzino',
    'nav.crm': 'CRM',
    'nav.map': 'Mappa',
    
    // Common
    'common.save': 'Salva',
    'common.cancel': 'Annulla',
    'common.delete': 'Elimina',
    'common.edit': 'Modifica',
    'common.create': 'Crea',
    'common.search': 'Cerca',
    'common.loading': 'Caricamento...',
    'common.error': 'Errore',
    'common.success': 'Successo',
    'common.yes': 'Sì',
    'common.no': 'No',
    
    // Sites
    'sites.title': 'Gestione Siti',
    'sites.create': 'Nuovo Sito',
    'sites.edit': 'Modifica Sito',
    'sites.code': 'Codice',
    'sites.name': 'Nome',
    'sites.address': 'Indirizzo',
    'sites.city': 'Città',
    'sites.postal_code': 'Codice Postale',
    'sites.country': 'Paese',
    'sites.timezone': 'Fuso Orario',
    'sites.currency': 'Valuta',
    'sites.active': 'Attivo',
    
    // Currencies
    'currencies.title': 'Gestione Valute',
    'currencies.create': 'Nuova Valuta',
    'currencies.code': 'Codice',
    'currencies.name': 'Nome',
    'currencies.symbol': 'Simbolo',
    'currencies.rate': 'Tasso di Cambio',
    'currencies.base': 'Valuta Base',
    
    // Preferences
    'preferences.title': 'Preferenze',
    'preferences.language': 'Lingua',
    'preferences.timezone': 'Fuso Orario',
    'preferences.currency': 'Valuta',
    'preferences.site': 'Sito',
  }
};

export const getTranslation = (key: string, language: Language = 'fr'): string => {
  return translations[language]?.[key] || translations.fr[key] || key;
};

export const SUPPORTED_LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' }
];

export const TIMEZONES = [
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' }
];

