import { useState, useEffect, useMemo } from 'react';
import { Api, Supplier, SupplierEvaluation, SupplierOrder, SupplierInvoice, TenderCall, TenderOffer } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  Users,
  Star,
  ShoppingCart,
  FileText,
  Gavel,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Loader
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'suppliers' | 'evaluations' | 'orders' | 'invoices' | 'tenders';

export const SuppliersPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('suppliers');
  const [loading, setLoading] = useState(false);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    supplier_code: '',
    name: '',
    supplier_type: 'other' as 'transporter' | 'service_provider' | 'material_supplier' | 'equipment_supplier' | 'other',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'France',
    siret: '',
    vat_number: '',
    payment_terms: '',
    notes: ''
  });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>('');

  // Evaluations state
  const [selectedSupplierForEval, setSelectedSupplierForEval] = useState<Supplier | null>(null);
  const [evaluations, setEvaluations] = useState<SupplierEvaluation[]>([]);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluationForm, setEvaluationForm] = useState({
    evaluation_date: '',
    quality_score: '',
    delivery_time_score: '',
    price_score: '',
    communication_score: '',
    comments: ''
  });

  // Orders state
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    supplier_id: '',
    order_date: '',
    expected_delivery_date: '',
    order_type: 'material' as 'material' | 'service' | 'transport' | 'equipment' | 'other',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    notes: ''
  });
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<SupplierOrder | null>(null);
  const [receptionForm, setReceptionForm] = useState({
    reception_date: '',
    reception_status: 'partial' as 'partial' | 'complete' | 'rejected',
    received_items: [{ description: '', quantity_received: 0 }],
    quality_check_passed: true,
    quality_check_notes: '',
    notes: ''
  });

  // Invoices state
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    supplier_id: '',
    order_id: '',
    invoice_date: '',
    due_date: '',
    subtotal: '',
    tax_amount: '',
    total_amount: '',
    currency: 'EUR',
    notes: ''
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: '',
    payment_method: '',
    payment_reference: ''
  });

  // Tenders state
  const [tenders, setTenders] = useState<TenderCall[]>([]);
  const [offers, setOffers] = useState<TenderOffer[]>([]);
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedTender, setSelectedTender] = useState<TenderCall | null>(null);
  const [tenderForm, setTenderForm] = useState({
    title: '',
    description: '',
    tender_type: 'material' as 'material' | 'service' | 'transport' | 'equipment' | 'other',
    start_date: '',
    end_date: '',
    submission_deadline: ''
  });
  const [offerForm, setOfferForm] = useState({
    supplier_id: '',
    offer_amount: '',
    currency: 'EUR',
    delivery_time_days: '',
    validity_days: ''
  });

  useEffect(() => {
    loadSuppliers();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'invoices') loadInvoices();
    if (activeTab === 'tenders') loadTenders();
  }, [activeTab]);

  const loadSuppliers = async () => {
    try {
      const data = await Api.fetchSuppliers({
        supplier_type: supplierTypeFilter || undefined,
        search: supplierSearch || undefined
      });
      setSuppliers(data);
    } catch (error: any) {
      console.error('Erreur chargement fournisseurs:', error);
    }
  };

  const loadEvaluations = async (supplierId: string) => {
    try {
      const data = await Api.fetchSupplierEvaluations(supplierId);
      setEvaluations(data);
    } catch (error: any) {
      console.error('Erreur chargement évaluations:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await Api.fetchSupplierOrders();
      setOrders(data);
    } catch (error: any) {
      console.error('Erreur chargement commandes:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await Api.fetchSupplierInvoices();
      setInvoices(data);
    } catch (error: any) {
      console.error('Erreur chargement factures:', error);
    }
  };

  const loadTenders = async () => {
    try {
      const data = await Api.fetchTenderCalls();
      setTenders(data);
    } catch (error: any) {
      console.error('Erreur chargement appels d\'offres:', error);
    }
  };

  const loadTenderOffers = async (tenderId: string) => {
    try {
      const data = await Api.fetchTenderOffers(tenderId);
      setOffers(data);
    } catch (error: any) {
      console.error('Erreur chargement offres:', error);
    }
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.supplier_code || !supplierForm.name) {
      toast.error('Code et nom requis');
      return;
    }

    setLoading(true);
    try {
      if (editingSupplier) {
        await Api.updateSupplier(editingSupplier.id, supplierForm);
        toast.success('Fournisseur mis à jour');
      } else {
        await Api.createSupplier(supplierForm);
        toast.success('Fournisseur créé');
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({
        supplier_code: '',
        name: '',
        supplier_type: 'other',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'France',
        siret: '',
        vat_number: '',
        payment_terms: '',
        notes: ''
      });
      loadSuppliers();
    } catch (error: any) {
      console.error('Erreur sauvegarde fournisseur:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;

    try {
      await Api.deleteSupplier(id);
      toast.success('Fournisseur supprimé');
      loadSuppliers();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleOpenEvaluation = async (supplier: Supplier) => {
    setSelectedSupplierForEval(supplier);
    await loadEvaluations(supplier.id);
    setShowEvaluationModal(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedSupplierForEval) return;

    setLoading(true);
    try {
      await Api.createSupplierEvaluation(selectedSupplierForEval.id, {
        evaluation_date: evaluationForm.evaluation_date || undefined,
        quality_score: evaluationForm.quality_score ? parseInt(evaluationForm.quality_score) : undefined,
        delivery_time_score: evaluationForm.delivery_time_score ? parseInt(evaluationForm.delivery_time_score) : undefined,
        price_score: evaluationForm.price_score ? parseInt(evaluationForm.price_score) : undefined,
        communication_score: evaluationForm.communication_score ? parseInt(evaluationForm.communication_score) : undefined,
        comments: evaluationForm.comments || undefined
      });
      toast.success('Évaluation créée');
      setShowEvaluationModal(false);
      setEvaluationForm({
        evaluation_date: '',
        quality_score: '',
        delivery_time_score: '',
        price_score: '',
        communication_score: '',
        comments: ''
      });
      loadEvaluations(selectedSupplierForEval.id);
      loadSuppliers();
    } catch (error: any) {
      console.error('Erreur création évaluation:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!orderForm.supplier_id || orderForm.items.length === 0) {
      toast.error('Fournisseur et articles requis');
      return;
    }

    setLoading(true);
    try {
      await Api.createSupplierOrder({
        supplier_id: orderForm.supplier_id,
        order_date: orderForm.order_date || undefined,
        expected_delivery_date: orderForm.expected_delivery_date || undefined,
        order_type: orderForm.order_type,
        items: orderForm.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        notes: orderForm.notes || undefined
      });
      toast.success('Commande créée');
      setShowOrderModal(false);
      setOrderForm({
        supplier_id: '',
        order_date: '',
        expected_delivery_date: '',
        order_type: 'material',
        items: [{ description: '', quantity: 1, unit_price: 0 }],
        notes: ''
      });
      loadOrders();
      loadSuppliers();
    } catch (error: any) {
      console.error('Erreur création commande:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveOrder = async () => {
    if (!receivingOrder) return;

    setLoading(true);
    try {
      await Api.receiveSupplierOrder(receivingOrder.id, {
        reception_date: receptionForm.reception_date || undefined,
        reception_status: receptionForm.reception_status,
        received_items: receptionForm.received_items,
        quality_check_passed: receptionForm.quality_check_passed,
        quality_check_notes: receptionForm.quality_check_notes || undefined,
        notes: receptionForm.notes || undefined
      });
      toast.success('Réception enregistrée');
      setShowReceiveModal(false);
      setReceivingOrder(null);
      loadOrders();
    } catch (error: any) {
      console.error('Erreur enregistrement réception:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceForm.invoice_number || !invoiceForm.supplier_id || !invoiceForm.total_amount) {
      toast.error('Champs requis manquants');
      return;
    }

    setLoading(true);
    try {
      await Api.createSupplierInvoice({
        invoice_number: invoiceForm.invoice_number,
        supplier_id: invoiceForm.supplier_id,
        order_id: invoiceForm.order_id || undefined,
        invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date,
        subtotal: invoiceForm.subtotal ? parseFloat(invoiceForm.subtotal) : undefined,
        tax_amount: invoiceForm.tax_amount ? parseFloat(invoiceForm.tax_amount) : undefined,
        total_amount: parseFloat(invoiceForm.total_amount),
        currency: invoiceForm.currency,
        notes: invoiceForm.notes || undefined
      });
      toast.success('Facture créée');
      setShowInvoiceModal(false);
      setInvoiceForm({
        invoice_number: '',
        supplier_id: '',
        order_id: '',
        invoice_date: '',
        due_date: '',
        subtotal: '',
        tax_amount: '',
        total_amount: '',
        currency: 'EUR',
        notes: ''
      });
      loadInvoices();
    } catch (error: any) {
      console.error('Erreur création facture:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!payingInvoice) return;

    setLoading(true);
    try {
      await Api.paySupplierInvoice(payingInvoice.id, {
        payment_date: paymentForm.payment_date || undefined,
        payment_method: paymentForm.payment_method || undefined,
        payment_reference: paymentForm.payment_reference || undefined
      });
      toast.success('Facture marquée comme payée');
      setShowPayModal(false);
      setPayingInvoice(null);
      loadInvoices();
    } catch (error: any) {
      console.error('Erreur paiement facture:', error);
      toast.error(error.message || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTender = async () => {
    if (!tenderForm.title || !tenderForm.start_date || !tenderForm.end_date || !tenderForm.submission_deadline) {
      toast.error('Champs requis manquants');
      return;
    }

    setLoading(true);
    try {
      await Api.createTenderCall(tenderForm);
      toast.success('Appel d\'offres créé');
      setShowTenderModal(false);
      setTenderForm({
        title: '',
        description: '',
        tender_type: 'material',
        start_date: '',
        end_date: '',
        submission_deadline: ''
      });
      loadTenders();
    } catch (error: any) {
      console.error('Erreur création appel d\'offres:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!selectedTender || !offerForm.supplier_id || !offerForm.offer_amount) {
      toast.error('Fournisseur et montant requis');
      return;
    }

    setLoading(true);
    try {
      await Api.submitTenderOffer(selectedTender.id, {
        supplier_id: offerForm.supplier_id,
        offer_amount: parseFloat(offerForm.offer_amount),
        currency: offerForm.currency,
        delivery_time_days: offerForm.delivery_time_days ? parseInt(offerForm.delivery_time_days) : undefined,
        validity_days: offerForm.validity_days ? parseInt(offerForm.validity_days) : undefined
      });
      toast.success('Offre soumise');
      setShowOfferModal(false);
      setSelectedTender(null);
      if (selectedTender) await loadTenderOffers(selectedTender.id);
    } catch (error: any) {
      console.error('Erreur soumission offre:', error);
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTenderOffers = async (tender: TenderCall) => {
    setSelectedTender(tender);
    await loadTenderOffers(tender.id);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      supplier_code: supplier.supplier_code,
      name: supplier.name,
      supplier_type: supplier.supplier_type,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country,
      siret: supplier.siret || '',
      vat_number: supplier.vat_number || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || ''
    });
    setShowSupplierModal(true);
  };

  const openReceiveOrder = (order: SupplierOrder) => {
    setReceivingOrder(order);
    setReceptionForm({
      reception_date: '',
      reception_status: 'partial',
      received_items: order.items.map(item => ({
        description: item.description,
        quantity_received: item.quantity
      })),
      quality_check_passed: true,
      quality_check_notes: '',
      notes: ''
    });
    setShowReceiveModal(true);
  };

  const openPayInvoice = (invoice: SupplierInvoice) => {
    setPayingInvoice(invoice);
    setPaymentForm({
      payment_date: '',
      payment_method: '',
      payment_reference: ''
    });
    setShowPayModal(true);
  };

  const addOrderItem = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeOrderItem = (index: number) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== index)
    });
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (supplierSearch && !s.name.toLowerCase().includes(supplierSearch.toLowerCase()) &&
          !s.supplier_code.toLowerCase().includes(supplierSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [suppliers, supplierSearch]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      'draft': { color: 'status-gray', icon: Clock },
      'sent': { color: 'status-blue', icon: Clock },
      'confirmed': { color: 'status-blue', icon: CheckCircle },
      'in_progress': { color: 'status-yellow', icon: Clock },
      'delivered': { color: 'status-green', icon: CheckCircle },
      'completed': { color: 'status-green', icon: CheckCircle },
      'cancelled': { color: 'status-red', icon: XCircle },
      'pending': { color: 'status-yellow', icon: Clock },
      'paid': { color: 'status-green', icon: CheckCircle },
      'overdue': { color: 'status-red', icon: XCircle },
      'published': { color: 'status-blue', icon: CheckCircle },
      'closed': { color: 'status-gray', icon: XCircle },
      'awarded': { color: 'status-green', icon: CheckCircle }
    };
    return badges[status] || { color: 'status-gray', icon: Clock };
  };

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h1>Gestion des Fournisseurs</h1>
          <p>Gérez vos fournisseurs, commandes, factures et appels d'offres</p>
        </div>
      </div>

      <div className="suppliers-tabs">
        <button
          className={activeTab === 'suppliers' ? 'active' : ''}
          onClick={() => setActiveTab('suppliers')}
        >
          <Users size={18} />
          Fournisseurs
        </button>
        <button
          className={activeTab === 'evaluations' ? 'active' : ''}
          onClick={() => setActiveTab('evaluations')}
        >
          <Star size={18} />
          Évaluations
        </button>
        <button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={18} />
          Commandes
        </button>
        <button
          className={activeTab === 'invoices' ? 'active' : ''}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={18} />
          Factures
        </button>
        <button
          className={activeTab === 'tenders' ? 'active' : ''}
          onClick={() => setActiveTab('tenders')}
        >
          <Gavel size={18} />
          Appels d'Offres
        </button>
      </div>

      <div className="suppliers-content">
        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div className="suppliers-section">
            <div className="section-header">
              <div>
                <h2>Fournisseurs</h2>
                <p>Gérez votre base de données de fournisseurs</p>
              </div>
              <button className="btn-primary" onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({
                  supplier_code: '',
                  name: '',
                  supplier_type: 'other',
                  contact_name: '',
                  email: '',
                  phone: '',
                  address: '',
                  city: '',
                  postal_code: '',
                  country: 'France',
                  siret: '',
                  vat_number: '',
                  payment_terms: '',
                  notes: ''
                });
                setShowSupplierModal(true);
              }}>
                <Plus size={18} />
                Nouveau Fournisseur
              </button>
            </div>

            <div className="filters-bar">
              <div className="search-bar">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un fournisseur..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                />
              </div>
              <select
                value={supplierTypeFilter}
                onChange={(e) => {
                  setSupplierTypeFilter(e.target.value);
                  loadSuppliers();
                }}
              >
                <option value="">Tous les types</option>
                <option value="transporter">Transporteur</option>
                <option value="service_provider">Prestataire</option>
                <option value="material_supplier">Fournisseur de matières</option>
                <option value="equipment_supplier">Fournisseur d'équipements</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div className="suppliers-grid">
              {filteredSuppliers.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} />
                  <p>Aucun fournisseur trouvé</p>
                </div>
              ) : (
                filteredSuppliers.map(supplier => (
                  <div key={supplier.id} className="supplier-card">
                    <div className="supplier-header">
                      <div>
                        <h3>{supplier.name}</h3>
                        <p className="supplier-code">{supplier.supplier_code}</p>
                      </div>
                      <div className="supplier-rating">
                        {supplier.average_rating !== null && supplier.average_rating !== undefined && (
                          <div className="rating">
                            <Star size={16} fill="#fbbf24" color="#fbbf24" />
                            <span>{Number(supplier.average_rating).toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="supplier-info">
                      <p className="supplier-type">{supplier.supplier_type}</p>
                      {supplier.email && <p>{supplier.email}</p>}
                      {supplier.phone && <p>{supplier.phone}</p>}
                      {supplier.city && <p>{supplier.city}</p>}
                    </div>
                    <div className="supplier-stats">
                      <div className="stat">
                        <span className="stat-label">Commandes</span>
                        <span className="stat-value">{supplier.total_orders || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Valeur totale</span>
                        <span className="stat-value">{supplier.total_value.toLocaleString()} €</span>
                      </div>
                    </div>
                    <div className="supplier-actions">
                      <button className="btn-icon" onClick={() => handleOpenEvaluation(supplier)}>
                        <Star size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => openEditSupplier(supplier)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn-icon-danger" onClick={() => handleDeleteSupplier(supplier.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Evaluations Tab */}
        {activeTab === 'evaluations' && selectedSupplierForEval && (
          <div className="evaluations-section">
            <div className="section-header">
              <div>
                <h2>Évaluations - {selectedSupplierForEval.name}</h2>
                <p>Historique des évaluations de ce fournisseur</p>
              </div>
              <button className="btn-primary" onClick={() => setShowEvaluationModal(true)}>
                <Plus size={18} />
                Nouvelle Évaluation
              </button>
            </div>

            <div className="evaluations-list">
              {evaluations.length === 0 ? (
                <div className="empty-state">
                  <Star size={48} />
                  <p>Aucune évaluation disponible</p>
                </div>
              ) : (
                evaluations.map(evaluation => (
                  <div key={evaluation.id} className="evaluation-card">
                    <div className="evaluation-header">
                      <span className="evaluation-date">
                        {format(new Date(evaluation.evaluation_date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                      {evaluation.overall_score !== null && (
                        <div className="evaluation-score">
                          <Star size={16} fill="#fbbf24" color="#fbbf24" />
                          <span>{evaluation.overall_score.toFixed(1)}/10</span>
                        </div>
                      )}
                    </div>
                    <div className="evaluation-scores">
                      {evaluation.quality_score !== null && (
                        <div className="score-item">
                          <span>Qualité</span>
                          <span>{evaluation.quality_score}/10</span>
                        </div>
                      )}
                      {evaluation.delivery_time_score !== null && (
                        <div className="score-item">
                          <span>Délais</span>
                          <span>{evaluation.delivery_time_score}/10</span>
                        </div>
                      )}
                      {evaluation.price_score !== null && (
                        <div className="score-item">
                          <span>Prix</span>
                          <span>{evaluation.price_score}/10</span>
                        </div>
                      )}
                      {evaluation.communication_score !== null && (
                        <div className="score-item">
                          <span>Communication</span>
                          <span>{evaluation.communication_score}/10</span>
                        </div>
                      )}
                    </div>
                    {evaluation.comments && <p className="evaluation-comments">{evaluation.comments}</p>}
                    {evaluation.evaluated_by_name && (
                      <p className="evaluation-author">Par {evaluation.evaluated_by_name}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="orders-section">
            <div className="section-header">
              <div>
                <h2>Commandes Fournisseurs</h2>
                <p>Gérez vos commandes et réceptions</p>
              </div>
              <button className="btn-primary" onClick={() => setShowOrderModal(true)}>
                <Plus size={18} />
                Nouvelle Commande
              </button>
            </div>

            <div className="orders-list">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={48} />
                  <p>Aucune commande disponible</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>N° Commande</th>
                      <th>Fournisseur</th>
                      <th>Date</th>
                      <th>Livraison prévue</th>
                      <th>Montant</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const badge = getStatusBadge(order.order_status);
                      const StatusIcon = badge.icon;
                      return (
                        <tr key={order.id}>
                          <td>{order.order_number}</td>
                          <td>{order.supplier_name}</td>
                          <td>{format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })}</td>
                          <td>{order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy', { locale: fr }) : '-'}</td>
                          <td>{order.total_amount.toLocaleString()} {order.currency}</td>
                          <td>
                            <span className={`status-badge ${badge.color}`}>
                              <StatusIcon size={12} />
                              {order.order_status}
                            </span>
                          </td>
                          <td>
                            {order.order_status !== 'completed' && order.order_status !== 'cancelled' && (
                              <button className="btn-icon" onClick={() => openReceiveOrder(order)}>
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="invoices-section">
            <div className="section-header">
              <div>
                <h2>Factures Fournisseurs</h2>
                <p>Suivez vos factures et paiements</p>
              </div>
              <button className="btn-primary" onClick={() => setShowInvoiceModal(true)}>
                <Plus size={18} />
                Nouvelle Facture
              </button>
            </div>

            <div className="invoices-list">
              {invoices.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <p>Aucune facture disponible</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>N° Facture</th>
                      <th>Fournisseur</th>
                      <th>Date</th>
                      <th>Échéance</th>
                      <th>Montant</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(invoice => {
                      const badge = getStatusBadge(invoice.invoice_status);
                      const StatusIcon = badge.icon;
                      return (
                        <tr key={invoice.id}>
                          <td>{invoice.invoice_number}</td>
                          <td>{invoice.supplier_name}</td>
                          <td>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}</td>
                          <td>{format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}</td>
                          <td>{invoice.total_amount.toLocaleString()} {invoice.currency}</td>
                          <td>
                            <span className={`status-badge ${badge.color}`}>
                              <StatusIcon size={12} />
                              {invoice.invoice_status}
                            </span>
                          </td>
                          <td>
                            {invoice.invoice_status === 'pending' && (
                              <button className="btn-icon" onClick={() => openPayInvoice(invoice)}>
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tenders Tab */}
        {activeTab === 'tenders' && (
          <div className="tenders-section">
            <div className="section-header">
              <div>
                <h2>Appels d'Offres</h2>
                <p>Gérez vos appels d'offres et comparez les offres</p>
              </div>
              <button className="btn-primary" onClick={() => setShowTenderModal(true)}>
                <Plus size={18} />
                Nouvel Appel d'Offres
              </button>
            </div>

            {selectedTender ? (
              <div className="tender-offers-view">
                <div className="tender-header">
                  <button className="btn-secondary" onClick={() => {
                    setSelectedTender(null);
                    setOffers([]);
                  }}>
                    ← Retour
                  </button>
                  <div>
                    <h3>{selectedTender.title}</h3>
                    <p>{selectedTender.description}</p>
                  </div>
                  <button className="btn-primary" onClick={() => setShowOfferModal(true)}>
                    <Plus size={18} />
                    Soumettre une Offre
                  </button>
                </div>

                <div className="offers-comparison">
                  <h4>Comparaison des Offres</h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fournisseur</th>
                        <th>Montant</th>
                        <th>Délai (jours)</th>
                        <th>Validité (jours)</th>
                        <th>Score</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map(offer => {
                        const badge = getStatusBadge(offer.offer_status);
                        const StatusIcon = badge.icon;
                        return (
                          <tr key={offer.id}>
                            <td>{offer.supplier_name}</td>
                            <td>{offer.offer_amount.toLocaleString()} {offer.currency}</td>
                            <td>{offer.delivery_time_days || '-'}</td>
                            <td>{offer.validity_days || '-'}</td>
                            <td>{offer.evaluation_score !== null ? offer.evaluation_score.toFixed(1) : '-'}</td>
                            <td>
                              <span className={`status-badge ${badge.color}`}>
                                <StatusIcon size={12} />
                                {offer.offer_status}
                              </span>
                            </td>
                            <td>
                              {offer.offer_status === 'submitted' && (
                                <button className="btn-icon" onClick={async () => {
                                  try {
                                    await Api.evaluateTenderOffer(offer.id, {
                                      offer_status: 'accepted',
                                      evaluation_score: 8.5
                                    });
                                    toast.success('Offre acceptée');
                                    await loadTenderOffers(selectedTender.id);
                                  } catch (error: any) {
                                    toast.error(error.message || 'Erreur');
                                  }
                                }}>
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="tenders-list">
                {tenders.length === 0 ? (
                  <div className="empty-state">
                    <Gavel size={48} />
                    <p>Aucun appel d'offres disponible</p>
                  </div>
                ) : (
                  <div className="tenders-grid">
                    {tenders.map(tender => {
                      const badge = getStatusBadge(tender.status);
                      const StatusIcon = badge.icon;
                      return (
                        <div key={tender.id} className="tender-card">
                          <div className="tender-header">
                            <h3>{tender.title}</h3>
                            <span className={`status-badge ${badge.color}`}>
                              <StatusIcon size={12} />
                              {tender.status}
                            </span>
                          </div>
                          <p className="tender-type">{tender.tender_type}</p>
                          {tender.description && <p>{tender.description}</p>}
                          <div className="tender-dates">
                            <p>Début: {format(new Date(tender.start_date), 'dd/MM/yyyy', { locale: fr })}</p>
                            <p>Fin: {format(new Date(tender.end_date), 'dd/MM/yyyy', { locale: fr })}</p>
                            <p>Échéance: {format(new Date(tender.submission_deadline), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                          </div>
                          <div className="tender-footer">
                            <span>{tender.offer_count || 0} offre(s)</span>
                            <button className="btn-secondary" onClick={() => handleViewTenderOffers(tender)}>
                              Voir les offres
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}</h2>
              <button className="btn-icon" onClick={() => setShowSupplierModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations Générales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Code Fournisseur <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={supplierForm.supplier_code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, supplier_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Nom <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Type <span className="required-indicator">*</span></label>
                    <select
                      value={supplierForm.supplier_type}
                      onChange={(e) => setSupplierForm({ ...supplierForm, supplier_type: e.target.value as any })}
                    >
                      <option value="transporter">Transporteur</option>
                      <option value="service_provider">Prestataire</option>
                      <option value="material_supplier">Fournisseur de matières</option>
                      <option value="equipment_supplier">Fournisseur d'équipements</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Contact</label>
                    <input
                      type="text"
                      value={supplierForm.contact_name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Coordonnées</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input
                      type="tel"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Adresse</label>
                    <input
                      type="text"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ville</label>
                    <input
                      type="text"
                      value={supplierForm.city}
                      onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Code Postal</label>
                    <input
                      type="text"
                      value={supplierForm.postal_code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, postal_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Informations Légales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>SIRET</label>
                    <input
                      type="text"
                      value={supplierForm.siret}
                      onChange={(e) => setSupplierForm({ ...supplierForm, siret: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>N° TVA</label>
                    <input
                      type="text"
                      value={supplierForm.vat_number}
                      onChange={(e) => setSupplierForm({ ...supplierForm, vat_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSupplierModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveSupplier} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      {showEvaluationModal && selectedSupplierForEval && (
        <div className="modal-overlay" onClick={() => setShowEvaluationModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle Évaluation - {selectedSupplierForEval.name}</h2>
              <button className="btn-icon" onClick={() => setShowEvaluationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations d'Évaluation</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Date d'évaluation</label>
                    <input
                      type="date"
                      value={evaluationForm.evaluation_date}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, evaluation_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Critères d'Évaluation</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Qualité (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={evaluationForm.quality_score}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, quality_score: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Délais (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={evaluationForm.delivery_time_score}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, delivery_time_score: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Prix (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={evaluationForm.price_score}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, price_score: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Communication (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={evaluationForm.communication_score}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, communication_score: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Commentaires</label>
                    <textarea
                      value={evaluationForm.comments}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, comments: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEvaluationModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveEvaluation} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle Commande</h2>
              <button className="btn-icon" onClick={() => setShowOrderModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations de Commande</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Fournisseur <span className="required-indicator">*</span></label>
                    <select
                      value={orderForm.supplier_id}
                      onChange={(e) => setOrderForm({ ...orderForm, supplier_id: e.target.value })}
                      required
                    >
                      <option value="">Sélectionner</option>
                      {suppliers.filter(s => s.is_active).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date de commande</label>
                    <input
                      type="date"
                      value={orderForm.order_date}
                      onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Livraison prévue</label>
                    <input
                      type="date"
                      value={orderForm.expected_delivery_date}
                      onChange={(e) => setOrderForm({ ...orderForm, expected_delivery_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={orderForm.order_type}
                      onChange={(e) => setOrderForm({ ...orderForm, order_type: e.target.value as any })}
                    >
                      <option value="material">Matière</option>
                      <option value="service">Service</option>
                      <option value="transport">Transport</option>
                      <option value="equipment">Équipement</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Articles</h3>
                {orderForm.items.map((item, index) => (
                  <div key={index} className="order-item-row">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...orderForm.items];
                        updated[index].description = e.target.value;
                        setOrderForm({ ...orderForm, items: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Quantité"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...orderForm.items];
                        updated[index].quantity = parseFloat(e.target.value) || 0;
                        setOrderForm({ ...orderForm, items: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Prix unitaire"
                      value={item.unit_price}
                      onChange={(e) => {
                        const updated = [...orderForm.items];
                        updated[index].unit_price = parseFloat(e.target.value) || 0;
                        setOrderForm({ ...orderForm, items: updated });
                      }}
                    />
                    <button className="btn-icon-danger" onClick={() => removeOrderItem(index)}>
                      ×
                    </button>
                  </div>
                ))}
                <button className="btn-secondary" onClick={addOrderItem}>
                  Ajouter un article
                </button>
              </div>

              <div className="form-section">
                <h3>Notes</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowOrderModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveOrder} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Order Modal */}
      {showReceiveModal && receivingOrder && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enregistrer la Réception - {receivingOrder.order_number}</h2>
              <button className="btn-icon" onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations de Réception</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Date de réception</label>
                    <input
                      type="date"
                      value={receptionForm.reception_date}
                      onChange={(e) => setReceptionForm({ ...receptionForm, reception_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Statut</label>
                    <select
                      value={receptionForm.reception_status}
                      onChange={(e) => setReceptionForm({ ...receptionForm, reception_status: e.target.value as any })}
                    >
                      <option value="partial">Partielle</option>
                      <option value="complete">Complète</option>
                      <option value="rejected">Rejetée</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Articles Reçus</h3>
                {receptionForm.received_items.map((item, index) => (
                  <div key={index} className="reception-item-row">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      readOnly
                    />
                    <input
                      type="number"
                      placeholder="Quantité reçue"
                      value={item.quantity_received}
                      onChange={(e) => {
                        const updated = [...receptionForm.received_items];
                        updated[index].quantity_received = parseFloat(e.target.value) || 0;
                        setReceptionForm({ ...receptionForm, received_items: updated });
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="form-section">
                <h3>Contrôle Qualité</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Contrôle qualité réussi</label>
                    <select
                      value={receptionForm.quality_check_passed ? 'yes' : 'no'}
                      onChange={(e) => setReceptionForm({ ...receptionForm, quality_check_passed: e.target.value === 'yes' })}
                    >
                      <option value="yes">Oui</option>
                      <option value="no">Non</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Notes contrôle qualité</label>
                    <textarea
                      value={receptionForm.quality_check_notes}
                      onChange={(e) => setReceptionForm({ ...receptionForm, quality_check_notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={receptionForm.notes}
                      onChange={(e) => setReceptionForm({ ...receptionForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowReceiveModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleReceiveOrder} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle Facture</h2>
              <button className="btn-icon" onClick={() => setShowInvoiceModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations de Facture</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>N° Facture <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={invoiceForm.invoice_number}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Fournisseur <span className="required-indicator">*</span></label>
                    <select
                      value={invoiceForm.supplier_id}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, supplier_id: e.target.value })}
                      required
                    >
                      <option value="">Sélectionner</option>
                      {suppliers.filter(s => s.is_active).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Commande (optionnel)</label>
                    <select
                      value={invoiceForm.order_id}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, order_id: e.target.value })}
                    >
                      <option value="">Aucune</option>
                      {orders.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.order_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date facture <span className="required-indicator">*</span></label>
                    <input
                      type="date"
                      value={invoiceForm.invoice_date}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date échéance <span className="required-indicator">*</span></label>
                    <input
                      type="date"
                      value={invoiceForm.due_date}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Devise</label>
                    <select
                      value={invoiceForm.currency}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value })}
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Montants</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Sous-total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.subtotal}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>TVA</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.tax_amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Total <span className="required-indicator">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.total_amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, total_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowInvoiceModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveInvoice} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && payingInvoice && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payer la Facture - {payingInvoice.invoice_number}</h2>
              <button className="btn-icon" onClick={() => setShowPayModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations de Paiement</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Date de paiement</label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Méthode de paiement</label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    >
                      <option value="">Sélectionner</option>
                      <option value="bank_transfer">Virement</option>
                      <option value="check">Chèque</option>
                      <option value="card">Carte</option>
                      <option value="cash">Espèces</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Référence de paiement</label>
                    <input
                      type="text"
                      value={paymentForm.payment_reference}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPayModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handlePayInvoice} disabled={loading}>
                {loading ? 'Paiement...' : 'Marquer comme Payé'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tender Modal */}
      {showTenderModal && (
        <div className="modal-overlay" onClick={() => setShowTenderModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvel Appel d'Offres</h2>
              <button className="btn-icon" onClick={() => setShowTenderModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations Générales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Titre <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={tenderForm.title}
                      onChange={(e) => setTenderForm({ ...tenderForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Type <span className="required-indicator">*</span></label>
                    <select
                      value={tenderForm.tender_type}
                      onChange={(e) => setTenderForm({ ...tenderForm, tender_type: e.target.value as any })}
                    >
                      <option value="material">Matière</option>
                      <option value="service">Service</option>
                      <option value="transport">Transport</option>
                      <option value="equipment">Équipement</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      value={tenderForm.description}
                      onChange={(e) => setTenderForm({ ...tenderForm, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Dates</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Date début <span className="required-indicator">*</span></label>
                    <input
                      type="date"
                      value={tenderForm.start_date}
                      onChange={(e) => setTenderForm({ ...tenderForm, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date fin <span className="required-indicator">*</span></label>
                    <input
                      type="date"
                      value={tenderForm.end_date}
                      onChange={(e) => setTenderForm({ ...tenderForm, end_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Échéance soumission <span className="required-indicator">*</span></label>
                    <input
                      type="datetime-local"
                      value={tenderForm.submission_deadline}
                      onChange={(e) => setTenderForm({ ...tenderForm, submission_deadline: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTenderModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveTender} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedTender && (
        <div className="modal-overlay" onClick={() => setShowOfferModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Soumettre une Offre - {selectedTender.title}</h2>
              <button className="btn-icon" onClick={() => setShowOfferModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations de l'Offre</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Fournisseur <span className="required-indicator">*</span></label>
                    <select
                      value={offerForm.supplier_id}
                      onChange={(e) => setOfferForm({ ...offerForm, supplier_id: e.target.value })}
                      required
                    >
                      <option value="">Sélectionner</option>
                      {suppliers.filter(s => s.is_active).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Montant <span className="required-indicator">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={offerForm.offer_amount}
                      onChange={(e) => setOfferForm({ ...offerForm, offer_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Devise</label>
                    <select
                      value={offerForm.currency}
                      onChange={(e) => setOfferForm({ ...offerForm, currency: e.target.value })}
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Conditions</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Délai de livraison (jours)</label>
                    <input
                      type="number"
                      value={offerForm.delivery_time_days}
                      onChange={(e) => setOfferForm({ ...offerForm, delivery_time_days: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Validité (jours)</label>
                    <input
                      type="number"
                      value={offerForm.validity_days}
                      onChange={(e) => setOfferForm({ ...offerForm, validity_days: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowOfferModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSubmitOffer} disabled={loading}>
                {loading ? 'Soumission...' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

