import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Calendar, Scale, Truck, User, Loader2, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

type Direction = 'in' | 'out';

type WeighLine = {
  id: string;
  contract?: string;
  product?: string;
  activity?: string;
  unit?: string;
  unitPrice?: number;
  grossWeight?: number;
  netWeight?: number;
  billedWeight?: number;
  notes?: string;
};

const createEmptyLine = (): WeighLine => ({
  id: Math.random().toString(36).slice(2),
  unit: 'kg'
});

const WeighbridgePage: React.FC = () => {
  const [direction, setDirection] = useState<Direction>('in');
  const [ticketNumber, setTicketNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [tare, setTare] = useState<number | ''>('');
  const [grossWeight, setGrossWeight] = useState<number | ''>('');
  const [timestamp, setTimestamp] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<WeighLine[]>([createEmptyLine()]);
  const [isSaving, setIsSaving] = useState(false);

  const netWeight = useMemo(() => {
    if (grossWeight === '' || tare === '') return 0;
    return Math.max(0, Number(grossWeight) - Number(tare));
  }, [grossWeight, tare]);

  const totalBilled = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const weight = line.billedWeight ?? line.netWeight ?? 0;
        const price = line.unitPrice ?? 0;
        return sum + weight * price;
      }, 0),
    [lines]
  );

  const handleLineChange = <K extends keyof WeighLine>(id: string, key: K, value: WeighLine[K]) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, [key]: value } : line)));
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.id !== id)));
  };

  const handleMeasureWeight = () => {
    // Placeholder pour l’intégration pont-bascule
    // Pour l’instant on simule une valeur
    const simulated = 12340;
    if (direction === 'in') {
      setGrossWeight(simulated);
    } else {
      setTare(simulated);
    }
    toast.success('Poids simulé appliqué (intégration pont-bascule à connecter).');
  };

  const resetForm = () => {
    setTicketNumber('');
    setOrderNumber('');
    setAccountNumber('');
    setTruckPlate('');
    setDriverName('');
    setTare('');
    setGrossWeight('');
    setTimestamp(new Date().toISOString().slice(0, 16));
    setComment('');
    setLines([createEmptyLine()]);
  };

  const handleSave = async () => {
    if (!truckPlate) {
      toast.error('Merci de saisir la plaque du camion.');
      return;
    }
    if (!grossWeight && !tare) {
      toast.error('Saisissez au moins un poids (brut ou tare).');
      return;
    }
    try {
      setIsSaving(true);
      // TODO: Brancher sur l’API backend lorsque disponible
      await new Promise((resolve) => setTimeout(resolve, 700));
      toast.success('Ticket pont-bascule enregistré (simulation).');
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement du ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Pont-bascule</p>
          <h1 className="page-title">Saisie des poids entrée / sortie</h1>
          <p className="page-subtitle">
            Enregistrez les tickets de pesée camion avec un écran clair et adapté à l&apos;exploitation.
          </p>
        </div>
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div className="weighbridge-layout">
            <div className="weighbridge-header">
              <div className="weighbridge-header-left">
                <div className="chip-group">
                  <button
                    type="button"
                    className={`chip ${direction === 'in' ? 'chip--active' : ''}`}
                    onClick={() => setDirection('in')}
                  >
                    <ArrowLeftRight size={14} />
                    Entrée
                  </button>
                  <button
                    type="button"
                    className={`chip ${direction === 'out' ? 'chip--active' : ''}`}
                    onClick={() => setDirection('out')}
                  >
                    <ArrowLeftRight size={14} />
                    Sortie
                  </button>
                </div>

                <div className="weighbridge-grid">
                  <div className="destruction-field">
                    <label className="destruction-label">Ticket n°</label>
                    <input
                      className="destruction-input"
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      placeholder="Auto / manuel"
                    />
                  </div>
                  <div className="destruction-field">
                    <label className="destruction-label">Compte / client</label>
                    <input
                      className="destruction-input"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="n° compte ou nom"
                    />
                  </div>
                  <div className="destruction-field">
                    <label className="destruction-label">Ordre / référence</label>
                    <input
                      className="destruction-input"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="ordre, bon, projet..."
                    />
                  </div>
                  <div className="destruction-field">
                    <label className="destruction-label">Date & heure</label>
                    <div className="map-input">
                      <Calendar size={16} />
                      <input
                        type="datetime-local"
                        value={timestamp}
                        onChange={(e) => setTimestamp(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="weighbridge-header-right">
                <div className="destruction-field">
                  <label className="destruction-label">Camion</label>
                  <div className="map-input">
                    <Truck size={16} />
                    <input
                      className="destruction-input"
                      value={truckPlate}
                      onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                      placeholder="Plaque / interne"
                    />
                  </div>
                </div>
                <div className="destruction-field">
                  <label className="destruction-label">Chauffeur</label>
                  <div className="map-input">
                    <User size={16} />
                    <input
                      className="destruction-input"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Nom du chauffeur"
                    />
                  </div>
                </div>
                <div className="weighbridge-weights">
                  <div className="weight-card">
                    <span>Poids brut</span>
                    <strong>{grossWeight || 0} kg</strong>
                  </div>
                  <div className="weight-card">
                    <span>Tare</span>
                    <strong>{tare || 0} kg</strong>
                  </div>
                  <div className="weight-card weight-card--accent">
                    <span>Poids net</span>
                    <strong>{netWeight} kg</strong>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleMeasureWeight}>
                    <Scale size={16} />
                    Mesurer poids
                  </button>
                </div>
              </div>
            </div>

            <div className="weighbridge-main">
              <div className="detail-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Contrat</th>
                      <th>Produit</th>
                      <th style={{ width: 120 }}>Activité</th>
                      <th style={{ width: 80 }}>Unité</th>
                      <th style={{ width: 110 }}>Poids net</th>
                      <th style={{ width: 120 }}>Poids facturé</th>
                      <th style={{ width: 110 }}>Prix unitaire</th>
                      <th style={{ width: 140 }}>Montant</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const amount = (line.billedWeight ?? line.netWeight ?? 0) * (line.unitPrice ?? 0);
                      return (
                        <tr key={line.id}>
                          <td>
                            <input
                              className="table-input"
                              value={line.contract ?? ''}
                              onChange={(e) => handleLineChange(line.id, 'contract', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="table-input"
                              value={line.product ?? ''}
                              onChange={(e) => handleLineChange(line.id, 'product', e.target.value)}
                              placeholder="Description produit"
                            />
                          </td>
                          <td>
                            <input
                              className="table-input"
                              value={line.activity ?? ''}
                              onChange={(e) => handleLineChange(line.id, 'activity', e.target.value)}
                              placeholder="Code / activité"
                            />
                          </td>
                          <td>
                            <select
                              className="table-input"
                              value={line.unit ?? 'kg'}
                              onChange={(e) => handleLineChange(line.id, 'unit', e.target.value)}
                            >
                              <option value="kg">kg</option>
                              <option value="t">t</option>
                              <option value="pce">pce</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="table-input"
                              value={line.netWeight ?? ''}
                              onChange={(e) =>
                                handleLineChange(
                                  line.id,
                                  'netWeight',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="table-input"
                              value={line.billedWeight ?? ''}
                              onChange={(e) =>
                                handleLineChange(
                                  line.id,
                                  'billedWeight',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="table-input"
                              value={line.unitPrice ?? ''}
                              onChange={(e) =>
                                handleLineChange(
                                  line.id,
                                  'unitPrice',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              placeholder="CHF"
                            />
                          </td>
                          <td>
                            <span className="table-amount">
                              {amount ? amount.toFixed(2) : '0.00'} CHF
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => handleRemoveLine(line.id)}
                              aria-label="Supprimer la ligne"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="weighbridge-footer">
                <button type="button" className="btn btn-outline btn-small" onClick={handleAddLine}>
                  <Plus size={14} />
                  Ajouter une ligne
                </button>
                <div className="spacer" />
                <div className="weighbridge-totals">
                  <div>
                    <span className="muted-text">Total montant estimé</span>
                    <strong>{totalBilled.toFixed(2)} CHF</strong>
                  </div>
                </div>
              </div>

              <div className="destruction-field" style={{ marginTop: 16 }}>
                <label className="destruction-label">Remarques</label>
                <textarea
                  className="destruction-input"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Informations complémentaires (client, chantier, consignes spéciales...)"
                />
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 24, justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-outline" onClick={resetForm}>
              Réinitialiser
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Enregistrer le ticket
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WeighbridgePage;


