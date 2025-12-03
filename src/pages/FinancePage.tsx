import { useEffect, useState } from 'react';
import { Plus, FileText, Search, Loader2, Edit2, Trash2, Eye, DollarSign, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name_full: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_vat_number: string | null;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
  total_amount: number;
  total_tax: number;
  currency: string;
  payment_terms: string | null;
  notes: string | null;
  reference: string | null;
  total_paid: number;
  remaining_amount: number;
  created_at: string;
};

type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_vat_number: string | null;
  issue_date: string;
  valid_until: string;
  status: string;
  total_amount: number;
  total_tax: number;
  currency: string;
  notes: string | null;
  reference: string | null;
  created_at: string;
};

type InvoiceLine = {
  id: string;
  invoice_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  material_id: string | null;
};

type QuoteLine = {
  id: string;
  quote_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  material_id: string | null;
};

type InvoiceDetail = Invoice & {
  lines: InvoiceLine[];
  payments: any[];
};

type QuoteDetail = Quote & {
  lines: QuoteLine[];
};

type InvoiceForm = {
  customer_id: string;
  customer_name: string;
  customer_address: string;
  customer_vat_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  payment_terms: string;
  notes: string;
  reference: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    material_id: string | null;
  }>;
};

type QuoteForm = {
  customer_id: string;
  customer_name: string;
  customer_address: string;
  customer_vat_number: string;
  issue_date: string;
  valid_until: string;
  currency: string;
  notes: string;
  reference: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    material_id: string | null;
  }>;
};

const DEFAULT_INVOICE_FORM: InvoiceForm = {
  customer_id: '',
  customer_name: '',
  customer_address: '',
  customer_vat_number: '',
  issue_date: format(new Date(), 'yyyy-MM-dd'),
  due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  currency: 'EUR',
  payment_terms: '',
  notes: '',
  reference: '',
  lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, material_id: null }]
};

const DEFAULT_QUOTE_FORM: QuoteForm = {
  customer_id: '',
  customer_name: '',
  customer_address: '',
  customer_vat_number: '',
  issue_date: format(new Date(), 'yyyy-MM-dd'),
  valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  currency: 'EUR',
  notes: '',
  reference: '',
  lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, material_id: null }]
};

