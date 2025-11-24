import React, { useState, useEffect, useMemo } from 'react';
import { Download, Save, FileText, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import { Api } from '../lib/api';

// Types temporaires - TODO: Déplacer vers types/ si nécessaire
interface Article {
  id: string;
  name: string;
}

interface ContainerInventory {
  type: string;
  quantite: number;
  location: string;
}

interface BagInventory {
  type: string;
  quantite: number;
  location: string;
}

interface AutresData {
  diesel: { litres: number; piece: number };
  adBlue: { litres: number; piece: number };
  filFer: { litres: number; piece: number };
  eau: {
    morgevon11: { m3: number; compteur: number };
    morgevon13: { m3: number; compteur: number };
    halleBois: { m3: number; compteur: number };
  };
}

interface HalleRow {
  matiere: string;
  bb: number;
  palette: number;
}

interface PlastiqueBRow {
  matiere: string;
  balles: number;
  palettes: number;
}

interface CdtRow {
  matiere: string;
  m3: number;
  tonnes: number;
}

interface PapierRow {
  num: string;
  mat: string;
  bal: string;
}

interface MachineRow {
  num1: string;
  mac: string;
  ball: string;
  heur: string;
}

interface InventorySnapshot {
  halle: HalleRow[];
  plastiqueB: PlastiqueBRow[];
  cdt: CdtRow[];
  papier: PapierRow[];
  machines: MachineRow[];
  autres: AutresData;
  containers: ContainerInventory[];
  bags: BagInventory[];
}

interface InventorySheetProps {
  articles: Article[];
  user: any;
  signOut: () => Promise<void>;
}

export function InventorySheet({ articles, user, signOut }: InventorySheetProps) {
  const [activeTab, setActiveTab] = useState('plastiquebb');

  const HALLE_DEFAULT_ROWS: HalleRow[] = [
    { matiere: 'PET broyé', bb: 0, palette: 0 },
    { matiere: 'Rouleau emballage', bb: 0, palette: 0 },
    { matiere: 'Bouchons', bb: 0, palette: 0 },
    { matiere: 'CD', bb: 0, palette: 0 },
    { matiere: 'Big bag', bb: 0, palette: 0 }
  ];

  const normalizeHalleData = (rows?: any[]): HalleRow[] => {
    if (!rows || rows.length === 0) {
      return HALLE_DEFAULT_ROWS;
    }
    return rows.map((row, idx) => ({
      matiere: row.matiere ?? HALLE_DEFAULT_ROWS[idx]?.matiere ?? `Matière ${idx + 1}`,
      bb: Number(row.bb) || 0,
      palette: Number(row.palette) || 0
    }));
  };

  // État pour la section Plastique en BB
  const [halleData, setHalleData] = useState<HalleRow[]>(HALLE_DEFAULT_ROWS);

  // État pour la section Plastique en balles
  const [plastiqueBData, setPlastiqueBData] = useState<PlastiqueBRow[]>([
    { matiere: 'Polyéthyène 98/2', balles: 0, palettes: 0 },
    { matiere: 'Polyéthyène 90/10', balles: 0, palettes: 0 },
    { matiere: 'Canettes Alu (400)', balles: 0, palettes: 0 },
    { matiere: 'Bouteilles de lait (380)', balles: 0, palettes: 0 },
    { matiere: 'Plaque bleu PP', balles: 0, palettes: 0 },
    { matiere: 'Ligatures Strapex', balles: 0, palettes: 0 },
    { matiere: 'Opercule', balles: 0, palettes: 0 },
    { matiere: 'PP', balles: 0, palettes: 0 },
    { matiere: 'PS', balles: 0, palettes: 0 },
    { matiere: 'Pet bouteille (370)', balles: 0, palettes: 0 }
  ]);

  // État pour la section CDT
  const [cdtData, setCdtData] = useState<CdtRow[]>([
    { matiere: 'Inerte', m3: 0, tonnes: 0 },
    { matiere: 'Bois à problème', m3: 0, tonnes: 0 },
    { matiere: 'Alu propre', m3: 0, tonnes: 0 },
    { matiere: 'Fer léger', m3: 0, tonnes: 0 },
    { matiere: 'Fer propre', m3: 0, tonnes: 0 },
    { matiere: 'Déchets', m3: 0, tonnes: 0 }
  ]);

  // État pour la section Papier en balles
  const [papierData, setPapierData] = useState<PapierRow[]>([
    { num: '1.02', mat: 'Ordinaire en balle (950)', bal: '1078050' },
    { num: '1.04', mat: 'Carton mixte (900)', bal: '1078050' },
    { num: '1.05', mat: 'Carton propre (800)', bal: '1078050' },
    { num: '2.06', mat: 'Écrit couleur n°2 (750)', bal: '1078050' },
    { num: '2.06', mat: 'Broyé (850)', bal: '1078050' },
    { num: '3.03', mat: 'Rognures d\'imprimerie', bal: '1078050' },
    { num: '3.05', mat: 'Écrit blanc (750)', bal: '1078050' },
    { num: '3.08', mat: 'Cellulose (blanche)', bal: '1078050' },
    { num: '3.10', mat: 'Afnor7 (950)', bal: '1078050' },
    { num: '3.18', mat: 'Blanc (900)', bal: '1078050' },
    { num: '4.02', mat: 'Natron (750)', bal: '1078050' },
    { num: '2.02', mat: 'Journaux invendus', bal: '1078050' },
    { num: '3.14', mat: 'Papier blanc journaux', bal: '1078050' },
    { num: '3.17', mat: 'Rognures journaux', bal: '1078050' },
    { num: '1.04', mat: 'Marvinpac', bal: '1078050' }
  ]);

  // État pour la section Papier en balles
  const [machineData, setMachineData] = useState<MachineRow[]>([
    { num1: '2.0.10', mac: 'Linde pinde H45', ball: '', heur: '100' },
    { num1: '2.0.07', mac: 'Linde pince H50', ball: '', heur: '100' },
    { num1: '2.0.08', mac: 'Linde H25/D600 tournant', ball: '', heur: '100' },
    { num1: '2.0.09', mac: 'Linde H25/D600 tournant', ball: '', heur: '100' },
    { num1: '2.0.11', mac: 'Linde transpal.Gerbeur P-F', ball: '', heur: '100' },
    { num1: '2.0.12', mac: 'Linde transpal.Gerbeur', ball: '', heur: '100' },
    { num1: '2.0.13', mac: 'Toyota fourche', ball: '', heur: '100' },
    { num1: '2.0.40', mac: 'Linde H45 tournante', ball: '', heur: '100' },
    { num1: '2.0.02', mac: 'Liebheer 526', ball: '', heur: '100' },
    { num1: '2.0.15', mac: 'Palan', ball: '', heur: '100' },
    { num1: '2.0.43', mac: 'Grue Fuchs 335 New', ball: '', heur: '100' },
    { num1: '2.0.38', mac: 'Grue Liebherr LH22', ball: '', heur: '100' },
    { num1: '2.0.39', mac: 'Grue Caterpilar MH3024', ball: '', heur: '100' },
    { num1: '2.0.17', mac: 'Compresseur GA 20VSD', ball: '', heur: '100' },
    { num1: '2.0.16', mac: 'Compresseur GA 30VSD', ball: '', heur: '100' },
    { num1: '2.0.25', mac: 'Aktid convoyeur', ball: '', heur: '100' },
    { num1: '2.0.22', mac: 'Forus / F400', ball: '', heur: '100' },
    { num1: '2.0.23', mac: 'Forus / BZ396', ball: '', heur: '100' },
    { num1: '2.0.27', mac: 'Broyeur Hammel', ball: '', heur: '100' },
    { num1: '2.0.34', mac: 'Tapis bois', ball: '', heur: '100' },
    { num1: '2.0.19', mac: 'Press Paal', ball: '', heur: '100' },
    { num1: '2.0.24', mac: 'Titech', ball: '', heur: '100' },
    { num1: '2.0.05', mac: 'Linde pince H50 NEW', ball: '', heur: '100' },
    { num1: '2.0.04', mac: 'Liebherr T60-9 S', ball: '', heur: '100' },
    { num1: '2.0.41', mac: 'Linde New H35', ball: '', heur: '100' },
    { num1: '2.0.41', mac: 'Linde New H25', ball: '', heur: '100' },
    { num1: '2.0.29', mac: 'Broyeur Satrindtech', ball: '', heur: '100' },
    { num1: '2.0.37', mac: 'Linde L12 Atelier', ball: '', heur: '100' }
  ]);

  // État pour la section Autres
  const [autresData, setAutresData] = useState<AutresData>({
    diesel: { litres: 0, piece: 0 },
    adBlue: { litres: 1900, piece: 18 },
    filFer: { litres: 0, piece: 0 },
    eau: {
      morgevon11: { m3: 0, compteur: 1078050 },
      morgevon13: { m3: 2354, compteur: 563623 },
      halleBois: { m3: 1727, compteur: 780398 }
    }
  });

  // État pour la section Contenants
  const [containersData, setContainersData] = useState<ContainerInventory[]>([
    { type: 'Conteneur 770L', quantite: 0, location: '' },
    { type: 'Conteneur 360L', quantite: 0, location: '' },
    { type: 'Conteneur 240L', quantite: 0, location: '' },
    { type: 'Conteneur 140L', quantite: 0, location: '' },
    { type: 'Conteneur 120L', quantite: 0, location: '' },
    { type: 'Conteneur 35L', quantite: 0, location: '' }
  ]);

  // État pour la section Sacs
  const [bagsData, setBagsData] = useState<BagInventory[]>([
    { type: 'Sacs 110L', quantite: 0, location: '' },
    { type: 'Sacs 60L', quantite: 0, location: '' },
    { type: 'Sacs 35L', quantite: 0, location: '' },
    { type: 'Sacs Biodégradables', quantite: 0, location: '' }
  ]);

  // Ajouter après les états existants
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [reportDate, setReportDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  });

  const reportDateLabel = useMemo(() => {
    try {
      return new Date(reportDate).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, [reportDate]);

  // Fonction pour sauvegarder toutes les données
  const saveAllData = async () => {
    try {
      setIsSaving(true);
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // Préparer les données pour la sauvegarde
      const inventoryData = {
        halle: halleData,
        plastique_balles: plastiqueBData,
        cdt: cdtData,
        papier: papierData,
        machines: machineData,
        autres: autresData,
        containers: containersData,
        bags: bagsData,
        month,
        year,
        created_at: new Date().toISOString()
      };

      // Sauvegarder dans le localStorage
      const key = `inventory_${year}_${month}`;
      localStorage.setItem(key, JSON.stringify(inventoryData));

      // TODO: Réimplémenter avec l'API backend si nécessaire
      // Les données sont sauvegardées dans localStorage pour l'instant

      toast.success('Données sauvegardées avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des données');
    } finally {
      setIsSaving(false);
    }
  };

  // Fonction pour charger les données du mois en cours
  const loadCurrentMonthData = async () => {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // TODO: Charger depuis l'API backend si nécessaire
      // Pour l'instant, on charge depuis localStorage
      {
        // Si pas de données Supabase, essayer le localStorage
        const key = `inventory_${year}_${month}`;
        const savedData = localStorage.getItem(key);

        if (savedData) {
          const data = JSON.parse(savedData);
          setHalleData(normalizeHalleData(data.halle));
          setPlastiqueBData(data.plastique_balles || plastiqueBData);
          setCdtData(data.cdt || cdtData);
          setPapierData(data.papier || papierData);
          setMachineData(data.machines || machineData);
          setAutresData(data.autres || autresData);
          setContainersData(data.containers || containersData);
          setBagsData(data.bags || bagsData);
        } else {
          setHalleData(HALLE_DEFAULT_ROWS);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
    }
  };

  // Ajouter useEffect pour charger les données au montage
  useEffect(() => {
    loadCurrentMonthData();
  }, []);

  // Ajouter une fonction pour sauvegarder automatiquement
  useEffect(() => {
    const autoSave = () => {
      saveAllData();
    };

    // Sauvegarder toutes les 5 minutes
    const interval = setInterval(autoSave, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [halleData, plastiqueBData, cdtData, papierData, machineData, autresData, containersData, bagsData]);

  // Fonctions de mise à jour
  const handleHalleChange = (index: number, field: keyof HalleRow, value: string) => {
    const newData = [...halleData];
    const parsedValue = field === 'matiere' ? value : parseFloat(value) || 0;
    newData[index] = { ...newData[index], [field]: parsedValue };
    setHalleData(newData);
  };

  const handlePlastiqueBChange = (index: number, field: keyof PlastiqueBRow, value: string) => {
    const newData = [...plastiqueBData];
    const parsedValue = field === 'matiere' ? value : parseInt(value, 10) || 0;
    newData[index] = { ...newData[index], [field]: parsedValue };
    setPlastiqueBData(newData);
  };

  const handleCDTChange = (index: number, field: keyof CdtRow, value: string) => {
    const newData = [...cdtData];
    const parsedValue = field === 'matiere' ? value : parseFloat(value) || 0;
    newData[index] = { ...newData[index], [field]: parsedValue };
    setCdtData(newData);
  };

  const handlePapierChange = (index: number, field: string, value: string) => {
    const newData = [...papierData];
    newData[index] = { ...newData[index], [field]: value };
    setPapierData(newData);
  };

  const handleContainerChange = (index: number, field: keyof ContainerInventory, value: string | number) => {
    const newData = [...containersData];
    newData[index] = { ...newData[index], [field]: value };
    setContainersData(newData);
  };

  const handleBagChange = (index: number, field: keyof BagInventory, value: string | number) => {
    const newData = [...bagsData];
    newData[index] = { ...newData[index], [field]: value };
    setBagsData(newData);
  };

  const handleMachineChange = (index: number, field: string, value: string) => {
    const newData = [...machineData];
    newData[index] = { ...newData[index], [field]: value };
    setMachineData(newData);
  };

  const getSnapshot = (): InventorySnapshot => ({
    halle: halleData,
    plastiqueB: plastiqueBData,
    cdt: cdtData,
    papier: papierData,
    machines: machineData,
    autres: autresData,
    containers: containersData,
    bags: bagsData
  });

  const handleDownloadPdf = () => {
    const pdf = buildInventoryPdf(reportDateLabel, getSnapshot());
    pdf.doc.save(pdf.filename);
  };

  const handlePreviewPdf = () => {
    try {
      const pdf = buildInventoryPdf(reportDateLabel, getSnapshot());
      const blobUrl = pdf.doc.output('bloburl') as unknown as string;
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  const handleExportExcel = () => {
    try {
      exportInventoryToExcel(reportDateLabel, getSnapshot());
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d\'exporter vers Excel');
    }
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const pdf = buildInventoryPdf(reportDateLabel, getSnapshot());
      const excel = buildInventoryExcelBase64(reportDateLabel, getSnapshot());
      await Api.sendInventorySheet({
        dateLabel: reportDateLabel,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename,
        excelBase64: excel.base64,
        excelFilename: excel.filename
      });
      toast.success('✅ Email envoyé avec succès ! Le PDF et le fichier Excel ont été transmis aux destinataires.', {
        duration: 5000
      });
      pdf.doc.save(pdf.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d\'envoyer le PDF');
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <section className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">Inventaires</p>
              <h1>Feuille d'inventaire</h1>
            <p>Gestion des stocks et inventaires de la halle.</p>
            <div className="destruction-field" style={{ maxWidth: 260, marginTop: 8 }}>
              <span>Date du relevé</span>
              <input
                type="datetime-local"
                className="destruction-input"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <p style={{ marginTop: 4 }}>Relevé du: {reportDateLabel}</p>
            </div>
            <div className="page-actions">
              <button
                onClick={handlePreviewPdf}
                className="btn btn-outline"
                disabled={isSending}
              >
                <FileText size={18} />
                Prévisualiser PDF
              </button>
              <button
                onClick={handleDownloadPdf}
                className="btn btn-outline"
              >
                <Download size={18} />
                Télécharger PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="btn btn-outline"
              >
                <Download size={18} />
                Exporter Excel
              </button>
              <button
                onClick={handleSendEmail}
                className="btn btn-primary"
                disabled={isSending}
              >
                {isSending ? (
                  'Envoi...'
                ) : (
                  <>
                    <Send size={18} />
                    Générer & envoyer
                  </>
                )}
              </button>
              <button
                onClick={saveAllData}
                disabled={isSaving}
                className="btn btn-primary"
              >
                <Save size={18} />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>

          <div className="destruction-card__body">
            {/* Navigation des onglets */}
            <div className="tab-nav">
              <button
                type="button"
                onClick={() => setActiveTab('plastiquebb')}
                className={activeTab === 'plastiquebb' ? 'active' : ''}
              >
                Plastique en BB
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plastiqueb')}
                className={activeTab === 'plastiqueb' ? 'active' : ''}
              >
                Plastique en balles
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cdt')}
                className={activeTab === 'cdt' ? 'active' : ''}
              >
                CDT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('papierballes')}
                className={activeTab === 'papierballes' ? 'active' : ''}
              >
                Papier en balles
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('autres')}
                className={activeTab === 'autres' ? 'active' : ''}
              >
                Autres
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('contenants')}
                className={activeTab === 'contenants' ? 'active' : ''}
              >
                Contenants
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sacs')}
                className={activeTab === 'sacs' ? 'active' : ''}
              >
                Sacs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('machine')}
                className={activeTab === 'machine' ? 'active' : ''}
              >
                Machine
              </button>
            </div>

            {activeTab === 'plastiquebb' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Plastique en BB</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Matière</th>
                        <th>BB</th>
                        <th>Palette</th>
                      </tr>
                    </thead>
                    <tbody>
                      {halleData.map((row, index) => (
                        <tr key={row.matiere}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={row.matiere}
                              onChange={(e) => handleHalleChange(index, 'matiere', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={row.bb}
                              onChange={(e) => handleHalleChange(index, 'bb', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={row.palette}
                              onChange={(e) => handleHalleChange(index, 'palette', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'plastiqueb' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Plastique en balles</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Matière</th>
                        <th>Balles</th>
                        <th>Palettes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plastiqueBData.map((item, index) => (
                        <tr key={item.matiere}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.matiere}
                              onChange={(e) => handlePlastiqueBChange(index, 'matiere', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={item.balles}
                              onChange={(e) => handlePlastiqueBChange(index, 'balles', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={item.palettes}
                              onChange={(e) => handlePlastiqueBChange(index, 'palettes', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section CDT */}
            {activeTab === 'cdt' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>CDT</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Matière</th>
                        <th>m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cdtData.map((item, index) => (
                        <tr key={item.matiere}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.matiere}
                              onChange={(e) => handleCDTChange(index, 'matiere', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={item.m3}
                              onChange={(e) => handleCDTChange(index, 'm3', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Papier en balles */}
            {activeTab === 'papierballes' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Papier en balles</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Numéro</th>
                        <th>Matière</th>
                        <th>N° de balles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {papierData.map((item, index) => (
                        <tr key={index}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.num}
                              onChange={(e) => handlePapierChange(index, 'num', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.mat}
                              onChange={(e) => handlePapierChange(index, 'mat', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.bal}
                              onChange={(e) => handlePapierChange(index, 'bal', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Autres */}
            {activeTab === 'autres' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Autres</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Litres</th>
                        <th>Pièce</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="sticky">Stock Diesel</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.diesel.litres}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              diesel: { ...autresData.diesel, litres: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.diesel.piece}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              diesel: { ...autresData.diesel, piece: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky">AD blue</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.adBlue.litres}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              adBlue: { ...autresData.adBlue, litres: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.adBlue.piece}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              adBlue: { ...autresData.adBlue, piece: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky">Stock fil de fer</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.filFer.litres}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              filFer: { ...autresData.filFer, litres: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.filFer.piece}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              filFer: { ...autresData.filFer, piece: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="destruction-section__header" style={{ marginTop: '24px' }}>
                  <h2>EAU (COMPTEUR)</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>m³</th>
                        <th>Compteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="sticky">Morgevon 11</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.morgevon11.m3}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                morgevon11: { ...autresData.eau.morgevon11, m3: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.morgevon11.compteur}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                morgevon11: { ...autresData.eau.morgevon11, compteur: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky">Morgevon 13</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.morgevon13.m3}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                morgevon13: { ...autresData.eau.morgevon13, m3: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.morgevon13.compteur}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                morgevon13: { ...autresData.eau.morgevon13, compteur: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky">Halle à bois</td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.halleBois.m3}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                halleBois: { ...autresData.eau.halleBois, m3: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="destruction-input"
                            value={autresData.eau.halleBois.compteur}
                            onChange={(e) => setAutresData({
                              ...autresData,
                              eau: {
                                ...autresData.eau,
                                halleBois: { ...autresData.eau.halleBois, compteur: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Contenants */}
            {activeTab === 'contenants' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Contenants</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Quantité</th>
                        <th>Localisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containersData.map((item, index) => (
                        <tr key={index}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.type}
                              onChange={(e) => handleContainerChange(index, 'type', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={item.quantite}
                              onChange={(e) => {
                                const newData = [...containersData];
                                newData[index] = { ...newData[index], quantite: parseInt(e.target.value) || 0 };
                                setContainersData(newData);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.location}
                              onChange={(e) => {
                                const newData = [...containersData];
                                newData[index] = { ...newData[index], location: e.target.value };
                                setContainersData(newData);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Sacs */}
            {activeTab === 'sacs' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Sacs</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Quantité</th>
                        <th>Localisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bagsData.map((item, index) => (
                        <tr key={index}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.type}
                              onChange={(e) => handleBagChange(index, 'type', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="destruction-input"
                              value={item.quantite}
                              onChange={(e) => {
                                const newData = [...bagsData];
                                newData[index] = { ...newData[index], quantite: parseInt(e.target.value) || 0 };
                                setBagsData(newData);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.location}
                              onChange={(e) => {
                                const newData = [...bagsData];
                                newData[index] = { ...newData[index], location: e.target.value };
                                setBagsData(newData);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Machine */}
            {activeTab === 'machine' && (
              <section className="destruction-section">
                <div className="destruction-section__header">
                  <h2>Machine</h2>
                </div>
                <div className="calendar-table-wrapper">
                  <table className="calendar-table">
                    <thead>
                      <tr>
                        <th>Numéro</th>
                        <th>Machine</th>
                        <th>N° de balles</th>
                        <th>Heures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineData.map((item, index) => (
                        <tr key={index}>
                          <td className="sticky">
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.num1}
                              onChange={(e) => handleMachineChange(index, 'num1', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.mac}
                              onChange={(e) => handleMachineChange(index, 'mac', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.ball}
                              onChange={(e) => handleMachineChange(index, 'ball', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="destruction-input"
                              value={item.heur}
                              onChange={(e) => handleMachineChange(index, 'heur', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section Signatures */}
            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Signatures</h2>
              </div>
              <div className="destruction-grid">
                <div>
                  <p className="destruction-label">Rempli par:</p>
                  <p>Ferreira Heder</p>
                </div>
                <div>
                  <p className="destruction-label">Vérifié par:</p>
                  <p>Nom: _________________</p>
                  <p>Signature: _________________</p>
                </div>
              </div>
            </section>

            {/* Section Date */}
            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>INVENTAIRE DU MOIS DE: {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildInventoryPdf(dateLabel: string, snapshot: InventorySnapshot) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin + 6;

  const safeDate = dateLabel.replace(/[^0-9a-zA-Z-_]/g, '_');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Feuille d\'inventaire - Centre de tri', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(dateLabel, margin, y + 6);
  y += 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin + 6;
    }
  };

  const addTable = (title: string, headers: string[], rows: Array<Array<string | number>>) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 6;

    const colWidth = (pageWidth - margin * 2) / headers.length;
    const rowHeight = 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    headers.forEach((header, idx) => {
      const x = margin + idx * colWidth;
      doc.setFillColor(233, 233, 233);
      doc.rect(x, y, colWidth, rowHeight, 'F');
      doc.setTextColor(0);
      doc.text(header, x + 1.5, y + rowHeight / 2 + 1.5);
    });
    y += rowHeight;

    doc.setFont('helvetica', 'normal');
    rows.forEach((row) => {
      ensureSpace(rowHeight);
      row.forEach((cell, idx) => {
        const x = margin + idx * colWidth;
        doc.rect(x, y, colWidth, rowHeight);
        doc.text(String(cell ?? '-'), x + 1.5, y + rowHeight / 2 + 1.5);
      });
      y += rowHeight;
    });

    y += 6;
  };

  addTable('Plastique en BB', ['Matière', 'BB', 'Palette'], snapshot.halle.map((row) => [row.matiere, row.bb, row.palette]));
  addTable(
    'Plastique en balles',
    ['Matière', 'Balles', 'Palettes'],
    snapshot.plastiqueB.map((row) => [row.matiere, row.balles, row.palettes])
  );
  addTable('CDT', ['Matière', 'm³'], snapshot.cdt.map((row) => [row.matiere, row.m3]));
  addTable('Papier en balles', ['Numéro', 'Matière', 'N° de balles'], snapshot.papier.map((row) => [row.num, row.mat, row.bal]));
  addTable('Machines', ['Numéro', 'Machine', 'N° de balles', 'Heures'], snapshot.machines.map((row) => [row.num1, row.mac, row.ball, row.heur]));
  addTable(
    'Autres consommables',
    ['Libellé', 'Valeur 1', 'Valeur 2'],
    [
      ['Stock Diesel', snapshot.autres.diesel.litres, snapshot.autres.diesel.piece],
      ['Stock AdBlue', snapshot.autres.adBlue.litres, snapshot.autres.adBlue.piece],
      ['Fil de fer', snapshot.autres.filFer.litres, snapshot.autres.filFer.piece],
      ['Eau Morgevon 11', snapshot.autres.eau.morgevon11.m3, snapshot.autres.eau.morgevon11.compteur],
      ['Eau Morgevon 13', snapshot.autres.eau.morgevon13.m3, snapshot.autres.eau.morgevon13.compteur],
      ['Eau Halle bois', snapshot.autres.eau.halleBois.m3, snapshot.autres.eau.halleBois.compteur]
    ]
  );
  addTable(
    'Contenants',
    ['Type', 'Quantité', 'Localisation'],
    snapshot.containers.map((row) => [row.type, row.quantite, row.location])
  );
  addTable('Sacs', ['Type', 'Quantité', 'Localisation'], snapshot.bags.map((row) => [row.type, row.quantite, row.location]));

  const filename = `inventaire_${safeDate}.pdf`;
  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  return { doc, base64, filename };
}

const sanitizeFileLabel = (label: string) => label.replace(/[^0-9a-zA-Z-_]/g, '_');

function createInventoryWorkbook(snapshot: InventorySnapshot) {
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, headers: string[], rows: Array<Array<string | number>>) => {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  };

  addSheet('Plastique BB', ['Matière', 'BB', 'Palette'], snapshot.halle.map((row) => [row.matiere, row.bb, row.palette]));
  addSheet('Plastique balles', ['Matière', 'Balles', 'Palettes'], snapshot.plastiqueB.map((row) => [row.matiere, row.balles, row.palettes]));
  addSheet('CDT', ['Matière', 'm³'], snapshot.cdt.map((row) => [row.matiere, row.m3]));
  addSheet('Papier balles', ['Numéro', 'Matière', 'N° de balles'], snapshot.papier.map((row) => [row.num, row.mat, row.bal]));
  addSheet('Machines', ['Numéro', 'Machine', 'N° de balles', 'Heures'], snapshot.machines.map((row) => [row.num1, row.mac, row.ball, row.heur]));
  addSheet(
    'Autres',
    ['Libellé', 'Valeur 1', 'Valeur 2'],
    [
      ['Stock Diesel', snapshot.autres.diesel.litres, snapshot.autres.diesel.piece],
      ['Stock AdBlue', snapshot.autres.adBlue.litres, snapshot.autres.adBlue.piece],
      ['Fil de fer', snapshot.autres.filFer.litres, snapshot.autres.filFer.piece],
      ['Eau Morgevon 11', snapshot.autres.eau.morgevon11.m3, snapshot.autres.eau.morgevon11.compteur],
      ['Eau Morgevon 13', snapshot.autres.eau.morgevon13.m3, snapshot.autres.eau.morgevon13.compteur],
      ['Eau Halle bois', snapshot.autres.eau.halleBois.m3, snapshot.autres.eau.halleBois.compteur]
    ]
  );
  addSheet('Contenants', ['Type', 'Quantité', 'Localisation'], snapshot.containers.map((row) => [row.type, row.quantite, row.location]));
  addSheet('Sacs', ['Type', 'Quantité', 'Localisation'], snapshot.bags.map((row) => [row.type, row.quantite, row.location]));

  return wb;
}

function exportInventoryToExcel(dateLabel: string, snapshot: InventorySnapshot) {
  const wb = createInventoryWorkbook(snapshot);
  const safeDate = sanitizeFileLabel(dateLabel);
  XLSX.writeFile(wb, `inventaire_${safeDate}.xlsx`);
}

function buildInventoryExcelBase64(dateLabel: string, snapshot: InventorySnapshot) {
  const wb = createInventoryWorkbook(snapshot);
  const safeDate = sanitizeFileLabel(dateLabel);
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return {
    base64,
    filename: `inventaire_${safeDate}.xlsx`
  };
}
