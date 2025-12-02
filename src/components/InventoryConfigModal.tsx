import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Api, type InventoryMaterial, type InventoryMachine, type InventoryContainer, type InventoryBag, type InventoryOtherItem } from '../lib/api';

interface InventoryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

type ConfigType = 'materials' | 'machines' | 'containers' | 'bags' | 'other-items';

export function InventoryConfigModal({ isOpen, onClose, onConfigUpdated }: InventoryConfigModalProps) {
  const [activeTab, setActiveTab] = useState<ConfigType>('materials');
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [machines, setMachines] = useState<InventoryMachine[]>([]);
  const [containers, setContainers] = useState<InventoryContainer[]>([]);
  const [bags, setBags] = useState<InventoryBag[]>([]);
  const [otherItems, setOtherItems] = useState<InventoryOtherItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'materials':
          const mats = await Api.fetchInventoryMaterials(undefined, showInactive);
          setMaterials(mats);
          break;
        case 'machines':
          const machs = await Api.fetchInventoryMachines(showInactive);
          setMachines(machs);
          break;
        case 'containers':
          const conts = await Api.fetchInventoryContainers(showInactive);
          setContainers(conts);
          break;
        case 'bags':
          const bagsData = await Api.fetchInventoryBags(showInactive);
          setBags(bagsData);
          break;
        case 'other-items':
          const others = await Api.fetchInventoryOtherItems(undefined, showInactive);
          setOtherItems(others);
          break;
      }
    } catch (error: any) {
      toast.error(`Erreur lors du chargement: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    switch (activeTab) {
      case 'materials':
        setEditingData({ category: 'halle', matiere: '', num: '', display_order: 0 });
        break;
      case 'machines':
        setEditingData({ num1: '', mac: '', display_order: 0 });
        break;
      case 'containers':
        setEditingData({ type: '', display_order: 0 });
        break;
      case 'bags':
        setEditingData({ type: '', display_order: 0 });
        break;
      case 'other-items':
        setEditingData({ category: 'diesel', label: '', unit1: '', unit2: '', default_value1: 0, default_value2: 0, display_order: 0 });
        break;
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditingData({ ...item });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (editingId) {
        // Update
        switch (activeTab) {
          case 'materials':
            await Api.updateInventoryMaterial(editingId, editingData);
            break;
          case 'machines':
            await Api.updateInventoryMachine(editingId, editingData);
            break;
          case 'containers':
            await Api.updateInventoryContainer(editingId, editingData);
            break;
          case 'bags':
            await Api.updateInventoryBag(editingId, editingData);
            break;
          case 'other-items':
            await Api.updateInventoryOtherItem(editingId, editingData);
            break;
        }
        toast.success('Élément modifié avec succès');
      } else {
        // Create
        switch (activeTab) {
          case 'materials':
            await Api.createInventoryMaterial(editingData);
            break;
          case 'machines':
            await Api.createInventoryMachine(editingData);
            break;
          case 'containers':
            await Api.createInventoryContainer(editingData);
            break;
          case 'bags':
            await Api.createInventoryBag(editingData);
            break;
          case 'other-items':
            await Api.createInventoryOtherItem(editingData);
            break;
        }
        toast.success('Élément créé avec succès');
      }
      setEditingId(null);
      setEditingData(null);
      await loadData();
      onConfigUpdated();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, permanent: boolean = false) => {
    const message = permanent 
      ? 'Êtes-vous sûr de vouloir supprimer définitivement cet élément ? Cette action est irréversible.'
      : 'Êtes-vous sûr de vouloir désactiver cet élément ? Il ne sera plus visible dans les inventaires.';
    if (!confirm(message)) return;
    try {
      setLoading(true);
      switch (activeTab) {
        case 'materials':
          await Api.deleteInventoryMaterial(id, permanent);
          break;
        case 'machines':
          await Api.deleteInventoryMachine(id, permanent);
          break;
        case 'containers':
          await Api.deleteInventoryContainer(id, permanent);
          break;
        case 'bags':
          await Api.deleteInventoryBag(id, permanent);
          break;
        case 'other-items':
          await Api.deleteInventoryOtherItem(id, permanent);
          break;
      }
      toast.success(permanent ? 'Élément supprimé définitivement' : 'Élément désactivé');
      await loadData();
      onConfigUpdated();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'materials':
          await Api.updateInventoryMaterial(id, { is_active: true });
          break;
        case 'machines':
          await Api.updateInventoryMachine(id, { is_active: true });
          break;
        case 'containers':
          await Api.updateInventoryContainer(id, { is_active: true });
          break;
        case 'bags':
          await Api.updateInventoryBag(id, { is_active: true });
          break;
        case 'other-items':
          await Api.updateInventoryOtherItem(id, { is_active: true });
          break;
      }
      toast.success('Élément réactivé');
      await loadData();
      onConfigUpdated();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderMaterialsTable = () => {
    const grouped = materials.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, InventoryMaterial[]>);

    return (
      <div>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', textTransform: 'capitalize' }}>
              {category === 'halle' ? 'Plastique BB' : category === 'plastiqueB' ? 'Plastique en balles' : category === 'cdt' ? 'CDT' : 'Papier'}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Matière</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Numéro</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Ordre</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.6 }}>
                    <td style={{ padding: '8px' }}>
                      {item.matiere}
                      {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#ef4444' }}>(inactif)</span>}
                    </td>
                    <td style={{ padding: '8px' }}>{item.num || '-'}</td>
                    <td style={{ padding: '8px' }}>{item.display_order}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {item.is_active ? (
                        <>
                          <button className="btn-icon" onClick={() => handleEdit(item)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, false)} title="Désactiver">
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn-icon" onClick={() => handleRestore(item.id)} title="Réactiver" style={{ fontSize: '18px' }}>
                            ↻
                          </button>
                          <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, true)} title="Supprimer définitivement">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  const renderForm = () => {
    if (!editingData) return null;

    return (
      <div style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>
          {editingId ? 'Modifier' : 'Nouvel élément'}
        </h3>
        {activeTab === 'materials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Catégorie</label>
              <select
                value={editingData.category || 'halle'}
                onChange={(e) => setEditingData({ ...editingData, category: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value="halle">Plastique BB</option>
                <option value="plastiqueB">Plastique en balles</option>
                <option value="cdt">CDT</option>
                <option value="papier">Papier</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Matière</label>
              <input
                type="text"
                value={editingData.matiere || ''}
                onChange={(e) => setEditingData({ ...editingData, matiere: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Numéro</label>
              <input
                type="text"
                value={editingData.num || ''}
                onChange={(e) => setEditingData({ ...editingData, num: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ordre d'affichage</label>
              <input
                type="number"
                value={editingData.display_order || 0}
                onChange={(e) => setEditingData({ ...editingData, display_order: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        {activeTab === 'machines' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Numéro</label>
              <input
                type="text"
                value={editingData.num1 || ''}
                onChange={(e) => setEditingData({ ...editingData, num1: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Machine</label>
              <input
                type="text"
                value={editingData.mac || ''}
                onChange={(e) => setEditingData({ ...editingData, mac: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ordre d'affichage</label>
              <input
                type="number"
                value={editingData.display_order || 0}
                onChange={(e) => setEditingData({ ...editingData, display_order: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        {activeTab === 'containers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Type</label>
              <input
                type="text"
                value={editingData.type || ''}
                onChange={(e) => setEditingData({ ...editingData, type: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ordre d'affichage</label>
              <input
                type="number"
                value={editingData.display_order || 0}
                onChange={(e) => setEditingData({ ...editingData, display_order: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        {activeTab === 'bags' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Type</label>
              <input
                type="text"
                value={editingData.type || ''}
                onChange={(e) => setEditingData({ ...editingData, type: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ordre d'affichage</label>
              <input
                type="number"
                value={editingData.display_order || 0}
                onChange={(e) => setEditingData({ ...editingData, display_order: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        {activeTab === 'other-items' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Catégorie</label>
              <select
                value={editingData.category || 'diesel'}
                onChange={(e) => setEditingData({ ...editingData, category: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value="diesel">Diesel</option>
                <option value="adBlue">AdBlue</option>
                <option value="filFer">Fil de fer</option>
                <option value="eau">Eau</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Sous-catégorie (pour Eau)</label>
              <input
                type="text"
                value={editingData.subcategory || ''}
                onChange={(e) => setEditingData({ ...editingData, subcategory: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                placeholder="ex: morgevon11"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Libellé</label>
              <input
                type="text"
                value={editingData.label || ''}
                onChange={(e) => setEditingData({ ...editingData, label: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Unité 1</label>
                <input
                  type="text"
                  value={editingData.unit1 || ''}
                  onChange={(e) => setEditingData({ ...editingData, unit1: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  placeholder="ex: litres"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Unité 2</label>
                <input
                  type="text"
                  value={editingData.unit2 || ''}
                  onChange={(e) => setEditingData({ ...editingData, unit2: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  placeholder="ex: pièce"
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ordre d'affichage</label>
              <input
                type="number"
                value={editingData.display_order || 0}
                onChange={(e) => setEditingData({ ...editingData, display_order: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={16} /> Enregistrer
          </button>
          <button className="btn" onClick={() => { setEditingId(null); setEditingData(null); }}>
            Annuler
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Gestion des configurations d'inventaire</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            {(['materials', 'machines', 'containers', 'bags', 'other-items'] as ConfigType[]).map((tab) => (
              <button
                key={tab}
                className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  setEditingId(null);
                  setEditingData(null);
                }}
                style={{ borderRadius: '4px 4px 0 0', marginBottom: '-1px' }}
              >
                {tab === 'materials' ? 'Matières' : tab === 'machines' ? 'Machines' : tab === 'containers' ? 'Conteneurs' : tab === 'bags' ? 'Sacs' : 'Autres'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {activeTab === 'materials' ? 'Matières' : activeTab === 'machines' ? 'Machines' : activeTab === 'containers' ? 'Conteneurs' : activeTab === 'bags' ? 'Sacs' : 'Autres éléments'}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => {
                    setShowInactive(e.target.checked);
                    setEditingId(null);
                    setEditingData(null);
                  }}
                />
                Afficher les éléments inactifs
              </label>
              <button className="btn btn-primary" onClick={handleCreate}>
                <Plus size={16} /> Ajouter
              </button>
            </div>
          </div>
          {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Chargement...</div>}
          {!loading && (
            <>
              {activeTab === 'materials' && renderMaterialsTable()}
              {activeTab === 'machines' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Numéro</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Machine</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Ordre</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.6 }}>
                        <td style={{ padding: '8px' }}>
                          {item.num1}
                          {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#ef4444' }}>(inactif)</span>}
                        </td>
                        <td style={{ padding: '8px' }}>{item.mac}</td>
                        <td style={{ padding: '8px' }}>{item.display_order}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {item.is_active ? (
                            <>
                              <button className="btn-icon" onClick={() => handleEdit(item)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, false)} title="Désactiver">
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn-icon" onClick={() => handleRestore(item.id)} title="Réactiver" style={{ fontSize: '18px' }}>
                                ↻
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, true)} title="Supprimer définitivement">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 'containers' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Ordre</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.6 }}>
                        <td style={{ padding: '8px' }}>
                          {item.type}
                          {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#ef4444' }}>(inactif)</span>}
                        </td>
                        <td style={{ padding: '8px' }}>{item.display_order}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {item.is_active ? (
                            <>
                              <button className="btn-icon" onClick={() => handleEdit(item)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, false)} title="Désactiver">
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn-icon" onClick={() => handleRestore(item.id)} title="Réactiver" style={{ fontSize: '18px' }}>
                                ↻
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, true)} title="Supprimer définitivement">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 'bags' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Ordre</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bags.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.6 }}>
                        <td style={{ padding: '8px' }}>
                          {item.type}
                          {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#ef4444' }}>(inactif)</span>}
                        </td>
                        <td style={{ padding: '8px' }}>{item.display_order}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {item.is_active ? (
                            <>
                              <button className="btn-icon" onClick={() => handleEdit(item)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, false)} title="Désactiver">
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn-icon" onClick={() => handleRestore(item.id)} title="Réactiver" style={{ fontSize: '18px' }}>
                                ↻
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, true)} title="Supprimer définitivement">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 'other-items' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Catégorie</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Sous-catégorie</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Libellé</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Unité 1</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Unité 2</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.6 }}>
                        <td style={{ padding: '8px' }}>
                          {item.category}
                          {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#ef4444' }}>(inactif)</span>}
                        </td>
                        <td style={{ padding: '8px' }}>{item.subcategory || '-'}</td>
                        <td style={{ padding: '8px' }}>{item.label}</td>
                        <td style={{ padding: '8px' }}>{item.unit1 || '-'}</td>
                        <td style={{ padding: '8px' }}>{item.unit2 || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {item.is_active ? (
                            <>
                              <button className="btn-icon" onClick={() => handleEdit(item)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, false)} title="Désactiver">
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn-icon" onClick={() => handleRestore(item.id)} title="Réactiver" style={{ fontSize: '18px' }}>
                                ↻
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id, true)} title="Supprimer définitivement">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {renderForm()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

