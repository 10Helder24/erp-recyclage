import { useState, useEffect, useMemo } from 'react';
import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  Shield,
  Search,
  Plus,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Archive,
  Link as LinkIcon,
  Filter,
  RefreshCw
} from 'lucide-react';
import type {
  WasteTrackingSlip,
  CreateWasteTrackingSlipPayload,
  TreatmentCertificate,
  CreateTreatmentCertificatePayload,
  TraceabilityLink,
  CreateTraceabilityLinkPayload,
  ComplianceCheck,
  RegulatoryDocument
} from '../lib/api';

export const CompliancePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'bsd' | 'certificates' | 'traceability' | 'compliance' | 'documents'>('bsd');
  const [loading, setLoading] = useState(false);

  // BSD State
  const [slips, setSlips] = useState<WasteTrackingSlip[]>([]);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [editingSlip, setEditingSlip] = useState<WasteTrackingSlip | null>(null);
  const [slipForm, setSlipForm] = useState<Partial<CreateWasteTrackingSlipPayload>>({
    slip_type: 'BSD',
    unit: 'kg'
  });
  const [slipFilters, setSlipFilters] = useState({ status: '', producer_id: '', start_date: '', end_date: '' });

  // Certificates State
  const [certificates, setCertificates] = useState<TreatmentCertificate[]>([]);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateForm, setCertificateForm] = useState<Partial<CreateTreatmentCertificatePayload>>({
    unit: 'kg'
  });
  const [certificateFilters, setCertificateFilters] = useState({ customer_id: '', compliance_status: '', start_date: '', end_date: '' });

  // Traceability State
  const [traceabilityChain, setTraceabilityChain] = useState<TraceabilityLink[]>([]);
  const [showTraceabilityModal, setShowTraceabilityModal] = useState(false);
  const [traceabilityForm, setTraceabilityForm] = useState<Partial<CreateTraceabilityLinkPayload>>({
    unit: 'kg',
    transaction_type: 'transfer'
  });
  const [traceabilityFilters, setTraceabilityFilters] = useState({ slip_id: '', chain_reference: '', start_date: '', end_date: '' });

  // Compliance Checks State
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [complianceFilters, setComplianceFilters] = useState({ entity_type: '', entity_id: '', check_status: '' });

  // Documents State
  const [regulatoryDocuments, setRegulatoryDocuments] = useState<RegulatoryDocument[]>([]);
  const [documentFilters, setDocumentFilters] = useState({ document_type: '', related_entity_type: '', related_entity_id: '' });

  // Customers for dropdowns
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    switch (activeTab) {
      case 'bsd':
        loadSlips();
        break;
      case 'certificates':
        loadCertificates();
        break;
      case 'traceability':
        loadTraceabilityChain();
        break;
      case 'compliance':
        loadComplianceChecks();
        break;
      case 'documents':
        loadRegulatoryDocuments();
        break;
    }
  }, [activeTab]);

  const loadCustomers = async () => {
    try {
      const data = await Api.fetchCustomers();
      setCustomers(data.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadSlips = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchWasteTrackingSlips(slipFilters);
      setSlips(data);
    } catch (error: any) {
      console.error('Error loading waste tracking slips:', error);
      toast.error('Impossible de charger les BSD');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchTreatmentCertificates(certificateFilters);
      setCertificates(data);
    } catch (error: any) {
      console.error('Error loading certificates:', error);
      toast.error('Impossible de charger les certificats');
    } finally {
      setLoading(false);
    }
  };

  const loadTraceabilityChain = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchTraceabilityChain(traceabilityFilters);
      setTraceabilityChain(data);
    } catch (error: any) {
      console.error('Error loading traceability chain:', error);
      toast.error('Impossible de charger la chaîne de traçabilité');
    } finally {
      setLoading(false);
    }
  };

  const loadComplianceChecks = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchComplianceChecks(complianceFilters);
      setComplianceChecks(data);
    } catch (error: any) {
      console.error('Error loading compliance checks:', error);
      toast.error('Impossible de charger les vérifications de conformité');
    } finally {
      setLoading(false);
    }
  };

  const loadRegulatoryDocuments = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchRegulatoryDocuments(documentFilters);
      setRegulatoryDocuments(data);
    } catch (error: any) {
      console.error('Error loading regulatory documents:', error);
      toast.error('Impossible de charger les documents réglementaires');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlip = async () => {
    if (!slipForm.slip_type || !slipForm.producer_name || !slipForm.recipient_name || !slipForm.waste_code || !slipForm.waste_description || !slipForm.quantity || !slipForm.collection_date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      await Api.createWasteTrackingSlip(slipForm as CreateWasteTrackingSlipPayload);
      toast.success('BSD créé avec succès');
      setShowSlipModal(false);
      setSlipForm({ slip_type: 'BSD', unit: 'kg' });
      loadSlips();
    } catch (error: any) {
      console.error('Error creating slip:', error);
      toast.error(error.message || 'Impossible de créer le BSD');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCertificate = async () => {
    if (!certificateForm.customer_name || !certificateForm.treatment_date || !certificateForm.treatment_method || !certificateForm.treatment_facility || !certificateForm.waste_code || !certificateForm.waste_description || !certificateForm.quantity_treated) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      await Api.createTreatmentCertificate(certificateForm as CreateTreatmentCertificatePayload);
      toast.success('Certificat créé avec succès');
      setShowCertificateModal(false);
      setCertificateForm({ unit: 'kg' });
      loadCertificates();
    } catch (error: any) {
      console.error('Error creating certificate:', error);
      toast.error(error.message || 'Impossible de créer le certificat');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTraceabilityLink = async () => {
    if (!traceabilityForm.origin_type || !traceabilityForm.origin_name || !traceabilityForm.destination_type || !traceabilityForm.destination_name || !traceabilityForm.quantity || !traceabilityForm.transaction_date || !traceabilityForm.transaction_type) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      await Api.createTraceabilityLink(traceabilityForm as CreateTraceabilityLinkPayload);
      toast.success('Maillon de traçabilité créé avec succès');
      setShowTraceabilityModal(false);
      setTraceabilityForm({ unit: 'kg', transaction_type: 'transfer' });
      loadTraceabilityChain();
    } catch (error: any) {
      console.error('Error creating traceability link:', error);
      toast.error(error.message || 'Impossible de créer le maillon');
    } finally {
      setLoading(false);
    }
  };

  const filteredSlips = useMemo(() => {
    return slips;
  }, [slips]);

  const filteredCertificates = useMemo(() => {
    return certificates;
  }, [certificates]);

  const filteredTraceability = useMemo(() => {
    return traceabilityChain;
  }, [traceabilityChain]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      draft: { color: 'gray', icon: FileText, label: 'Brouillon' },
      in_transit: { color: 'blue', icon: Clock, label: 'En transit' },
      delivered: { color: 'green', icon: CheckCircle, label: 'Livré' },
      treated: { color: 'green', icon: CheckCircle, label: 'Traité' },
      archived: { color: 'gray', icon: Archive, label: 'Archivé' },
      compliant: { color: 'green', icon: CheckCircle, label: 'Conforme' },
      non_compliant: { color: 'red', icon: XCircle, label: 'Non conforme' },
      pending_verification: { color: 'yellow', icon: AlertCircle, label: 'En attente' }
    };
    return badges[status] || { color: 'gray', icon: FileText, label: status };
  };

  return (
    <div className="compliance-page">
      <div className="page-header">
        <div>
          <h1>Conformité & Traçabilité</h1>
          <p>Gestion des BSD, certificats de traitement et traçabilité complète</p>
        </div>
        <div className="page-actions">
          {activeTab === 'bsd' && (
            <button className="btn-primary" onClick={() => setShowSlipModal(true)}>
              <Plus size={18} />
              Nouveau BSD
            </button>
          )}
          {activeTab === 'certificates' && (
            <button className="btn-primary" onClick={() => setShowCertificateModal(true)}>
              <Plus size={18} />
              Nouveau Certificat
            </button>
          )}
          {activeTab === 'traceability' && (
            <button className="btn-primary" onClick={() => setShowTraceabilityModal(true)}>
              <Plus size={18} />
              Ajouter un Maillon
            </button>
          )}
        </div>
      </div>

      <div className="compliance-tabs">
        <button
          className={activeTab === 'bsd' ? 'active' : ''}
          onClick={() => setActiveTab('bsd')}
        >
          <FileText size={18} />
          BSD
        </button>
        <button
          className={activeTab === 'certificates' ? 'active' : ''}
          onClick={() => setActiveTab('certificates')}
        >
          <Shield size={18} />
          Certificats
        </button>
        <button
          className={activeTab === 'traceability' ? 'active' : ''}
          onClick={() => setActiveTab('traceability')}
        >
          <LinkIcon size={18} />
          Traçabilité
        </button>
        <button
          className={activeTab === 'compliance' ? 'active' : ''}
          onClick={() => setActiveTab('compliance')}
        >
          <CheckCircle size={18} />
          Vérifications
        </button>
        <button
          className={activeTab === 'documents' ? 'active' : ''}
          onClick={() => setActiveTab('documents')}
        >
          <Archive size={18} />
          Documents
        </button>
      </div>

      <div className="compliance-content">
        {activeTab === 'bsd' && (
          <div className="compliance-section">
            <div className="section-filters">
              <div className="filter-group">
                <label>Statut</label>
                <select
                  value={slipFilters.status}
                  onChange={(e) => {
                    setSlipFilters({ ...slipFilters, status: e.target.value });
                    setTimeout(() => loadSlips(), 100);
                  }}
                >
                  <option value="">Tous</option>
                  <option value="draft">Brouillon</option>
                  <option value="in_transit">En transit</option>
                  <option value="delivered">Livré</option>
                  <option value="treated">Traité</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Date début</label>
                <input
                  type="date"
                  value={slipFilters.start_date}
                  onChange={(e) => {
                    setSlipFilters({ ...slipFilters, start_date: e.target.value });
                    setTimeout(() => loadSlips(), 100);
                  }}
                />
              </div>
              <div className="filter-group">
                <label>Date fin</label>
                <input
                  type="date"
                  value={slipFilters.end_date}
                  onChange={(e) => {
                    setSlipFilters({ ...slipFilters, end_date: e.target.value });
                    setTimeout(() => loadSlips(), 100);
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spinning" size={32} />
                <p>Chargement...</p>
              </div>
            ) : filteredSlips.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <p>Aucun BSD trouvé</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Type</th>
                      <th>Producteur</th>
                      <th>Destinataire</th>
                      <th>Code déchet</th>
                      <th>Quantité</th>
                      <th>Date collecte</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlips.map((slip) => {
                      const badge = getStatusBadge(slip.status);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={slip.id}>
                          <td><strong>{slip.slip_number}</strong></td>
                          <td>{slip.slip_type}</td>
                          <td>{slip.producer_name}</td>
                          <td>{slip.recipient_name}</td>
                          <td>{slip.waste_code}</td>
                          <td>{slip.quantity} {slip.unit}</td>
                          <td>{format(new Date(slip.collection_date), 'dd/MM/yyyy', { locale: fr })}</td>
                          <td>
                            <span className={`status-badge status-${badge.color}`}>
                              <BadgeIcon size={14} />
                              {badge.label}
                            </span>
                          </td>
                          <td>
                            <button className="btn-icon" title="Télécharger PDF">
                              <Download size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="compliance-section">
            <div className="section-filters">
              <div className="filter-group">
                <label>Statut conformité</label>
                <select
                  value={certificateFilters.compliance_status}
                  onChange={(e) => {
                    setCertificateFilters({ ...certificateFilters, compliance_status: e.target.value });
                    setTimeout(() => loadCertificates(), 100);
                  }}
                >
                  <option value="">Tous</option>
                  <option value="compliant">Conforme</option>
                  <option value="non_compliant">Non conforme</option>
                  <option value="pending_verification">En attente</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Date début</label>
                <input
                  type="date"
                  value={certificateFilters.start_date}
                  onChange={(e) => {
                    setCertificateFilters({ ...certificateFilters, start_date: e.target.value });
                    setTimeout(() => loadCertificates(), 100);
                  }}
                />
              </div>
              <div className="filter-group">
                <label>Date fin</label>
                <input
                  type="date"
                  value={certificateFilters.end_date}
                  onChange={(e) => {
                    setCertificateFilters({ ...certificateFilters, end_date: e.target.value });
                    setTimeout(() => loadCertificates(), 100);
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spinning" size={32} />
                <p>Chargement...</p>
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="empty-state">
                <Shield size={48} />
                <p>Aucun certificat trouvé</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Client</th>
                      <th>Méthode traitement</th>
                      <th>Code déchet</th>
                      <th>Quantité traitée</th>
                      <th>Date traitement</th>
                      <th>Conformité</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCertificates.map((cert) => {
                      const badge = getStatusBadge(cert.compliance_status);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={cert.id}>
                          <td><strong>{cert.certificate_number}</strong></td>
                          <td>{cert.customer_name}</td>
                          <td>{cert.treatment_method}</td>
                          <td>{cert.waste_code}</td>
                          <td>{cert.quantity_treated} {cert.unit}</td>
                          <td>{format(new Date(cert.treatment_date), 'dd/MM/yyyy', { locale: fr })}</td>
                          <td>
                            <span className={`status-badge status-${badge.color}`}>
                              <BadgeIcon size={14} />
                              {badge.label}
                            </span>
                          </td>
                          <td>
                            <button className="btn-icon" title="Télécharger PDF">
                              <Download size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'traceability' && (
          <div className="compliance-section">
            <div className="section-filters">
              <div className="filter-group">
                <label>Référence chaîne</label>
                <input
                  type="text"
                  placeholder="TRACE-..."
                  value={traceabilityFilters.chain_reference}
                  onChange={(e) => {
                    setTraceabilityFilters({ ...traceabilityFilters, chain_reference: e.target.value });
                    setTimeout(() => loadTraceabilityChain(), 100);
                  }}
                />
              </div>
              <div className="filter-group">
                <label>Date début</label>
                <input
                  type="date"
                  value={traceabilityFilters.start_date}
                  onChange={(e) => {
                    setTraceabilityFilters({ ...traceabilityFilters, start_date: e.target.value });
                    setTimeout(() => loadTraceabilityChain(), 100);
                  }}
                />
              </div>
              <div className="filter-group">
                <label>Date fin</label>
                <input
                  type="date"
                  value={traceabilityFilters.end_date}
                  onChange={(e) => {
                    setTraceabilityFilters({ ...traceabilityFilters, end_date: e.target.value });
                    setTimeout(() => loadTraceabilityChain(), 100);
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spinning" size={32} />
                <p>Chargement...</p>
              </div>
            ) : filteredTraceability.length === 0 ? (
              <div className="empty-state">
                <LinkIcon size={48} />
                <p>Aucun maillon de traçabilité trouvé</p>
              </div>
            ) : (
              <div className="traceability-chain">
                {filteredTraceability.map((link, idx) => (
                  <div key={link.id} className="traceability-link">
                    <div className="link-origin">
                      <strong>{link.origin_name}</strong>
                      <span className="link-type">{link.origin_type}</span>
                    </div>
                    <div className="link-arrow">→</div>
                    <div className="link-destination">
                      <strong>{link.destination_name}</strong>
                      <span className="link-type">{link.destination_type}</span>
                    </div>
                    <div className="link-details">
                      <span>{link.quantity} {link.unit}</span>
                      <span>{link.transaction_type}</span>
                      <span>{format(new Date(link.transaction_date), 'dd/MM/yyyy', { locale: fr })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="compliance-section">
            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spinning" size={32} />
                <p>Chargement...</p>
              </div>
            ) : complianceChecks.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={48} />
                <p>Aucune vérification de conformité trouvée</p>
              </div>
            ) : (
              <div className="compliance-checks-list">
                {complianceChecks.map((check) => {
                  const badge = getStatusBadge(check.check_status);
                  const BadgeIcon = badge.icon;
                  return (
                    <div key={check.id} className="compliance-check-card">
                      <div className="check-header">
                        <span className={`status-badge status-${badge.color}`}>
                          <BadgeIcon size={14} />
                          {badge.label}
                        </span>
                        <span className="check-type">{check.check_type}</span>
                      </div>
                      <div className="check-body">
                        <h4>{check.rule_name || 'Vérification'}</h4>
                        <p>{check.rule_code || check.entity_type}</p>
                        {check.checked_at && (
                          <p className="check-date">
                            Vérifié le {format(new Date(check.checked_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            {check.checked_by_name && ` par ${check.checked_by_name}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="compliance-section">
            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spinning" size={32} />
                <p>Chargement...</p>
              </div>
            ) : regulatoryDocuments.length === 0 ? (
              <div className="empty-state">
                <Archive size={48} />
                <p>Aucun document réglementaire trouvé</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Numéro</th>
                      <th>Titre</th>
                      <th>Fichier</th>
                      <th>Taille</th>
                      <th>Date création</th>
                      <th>Archivé le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regulatoryDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.document_type}</td>
                        <td><strong>{doc.document_number}</strong></td>
                        <td>{doc.title}</td>
                        <td>{doc.file_name}</td>
                        <td>{(doc.file_size / 1024).toFixed(2)} Ko</td>
                        <td>{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
                        <td>{doc.archived_at ? format(new Date(doc.archived_at), 'dd/MM/yyyy', { locale: fr }) : '-'}</td>
                        <td>
                          <button className="btn-icon" title="Télécharger">
                            <Download size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BSD Modal */}
      {showSlipModal && (
        <div className="modal-overlay" onClick={() => setShowSlipModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouveau Bordereau de Suivi des Déchets</h2>
              <button className="btn-icon" onClick={() => setShowSlipModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations générales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Type de BSD</label>
                    <select
                      value={slipForm.slip_type || 'BSD'}
                      onChange={(e) => setSlipForm({ ...slipForm, slip_type: e.target.value as any })}
                      required
                    >
                      <option value="BSD">BSD - Bordereau de Suivi des Déchets</option>
                      <option value="BSDD">BSDD - Bordereau de Suivi des Déchets Dangereux</option>
                      <option value="BSDA">BSDA - Bordereau de Suivi des Déchets Amiante</option>
                      <option value="BSDI">BSDI - Bordereau de Suivi des Déchets Inertes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date de collecte</label>
                    <input
                      type="date"
                      value={slipForm.collection_date || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, collection_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>Producteur</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Client producteur</label>
                    <select
                      value={slipForm.producer_id || ''}
                      onChange={(e) => {
                        const customer = customers.find(c => c.id === e.target.value);
                        setSlipForm({
                          ...slipForm,
                          producer_id: e.target.value || undefined,
                          producer_name: customer?.name || slipForm.producer_name
                        });
                      }}
                    >
                      <option value="">Sélectionner un client</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nom producteur</label>
                    <input
                      type="text"
                      value={slipForm.producer_name || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, producer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Adresse</label>
                    <input
                      type="text"
                      value={slipForm.producer_address || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, producer_address: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>SIRET</label>
                    <input
                      type="text"
                      value={slipForm.producer_siret || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, producer_siret: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Transporteur (optionnel)</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Client transporteur</label>
                    <select
                      value={slipForm.transporter_id || ''}
                      onChange={(e) => {
                        const customer = customers.find(c => c.id === e.target.value);
                        setSlipForm({
                          ...slipForm,
                          transporter_id: e.target.value || undefined,
                          transporter_name: customer?.name || slipForm.transporter_name
                        });
                      }}
                    >
                      <option value="">Sélectionner un client</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nom transporteur</label>
                    <input
                      type="text"
                      value={slipForm.transporter_name || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, transporter_name: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Destinataire</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Client destinataire</label>
                    <select
                      value={slipForm.recipient_id || ''}
                      onChange={(e) => {
                        const customer = customers.find(c => c.id === e.target.value);
                        setSlipForm({
                          ...slipForm,
                          recipient_id: e.target.value || undefined,
                          recipient_name: customer?.name || slipForm.recipient_name
                        });
                      }}
                    >
                      <option value="">Sélectionner un client</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nom destinataire</label>
                    <input
                      type="text"
                      value={slipForm.recipient_name || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, recipient_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Déchet</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Code déchet</label>
                    <input
                      type="text"
                      value={slipForm.waste_code || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, waste_code: e.target.value })}
                      placeholder="Ex: 15 01 06"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      value={slipForm.waste_description || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, waste_description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantité</label>
                    <input
                      type="number"
                      step="0.01"
                      value={slipForm.quantity || ''}
                      onChange={(e) => setSlipForm({ ...slipForm, quantity: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unité</label>
                    <select
                      value={slipForm.unit || 'kg'}
                      onChange={(e) => setSlipForm({ ...slipForm, unit: e.target.value })}
                    >
                      <option value="kg">kg</option>
                      <option value="t">tonnes</option>
                      <option value="L">litres</option>
                      <option value="m³">m³</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSlipModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateSlip} disabled={loading}>
                {loading ? 'Création...' : 'Créer le BSD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && (
        <div className="modal-overlay" onClick={() => setShowCertificateModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouveau Certificat de Traitement</h2>
              <button className="btn-icon" onClick={() => setShowCertificateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations client</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Client</label>
                  <select
                    value={certificateForm.customer_id || ''}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      setCertificateForm({
                        ...certificateForm,
                        customer_id: e.target.value || undefined,
                        customer_name: customer?.name || certificateForm.customer_name
                      });
                    }}
                  >
                    <option value="">Sélectionner un client</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                  <div className="form-group">
                    <label>Nom client</label>
                    <input
                      type="text"
                      value={certificateForm.customer_name || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, customer_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Traitement</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Date de traitement</label>
                    <input
                      type="date"
                      value={certificateForm.treatment_date || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, treatment_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Méthode de traitement</label>
                    <input
                      type="text"
                      value={certificateForm.treatment_method || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, treatment_method: e.target.value })}
                      placeholder="Ex: Incinération, Recyclage, Compostage"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Installation de traitement</label>
                    <input
                      type="text"
                      value={certificateForm.treatment_facility || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, treatment_facility: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date d'expiration</label>
                    <input
                      type="date"
                      value={certificateForm.expires_at || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, expires_at: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Déchet traité</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Code déchet</label>
                    <input
                      type="text"
                      value={certificateForm.waste_code || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, waste_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Description déchet</label>
                    <input
                      type="text"
                      value={certificateForm.waste_description || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, waste_description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantité traitée</label>
                    <input
                      type="number"
                      step="0.01"
                      value={certificateForm.quantity_treated || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, quantity_treated: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unité</label>
                    <select
                      value={certificateForm.unit || 'kg'}
                      onChange={(e) => setCertificateForm({ ...certificateForm, unit: e.target.value })}
                    >
                      <option value="kg">kg</option>
                      <option value="t">tonnes</option>
                      <option value="L">litres</option>
                      <option value="m³">m³</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Résultat du traitement</label>
                    <textarea
                      value={certificateForm.treatment_result || ''}
                      onChange={(e) => setCertificateForm({ ...certificateForm, treatment_result: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCertificateModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateCertificate} disabled={loading}>
                {loading ? 'Création...' : 'Créer le Certificat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {showTraceabilityModal && (
        <div className="modal-overlay" onClick={() => setShowTraceabilityModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ajouter un Maillon de Traçabilité</h2>
              <button className="btn-icon" onClick={() => setShowTraceabilityModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Origine</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Type d'origine</label>
                  <select
                    value={traceabilityForm.origin_type || ''}
                    onChange={(e) => setTraceabilityForm({ ...traceabilityForm, origin_type: e.target.value as any })}
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="collection">Collecte</option>
                    <option value="customer">Client</option>
                    <option value="warehouse">Entrepôt</option>
                    <option value="treatment">Traitement</option>
                    <option value="valorization">Valorisation</option>
                  </select>
                </div>
                  <div className="form-group">
                    <label>Nom origine</label>
                    <input
                      type="text"
                      value={traceabilityForm.origin_name || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, origin_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Destination</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Type de destination</label>
                    <select
                      value={traceabilityForm.destination_type || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, destination_type: e.target.value as any })}
                      required
                    >
                      <option value="">Sélectionner</option>
                      <option value="warehouse">Entrepôt</option>
                      <option value="treatment">Traitement</option>
                      <option value="valorization">Valorisation</option>
                      <option value="disposal">Élimination</option>
                      <option value="customer">Client</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nom destination</label>
                    <input
                      type="text"
                      value={traceabilityForm.destination_name || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, destination_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Transaction</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Type de transaction</label>
                    <select
                      value={traceabilityForm.transaction_type || 'transfer'}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, transaction_type: e.target.value as any })}
                      required
                    >
                      <option value="collection">Collecte</option>
                      <option value="transfer">Transfert</option>
                      <option value="treatment">Traitement</option>
                      <option value="valorization">Valorisation</option>
                      <option value="disposal">Élimination</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date transaction</label>
                    <input
                      type="date"
                      value={traceabilityForm.transaction_date || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantité</label>
                    <input
                      type="number"
                      step="0.01"
                      value={traceabilityForm.quantity || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, quantity: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unité</label>
                    <select
                      value={traceabilityForm.unit || 'kg'}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, unit: e.target.value })}
                    >
                      <option value="kg">kg</option>
                      <option value="t">tonnes</option>
                      <option value="L">litres</option>
                      <option value="m³">m³</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={traceabilityForm.notes || ''}
                      onChange={(e) => setTraceabilityForm({ ...traceabilityForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTraceabilityModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateTraceabilityLink} disabled={loading}>
                {loading ? 'Création...' : 'Créer le Maillon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