export const FinancePage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('view_customers');

  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(DEFAULT_INVOICE_FORM);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(DEFAULT_QUOTE_FORM);
  const [viewingDetail, setViewingDetail] = useState<InvoiceDetail | QuoteDetail | null>(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchInvoices();
      setInvoices(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  };

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchQuotes();
      setQuotes(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur lors du chargement des devis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
    } else {
      loadQuotes();
    }
  }, [activeTab]);

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name_full?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddInvoiceModal = () => {
    setEditingInvoice(null);
    setInvoiceForm(DEFAULT_INVOICE_FORM);
    setShowInvoiceModal(true);
  };

  const openEditInvoiceModal = async (invoice: Invoice) => {
    try {
      const detail = await Api.fetchInvoice(invoice.id);
      setEditingInvoice(invoice);
      setInvoiceForm({
        customer_id: detail.customer_id || '',
        customer_name: detail.customer_name,
        customer_address: detail.customer_address || '',
        customer_vat_number: detail.customer_vat_number || '',
        issue_date: detail.issue_date,
        due_date: detail.due_date,
        currency: detail.currency,
        payment_terms: detail.payment_terms || '',
        notes: detail.notes || '',
        reference: detail.reference || '',
        lines: detail.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_rate: line.tax_rate,
          material_id: line.material_id
        }))
      });
      setShowInvoiceModal(true);
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la facture');
    }
  };

  const openAddQuoteModal = () => {
    setEditingQuote(null);
    setQuoteForm(DEFAULT_QUOTE_FORM);
    setShowQuoteModal(true);
  };

  const openEditQuoteModal = async (quote: Quote) => {
    try {
      const detail = await Api.fetchQuote(quote.id);
      setEditingQuote(quote);
      setQuoteForm({
        customer_id: detail.customer_id || '',
        customer_name: detail.customer_name,
        customer_address: detail.customer_address || '',
        customer_vat_number: detail.customer_vat_number || '',
        issue_date: detail.issue_date,
        valid_until: detail.valid_until,
        currency: detail.currency,
        notes: detail.notes || '',
        reference: detail.reference || '',
        lines: detail.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_rate: line.tax_rate,
          material_id: line.material_id
        }))
      });
      setShowQuoteModal(true);
    } catch (error: any) {
      toast.error('Erreur lors du chargement du devis');
    }
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.customer_name || !invoiceForm.issue_date || !invoiceForm.due_date) {
      toast.error('Les champs obligatoires doivent être remplis');
      return;
    }
    if (invoiceForm.lines.length === 0 || invoiceForm.lines.some((l) => !l.description)) {
      toast.error('Au moins une ligne avec description est requise');
      return;
    }

    try {
      if (editingInvoice) {
        await Api.updateInvoice(editingInvoice.id, invoiceForm);
        toast.success('Facture mise à jour avec succès');
      } else {
        await Api.createInvoice(invoiceForm);
        toast.success('Facture créée avec succès');
      }
      setShowInvoiceModal(false);
      loadInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.customer_name || !quoteForm.issue_date || !quoteForm.valid_until) {
      toast.error('Les champs obligatoires doivent être remplis');
      return;
    }
    if (quoteForm.lines.length === 0 || quoteForm.lines.some((l) => !l.description)) {
      toast.error('Au moins une ligne avec description est requise');
      return;
    }

    try {
      if (editingQuote) {
        await Api.updateQuote(editingQuote.id, quoteForm);
        toast.success('Devis mis à jour avec succès');
      } else {
        await Api.createQuote(quoteForm);
        toast.success('Devis créé avec succès');
      }
      setShowQuoteModal(false);
      loadQuotes();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;
    try {
      await Api.deleteInvoice(id);
      toast.success('Facture supprimée avec succès');
      loadInvoices();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) return;
    try {
      await Api.deleteQuote(id);
      toast.success('Devis supprimé avec succès');
      loadQuotes();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const viewInvoiceDetail = async (invoice: Invoice) => {
    try {
      const detail = await Api.fetchInvoice(invoice.id);
      setViewingDetail(detail);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des détails');
    }
  };

  const viewQuoteDetail = async (quote: Quote) => {
    try {
      const detail = await Api.fetchQuote(quote.id);
      setViewingDetail(detail);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des détails');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canEdit) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Finance</h1>
        </div>
        <div className="page-content">
          <p>Vous n'avez pas accès à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container finance-page">
      <div className="page-header">
        <h1>Finance</h1>
        <div className="page-actions">
          {activeTab === 'invoices' ? (
            <button onClick={openAddInvoiceModal} className="btn-primary">
              <Plus size={16} />
              Nouvelle facture
            </button>
          ) : (
            <button onClick={openAddQuoteModal} className="btn-primary">
              <Plus size={16} />
              Nouveau devis
            </button>
          )}
        </div>
      </div>

      <div className="tab-nav">
        <button
          className={activeTab === 'invoices' ? 'active' : ''}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={16} />
          Factures
        </button>
        <button
          className={activeTab === 'quotes' ? 'active' : ''}
          onClick={() => setActiveTab('quotes')}
        >
          <FileCheck size={16} />
          Devis
        </button>
      </div>

      <div className="page-content">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder={`Rechercher ${activeTab === 'invoices' ? 'une facture' : 'un devis'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : activeTab === 'invoices' ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Date émission</th>
                  <th>Échéance</th>
                  <th>Montant</th>
                  <th>Payé</th>
                  <th>Reste</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">
                      Aucune facture trouvée
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-mono">{invoice.invoice_number}</td>
                      <td>{invoice.customer_name_full || invoice.customer_name}</td>
                      <td>{format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td>{format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td className="font-mono">{invoice.total_amount.toFixed(2)} {invoice.currency}</td>
                      <td className="font-mono text-green-600">{invoice.total_paid.toFixed(2)}</td>
                      <td className="font-mono text-red-600">{invoice.remaining_amount.toFixed(2)}</td>
                      <td>
                        <span className={`finance-badge ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewInvoiceDetail(invoice)}
                            className="btn-icon"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openEditInvoiceModal(invoice)}
                            className="btn-icon"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            className="btn-icon text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Date émission</th>
                  <th>Valide jusqu'au</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      Aucun devis trouvé
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td className="font-mono">{quote.quote_number}</td>
                      <td>{quote.customer_name}</td>
                      <td>{format(new Date(quote.issue_date), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td>{format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td className="font-mono">{quote.total_amount.toFixed(2)} {quote.currency}</td>
                      <td>
                        <span className={`finance-badge ${getStatusColor(quote.status)}`}>
                          {quote.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewQuoteDetail(quote)}
                            className="btn-icon"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openEditQuoteModal(quote)}
                            className="btn-icon"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(quote.id)}
                            className="btn-icon text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Facture */}
      {showInvoiceModal && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
            <form onSubmit={handleInvoiceSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nom du client *</label>
                  <input
                    type="text"
                    value={invoiceForm.customer_name}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input
                    type="text"
                    value={invoiceForm.customer_address}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_address: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>N° TVA</label>
                  <input
                    type="text"
                    value={invoiceForm.customer_vat_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_vat_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date d'émission *</label>
                  <input
                    type="date"
                    value={invoiceForm.issue_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, issue_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Date d'échéance *</label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Devise *</label>
                  <select
                    value={invoiceForm.currency}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value })}
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
                  <label>Conditions de paiement</label>
                  <input
                    type="text"
                    value={invoiceForm.payment_terms}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_terms: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Référence</label>
                  <input
                    type="text"
                    value={invoiceForm.reference}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <div className="finance-lines-header">
                  <label className="finance-section-title">Lignes de facture</label>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceForm({
                        ...invoiceForm,
                        lines: [
                          ...invoiceForm.lines,
                          { description: '', quantity: 1, unit_price: 0, tax_rate: 0, material_id: null }
                        ]
                      });
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <Plus size={14} />
                    Ajouter une ligne
                  </button>
                </div>
                <div className="finance-lines-container">
                  {invoiceForm.lines.map((line, index) => {
                    const lineTotal = line.quantity * line.unit_price;
                    const taxAmount = lineTotal * (line.tax_rate / 100);
                    const totalWithTax = lineTotal + taxAmount;
                    return (
                      <div key={index} className="finance-line-card">
                        <div className="finance-line-header">
                          <span className="finance-line-number">Ligne {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newLines = invoiceForm.lines.filter((_, i) => i !== index);
                              setInvoiceForm({ ...invoiceForm, lines: newLines });
                            }}
                            className="btn-icon btn-icon-danger"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="form-grid form-grid-4-cols">
                          <div className="form-group form-group-full">
                            <label>Description *</label>
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => {
                                const newLines = [...invoiceForm.lines];
                                newLines[index].description = e.target.value;
                                setInvoiceForm({ ...invoiceForm, lines: newLines });
                              }}
                              required
                              placeholder="Description de la prestation"
                            />
                          </div>
                          <div className="form-group">
                            <label>Quantité</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) => {
                                const newLines = [...invoiceForm.lines];
                                newLines[index].quantity = parseFloat(e.target.value) || 0;
                                setInvoiceForm({ ...invoiceForm, lines: newLines });
                              }}
                              placeholder="1"
                            />
                          </div>
                          <div className="form-group">
                            <label>Prix unitaire</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => {
                                const newLines = [...invoiceForm.lines];
                                newLines[index].unit_price = parseFloat(e.target.value) || 0;
                                setInvoiceForm({ ...invoiceForm, lines: newLines });
                              }}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="form-group">
                            <label>Taux TVA (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={line.tax_rate}
                              onChange={(e) => {
                                const newLines = [...invoiceForm.lines];
                                newLines[index].tax_rate = parseFloat(e.target.value) || 0;
                                setInvoiceForm({ ...invoiceForm, lines: newLines });
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="finance-line-total">
                          <span className="finance-line-total-label">Total ligne:</span>
                          <span className="finance-line-total-value">
                            {totalWithTax.toFixed(2)} {invoiceForm.currency}
                            <span className="finance-line-total-breakdown">
                              {' '}(HT: {lineTotal.toFixed(2)} + TVA: {taxAmount.toFixed(2)})
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingInvoice ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Devis */}
      {showQuoteModal && (
        <div className="modal-overlay" onClick={() => setShowQuoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingQuote ? 'Modifier le devis' : 'Nouveau devis'}</h2>
            <form onSubmit={handleQuoteSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nom du client *</label>
                  <input
                    type="text"
                    value={quoteForm.customer_name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input
                    type="text"
                    value={quoteForm.customer_address}
                    onChange={(e) => setQuoteForm({ ...quoteForm, customer_address: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>N° TVA</label>
                  <input
                    type="text"
                    value={quoteForm.customer_vat_number}
                    onChange={(e) => setQuoteForm({ ...quoteForm, customer_vat_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date d'émission *</label>
                  <input
                    type="date"
                    value={quoteForm.issue_date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, issue_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Valide jusqu'au *</label>
                  <input
                    type="date"
                    value={quoteForm.valid_until}
                    onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Devise *</label>
                  <select
                    value={quoteForm.currency}
                    onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value })}
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
                  <label>Référence</label>
                  <input
                    type="text"
                    value={quoteForm.reference}
                    onChange={(e) => setQuoteForm({ ...quoteForm, reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <div className="finance-lines-header">
                  <label className="finance-section-title">Lignes de devis</label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteForm({
                        ...quoteForm,
                        lines: [
                          ...quoteForm.lines,
                          { description: '', quantity: 1, unit_price: 0, tax_rate: 0, material_id: null }
                        ]
                      });
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <Plus size={14} />
                    Ajouter une ligne
                  </button>
                </div>
                <div className="finance-lines-container">
                  {quoteForm.lines.map((line, index) => {
                    const lineTotal = line.quantity * line.unit_price;
                    const taxAmount = lineTotal * (line.tax_rate / 100);
                    const totalWithTax = lineTotal + taxAmount;
                    return (
                      <div key={index} className="finance-line-card">
                        <div className="finance-line-header">
                          <span className="finance-line-number">Ligne {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newLines = quoteForm.lines.filter((_, i) => i !== index);
                              setQuoteForm({ ...quoteForm, lines: newLines });
                            }}
                            className="btn-icon btn-icon-danger"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="form-grid form-grid-4-cols">
                          <div className="form-group form-group-full">
                            <label>Description *</label>
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => {
                                const newLines = [...quoteForm.lines];
                                newLines[index].description = e.target.value;
                                setQuoteForm({ ...quoteForm, lines: newLines });
                              }}
                              required
                              placeholder="Description de la prestation"
                            />
                          </div>
                          <div className="form-group">
                            <label>Quantité</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) => {
                                const newLines = [...quoteForm.lines];
                                newLines[index].quantity = parseFloat(e.target.value) || 0;
                                setQuoteForm({ ...quoteForm, lines: newLines });
                              }}
                              placeholder="1"
                            />
                          </div>
                          <div className="form-group">
                            <label>Prix unitaire</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => {
                                const newLines = [...quoteForm.lines];
                                newLines[index].unit_price = parseFloat(e.target.value) || 0;
                                setQuoteForm({ ...quoteForm, lines: newLines });
                              }}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="form-group">
                            <label>Taux TVA (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={line.tax_rate}
                              onChange={(e) => {
                                const newLines = [...quoteForm.lines];
                                newLines[index].tax_rate = parseFloat(e.target.value) || 0;
                                setQuoteForm({ ...quoteForm, lines: newLines });
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="finance-line-total">
                          <span className="finance-line-total-label">Total ligne:</span>
                          <span className="finance-line-total-value">
                            {totalWithTax.toFixed(2)} {quoteForm.currency}
                            <span className="finance-line-total-breakdown">
                              {' '}(HT: {lineTotal.toFixed(2)} + TVA: {taxAmount.toFixed(2)})
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowQuoteModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingQuote ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {viewingDetail && (
        <div className="modal-overlay" onClick={() => setViewingDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h2>
              {activeTab === 'invoices'
                ? `Facture ${(viewingDetail as InvoiceDetail).invoice_number}`
                : `Devis ${(viewingDetail as QuoteDetail).quote_number}`}
            </h2>
            {activeTab === 'invoices' ? (
              <div>
                <div className="mb-4">
                  <p><strong>Client:</strong> {(viewingDetail as InvoiceDetail).customer_name}</p>
                  {(viewingDetail as InvoiceDetail).customer_address && (
                    <p><strong>Adresse:</strong> {(viewingDetail as InvoiceDetail).customer_address}</p>
                  )}
                  <p><strong>Date d'émission:</strong> {format(new Date((viewingDetail as InvoiceDetail).issue_date), 'dd/MM/yyyy', { locale: fr })}</p>
                  <p><strong>Date d'échéance:</strong> {format(new Date((viewingDetail as InvoiceDetail).due_date), 'dd/MM/yyyy', { locale: fr })}</p>
                  <p><strong>Statut:</strong> {(viewingDetail as InvoiceDetail).status}</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qté</th>
                      <th>Prix unit.</th>
                      <th>TVA %</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingDetail as InvoiceDetail).lines.map((line) => {
                      const lineTotal = line.quantity * line.unit_price;
                      const taxAmount = lineTotal * (line.tax_rate / 100);
                      return (
                        <tr key={line.id}>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{line.unit_price.toFixed(2)}</td>
                          <td>{line.tax_rate}%</td>
                          <td>{(lineTotal + taxAmount).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>Total HT:</strong></td>
                      <td><strong>{(viewingDetail as InvoiceDetail).total_amount.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>TVA:</strong></td>
                      <td><strong>{(viewingDetail as InvoiceDetail).total_tax.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>Total TTC:</strong></td>
                      <td><strong>{((viewingDetail as InvoiceDetail).total_amount + (viewingDetail as InvoiceDetail).total_tax).toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <p><strong>Client:</strong> {(viewingDetail as QuoteDetail).customer_name}</p>
                  {(viewingDetail as QuoteDetail).customer_address && (
                    <p><strong>Adresse:</strong> {(viewingDetail as QuoteDetail).customer_address}</p>
                  )}
                  <p><strong>Date d'émission:</strong> {format(new Date((viewingDetail as QuoteDetail).issue_date), 'dd/MM/yyyy', { locale: fr })}</p>
                  <p><strong>Valide jusqu'au:</strong> {format(new Date((viewingDetail as QuoteDetail).valid_until), 'dd/MM/yyyy', { locale: fr })}</p>
                  <p><strong>Statut:</strong> {(viewingDetail as QuoteDetail).status}</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qté</th>
                      <th>Prix unit.</th>
                      <th>TVA %</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingDetail as QuoteDetail).lines.map((line) => {
                      const lineTotal = line.quantity * line.unit_price;
                      const taxAmount = lineTotal * (line.tax_rate / 100);
                      return (
                        <tr key={line.id}>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{line.unit_price.toFixed(2)}</td>
                          <td>{line.tax_rate}%</td>
                          <td>{(lineTotal + taxAmount).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>Total HT:</strong></td>
                      <td><strong>{(viewingDetail as QuoteDetail).total_amount.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>TVA:</strong></td>
                      <td><strong>{(viewingDetail as QuoteDetail).total_tax.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-right"><strong>Total TTC:</strong></td>
                      <td><strong>{((viewingDetail as QuoteDetail).total_amount + (viewingDetail as QuoteDetail).total_tax).toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="modal-actions mt-4">
              <button onClick={() => setViewingDetail(null)} className="btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

