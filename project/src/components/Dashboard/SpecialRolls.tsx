import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config';
import { Package, QrCode, Eye, Clock, MapPin, User, Plus, Upload, Navigation, CheckCircle2, X, Trash2 } from 'lucide-react';
import ClientFilterAlert from '../ClientFilterAlert';


interface SpecialRollDTO {
  id: string;
  number: string;
  itemName: string;
  description?: string | null;
  weight?: string | null;
  expectedReturnAt?: string | null;
  status: string;
  currentLocation?: string | null;
  priority?: number | null;
  attachments?: string | null;
  senderName?: string | null;
  qualityNotes?: string | null;
  receivedPhoto?: string | null;
  finalWeight?: string | null;
  dispatchedPhoto?: string | null;
  dispatchedBy?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  clientId?: string | null;
  linenItemId?: string | null;
  client?: {
    id: string;
    name: string;
  } | null;
  linenItem?: {
    id: string;
    name: string;
  } | null;
}

interface SpecialRollEvent {
  id: string;
  eventType: string;
  note?: string | null;
  location?: string | null;
  userId?: string | null;
  timestamp: string;
}

const STATUS_LABELS = {
  received: 'Recebido',
  enviado: 'Enviado',
  washing: 'Lavagem',
  drying: 'Secagem',
  quality_check: 'Controle de Qualidade',
  ready: 'Pronto',
  dispatched: 'Expedido',
  returned: 'Devolvido',
  cancelled: 'Cancelado'
};

// Ordem sequencial das etapas
const FLOW_ORDER = [
  'received',        // 1. Recebido
  'washing',         // 2. Lavagem  
  'drying',          // 3. Secagem
  'quality_check',   // 4. Controle de Qualidade
  'ready',           // 5. Pronto
  'dispatched'       // 6. Expedido
];

// Função para obter próximas etapas válidas
const getValidNextStatuses = (currentStatus: string): string[] => {
  const validStatuses = ['cancelled', 'returned']; // Status especiais sempre permitidos
  
  const currentIndex = FLOW_ORDER.indexOf(currentStatus);
  if (currentIndex === -1) return validStatuses;
  
  // Adicionar próxima etapa se existir
  if (currentIndex + 1 < FLOW_ORDER.length) {
    validStatuses.push(FLOW_ORDER[currentIndex + 1]);
  }
  
  // Adicionar etapa anterior se existir
  if (currentIndex - 1 >= 0) {
    validStatuses.push(FLOW_ORDER[currentIndex - 1]);
  }
  
  return validStatuses;
};

const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-800',
  enviado: 'bg-cyan-100 text-cyan-800',
  washing: 'bg-yellow-100 text-yellow-800',
  drying: 'bg-orange-100 text-orange-800',
  quality_check: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  dispatched: 'bg-indigo-100 text-indigo-800',
  returned: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
};

