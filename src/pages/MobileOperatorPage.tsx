import { useEffect, useState, useRef } from 'react';
import {
  Camera,
  MapPin,
  Mic,
  QrCode,
  PenTool,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Square,
  X,
  Save,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type Intervention, type InterventionPhoto, type InterventionSignature, type QRScan, type VoiceNote } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { offlineSyncManager } from '../utils/offlineSync';

export const MobileOperatorPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [photos, setPhotos] = useState<InterventionPhoto[]>([]);
  const [signatures, setSignatures] = useState<InterventionSignature[]>([]);
  const [scans, setScans] = useState<QRScan[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPhotoType, setCameraPhotoType] = useState<'before' | 'after' | 'other'>('before');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // QR Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Signature
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureType, setSignatureType] = useState<'customer' | 'operator' | 'witness'>('customer');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Fonction helper pour convertir la clé VAPID en Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        // Récupérer la clé publique VAPID depuis le serveur
        const { publicKey } = await Api.getPushPublicKey();
        
        // Convertir la clé publique en Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        
        // Demander la permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          
          // Vérifier si une subscription existe déjà
          let subscription = await registration.pushManager.getSubscription();
          
          if (!subscription) {
            // Créer une nouvelle subscription
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            });
          }
          
          // Envoyer le token au serveur
          await Api.registerPushToken({
            subscription,
            device_type: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 
                        /Android/.test(navigator.userAgent) ? 'android' : 'web',
            device_info: navigator.userAgent
          });
          
          console.log('Notifications push activées');
        }
      } catch (error: any) {
        console.error('Erreur configuration notifications push:', error);
        // Ne pas afficher d'erreur à l'utilisateur si les notifications ne sont pas configurées
        if (error.message && !error.message.includes('503')) {
          console.warn('Notifications push non disponibles');
        }
      }
    }
  };

  useEffect(() => {
    loadInterventions();
    setupGeolocation();
    setupOnlineStatus();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (selectedIntervention) {
      loadInterventionDetails(selectedIntervention.id);
    }
  }, [selectedIntervention]);

  const setupGeolocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          // Mettre à jour automatiquement la géolocalisation de l'intervention en cours
          if (selectedIntervention && selectedIntervention.status === 'pending') {
            updateGeolocation(selectedIntervention.id, 'current');
          }
        },
        (error) => {
          console.error('Erreur géolocalisation:', error);
        },
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    }
  };

  const setupOnlineStatus = () => {
    window.addEventListener('online', () => {
      setIsOnline(true);
      toast.success('Connexion rétablie');
      syncOfflineData();
    });
    window.addEventListener('offline', () => {
      setIsOnline(false);
      toast.error('Mode hors ligne activé');
    });
  };

  const loadInterventions = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchInterventions({ status: 'pending' });
      // Filtrer les interventions assignées à l'utilisateur actuel
      // Note: Il faudrait vérifier l'employee_id de l'utilisateur
      setInterventions(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des interventions');
    } finally {
      setLoading(false);
    }
  };

  const loadInterventionDetails = async (interventionId: string) => {
    try {
      const [photosData, signaturesData, scansData, voiceNotesData] = await Promise.all([
        Api.fetchInterventionPhotos(interventionId),
        Api.fetchInterventionSignatures(interventionId),
        Api.fetchInterventionScans(interventionId),
        Api.fetchInterventionVoiceNotes(interventionId)
      ]);
      setPhotos(photosData);
      setSignatures(signaturesData);
      setScans(scansData);
      setVoiceNotes(voiceNotesData);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des détails');
    }
  };

  const updateGeolocation = async (interventionId: string, locationType: 'arrival' | 'completion' | 'current') => {
    if (!currentLocation) return;
    try {
      await Api.updateInterventionGeolocation(interventionId, {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        location_type: locationType
      });
    } catch (error: any) {
      console.error('Erreur géolocalisation:', error);
    }
  };

  const syncOfflineData = async () => {
    try {
      await offlineSyncManager.sync();
      const queueLength = offlineSyncManager.getQueueLength();
      if (queueLength === 0) {
        toast.success('Toutes les données sont synchronisées');
      } else {
        toast.success(`${queueLength} élément(s) en attente de synchronisation`);
      }
    } catch (error: any) {
      console.error('Erreur synchronisation:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
    } catch (error: any) {
      toast.error('Impossible d\'accéder à la caméra');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedIntervention) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      const photoPayload = {
        photo_type: cameraPhotoType,
        photo_data: photoData,
        mime_type: 'image/jpeg',
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng
      };
      try {
        if (navigator.onLine) {
          await Api.createInterventionPhoto(selectedIntervention.id, photoPayload);
          toast.success('Photo enregistrée');
        } else {
          // Mode offline : ajouter à la file d'attente
          offlineSyncManager.addToQueue('intervention_photo', 'create', {
            intervention_id: selectedIntervention.id,
            ...photoPayload
          });
          toast.success('Photo enregistrée (synchronisation à la reconnexion)');
        }
        stopCamera();
        await loadInterventionDetails(selectedIntervention.id);
      } catch (error: any) {
        // En cas d'erreur, ajouter à la file d'attente
        offlineSyncManager.addToQueue('intervention_photo', 'create', {
          intervention_id: selectedIntervention.id,
          ...photoPayload
        });
        toast.success('Photo enregistrée (synchronisation à la reconnexion)');
        stopCamera();
      }
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (selectedIntervention) {
            const voiceNotePayload = {
              audio_data: base64Audio.split(',')[1], // Remove data:audio/webm;base64,
              mime_type: 'audio/webm',
              latitude: currentLocation?.lat,
              longitude: currentLocation?.lng
            };
            try {
              if (navigator.onLine) {
                await Api.createInterventionVoiceNote(selectedIntervention.id, voiceNotePayload);
                toast.success('Note vocale enregistrée');
              } else {
                offlineSyncManager.addToQueue('voice_note', 'create', {
                  intervention_id: selectedIntervention.id,
                  ...voiceNotePayload
                });
                toast.success('Note vocale enregistrée (synchronisation à la reconnexion)');
              }
              await loadInterventionDetails(selectedIntervention.id);
            } catch (error: any) {
              offlineSyncManager.addToQueue('voice_note', 'create', {
                intervention_id: selectedIntervention.id,
                ...voiceNotePayload
              });
              toast.success('Note vocale enregistrée (synchronisation à la reconnexion)');
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setAudioChunks([]);
    } catch (error: any) {
      toast.error('Impossible d\'accéder au microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 400;
      canvas.height = 200;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignature = async () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !selectedIntervention) return;
    const signatureData = canvas.toDataURL('image/png');
    const signaturePayload = {
      signature_type: signatureType,
      signature_data: signatureData,
      latitude: currentLocation?.lat,
      longitude: currentLocation?.lng,
      device_info: navigator.userAgent
    };
    try {
      if (navigator.onLine) {
        await Api.createInterventionSignature(selectedIntervention.id, signaturePayload);
        toast.success('Signature enregistrée');
      } else {
        offlineSyncManager.addToQueue('intervention_signature', 'create', {
          intervention_id: selectedIntervention.id,
          ...signaturePayload
        });
        toast.success('Signature enregistrée (synchronisation à la reconnexion)');
      }
      setShowSignatureModal(false);
      await loadInterventionDetails(selectedIntervention.id);
    } catch (error: any) {
      offlineSyncManager.addToQueue('intervention_signature', 'create', {
        intervention_id: selectedIntervention.id,
        ...signaturePayload
      });
      toast.success('Signature enregistrée (synchronisation à la reconnexion)');
      setShowSignatureModal(false);
    }
  };

  const handleQRScan = async (codeValue: string) => {
    if (!selectedIntervention || !codeValue.trim()) return;
    const scanPayload = {
      scan_type: 'qr_code' as const,
      code_value: codeValue,
      latitude: currentLocation?.lat,
      longitude: currentLocation?.lng,
      device_info: navigator.userAgent
    };
    try {
      if (navigator.onLine) {
        await Api.createInterventionScan(selectedIntervention.id, scanPayload);
        toast.success('Code scanné et enregistré');
      } else {
        offlineSyncManager.addToQueue('qr_scan', 'create', {
          intervention_id: selectedIntervention.id,
          ...scanPayload
        });
        toast.success('Code scanné (synchronisation à la reconnexion)');
      }
      await loadInterventionDetails(selectedIntervention.id);
      setShowQRScanner(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    } catch (error: any) {
      offlineSyncManager.addToQueue('qr_scan', 'create', {
        intervention_id: selectedIntervention.id,
        ...scanPayload
      });
      toast.success('Code scanné (synchronisation à la reconnexion)');
      setShowQRScanner(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const startIntervention = async (interventionId: string) => {
    try {
      await Api.updateInterventionTiming(interventionId, {
        start_time: new Date().toISOString()
      });
      await Api.updateIntervention(interventionId, { status: 'in_progress' });
      toast.success('Intervention démarrée');
      await loadInterventions();
      if (currentLocation) {
        await updateGeolocation(interventionId, 'arrival');
      }
    } catch (error: any) {
      toast.error('Erreur lors du démarrage');
    }
  };

  const completeIntervention = async (interventionId: string) => {
    try {
      await Api.updateInterventionTiming(interventionId, {
        end_time: new Date().toISOString()
      });
      await Api.updateIntervention(interventionId, { status: 'completed' });
      toast.success('Intervention terminée');
      await loadInterventions();
      if (currentLocation) {
        await updateGeolocation(interventionId, 'completion');
      }
      setSelectedIntervention(null);
    } catch (error: any) {
      toast.error('Erreur lors de la finalisation');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="spinner" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Application Mobile Opérateur</h1>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-600">
              <Wifi size={16} />
              En ligne
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600">
              <WifiOff size={16} />
              Hors ligne ({offlineSyncManager.getQueueLength()} en attente)
            </span>
          )}
          {currentLocation && (
            <span className="text-xs text-gray-500">
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </span>
          )}
          {!isOnline && offlineSyncManager.getQueueLength() > 0 && (
            <button onClick={syncOfflineData} className="btn-secondary text-xs">
              <Upload size={14} />
              Sync
            </button>
          )}
        </div>
      </div>

      {!selectedIntervention ? (
        <div className="page-content">
          <h2 className="text-lg font-semibold mb-4">Mes interventions</h2>
          {interventions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Aucune intervention assignée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="bg-white p-4 rounded-lg border cursor-pointer hover:border-blue-500"
                  onClick={() => setSelectedIntervention(intervention)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{intervention.title}</h3>
                      <p className="text-sm text-gray-600">{intervention.customer_name}</p>
                      {intervention.customer_address && (
                        <p className="text-xs text-gray-500">{intervention.customer_address}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        intervention.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : intervention.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {intervention.priority}
                    </span>
                  </div>
                  {intervention.description && (
                    <p className="text-sm text-gray-700 mb-2">{intervention.description}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startIntervention(intervention.id);
                        setSelectedIntervention(intervention);
                      }}
                      className="btn-primary flex-1"
                    >
                      <Play size={16} />
                      Démarrer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="page-content">
          <div className="mb-4">
            <button
              onClick={() => {
                setSelectedIntervention(null);
                setPhotos([]);
                setSignatures([]);
                setScans([]);
                setVoiceNotes([]);
              }}
              className="btn-secondary mb-2"
            >
              ← Retour
            </button>
            <h2 className="text-xl font-semibold">{selectedIntervention.title}</h2>
            <p className="text-sm text-gray-600">{selectedIntervention.customer_name}</p>
          </div>

          {/* Actions rapides */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                setCameraPhotoType('before');
                startCamera();
              }}
              className="btn-secondary flex flex-col items-center gap-2 py-4"
            >
              <Camera size={24} />
              <span>Photo avant</span>
            </button>
            <button
              onClick={() => {
                setCameraPhotoType('after');
                startCamera();
              }}
              className="btn-secondary flex flex-col items-center gap-2 py-4"
            >
              <Camera size={24} />
              <span>Photo après</span>
            </button>
            <button
              onClick={() => setShowQRScanner(true)}
              className="btn-secondary flex flex-col items-center gap-2 py-4"
            >
              <QrCode size={24} />
              <span>Scanner QR</span>
            </button>
            <button
              onClick={() => {
                setSignatureType('customer');
                setShowSignatureModal(true);
                setTimeout(initSignatureCanvas, 100);
              }}
              className="btn-secondary flex flex-col items-center gap-2 py-4"
            >
              <PenTool size={24} />
              <span>Signature</span>
            </button>
          </div>

          {/* Enregistrement vocal */}
          <div className="mb-6">
            <button
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              className={`w-full btn-secondary flex items-center justify-center gap-2 py-4 ${
                isRecording ? 'bg-red-100 text-red-800' : ''
              }`}
            >
              {isRecording ? (
                <>
                  <Square size={24} />
                  <span>Arrêter l'enregistrement</span>
                </>
              ) : (
                <>
                  <Mic size={24} />
                  <span>Note vocale</span>
                </>
              )}
            </button>
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Photos</h3>
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={`data:${photo.mime_type};base64,${photo.photo_data}`}
                      alt={photo.photo_type}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <span className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                      {photo.photo_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scans */}
          {scans.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Codes scannés</h3>
              <div className="space-y-2">
                {scans.map((scan) => (
                  <div key={scan.id} className="bg-gray-50 p-2 rounded text-sm">
                    <span className="font-mono">{scan.code_value}</span>
                    <span className="text-gray-500 ml-2">
                      {format(new Date(scan.scanned_at), 'HH:mm', { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          {signatures.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Signatures</h3>
              <div className="space-y-2">
                {signatures.map((signature) => (
                  <div key={signature.id} className="bg-gray-50 p-2 rounded">
                    <img
                      src={`data:image/png;base64,${signature.signature_data}`}
                      alt={signature.signature_type}
                      className="h-20 border rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {signature.signer_name || signature.signature_type} -{' '}
                      {format(new Date(signature.signed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes vocales */}
          {voiceNotes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Notes vocales</h3>
              <div className="space-y-2">
                {voiceNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 p-3 rounded flex items-center gap-2">
                    <Play size={20} className="text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm">
                        {note.duration_seconds ? `${Math.round(note.duration_seconds)}s` : 'Audio'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(note.recorded_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finaliser */}
          <div className="mt-6">
            <button
              onClick={() => completeIntervention(selectedIntervention.id)}
              className="w-full btn-primary py-4 flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              Finaliser l'intervention
            </button>
          </div>
        </div>
      )}

      {/* Modal Camera */}
      {showCamera && (
        <div className="modal-overlay">
          <div className="modal-content bg-black">
            <div className="relative">
              <video ref={videoRef} autoPlay className="w-full" style={{ maxHeight: '70vh' }} />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute top-4 right-4">
                <button onClick={stopCamera} className="bg-red-600 text-white p-2 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="bg-white p-4 rounded-full shadow-lg"
                >
                  <Camera size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Scanner */}
      {showQRScanner && (
        <div className="modal-overlay" onClick={() => setShowQRScanner(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Scanner QR Code</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Entrez le code manuellement ou utilisez le scanner de votre appareil
              </p>
              <input
                ref={qrInputRef}
                type="text"
                placeholder="Code QR / Code-barres"
                className="w-full p-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleQRScan(e.currentTarget.value);
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowQRScanner(false)} className="btn-secondary">
                Annuler
              </button>
              <button
                onClick={() => {
                  if (qrInputRef.current) {
                    handleQRScan(qrInputRef.current.value);
                  }
                }}
                className="btn-primary"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Signature */}
      {showSignatureModal && (
        <div className="modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Signature électronique</h2>
            <div className="mb-4">
              <label>Type de signature</label>
              <select
                value={signatureType}
                onChange={(e) => setSignatureType(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="customer">Client</option>
                <option value="operator">Opérateur</option>
                <option value="witness">Témoin</option>
              </select>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded mb-4">
              <canvas
                ref={signatureCanvasRef}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={clearSignature} className="btn-secondary flex-1">
                Effacer
              </button>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSignatureModal(false)} className="btn-secondary">
                Annuler
              </button>
              <button onClick={saveSignature} className="btn-primary">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

