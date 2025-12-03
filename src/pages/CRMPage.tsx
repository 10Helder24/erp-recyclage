import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3,
  Tag,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import {
  Api,
  type Customer,
  type CustomerInteraction,
  type CustomerContract,
  type CustomerOpportunity,
  type CustomerNote,
  type CustomerStatistics
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'pipeline' | 'customers' | 'interactions' | 'contracts' | 'opportunities' | 'notes' | 'statistics';

export const CRMPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('edit_customers');

  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [contracts, setContracts] = useState<CustomerContract[]>([]);
  const [opportunities, setOpportunities] = useState<CustomerOpportunity[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [reminders, setReminders] = useState<CustomerNote[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStatistics | null>(null);

  // Modal states
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [editingInteraction, setEditingInteraction] = useState<CustomerInteraction | null>(null);
  const [editingContract, setEditingContract] = useState<CustomerContract | null>(null);
  const [editingOpportunity, setEditingOpportunity] = useState<CustomerOpportunity | null>(null);
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null);

  // Form states
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: 'call' as 'call' | 'email' | 'meeting' | 'visit' | 'quote' | 'invoice' | 'complaint' | 'other',
    subject: '',
    description: '',
    outcome: '',
    next_action: '',
    next_action_date: '',
    duration_minutes: 0,
    location: '',
    participants: ''
  });

  const [contractForm, setContractForm] = useState({
    contract_number: '',
    contract_type: 'service' as 'service' | 'supply' | 'maintenance' | 'other',
    title: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    renewal_date: '',
    auto_renewal: false,
    value: 0,
    currency: 'EUR',
    terms: '',
    notes: '',
    signed_date: '',
    signed_by: ''
  });

  const [opportunityForm, setOpportunityForm] = useState({
    title: '',
    description: '',
    stage: 'prospecting' as 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost',
    probability: 50,
    estimated_value: 0,
    currency: 'EUR',
    expected_close_date: '',
    source: '',
    notes: '',
    assigned_to: ''
  });

  const [noteForm, setNoteForm] = useState({
    note_type: 'note' as 'note' | 'reminder' | 'task' | 'call_log',
    title: '',
    content: '',
    is_reminder: false,
    reminder_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent' | null,
    tags: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'pipeline':
          await Promise.all([loadOpportunities(), loadReminders()]);
          break;
        case 'customers':
          await loadCustomers();
          break;
        case 'interactions':
          if (selectedCustomer) {
            await loadInteractions(selectedCustomer.id);
          }
          break;
        case 'contracts':
          if (selectedCustomer) {
            await loadContracts(selectedCustomer.id);
          }
          break;
        case 'opportunities':
          await loadOpportunities();
          break;
        case 'notes':
          if (selectedCustomer) {
            await loadNotes(selectedCustomer.id);
          }
          break;
        case 'statistics':
          if (selectedCustomer) {
            await loadStatistics(selectedCustomer.id);
          }
          break;
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    const data = await Api.fetchCustomers();
    setCustomers(data);
  };

  const loadInteractions = async (customerId: string) => {
    const data = await Api.fetchCustomerInteractions(customerId);
    setInteractions(data);
  };

  const loadContracts = async (customerId: string) => {
    const data = await Api.fetchCustomerContracts(customerId);
    setContracts(data);
  };

  const loadOpportunities = async () => {
    const data = await Api.fetchOpportunities({});
    setOpportunities(data);
  };

  const loadNotes = async (customerId: string) => {
    const data = await Api.fetchCustomerNotes(customerId);
    setNotes(data);
  };

  const loadReminders = async () => {
    const data = await Api.fetchReminders(7);
    setReminders(data);
  };

  const loadStatistics = async (customerId: string) => {
    const data = await Api.fetchCustomerStatistics(customerId);
    setCustomerStats(data);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'prospecting':
        return 'bg-gray-100 text-gray-800';
      case 'qualification':
        return 'bg-blue-100 text-blue-800';
      case 'proposal':
        return 'bg-yellow-100 text-yellow-800';
      case 'negotiation':
        return 'bg-orange-100 text-orange-800';
      case 'closed_won':
        return 'bg-green-100 text-green-800';
      case 'closed_lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospecting: 'Prospection',
      qualification: 'Qualification',
      proposal: 'Proposition',
      negotiation: 'Négociation',
      closed_won: 'Gagné',
      closed_lost: 'Perdu'
    };
    return labels[stage] || stage;
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-yellow-100 text-yellow-800';
      case 'C':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canEdit) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>CRM</h1>
        </div>
        <div className="page-content">
          <p>Vous n'avez pas accès à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container crm-page">
      <div className="page-header">
        <h1>CRM & Gestion Commerciale</h1>
      </div>

      <div className="tab-nav">
        <button className={activeTab === 'pipeline' ? 'active' : ''} onClick={() => setActiveTab('pipeline')}>
          <Target size={16} />
          Pipeline
        </button>
        <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => setActiveTab('customers')}>
          <Users size={16} />
          Clients
        </button>
        <button className={activeTab === 'interactions' ? 'active' : ''} onClick={() => setActiveTab('interactions')}>
          <Phone size={16} />
          Interactions
        </button>
        <button className={activeTab === 'contracts' ? 'active' : ''} onClick={() => setActiveTab('contracts')}>
          <FileText size={16} />
          Contrats
        </button>
        <button className={activeTab === 'opportunities' ? 'active' : ''} onClick={() => setActiveTab('opportunities')}>
          <TrendingUp size={16} />
          Opportunités
        </button>
        <button className={activeTab === 'notes' ? 'active' : ''} onClick={() => setActiveTab('notes')}>
          <Tag size={16} />
          Notes
        </button>
        <button className={activeTab === 'statistics' ? 'active' : ''} onClick={() => setActiveTab('statistics')}>
          <BarChart3 size={16} />
          Statistiques
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : activeTab === 'pipeline' ? (
          <div>
            <div className="crm-pipeline-grid">
              {['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].map((stage) => {
                const stageOpps = opportunities.filter((o) => o.stage === stage);
                const totalValue = stageOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0);
                return (
                  <div key={stage} className="crm-pipeline-column">
                    <h3>{getStageLabel(stage)}</h3>
                    <p className="count">{stageOpps.length}</p>
                    <p className="value">
                      {stageOpps.length > 0 && stageOpps[0].currency 
                        ? `${totalValue.toFixed(0)} ${stageOpps[0].currency}`
                        : `${totalValue.toFixed(0)} EUR`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="crm-card">
              <h2>Rappels à venir</h2>
              <div>
                {reminders.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucun rappel</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.slice(0, 5).map((reminder) => (
                      <div key={reminder.id} className="crm-card" style={{ background: 'var(--warning-bg, #fef3c7)', borderColor: 'var(--warning-border, #fbbf24)' }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{reminder.customer_name}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{reminder.title || reminder.content}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {reminder.reminder_date && format(new Date(reminder.reminder_date), 'dd/MM/yyyy', { locale: fr })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'customers' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Segment</th>
                    <th>Dernière interaction</th>
                    <th>Prochaine action</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>
                        <td>
                          <span className={`crm-badge ${
                            (customer as any).customer_type === 'prospect' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {(customer as any).customer_type || 'client'}
                          </span>
                        </td>
                        <td>
                          {(customer as any).segment && (
                            <span className={`crm-badge ${getSegmentColor((customer as any).segment)}`}>
                              Segment {(customer as any).segment}
                            </span>
                          )}
                        </td>
                        <td>
                          {(customer as any).last_interaction_date
                            ? format(new Date((customer as any).last_interaction_date), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </td>
                        <td>
                          {(customer as any).next_follow_up_date
                            ? format(new Date((customer as any).next_follow_up_date), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setActiveTab('interactions');
                            }}
                            className="btn-secondary text-xs"
                          >
                            Voir détails
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'interactions' ? (
          <div>
            {selectedCustomer ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedCustomer.name} - Interactions</h2>
                  <button
                    onClick={() => {
                      setEditingInteraction(null);
                      setInteractionForm({
                        interaction_type: 'call',
                        subject: '',
                        description: '',
                        outcome: '',
                        next_action: '',
                        next_action_date: '',
                        duration_minutes: 0,
                        location: '',
                        participants: ''
                      });
                      setShowInteractionModal(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus size={16} />
                    Nouvelle interaction
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Sujet</th>
                        <th>Résultat</th>
                        <th>Prochaine action</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">
                            Aucune interaction
                          </td>
                        </tr>
                      ) : (
                        interactions.map((interaction) => (
                          <tr key={interaction.id}>
                            <td>{format(new Date(interaction.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                            <td>
                              <span className="crm-badge bg-blue-100 text-blue-800">
                                {interaction.interaction_type}
                              </span>
                            </td>
                            <td>{interaction.subject || '-'}</td>
                            <td>{interaction.outcome || '-'}</td>
                            <td>
                              {interaction.next_action_date
                                ? format(new Date(interaction.next_action_date), 'dd/MM/yyyy', { locale: fr })
                                : '-'}
                            </td>
                            <td>
                              <button
                                onClick={() => {
                                  setEditingInteraction(interaction);
                                  setInteractionForm({
                                    interaction_type: interaction.interaction_type,
                                    subject: interaction.subject || '',
                                    description: interaction.description,
                                    outcome: interaction.outcome || '',
                                    next_action: interaction.next_action || '',
                                    next_action_date: interaction.next_action_date || '',
                                    duration_minutes: interaction.duration_minutes || 0,
                                    location: interaction.location || '',
                                    participants: interaction.participants?.join(', ') || ''
                                  });
                                  setShowInteractionModal(true);
                                }}
                                className="btn-icon"
                                title="Voir détails"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Sélectionnez un client depuis l'onglet "Clients" pour voir ses interactions.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'contracts' ? (
          <div>
            {selectedCustomer ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedCustomer.name} - Contrats</h2>
                  <button
                    onClick={() => {
                      setEditingContract(null);
                      setContractForm({
                        contract_number: '',
                        contract_type: 'service',
                        title: '',
                        description: '',
                        start_date: format(new Date(), 'yyyy-MM-dd'),
                        end_date: '',
                        renewal_date: '',
                        auto_renewal: false,
                        value: 0,
                        currency: 'EUR',
                        terms: '',
                        notes: '',
                        signed_date: '',
                        signed_by: ''
                      });
                      setShowContractModal(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus size={16} />
                    Nouveau contrat
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Numéro</th>
                        <th>Titre</th>
                        <th>Type</th>
                        <th>Date début</th>
                        <th>Date fin</th>
                        <th>Valeur</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            Aucun contrat
                          </td>
                        </tr>
                      ) : (
                        contracts.map((contract) => (
                          <tr key={contract.id}>
                            <td className="font-mono">{contract.contract_number}</td>
                            <td>{contract.title}</td>
                            <td>{contract.contract_type}</td>
                            <td>{format(new Date(contract.start_date), 'dd/MM/yyyy', { locale: fr })}</td>
                            <td>{contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy', { locale: fr }) : '-'}</td>
                            <td className="font-mono">
                              {contract.value ? `${contract.value.toFixed(2)} ${contract.currency}` : '-'}
                            </td>
                            <td>
                              <span className={`crm-badge ${
                                contract.status === 'active' ? 'bg-green-100 text-green-800' :
                                contract.status === 'expired' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {contract.status}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => {
                                  setEditingContract(contract);
                                  setContractForm({
                                    contract_number: contract.contract_number,
                                    contract_type: contract.contract_type,
                                    title: contract.title,
                                    description: contract.description || '',
                                    start_date: contract.start_date,
                                    end_date: contract.end_date || '',
                                    renewal_date: contract.renewal_date || '',
                                    auto_renewal: contract.auto_renewal,
                                    value: contract.value || 0,
                                    currency: contract.currency,
                                    terms: contract.terms || '',
                                    notes: contract.notes || '',
                                    signed_date: contract.signed_date || '',
                                    signed_by: contract.signed_by || ''
                                  });
                                  setShowContractModal(true);
                                }}
                                className="btn-icon"
                                title="Modifier"
                              >
                                <Edit2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Sélectionnez un client depuis l'onglet "Clients" pour voir ses contrats.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'opportunities' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Opportunités</h2>
              {selectedCustomer && (
                <button
                  onClick={() => {
                    setEditingOpportunity(null);
                    setOpportunityForm({
                      title: '',
                      description: '',
                      stage: 'prospecting',
                      probability: 50,
                      estimated_value: 0,
                      currency: 'EUR',
                      expected_close_date: '',
                      source: '',
                      notes: '',
                      assigned_to: ''
                    });
                    setShowOpportunityModal(true);
                  }}
                  className="btn-primary"
                >
                  <Plus size={16} />
                  Nouvelle opportunité
                </button>
              )}
            </div>
            {!selectedCustomer && (
              <div className="mb-4 p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-800">
                  Sélectionnez un client depuis l'onglet "Clients" pour créer une opportunité.
                </p>
              </div>
            )}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Titre</th>
                    <th>Stage</th>
                    <th>Probabilité</th>
                    <th>Valeur estimée</th>
                    <th>Date de clôture</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Aucune opportunité
                      </td>
                    </tr>
                  ) : (
                    opportunities.map((opportunity) => (
                      <tr key={opportunity.id}>
                        <td>{opportunity.customer_name || '-'}</td>
                        <td>{opportunity.title}</td>
                        <td>
                          <span className={`crm-badge ${getStageColor(opportunity.stage)}`}>
                            {getStageLabel(opportunity.stage)}
                          </span>
                        </td>
                        <td>{opportunity.probability ? `${opportunity.probability}%` : '-'}</td>
                        <td className="font-mono">
                          {opportunity.estimated_value ? `${opportunity.estimated_value.toFixed(2)} ${opportunity.currency}` : '-'}
                        </td>
                        <td>
                          {opportunity.expected_close_date
                            ? format(new Date(opportunity.expected_close_date), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setEditingOpportunity(opportunity);
                              setOpportunityForm({
                                title: opportunity.title,
                                description: opportunity.description || '',
                                stage: opportunity.stage,
                                probability: opportunity.probability || 50,
                                estimated_value: opportunity.estimated_value || 0,
                                currency: opportunity.currency,
                                expected_close_date: opportunity.expected_close_date || '',
                                source: opportunity.source || '',
                                notes: opportunity.notes || '',
                                assigned_to: opportunity.assigned_to || ''
                              });
                              setShowOpportunityModal(true);
                            }}
                            className="btn-icon"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'notes' ? (
          <div>
            {selectedCustomer ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedCustomer.name} - Notes</h2>
                  <button
                    onClick={() => {
                      setEditingNote(null);
                      setNoteForm({
                        note_type: 'note',
                        title: '',
                        content: '',
                        is_reminder: false,
                        reminder_date: '',
                        priority: 'medium',
                        tags: ''
                      });
                      setShowNoteModal(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus size={16} />
                    Nouvelle note
                  </button>
                </div>
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Aucune note</div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-white p-4 rounded border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                {note.note_type}
                              </span>
                              {note.priority && (
                                <span className={`px-2 py-1 rounded text-xs ${
                                  note.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  note.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  note.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {note.priority}
                                </span>
                              )}
                              {note.is_completed && (
                                <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                                  Terminé
                                </span>
                              )}
                            </div>
                            {note.title && <h3 className="font-semibold mb-1">{note.title}</h3>}
                            <p className="text-sm">{note.content}</p>
                            {note.reminder_date && (
                              <p className="text-xs text-gray-500 mt-2">
                                Rappel: {format(new Date(note.reminder_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })} par {note.created_by_name || 'Utilisateur'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingNote(note);
                                setNoteForm({
                                  note_type: note.note_type,
                                  title: note.title || '',
                                  content: note.content,
                                  is_reminder: note.is_reminder,
                                  reminder_date: note.reminder_date || '',
                                  priority: note.priority || 'medium',
                                  tags: note.tags?.join(', ') || ''
                                });
                                setShowNoteModal(true);
                              }}
                              className="btn-icon"
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Supprimer cette note ?')) return;
                                try {
                                  await Api.deleteNote(note.id);
                                  toast.success('Note supprimée');
                                  await loadNotes(selectedCustomer.id);
                                } catch (error: any) {
                                  toast.error('Erreur lors de la suppression');
                                }
                              }}
                              className="btn-icon text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Sélectionnez un client depuis l'onglet "Clients" pour voir ses notes.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'statistics' ? (
          <div>
            {selectedCustomer ? (
              <>
                <h2 className="text-xl font-semibold mb-4">{selectedCustomer.name} - Statistiques</h2>
                {customerStats ? (
                  <div className="crm-stats-grid">
                    <div className="crm-stat-card">
                      <h3>Revenu total</h3>
                      <p className="stat-value">
                        {customerStats.total_revenue.toFixed(2)} {customerStats.currency || 'EUR'}
                      </p>
                    </div>
                    <div className="crm-stat-card">
                      <h3>Nombre de factures</h3>
                      <p className="stat-value">{customerStats.invoice_count}</p>
                    </div>
                    <div className="crm-stat-card">
                      <h3>Segment</h3>
                      <p className={`stat-value ${getSegmentColor(customerStats.segment)} px-2 py-1 rounded inline-block`}>
                        {customerStats.segment}
                      </p>
                    </div>
                    <div className="crm-stat-card">
                      <h3>Valeur moyenne facture</h3>
                      <p className="stat-value">
                        {customerStats.average_invoice_value.toFixed(2)} {customerStats.currency || 'EUR'}
                      </p>
                    </div>
                    <div className="crm-stat-card">
                      <h3>Fréquence commandes</h3>
                      <p className="stat-value">{customerStats.order_frequency.toFixed(2)}/mois</p>
                    </div>
                    <div className="crm-stat-card">
                      <h3>Interactions</h3>
                      <p className="stat-value">{customerStats.total_interactions}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Chargement des statistiques...</div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Sélectionnez un client depuis l'onglet "Clients" pour voir ses statistiques.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {selectedCustomer ? (
              <div>
                <h2 className="text-xl font-semibold mb-4">{selectedCustomer.name}</h2>
                <p>Les fonctionnalités détaillées seront implémentées dans la prochaine étape.</p>
              </div>
            ) : (
              <div>
                <p>Sélectionnez un client depuis l'onglet "Clients" pour voir ses détails.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Interaction */}
      {showInteractionModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowInteractionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingInteraction ? 'Modifier l\'interaction' : 'Nouvelle interaction'}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingInteraction) {
                    // Note: L'API ne supporte pas encore UPDATE pour les interactions
                    toast.error('La modification des interactions n\'est pas encore disponible');
                  } else {
                    await Api.createCustomerInteraction(selectedCustomer.id, {
                      ...interactionForm,
                      participants: interactionForm.participants
                        ? interactionForm.participants.split(',').map((p) => p.trim()).filter((p) => p)
                        : undefined
                    });
                    toast.success('Interaction créée');
                    setShowInteractionModal(false);
                    await loadInteractions(selectedCustomer.id);
                  }
                } catch (error: any) {
                  toast.error(error.message || 'Erreur lors de la sauvegarde');
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={interactionForm.interaction_type}
                    onChange={(e) =>
                      setInteractionForm({ ...interactionForm, interaction_type: e.target.value as any })
                    }
                    required
                  >
                    <option value="call">Appel</option>
                    <option value="email">Email</option>
                    <option value="meeting">Réunion</option>
                    <option value="visit">Visite</option>
                    <option value="quote">Devis</option>
                    <option value="invoice">Facture</option>
                    <option value="complaint">Réclamation</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sujet</label>
                  <input
                    type="text"
                    value={interactionForm.subject}
                    onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Durée (minutes)</label>
                  <input
                    type="number"
                    value={interactionForm.duration_minutes}
                    onChange={(e) =>
                      setInteractionForm({ ...interactionForm, duration_minutes: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Lieu</label>
                  <input
                    type="text"
                    value={interactionForm.location}
                    onChange={(e) => setInteractionForm({ ...interactionForm, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={interactionForm.description}
                  onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Résultat</label>
                  <textarea
                    value={interactionForm.outcome}
                    onChange={(e) => setInteractionForm({ ...interactionForm, outcome: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Prochaine action</label>
                  <textarea
                    value={interactionForm.next_action}
                    onChange={(e) => setInteractionForm({ ...interactionForm, next_action: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Date prochaine action</label>
                <input
                  type="date"
                  value={interactionForm.next_action_date}
                  onChange={(e) => setInteractionForm({ ...interactionForm, next_action_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Participants (séparés par des virgules)</label>
                <input
                  type="text"
                  value={interactionForm.participants}
                  onChange={(e) => setInteractionForm({ ...interactionForm, participants: e.target.value })}
                  placeholder="Jean Dupont, Marie Martin"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowInteractionModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingInteraction ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contrat */}
      {showContractModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingContract ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingContract) {
                    await Api.updateContract(editingContract.id, contractForm);
                    toast.success('Contrat mis à jour');
                  } else {
                    await Api.createCustomerContract(selectedCustomer.id, contractForm);
                    toast.success('Contrat créé');
                  }
                  setShowContractModal(false);
                  await loadContracts(selectedCustomer.id);
                } catch (error: any) {
                  toast.error(error.message || 'Erreur lors de la sauvegarde');
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>Numéro de contrat *</label>
                  <input
                    type="text"
                    value={contractForm.contract_number}
                    onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
                    required
                    disabled={!!editingContract}
                  />
                </div>
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={contractForm.contract_type}
                    onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as any })}
                    required
                  >
                    <option value="service">Service</option>
                    <option value="supply">Fourniture</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Titre *</label>
                  <input
                    type="text"
                    value={contractForm.title}
                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Date de début *</label>
                  <input
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Date de fin</label>
                  <input
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date de renouvellement</label>
                  <input
                    type="date"
                    value={contractForm.renewal_date}
                    onChange={(e) => setContractForm({ ...contractForm, renewal_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Valeur</label>
                  <input
                    type="number"
                    step="0.01"
                    value={contractForm.value}
                    onChange={(e) => setContractForm({ ...contractForm, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Devise *</label>
                  <select
                    value={contractForm.currency}
                    onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })}
                    required
                  >
                    <option value="EUR">EUR - Euro</option>
                    <option value="CHF">CHF - Franc suisse</option>
                    <option value="USD">USD - Dollar américain</option>
                    <option value="GBP">GBP - Livre sterling</option>
                    <option value="JPY">JPY - Yen japonais</option>
                    <option value="CAD">CAD - Dollar canadien</option>
                    <option value="AUD">AUD - Dollar australien</option>
                    <option value="CNY">CNY - Yuan chinois</option>
                    <option value="INR">INR - Roupie indienne</option>
                    <option value="BRL">BRL - Real brésilien</option>
                    <option value="MXN">MXN - Peso mexicain</option>
                    <option value="ZAR">ZAR - Rand sud-africain</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Conditions</label>
                <textarea
                  value={contractForm.terms}
                  onChange={(e) => setContractForm({ ...contractForm, terms: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date de signature</label>
                  <input
                    type="date"
                    value={contractForm.signed_date}
                    onChange={(e) => setContractForm({ ...contractForm, signed_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Signé par</label>
                  <input
                    type="text"
                    value={contractForm.signed_by}
                    onChange={(e) => setContractForm({ ...contractForm, signed_by: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={contractForm.auto_renewal}
                    onChange={(e) => setContractForm({ ...contractForm, auto_renewal: e.target.checked })}
                  />
                  {' '}Renouvellement automatique
                </label>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowContractModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingContract ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Opportunité */}
      {showOpportunityModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowOpportunityModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingOpportunity ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingOpportunity) {
                    await Api.updateOpportunity(editingOpportunity.id, opportunityForm);
                    toast.success('Opportunité mise à jour');
                  } else {
                    await Api.createCustomerOpportunity(selectedCustomer.id, opportunityForm);
                    toast.success('Opportunité créée');
                  }
                  setShowOpportunityModal(false);
                  await loadOpportunities();
                } catch (error: any) {
                  toast.error(error.message || 'Erreur lors de la sauvegarde');
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>Titre *</label>
                  <input
                    type="text"
                    value={opportunityForm.title}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Stage *</label>
                  <select
                    value={opportunityForm.stage}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, stage: e.target.value as any })}
                    required
                  >
                    <option value="prospecting">Prospection</option>
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposition</option>
                    <option value="negotiation">Négociation</option>
                    <option value="closed_won">Gagné</option>
                    <option value="closed_lost">Perdu</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Probabilité (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={opportunityForm.probability}
                    onChange={(e) =>
                      setOpportunityForm({ ...opportunityForm, probability: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Valeur estimée</label>
                  <input
                    type="number"
                    step="0.01"
                    value={opportunityForm.estimated_value}
                    onChange={(e) =>
                      setOpportunityForm({ ...opportunityForm, estimated_value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Devise *</label>
                  <select
                    value={opportunityForm.currency}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, currency: e.target.value })}
                    required
                  >
                    <option value="EUR">EUR - Euro</option>
                    <option value="CHF">CHF - Franc suisse</option>
                    <option value="USD">USD - Dollar américain</option>
                    <option value="GBP">GBP - Livre sterling</option>
                    <option value="JPY">JPY - Yen japonais</option>
                    <option value="CAD">CAD - Dollar canadien</option>
                    <option value="AUD">AUD - Dollar australien</option>
                    <option value="CNY">CNY - Yuan chinois</option>
                    <option value="INR">INR - Roupie indienne</option>
                    <option value="BRL">BRL - Real brésilien</option>
                    <option value="MXN">MXN - Peso mexicain</option>
                    <option value="ZAR">ZAR - Rand sud-africain</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date de clôture prévue</label>
                  <input
                    type="date"
                    value={opportunityForm.expected_close_date}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, expected_close_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={opportunityForm.description}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Source</label>
                  <input
                    type="text"
                    value={opportunityForm.source}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, source: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Assigné à (ID utilisateur)</label>
                  <input
                    type="text"
                    value={opportunityForm.assigned_to}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, assigned_to: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={opportunityForm.notes}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowOpportunityModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingOpportunity ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Note */}
      {showNoteModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingNote ? 'Modifier la note' : 'Nouvelle note'}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingNote) {
                    await Api.updateNote(editingNote.id, {
                      ...noteForm,
                      tags: noteForm.tags ? noteForm.tags.split(',').map((t) => t.trim()) : [],
                      priority: noteForm.priority === null ? undefined : noteForm.priority
                    });
                    toast.success('Note mise à jour');
                  } else {
                    await Api.createCustomerNote(selectedCustomer.id, {
                      ...noteForm,
                      tags: noteForm.tags ? noteForm.tags.split(',').map((t) => t.trim()) : [],
                      priority: noteForm.priority === null ? undefined : noteForm.priority
                    });
                    toast.success('Note créée');
                  }
                  setShowNoteModal(false);
                  await loadNotes(selectedCustomer.id);
                } catch (error: any) {
                  toast.error(error.message || 'Erreur lors de la sauvegarde');
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={noteForm.note_type}
                    onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value as any })}
                    required
                  >
                    <option value="note">Note</option>
                    <option value="reminder">Rappel</option>
                    <option value="task">Tâche</option>
                    <option value="call_log">Journal d'appel</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priorité</label>
                  <select
                    value={noteForm.priority || 'medium'}
                    onChange={(e) => setNoteForm({ ...noteForm, priority: e.target.value as any })}
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Titre</label>
                <input
                  type="text"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Contenu *</label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  rows={5}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={noteForm.is_reminder}
                    onChange={(e) => setNoteForm({ ...noteForm, is_reminder: e.target.checked })}
                  />
                  {' '}Rappel
                </label>
              </div>
              {noteForm.is_reminder && (
                <div className="form-group">
                  <label>Date du rappel</label>
                  <input
                    type="datetime-local"
                    value={noteForm.reminder_date}
                    onChange={(e) => setNoteForm({ ...noteForm, reminder_date: e.target.value })}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Tags (séparés par des virgules)</label>
                <input
                  type="text"
                  value={noteForm.tags}
                  onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
                  placeholder="important, suivi, client"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowNoteModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingNote ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