const SpecialRolls: React.FC = () => {
  const { clients, adminClientIdFilter } = useApp();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<SpecialRollDTO[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false); // indicador discreto
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ 
    itemName: '', 
    description: '', 
    quantity: '',
    weight: '', 
    priority: 3,
    clientId: '',
    senderName: ''
  });
  const [detail, setDetail] = useState<SpecialRollDTO | null>(null);
  const [events, setEvents] = useState<SpecialRollEvent[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrRoll, setQrRoll] = useState<SpecialRollDTO | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [receivedPreviewUrl, setReceivedPreviewUrl] = useState<string | null>(null);
  const [dispatchedPreviewUrl, setDispatchedPreviewUrl] = useState<string | null>(null);
  const [isReceivedSubmitting, setIsReceivedSubmitting] = useState(false);
  const [isDispatchedSubmitting, setIsDispatchedSubmitting] = useState(false);
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
  const [isDispatchedModalOpen, setIsDispatchedModalOpen] = useState(false);
  const [receivedForm, setReceivedForm] = useState({
    expectedReturnAt: '',
    qualityNotes: '',
    receivedPhoto: null as File | null,
    location: ''
  });
  const [dispatchedForm, setDispatchedForm] = useState({
    finalWeight: '',
    dispatchedPhoto: null as File | null,
    dispatchedBy: '',
    location: ''
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationModalType, setLocationModalType] = useState<'received' | 'dispatched'>('received');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [locationMessage, setLocationMessage] = useState('');

  const api = useMemo(() => getApiBaseUrl(), []);
  const lastFetchAtRef = useRef<number>(0);
  const lastDataSigRef = useRef<string>('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchList = async (opts?: { silent?: boolean }) => {
    const showSpinner = !opts?.silent;
    const now = Date.now();
    // Throttle silent updates (min 2000ms entre chamadas)
    if (opts?.silent && now - lastFetchAtRef.current < 2000) {
      return;
    }
    if (showSpinner) setLoading(true); else setIsUpdating(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (q.trim().length > 0) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (adminClientIdFilter) params.set('clientId', adminClientIdFilter);
      const res = await fetch(`${api}/special-rolls?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        // Assinar dados para evitar re-render desnecessário
        const data = j.data as SpecialRollDTO[];
        const totalNext = j.total as number;
        const signature = JSON.stringify({
          total: totalNext,
          data: data.map(d => ({ id: d.id, status: d.status, updatedAt: d.updatedAt || d.createdAt }))
        });
        if (signature !== lastDataSigRef.current) {
          lastDataSigRef.current = signature;
          setList(data);
          setTotal(totalNext);
        }
        lastFetchAtRef.current = now;
      }
    } finally {
      if (showSpinner) setLoading(false); else setIsUpdating(false);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, status, adminClientIdFilter]);

  // Sistema de atualização em tempo real (sem spinner)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // BroadcastChannel para comunicação entre abas
    const channel = new BroadcastChannel('ecolav-app');
    channel.onmessage = async (event) => {
      const type = event?.data?.type;
      if (type === 'special-rolls-changed' || type === 'orders-changed') {
        await fetchList({ silent: true });
      }
    };

    // Refresh quando a aba ganha foco
    const handleFocus = () => {
      fetchList({ silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      channel.close();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleReceivedPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limitar tamanho bruto (20MB nginx) e comprimir imagem em clientes móveis
    if (file.size > 20 * 1024 * 1024) {
      alert('Imagem muito grande (limite 20MB). Selecione uma menor.');
      return;
    }
    (async () => {
      const compressed = await compressImageSafely(file, 1280, 0.8);
      setReceivedForm({ ...receivedForm, receivedPhoto: compressed });
      try { receivedPreviewCleanup(); } catch {
        // Ignore cleanup errors
      }
      const url = URL.createObjectURL(compressed);
      setReceivedPreviewUrl(url);
    })();
  };

  const handleDispatchedPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('Imagem muito grande (limite 20MB). Selecione uma menor.');
      return;
    }
    (async () => {
      const compressed = await compressImageSafely(file, 1280, 0.8);
      setDispatchedForm({ ...dispatchedForm, dispatchedPhoto: compressed });
      try { dispatchedPreviewCleanup(); } catch {
        // Ignore cleanup errors
      }
      const url = URL.createObjectURL(compressed);
      setDispatchedPreviewUrl(url);
    })();
  };

  const receivedPreviewCleanup = () => {
    if (receivedPreviewUrl) URL.revokeObjectURL(receivedPreviewUrl);
  };
  const dispatchedPreviewCleanup = () => {
    if (dispatchedPreviewUrl) URL.revokeObjectURL(dispatchedPreviewUrl);
  };
  
  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      receivedPreviewCleanup();
      dispatchedPreviewCleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Utilitário: comprimir imagem em canvas com fallback seguro
  const compressImageSafely = async (file: File, maxDim: number, quality: number): Promise<File> => {
    try {
      if (!file.type.startsWith('image/')) return file;
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) return file;
      const { width, height } = bitmap;
      if (width <= maxDim && height <= maxDim) return file;
      const ratio = width > height ? maxDim / width : maxDim / height;
      const targetW = Math.round(width * ratio);
      const targetH = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b || file), mime, quality));
      return new File([blob], file.name.replace(/\.(png|jpg|jpeg|webp)$/i, mime === 'image/png' ? '.png' : '.jpg'), { type: blob.type });
    } catch {
      return file;
    }
  };

  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          resolve(location);
        },
        (error) => {
          let errorMessage = 'Erro ao obter localização';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível';
              break;
            case error.TIMEOUT:
              errorMessage = 'Timeout ao obter localização';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  // Reverse geocoding (coords -> endereço legível)
  const reverseGeocode = async (coords: string): Promise<string | null> => {
    try {
      const [latStr, lonStr] = coords.split(',').map(s => s.trim());
      const lat = Number(latStr);
      const lon = Number(lonStr);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      // Nominatim usage: include User-Agent identificável e rate limiting lado cliente implícito pelo uso pontual
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=pt-BR&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Ecolav/0.2.0 (ti@textilecolav.com.br)' } });
      if (!res.ok) return null;
      const j: { address?: { road?: string; house_number?: string; suburb?: string; neighbourhood?: string; city?: string; town?: string; village?: string; state?: string; postcode?: string } } = await res.json();
      const a = j?.address || {};
      const parts = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state, a.postcode]
        .filter(Boolean)
        .join(', ');
      return parts || (j?.display_name ?? null);
    } catch { return null; }
  };

  const handleGetLocation = (formType: 'received' | 'dispatched') => {
    // Verificar se o navegador suporta geolocalização
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Seu navegador não suporta geolocalização. Por favor, digite a localização manualmente.');
      setShowLocationModal(true);
      return;
    }

    setLocationModalType(formType);
    setLocationStatus('idle');
    setLocationMessage('');
    setShowLocationModal(true);
  };

  const handleConfirmLocation = async () => {
    setLocationStatus('requesting');
    setLocationMessage('Obtendo sua localização...');

    try {
      const location = await getCurrentLocation();
      // Tentar converter para endereço legível
      const human = await reverseGeocode(location);
      const finalLocation = human ? `${human} (${location})` : location;

      if (locationModalType === 'received') {
        setReceivedForm({ ...receivedForm, location: finalLocation });
      } else {
        setDispatchedForm({ ...dispatchedForm, location: finalLocation });
      }
      
      setLocationStatus('success');
      setLocationMessage(`Localização capturada com sucesso!\n\n${human ? `Endereço: ${human}\n` : ''}Coordenadas: ${location}\n\nVocê pode editar manualmente se necessário.`);
    } catch (error) {
      console.warn('Erro ao obter localização:', error);
      
      // Mostrar erro específico para o usuário
      let errorMessage = 'Não foi possível obter sua localização.';
      if (error instanceof Error) {
        if (error.message.includes('Permissão')) {
          errorMessage = 'Permissão de localização negada. Por favor, digite a localização manualmente.';
        } else if (error.message.includes('indisponível')) {
          errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
        } else if (error.message.includes('Timeout')) {
          errorMessage = 'Timeout ao obter localização. Tente novamente ou digite manualmente.';
        }
      }
      
      setLocationStatus('error');
      setLocationMessage(errorMessage);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName.trim()) return;
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('itemName', form.itemName.trim());
      formData.append('description', form.description.trim() || '');
      formData.append('quantity', form.quantity.trim() || '');
      formData.append('weight', form.weight.trim() || '');
      formData.append('priority', (Number(form.priority) || 3).toString());
      formData.append('clientId', form.clientId || '');
      formData.append('senderName', form.senderName.trim() || '');
      
      if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      const res = await fetch(`${api}/special-rolls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setForm({ itemName: '', description: '', quantity: '', weight: '', priority: 3, clientId: '', senderName: '' });
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsAddModalOpen(false);
        setPage(1);
        await fetchList();
        
        // Notificar outras abas sobre a mudança
        try {
          new BroadcastChannel('ecolav-app').postMessage({ type: 'special-rolls-changed' });
        } catch { /* ignore */ }
      }
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (id: string) => {
    const res = await fetch(`${api}/special-rolls/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setDetail(await res.json());
      // Buscar eventos
      const eventsRes = await fetch(`${api}/special-rolls/${id}/events`, { headers: { Authorization: `Bearer ${token}` } });
      if (eventsRes.ok) {
        setEvents(await eventsRes.json());
      }
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const res = await fetch(`${api}/special-rolls/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (res.ok) {
      await fetchList();
      if (detail?.id === id) await openDetail(id);
      
      // Notificar outras abas sobre a mudança
      try {
        new BroadcastChannel('ecolav-app').postMessage({ type: 'special-rolls-changed' });
      } catch { /* ignore */ }
    } else {
      // Tratar erro de transição inválida
      const errorData = await res.json().catch(() => ({}));
      if (errorData.error === 'InvalidStatusTransition') {
        alert(`❌ ${errorData.message}\n\nEtapas válidas: ${errorData.validNextStatuses?.join(', ') || 'Nenhuma'}`);
      } else {
        alert('❌ Erro ao atualizar status. Tente novamente.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    const ok = window.confirm('Tem certeza que deseja excluir este ROL? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      let res = await fetch(`${api}/special-rolls/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404 && detail?.id === id && detail?.number) {
        // Fallback: tentar por número
        res = await fetch(`${api}/special-rolls/by-number/${encodeURIComponent(detail.number)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (res.status === 204) {
        if (detail?.id === id) { setDetail(null); setEvents([]); }
        setPage(1);
        await fetchList({ silent: true });
        try { new BroadcastChannel('ecolav-app').postMessage({ type: 'special-rolls-changed' }); } catch { /* ignore */ }
      } else {
        alert('Falha ao excluir o ROL.');
      }
    } catch {
      alert('Erro de rede ao excluir o ROL.');
    }
  };

  const handleReceivedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setIsReceivedSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'received');
      formData.append('expectedReturnAt', receivedForm.expectedReturnAt);
      formData.append('qualityNotes', receivedForm.qualityNotes);
      formData.append('currentLocation', receivedForm.location);
      
      if (receivedForm.receivedPhoto) {
        formData.append('receivedPhoto', receivedForm.receivedPhoto);
      }

      const res = await fetch(`${api}/special-rolls/${detail.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setIsReceivedModalOpen(false);
        setReceivedForm({ expectedReturnAt: '', qualityNotes: '', receivedPhoto: null, location: '' });
        await openDetail(detail.id);
        await fetchList();
        
        // Notificar outras abas sobre a mudança
        try {
          new BroadcastChannel('ecolav-app').postMessage({ type: 'special-rolls-changed' });
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Erro ao processar recebimento:', error);
    } finally { setIsReceivedSubmitting(false); }
  };

  const handleDispatchedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setIsDispatchedSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'dispatched');
      formData.append('finalWeight', dispatchedForm.finalWeight);
      formData.append('dispatchedBy', dispatchedForm.dispatchedBy);
      formData.append('currentLocation', dispatchedForm.location);
      
      if (dispatchedForm.dispatchedPhoto) {
        formData.append('dispatchedPhoto', dispatchedForm.dispatchedPhoto);
      }

      const res = await fetch(`${api}/special-rolls/${detail.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setIsDispatchedModalOpen(false);
        setDispatchedForm({ finalWeight: '', dispatchedPhoto: null, dispatchedBy: '', location: '' });
        await openDetail(detail.id);
        await fetchList();
        
        // Notificar outras abas sobre a mudança
        try {
          new BroadcastChannel('ecolav-app').postMessage({ type: 'special-rolls-changed' });
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Erro ao processar expedição:', error);
    } finally { setIsDispatchedSubmitting(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <ClientFilterAlert showOnAction />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ROL Especial</h2>
          <p className="text-gray-600">Gerencie itens especiais não recorrentes</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center space-x-1 sm:space-x-2 transition-all text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Novo ROL</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>


      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
        {/* Indicador discreto de atualização */}
        {isUpdating && (
          <div className="mb-2 text-xs text-gray-500">Atualizando...</div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex gap-2 w-full md:w-auto">
            <input 
              className="border rounded px-3 py-2 w-full md:w-64" 
              placeholder="Buscar (número, item)" 
              value={q} 
              onChange={e => setQ(e.target.value)} 
            />
            <select className="border rounded px-3 py-2 w-full md:w-auto" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button 
              onClick={() => { setPage(1); fetchList(); }} 
              className="bg-gray-700 hover:bg-gray-800 text-white rounded px-4 py-2"
            >
              Filtrar
            </button>
          </div>
          <div className="text-sm text-gray-500">{total} resultados encontrados</div>
        </div>

        {loading ? (
          <div className="py-10"><LoadingSpinner text="Carregando..." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-3 pr-4 font-medium">Número ROL</th>
                  <th className="py-3 pr-4 font-medium hidden sm:table-cell">Item</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium hidden sm:table-cell">Retorno Previsto</th>
                  <th className="py-3 pr-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-blue-600 align-top">
                      <div>{r.number}</div>
                      <div className="sm:hidden text-[11px] text-gray-500 mt-0.5">{r.itemName}</div>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">{r.itemName}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] || r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 hidden sm:table-cell">
                      {r.expectedReturnAt ? new Date(r.expectedReturnAt).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1 sm:gap-2">
                        <button 
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1" 
                          onClick={() => openDetail(r.id)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">Detalhes</span>
                        </button>
                        <button 
                          className="text-green-600 hover:text-green-800 flex items-center gap-1" 
                          onClick={() => { setQrRoll(r); setShowQR(true); }}
                        >
                          <QrCode className="h-4 w-4" />
                          <span className="hidden sm:inline">QR Code</span>
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button disabled={page<=1} onClick={() => setPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded">Anterior</button>
              <span className="text-sm text-gray-600">Página {page} de {totalPages}</span>
              <button disabled={page>=totalPages} onClick={() => setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 border rounded">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold">{detail.number}</h3>
              </div>
                <div className="flex items-center gap-3">
                  <button
                    className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm border border-red-200 rounded px-2 py-1"
                    onClick={() => handleDelete(detail.id)}
                    title="Excluir ROL"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                  <button 
                    className="text-gray-600 hover:text-gray-800 text-xl" 
                    onClick={() => { setDetail(null); setEvents([]); }}
                  >
                    ×
                  </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações do ROL */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Informações do Item</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Item:</span>
                    <span>{detail.itemName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[detail.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[detail.status as keyof typeof STATUS_LABELS] || detail.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Retorno Previsto:</span>
                    <span>{detail.expectedReturnAt ? new Date(detail.expectedReturnAt).toLocaleString('pt-BR') : 'Não definido'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Local Atual:</span>
                    <span>{detail.currentLocation || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Enviado por:</span>
                    <span>{detail.senderName || 'Não informado'}</span>
                  </div>
                  {detail.weight && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Peso Inicial:</span>
                      <span>{detail.weight} kg</span>
                    </div>
                  )}
                  {detail.client && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Cliente:</span>
                      <span>{detail.client.name}</span>
                    </div>
                  )}
                  {detail.description && (
                    <div>
                      <span className="font-medium">Descrição:</span>
                      <p className="text-gray-600 mt-1">{detail.description}</p>
                    </div>
                  )}
                  {detail.attachments && (
                    <div>
                      <span className="font-medium">Foto do Item:</span>
                      <div className="mt-2">
                      <img
                        src={`${window.location.origin}/uploads/${detail.attachments}`}
                        alt="Foto do item"
                        className="w-full max-w-xs h-48 object-cover rounded-lg border border-gray-200"
                        loading="lazy"
                      />
                      </div>
                    </div>
                  )}
                  
                  {/* Informações de Recebimento */}
                  {detail.qualityNotes && (
                    <div>
                      <span className="font-medium">Controle de Qualidade:</span>
                      <p className="text-gray-600 mt-1 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        {detail.qualityNotes}
                      </p>
                    </div>
                  )}
                  
                  {detail.receivedPhoto && (
                    <div>
                      <span className="font-medium">Foto do Recebimento:</span>
                      <div className="mt-2">
                        <img
                        src={`${window.location.origin}/uploads/${detail.receivedPhoto}`}
                          alt="Foto do recebimento"
                          className="w-full max-w-xs h-48 object-cover rounded-lg border border-gray-200"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Informações de Expedição */}
                  {detail.finalWeight && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Peso Final:</span>
                      <span className="text-green-600 font-semibold">{detail.finalWeight} kg</span>
                    </div>
                  )}
                  
                  {detail.dispatchedBy && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Expedido por:</span>
                      <span>{detail.dispatchedBy}</span>
                    </div>
                  )}
                  
                  {detail.dispatchedPhoto && (
                    <div>
                      <span className="font-medium">Foto da Expedição:</span>
                      <div className="mt-2">
                        <img
                          src={`${window.location.origin}/uploads/${detail.dispatchedPhoto}`}
                          alt="Foto da expedição"
                          className="w-full max-w-xs h-48 object-cover rounded-lg border border-gray-200"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações de Status */}
                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Alterar Status</h4>
                  
                  {/* Barra de Progresso */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>Progresso do ROL</span>
                      <span>{FLOW_ORDER.indexOf(detail.status) + 1} de {FLOW_ORDER.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((FLOW_ORDER.indexOf(detail.status) + 1) / FLOW_ORDER.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Botões de etapa (mostrar todos, desabilitar os inválidos) */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">Etapas:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(STATUS_LABELS)
                        .filter(([key]) => key !== 'enviado')
                        .map(([statusKey, label]) => {
                          const isCurrent = detail.status === statusKey;
                          const allowed = isCurrent || getValidNextStatuses(detail.status).includes(statusKey);
                          return (
                            <button
                              key={statusKey}
                              disabled={!allowed}
                              className={`px-3 py-2 text-sm rounded border transition-all ${
                                isCurrent
                                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                                  : allowed
                                  ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (!allowed) return;
                                if (statusKey === 'received') {
                                  setIsReceivedModalOpen(true);
                                } else if (statusKey === 'dispatched') {
                                  setIsDispatchedModalOpen(true);
                                } else if (!isCurrent) {
                                  updateStatus(detail.id, statusKey);
                                }
                              }}
                              title={
                                isCurrent
                                  ? 'Status atual'
                                  : allowed
                                  ? 'Avançar para esta etapa'
                                  : 'Etapa bloqueada (ordem sequencial)'
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Informações do Usuário */}
                  {detail.updatedBy && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Última alteração:</strong> {detail.updatedBy}
                      </p>
                      {detail.updatedAt && (
                        <p className="text-sm text-gray-500">
                          {new Date(detail.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline de Eventos */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Histórico de Eventos</h4>
                <div className="space-y-3">
                  {events.length > 0 ? (
                    events.map((event, index) => (
                      <div key={event.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${
                            index === 0 ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[event.eventType as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                              {STATUS_LABELS[event.eventType as keyof typeof STATUS_LABELS] || event.eventType}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(event.timestamp).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          {event.note && (
                            <p className="text-sm text-gray-600">{event.note}</p>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum evento registrado ainda
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQR && qrRoll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">QR Code de Acompanhamento</h3>
              <button 
                className="text-gray-600 hover:text-gray-800 text-xl" 
                onClick={() => { setShowQR(false); setQrRoll(null); }}
              >
                ×
              </button>
            </div>
            <div className="text-center">
              <div className="bg-gray-100 p-8 rounded-lg mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">{qrRoll.number}</div>
                  <div className="text-sm text-gray-600 mb-4">{qrRoll.itemName}</div>
                  <div className="bg-white p-4 rounded border-2 border-dashed border-gray-300">
                    <div className="mx-auto w-32 h-32 flex items-center justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(`https://rouparia.textilecolav.com/track.html?roll=${qrRoll.number}`)}`}
                        alt={`QR Code para ${qrRoll.number}`}
                        className="w-32 h-32 border border-gray-200 rounded"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">QR Code</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>URL de Acompanhamento:</strong></p>
                <p className="text-xs bg-gray-100 p-2 rounded break-all">
                  {`https://rouparia.textilecolav.com/track.html?roll=${encodeURIComponent(qrRoll.number)}`}
                </p>
                <p className="mt-3">
                  Compartilhe este link ou QR Code para acompanhar o status do item em tempo real
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button 
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  onClick={async () => {
                    const url = `https://rouparia.textilecolav.com/track.html?roll=${encodeURIComponent(qrRoll.number)}`;
                    const hasClipboard = typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
                    if (hasClipboard) {
                      try {
                        await navigator.clipboard.writeText(url);
                        alert('Link copiado para a área de transferência!');
                        return;
                      } catch {
                        // fallback abaixo
                      }
                    }
                    // Fallback sem Clipboard API
                    prompt('Copie o link abaixo:', url);
                  }}
                >
                  Copiar Link
                </button>
                <button 
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  onClick={() => {
                    const url = `https://rouparia.textilecolav.com/track.html?roll=${encodeURIComponent(qrRoll.number)}`;
                    window.open(url, '_blank');
                  }}
                >
                  Abrir Página
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Novo ROL Especial</h3>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setForm({ itemName: '', description: '', quantity: '', weight: '', priority: 3, clientId: '', senderName: '' });
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 pt-4">
              <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.clientId}
                  onChange={e => setForm({ ...form, clientId: e.target.value })}
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome de Quem Está Enviando *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite o nome de quem está enviando"
                  value={form.senderName}
                  onChange={e => setForm({ ...form, senderName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite o nome do item"
                  value={form.itemName}
                  onChange={e => setForm({ ...form, itemName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descrição do item (opcional)"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade de Itens
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 10"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso do Item (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 2.5"
                  value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foto do Item
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600">
                      Clique para adicionar uma foto
                    </span>
                  </label>
                </div>
                
                {previewUrl && (
                  <div className="mt-2">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="mt-1 text-xs text-red-600 hover:text-red-800"
                    >
                      Remover foto
                    </button>
                  </div>
                )}
              </div>

              </form>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setForm({ itemName: '', description: '', quantity: '', weight: '', priority: 3, clientId: '', senderName: '' });
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar ROL'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recebido */}
      {isReceivedModalOpen && detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Recebimento</h3>
                <button
                  onClick={() => setIsReceivedModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 pt-4">
              <form onSubmit={handleReceivedSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Prevista de Entrega *
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={receivedForm.expectedReturnAt}
                    onChange={e => setReceivedForm({ ...receivedForm, expectedReturnAt: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Controle de Qualidade
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Observações sobre costura, manchas, etc. (opcional)"
                    rows={3}
                    value={receivedForm.qualityNotes}
                    onChange={e => setReceivedForm({ ...receivedForm, qualityNotes: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localização Atual
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Localização atual do item"
                      value={receivedForm.location}
                      onChange={e => setReceivedForm({ ...receivedForm, location: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleGetLocation('received')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      title="Usar GPS para localização atual"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Foto do Recebimento
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                    <input
                      type="file"
                      accept="image/*;capture=camera"
                      onChange={handleReceivedPhotoChange}
                      className="hidden"
                      id="received-photo-upload"
                    />
                    <label
                      htmlFor="received-photo-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600">
                        Clique para adicionar foto do recebimento
                      </span>
                    </label>
                  </div>
                  {receivedPreviewUrl && (
                    <div className="mt-2">
                      <img
                        src={receivedPreviewUrl}
                        alt="Preview recebimento"
                        className="w-full h-24 object-cover rounded-lg border"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => { setReceivedForm({ ...receivedForm, receivedPhoto: null }); receivedPreviewCleanup(); setReceivedPreviewUrl(null); }}
                        className="mt-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Remover foto
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsReceivedModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={(e)=>{ if (!isReceivedSubmitting) handleReceivedSubmit(e as React.MouseEvent<HTMLButtonElement>); }}
                  disabled={isReceivedSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isReceivedSubmitting ? 'Enviando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Expedido */}
      {isDispatchedModalOpen && detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Expedição</h3>
                <button
                  onClick={() => setIsDispatchedModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 pt-4">
              <form onSubmit={handleDispatchedSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso Final (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 2.3"
                    value={dispatchedForm.finalWeight}
                    onChange={e => setDispatchedForm({ ...dispatchedForm, finalWeight: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quem Está Enviando *
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome do funcionário que está enviando"
                    value={dispatchedForm.dispatchedBy}
                    onChange={e => setDispatchedForm({ ...dispatchedForm, dispatchedBy: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localização Atual
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Localização atual do item"
                      value={dispatchedForm.location}
                      onChange={e => setDispatchedForm({ ...dispatchedForm, location: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleGetLocation('dispatched')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      title="Usar GPS para localização atual"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Foto da Expedição
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                    <input
                      type="file"
                      accept="image/*;capture=camera"
                      onChange={handleDispatchedPhotoChange}
                      className="hidden"
                      id="dispatched-photo-upload"
                    />
                    <label
                      htmlFor="dispatched-photo-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600">
                        Clique para adicionar foto da expedição
                      </span>
                    </label>
                  </div>
                  {dispatchedPreviewUrl && (
                    <div className="mt-2">
                      <img
                        src={dispatchedPreviewUrl}
                        alt="Preview expedição"
                        className="w-full h-24 object-cover rounded-lg border"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => { setDispatchedForm({ ...dispatchedForm, dispatchedPhoto: null }); dispatchedPreviewCleanup(); setDispatchedPreviewUrl(null); }}
                        className="mt-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Remover foto
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDispatchedModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={(e)=>{ if (!isDispatchedSubmitting) handleDispatchedSubmit(e as React.MouseEvent<HTMLButtonElement>); }}
                  disabled={isDispatchedSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isDispatchedSubmitting ? 'Enviando...' : 'Confirmar Expedição'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Localização */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Solicitação de Localização</h3>
              </div>

              {locationStatus === 'idle' && (
                <div>
                  <p className="text-gray-600 mb-4">
                    Deseja permitir o acesso à sua localização atual?
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Isso nos ajudará a registrar onde o item está sendo processado. 
                    Sua localização será usada apenas para este registro.
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLocationModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmLocation}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Permitir Localização
                    </button>
                  </div>
                </div>
              )}

              {locationStatus === 'requesting' && (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">{locationMessage}</p>
                </div>
              )}

              {locationStatus === 'success' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-600 font-medium">Sucesso!</span>
                  </div>
                  <p className="text-gray-600 mb-4 whitespace-pre-line">{locationMessage}</p>
                  <button
                    onClick={() => setShowLocationModal(false)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    OK
                  </button>
                </div>
              )}

              {locationStatus === 'error' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="text-red-600 font-medium">Erro</span>
                  </div>
                  <p className="text-gray-600 mb-4">{locationMessage}</p>
                  <button
                    onClick={() => setShowLocationModal(false)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Entendi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialRolls;
