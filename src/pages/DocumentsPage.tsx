import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Api, type Document, type DocumentDetail, type DocumentVersion, type DocumentApproval, type DocumentRetentionRule, type CreateDocumentPayload, type CreateDocumentVersionPayload, type CreateDocumentRetentionRulePayload } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  FileText, Upload, Search, Filter, Download, Eye, Edit, Trash2, Archive, CheckCircle, XCircle, Clock,
  Tag, History, Shield, Settings, Plus, FileCheck, FileX, FileArchive, FolderOpen, Calendar
} from 'lucide-react';

type TabType = 'all' | 'pending' | 'approved' | 'archived' | 'versions' | 'retention';

const DOCUMENT_CATEGORIES = [
  { value: 'contract', label: 'Contrat' },
  { value: 'invoice', label: 'Facture' },
  { value: 'report', label: 'Rapport' },
  { value: 'certificate', label: 'Certificat' },
  { value: 'compliance', label: 'Conformité' },
  { value: 'hr', label: 'RH' },
  { value: 'financial', label: 'Financier' },
  { value: 'legal', label: 'Juridique' },
  { value: 'other', label: 'Autre' }
];

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  draft: { bg: '#f1f5f9', text: '#475569', icon: FileText },
  pending_approval: { bg: '#fef3c7', text: '#92400e', icon: Clock },
  approved: { bg: '#d1fae5', text: '#065f46', icon: CheckCircle },
  rejected: { bg: '#fee2e2', text: '#991b1b', icon: XCircle },
  archived: { bg: '#e0e7ff', text: '#3730a3', icon: Archive },
  deleted: { bg: '#f3f4f6', text: '#6b7280', icon: Trash2 }
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);
  const [retentionRules, setRetentionRules] = useState<DocumentRetentionRule[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  // Forms
  const [uploadForm, setUploadForm] = useState<CreateDocumentPayload>({
    title: '',
    description: '',
    category: 'other',
    file_name: '',
    file_path: '',
    file_size: 0,
    mime_type: '',
    is_sensitive: false,
    requires_approval: false,
    tags: []
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [approvalComments, setApprovalComments] = useState('');

  useEffect(() => {
    loadDocuments();
    loadRetentionRules();
  }, [categoryFilter, statusFilter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (categoryFilter) filters.category = categoryFilter;
      if (statusFilter) filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;
      
      const data = await Api.fetchDocuments(filters);
      setDocuments(data);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast.error('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const loadRetentionRules = async () => {
    try {
      const rules = await Api.fetchDocumentRetentionRules();
      setRetentionRules(rules);
    } catch (error: any) {
      console.error('Error loading retention rules:', error);
    }
  };

  const loadDocumentDetail = async (id: string) => {
    try {
      const detail = await Api.fetchDocument(id);
      setSelectedDocument(detail);
      setShowDocumentModal(true);
    } catch (error: any) {
      console.error('Error loading document detail:', error);
      toast.error('Erreur lors du chargement du document');
    }
  };

  const filteredDocuments = useMemo(() => {
    let filtered = documents;
    
    if (activeTab === 'pending') {
      filtered = filtered.filter(d => d.status === 'pending_approval');
    } else if (activeTab === 'approved') {
      filtered = filtered.filter(d => d.status === 'approved');
    } else if (activeTab === 'archived') {
      filtered = filtered.filter(d => d.status === 'archived');
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(term) ||
        d.description?.toLowerCase().includes(term) ||
        d.document_number.toLowerCase().includes(term) ||
        d.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [documents, activeTab, searchTerm]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadForm({
        ...uploadForm,
        file_name: file.name,
        file_path: `/uploads/documents/${file.name}`, // En production, uploader réellement le fichier
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream'
      });
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !uploadForm.tags?.includes(tagInput.trim())) {
      setUploadForm({
        ...uploadForm,
        tags: [...(uploadForm.tags || []), tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setUploadForm({
      ...uploadForm,
      tags: uploadForm.tags?.filter(t => t !== tag) || []
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title || !uploadForm.category) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setLoading(true);
    try {
      await Api.createDocument(uploadForm);
      toast.success('Document uploadé avec succès');
      setShowUploadModal(false);
      setUploadForm({
        title: '',
        description: '',
        category: 'other',
        file_name: '',
        file_path: '',
        file_size: 0,
        mime_type: '',
        is_sensitive: false,
        requires_approval: false,
        tags: []
      });
      setSelectedFile(null);
      loadDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('Erreur lors de l\'upload du document');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      await Api.approveDocument(id, { comments: approvalComments });
      toast.success('Document approuvé');
      setShowApprovalModal(false);
      setApprovalComments('');
      loadDocuments();
      if (selectedDocument) {
        loadDocumentDetail(id);
      }
    } catch (error: any) {
      console.error('Error approving document:', error);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    try {
      await Api.rejectDocument(id, { comments: approvalComments });
      toast.success('Document rejeté');
      setShowApprovalModal(false);
      setApprovalComments('');
      loadDocuments();
      if (selectedDocument) {
        loadDocumentDetail(id);
      }
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      toast.error('Erreur lors du rejet');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir archiver ce document ?')) return;
    
    setLoading(true);
    try {
      await Api.archiveDocument(id);
      toast.success('Document archivé');
      loadDocuments();
      setShowDocumentModal(false);
    } catch (error: any) {
      console.error('Error archiving document:', error);
      toast.error('Erreur lors de l\'archivage');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    
    setLoading(true);
    try {
      await Api.deleteDocument(id);
      toast.success('Document supprimé');
      loadDocuments();
      setShowDocumentModal(false);
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status] || STATUS_COLORS.draft;
    const StatusIcon = config.icon;
    return (
      <span className={`status-badge ${status}`} style={{ backgroundColor: config.bg, color: config.text }}>
        <StatusIcon size={12} />
        {status === 'pending_approval' ? 'En attente' :
         status === 'approved' ? 'Approuvé' :
         status === 'rejected' ? 'Rejeté' :
         status === 'archived' ? 'Archivé' :
         status === 'deleted' ? 'Supprimé' : 'Brouillon'}
      </span>
    );
  };

  return (
    <div className="documents-page">
      <div className="page-header">
        <div>
          <h1>Gestion Documentaire</h1>
          <p>GED - Gestion Électronique de Documents</p>
        </div>
        <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
          <Upload size={18} />
          Uploader un Document
        </button>
      </div>

      {/* Filters */}
      <div className="documents-filters">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {DOCUMENT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="pending_approval">En attente</option>
            <option value="approved">Approuvé</option>
            <option value="rejected">Rejeté</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="documents-tabs">
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => setActiveTab('all')}
        >
          <FolderOpen size={18} />
          Tous ({documents.length})
        </button>
        <button
          className={activeTab === 'pending' ? 'active' : ''}
          onClick={() => setActiveTab('pending')}
        >
          <Clock size={18} />
          En attente ({documents.filter(d => d.status === 'pending_approval').length})
        </button>
        <button
          className={activeTab === 'approved' ? 'active' : ''}
          onClick={() => setActiveTab('approved')}
        >
          <CheckCircle size={18} />
          Approuvés ({documents.filter(d => d.status === 'approved').length})
        </button>
        <button
          className={activeTab === 'archived' ? 'active' : ''}
          onClick={() => setActiveTab('archived')}
        >
          <Archive size={18} />
          Archivés ({documents.filter(d => d.status === 'archived').length})
        </button>
        <button
          className={activeTab === 'versions' ? 'active' : ''}
          onClick={() => setActiveTab('versions')}
        >
          <History size={18} />
          Versions
        </button>
        <button
          className={activeTab === 'retention' ? 'active' : ''}
          onClick={() => setActiveTab('retention')}
        >
          <Settings size={18} />
          Règles de Rétention
        </button>
      </div>

      {/* Content */}
      <div className="documents-content">
        {loading && <div className="loading">Chargement...</div>}
        
        {activeTab === 'retention' ? (
          <div className="retention-rules-section">
            <div className="section-header">
              <h2>Règles de Rétention</h2>
              <button className="btn-secondary" onClick={() => setShowRetentionModal(true)}>
                <Plus size={18} />
                Nouvelle Règle
              </button>
            </div>
            <div className="retention-rules-grid">
              {retentionRules.map(rule => (
                <div key={rule.id} className="retention-rule-card">
                  <h3>{rule.name}</h3>
                  {rule.description && <p>{rule.description}</p>}
                  <div className="rule-details">
                    <div>
                      <span>Rétention:</span>
                      <strong>{rule.retention_years} ans</strong>
                    </div>
                    {rule.archive_after_days && (
                      <div>
                        <span>Archivage après:</span>
                        <strong>{rule.archive_after_days} jours</strong>
                      </div>
                    )}
                    {rule.category && (
                      <div>
                        <span>Catégorie:</span>
                        <strong>{rule.category}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="documents-grid">
            {filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <p>Aucun document trouvé</p>
              </div>
            ) : (
              filteredDocuments.map(doc => (
                <div key={doc.id} className="document-card" onClick={() => loadDocumentDetail(doc.id)}>
                  <div className="document-header">
                    <div className="document-icon">
                      <FileText size={24} />
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                  <div className="document-body">
                    <h3>{doc.title}</h3>
                    {doc.description && <p className="document-description">{doc.description}</p>}
                    <div className="document-meta">
                      <span className="document-number">{doc.document_number}</span>
                      <span className="document-category">{DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label}</span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="document-tags">
                        {doc.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                        {doc.tags.length > 3 && <span className="tag-more">+{doc.tags.length - 3}</span>}
                      </div>
                    )}
                    <div className="document-footer">
                      <span className="document-date">
                        {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                      {doc.version_count && doc.version_count > 1 && (
                        <span className="document-versions">
                          <History size={14} />
                          v{doc.current_version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Uploader un Document</h2>
              <button className="btn-icon" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations du Document</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Titre <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Catégorie <span className="required-indicator">*</span></label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as any })}
                      required
                    >
                      {DOCUMENT_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Fichier</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <label>Fichier <span className="required-indicator">*</span></label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                    />
                    {selectedFile && (
                      <div className="file-info">
                        <FileText size={16} />
                        <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Options</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={uploadForm.is_sensitive}
                        onChange={(e) => setUploadForm({ ...uploadForm, is_sensitive: e.target.checked })}
                      />
                      Document sensible
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={uploadForm.requires_approval}
                        onChange={(e) => setUploadForm({ ...uploadForm, requires_approval: e.target.checked })}
                      />
                      Nécessite approbation
                    </label>
                  </div>
                  <div className="form-group full-width">
                    <label>Tags</label>
                    <div className="tag-input-group">
                      <input
                        type="text"
                        placeholder="Ajouter un tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      />
                      <button type="button" className="btn-secondary" onClick={handleAddTag}>
                        <Plus size={16} />
                      </button>
                    </div>
                    {uploadForm.tags && uploadForm.tags.length > 0 && (
                      <div className="tags-list">
                        {uploadForm.tags.map(tag => (
                          <span key={tag} className="tag">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleUpload} disabled={loading}>
                {loading ? 'Upload...' : 'Uploader'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="modal-overlay" onClick={() => setShowDocumentModal(false)}>
          <div className="modal-panel compliance-modal document-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedDocument.title}</h2>
              <button className="btn-icon" onClick={() => setShowDocumentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="document-detail-info">
                <div className="info-row">
                  <span>Numéro:</span>
                  <strong>{selectedDocument.document_number}</strong>
                </div>
                <div className="info-row">
                  <span>Catégorie:</span>
                  <strong>{DOCUMENT_CATEGORIES.find(c => c.value === selectedDocument.category)?.label}</strong>
                </div>
                <div className="info-row">
                  <span>Statut:</span>
                  {getStatusBadge(selectedDocument.status)}
                </div>
                {selectedDocument.description && (
                  <div className="info-row">
                    <span>Description:</span>
                    <p>{selectedDocument.description}</p>
                  </div>
                )}
                {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                  <div className="info-row">
                    <span>Tags:</span>
                    <div className="tags-list">
                      {selectedDocument.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedDocument.versions && selectedDocument.versions.length > 0 && (
                <div className="document-versions-section">
                  <h3>Versions</h3>
                  <div className="versions-list">
                    {selectedDocument.versions.map(version => (
                      <div key={version.id} className="version-item">
                        <div className="version-header">
                          <span>Version {version.version_number}</span>
                          <span>{format(new Date(version.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                        </div>
                        {version.change_summary && <p>{version.change_summary}</p>}
                        <div className="version-meta">
                          <span>{version.file_name}</span>
                          <span>{(version.file_size / 1024).toFixed(2)} KB</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument.approvals && selectedDocument.approvals.length > 0 && (
                <div className="document-approvals-section">
                  <h3>Workflow d'Approbation</h3>
                  <div className="approvals-list">
                    {selectedDocument.approvals.map(approval => (
                      <div key={approval.id} className={`approval-item ${approval.status}`}>
                        <div className="approval-header">
                          <span>{approval.approver_name}</span>
                          {approval.status === 'approved' && <CheckCircle size={16} color="#10b981" />}
                          {approval.status === 'rejected' && <XCircle size={16} color="#ef4444" />}
                          {approval.status === 'pending' && <Clock size={16} color="#f59e0b" />}
                        </div>
                        {approval.comments && <p>{approval.comments}</p>}
                        {approval.approved_at && (
                          <span className="approval-date">
                            {format(new Date(approval.approved_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDocumentModal(false)}>
                Fermer
              </button>
              {selectedDocument.status === 'pending_approval' && (user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <button className="btn-success" onClick={() => {
                    setShowApprovalModal(true);
                    setApprovalComments('');
                  }}>
                    <CheckCircle size={16} />
                    Approuver
                  </button>
                  <button className="btn-danger" onClick={() => {
                    setShowApprovalModal(true);
                    setApprovalComments('');
                  }}>
                    <XCircle size={16} />
                    Rejeter
                  </button>
                </>
              )}
              {selectedDocument.status !== 'archived' && (
                <button className="btn-secondary" onClick={() => handleArchive(selectedDocument.id)}>
                  <Archive size={16} />
                  Archiver
                </button>
              )}
              {user?.role === 'admin' && (
                <button className="btn-danger" onClick={() => handleDelete(selectedDocument.id)}>
                  <Trash2 size={16} />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedDocument && (
        <div className="modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approbation / Rejet</h2>
              <button className="btn-icon" onClick={() => setShowApprovalModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Commentaires</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <label>Commentaires (optionnel)</label>
                    <textarea
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      rows={4}
                      placeholder="Ajouter un commentaire..."
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowApprovalModal(false)}>
                Annuler
              </button>
              <button className="btn-success" onClick={() => handleApprove(selectedDocument.id)} disabled={loading}>
                <CheckCircle size={16} />
                Approuver
              </button>
              <button className="btn-danger" onClick={() => handleReject(selectedDocument.id)} disabled={loading}>
                <XCircle size={16} />
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

