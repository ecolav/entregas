import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { getApiBaseUrl } from '../config';
import type { LinenItem } from '../types';
import { useLocation } from '../hooks/useLocation';
import { Bed, Plus, Minus, MessageCircle, Calendar, AlertCircle } from 'lucide-react';
import EcolavLogo from './EcolavLogo';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { useToast } from '../contexts/ToastContext';
import ConfirmDeliveryModal from './ConfirmDeliveryModal';

const OrderPage: React.FC = () => {
  const { getBedByToken, linenItems, addOrder, updateBed, clients, orders, confirmOrderDelivery } = useApp();
  const location = useLocation();
  const { addToast } = useToast();
  
  const [bed, setBed] = useState<null | import('../types').Bed>(null);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [observations, setObservations] = useState('');
  const [scheduledDelivery, setScheduledDelivery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toggleBedStatus, setToggleBedStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publicPendingOrder, setPublicPendingOrder] = useState<null | import('../types').Order>(null);
  const [publicItems, setPublicItems] = useState<LinenItem[]>([]);
  
  // Estados de carregamento
  const [isLoadingBed, setIsLoadingBed] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);

  // Get token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Try local cache first
      const local = getBedByToken(token);
      if (local) { setBed(local); return; }
      
      // Fallback to public API (no auth required)
      setIsLoadingBed(true);
      (async () => {
        try {
          const baseUrl = getApiBaseUrl();
          const res = await fetch(`${baseUrl}/public/beds/${token}`);
          if (res.ok) {
            const b = await res.json();
            setBed(b);
          }
        } catch { /* ignore */ }
        finally {
          setIsLoadingBed(false);
        }
      })();
    }
  }, [location.search, getBedByToken]);

  // Load items for public QR flow (no auth)
  useEffect(() => {
    const hasAuth = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage.getItem('token');
    if (hasAuth) return; // context will handle
    if (!bed) return;
    if (Array.isArray(linenItems) && linenItems.length > 0) return;
    
    setIsLoadingItems(true);
    (async () => {
      try {
        const base = getApiBaseUrl();
        const query = bed?.sector?.clientId ? `?clientId=${encodeURIComponent(bed.sector.clientId)}` : '';
        const res = await fetch(`${base}/public/items${query}`);
        if (res.ok) {
          const items = await res.json();
          setPublicItems(items as LinenItem[]);
        }
      } catch { /* ignore */ }
      finally {
        setIsLoadingItems(false);
      }
    })();
  }, [bed, linenItems]);

  const pendingOrder = useMemo(() => {
    if (!bed) return undefined;
    if (publicPendingOrder && publicPendingOrder.bedId === bed.id && publicPendingOrder.status !== 'delivered' && publicPendingOrder.status !== 'cancelled') {
      return publicPendingOrder;
    }
    const list = orders.filter(o => o.bedId === bed.id && o.status !== 'delivered' && o.status !== 'cancelled');
    if (list.length === 0) return undefined;
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [orders, bed, publicPendingOrder]);

  // Poll pending order in public flow so the banner appears after creation
  useEffect(() => {
    const hasAuth = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage.getItem('token');
    if (hasAuth) return;
    const tokenParam = new URLSearchParams(location.search).get('token');
    if (!tokenParam) return;
    const id = setInterval(async () => {
      try {
        const base = getApiBaseUrl();
        const r = await fetch(`${base}/public/orders?token=${encodeURIComponent(tokenParam)}`);
        if (r.ok) {
          const ord = await r.json();
          setPublicPendingOrder(ord as import('../types').Order);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [location.search]);

  const updateCart = (itemId: string, change: number) => {
    setCart(prev => {
      const newQuantity = (prev[itemId] || 0) + change;
      if (newQuantity <= 0) {
        const updated = { ...prev } as Record<string, number>;
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: newQuantity };
    });
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const itemsSource = (linenItems && linenItems.length > 0) ? linenItems : publicItems;

  const generateWhatsAppMessage = () => {
    const items = Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = itemsSource.find(i => i.id === itemId);
        return `- ${quantity} ${item?.name}`;
      })
      .join('\n');

    const message = `🧺 *Pedido de Enxoval*
🏥 Setor: *${bed?.sector?.name}*
🛏️ Leito: *${bed?.number}*

📦 *Itens:*
${items}

${observations ? `📝 *Observações:* ${observations}\n` : ''}${scheduledDelivery ? `📅 *Agendar:* ${new Date(scheduledDelivery).toLocaleString('pt-BR')}\n` : ''}
⏰ *Solicitado em:* ${new Date().toLocaleString('pt-BR')}`;

    return encodeURIComponent(message);
  };

  const handleSubmit = async () => {
    if (getTotalItems() === 0) return;

    setIsSubmitting(true);

    // Create order in system
    const orderItems = Object.entries(cart).map(([itemId, quantity]) => ({
      itemId,
      quantity
    }));

    // If user is authenticated inside app, use internal addOrder.
    // Otherwise, use public endpoint by token (for QR flow)
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage.getItem('token')) {
      addOrder({
        bedId: bed!.id,
        status: 'pending',
        items: orderItems,
        observations: observations || undefined,
        scheduledDelivery: scheduledDelivery || undefined
      });
    } else {
      try {
        const tokenParam = new URLSearchParams(location.search).get('token');
        const baseUrl = getApiBaseUrl();
        const createdRes = await fetch(`${baseUrl}/public/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenParam, items: orderItems, observations, scheduledDelivery })
        });
        if (createdRes.ok) {
          const created = await createdRes.json();
          setPublicPendingOrder(created as import('../types').Order);
        }
      } catch { /* ignore */ }
    }

    // Optionally toggle bed status (occupied <-> free)
    if (toggleBedStatus) {
      const nextStatus = bed!.status === 'occupied' ? 'free' : 'occupied';
      try {
        const hasAuth = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage.getItem('token');
        if (hasAuth) {
          updateBed(bed!.id, { status: nextStatus });
        } else {
          const tokenParam = new URLSearchParams(location.search).get('token');
          const baseUrl = getApiBaseUrl();
          await fetch(`${baseUrl}/public/beds/${tokenParam}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
          });
        }
        setBed(prev => (prev ? { ...prev, status: nextStatus } : prev));
      } catch { /* ignore */ }
    }

    // Generate WhatsApp link (prefer client-configured number)
    // Try to use client from context (when authenticated), otherwise use public bed.sector.client from API
    const clientFromCtx = clients.find(c => c.id === bed?.sector?.clientId);
    const bedSectorClient = (bed as { sector?: { client?: { whatsappNumber?: string } } })?.sector?.client;
    
    // Determine which number to use
    let number: string | undefined;
    
    if (clientFromCtx?.whatsappNumber) {
      number = clientFromCtx.whatsappNumber;
    } else if (bedSectorClient?.whatsappNumber) {
      number = bedSectorClient.whatsappNumber;
    }
    
    // Don't use any fallback number - if no number is configured, WhatsApp will open without a specific number
    

    
    const message = generateWhatsAppMessage();
    

    
    const whatsappUrl = buildWhatsAppUrl({ phone: number || undefined, text: decodeURIComponent(message) });
    window.open(whatsappUrl, '_blank');
    addToast({ type: 'success', message: 'Pedido enviado para o WhatsApp.' });

    setSubmitted(true);
    setIsSubmitting(false);
  };

  // Tela de carregamento inicial
  if (isLoadingBed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Carregando...</h2>
          <p className="text-gray-600">
            Verificando informações do leito...
          </p>
        </div>
      </div>
    );
  }

  if (!bed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md w-full">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">QR Code Inválido</h2>
          <p className="text-gray-600">
            O QR Code escaneado não é válido ou o leito não foi encontrado.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido Enviado!</h2>
          <p className="text-gray-600 mb-6">
            Seu pedido foi registrado no sistema e o WhatsApp foi aberto para envio à lavanderia.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setCart({});
              setObservations('');
              setScheduledDelivery('');
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 transition-all"
          >
            Fazer Novo Pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg">
              <EcolavLogo size={32} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ECOLAV</h1>
              <p className="text-sm text-gray-600">Pedido de Enxoval</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Bed Info */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-3 sm:mb-4">
            <div className={`p-2 rounded-lg ${bed.status === 'occupied' ? 'bg-red-100' : 'bg-green-100'}`}>
              <Bed className={`w-5 h-5 sm:w-6 sm:h-6 ${bed.status === 'occupied' ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Leito {bed.number}</h2>
              <p className="text-sm sm:text-base text-gray-600">{bed.sector?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
              bed.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {bed.status === 'occupied' ? '🔴 Ocupado' : '🟢 Livre'}
            </span>
          </div>
        </div>

        {/* Pending Delivery */}
        {pendingOrder ? (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Entrega pendente</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              Pedido criado em {new Date(pendingOrder.createdAt).toLocaleString('pt-BR')} — {pendingOrder.items.reduce((s,i)=>s+i.quantity,0)} unidades
            </p>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={isConfirmingDelivery}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
            >
              {isConfirmingDelivery ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Confirmando...
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Confirmar Entrega (Assinatura/Foto)</span>
                  <span className="sm:hidden">Confirmar Entrega</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Sem entrega pendente</h3>
            <p className="text-xs sm:text-sm text-gray-600">Crie um novo pedido abaixo e envie via WhatsApp.</p>
          </div>
        )}

        {/* Items Menu */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Itens Disponíveis</h3>
            <p className="text-xs sm:text-sm text-gray-600">Selecione os itens necessários</p>
          </div>

                     {isLoadingItems ? (
             <div className="p-4 sm:p-6 text-center">
               <div className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
               <p className="text-xs sm:text-sm text-gray-600">Carregando itens disponíveis...</p>
             </div>
           ) : (
             <div className="divide-y divide-gray-100">
               {itemsSource.map((item) => (
               <div key={item.id} className="p-4 sm:p-6">
                 <div className="flex items-center justify-between">
                   <div className="flex-1 min-w-0">
                     <h4 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">{item.name}</h4>
                     <p className="text-xs sm:text-sm text-gray-600">
                       SKU: {item.sku} • {item.unit}
                     </p>
                     <p className="text-xs text-gray-500 mt-1">
                       Estoque: {item.currentStock} {item.unit}
                     </p>
                   </div>
                  
                                     <div className="flex items-center space-x-2 sm:space-x-3">
                     {cart[item.id] > 0 && (
                       <button
                         onClick={() => updateCart(item.id, -1)}
                         className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                       >
                         <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                       </button>
                     )}
                     
                     {cart[item.id] > 0 && (
                       <span className="w-7 sm:w-8 text-center font-medium text-gray-900 text-sm sm:text-base">
                         {cart[item.id]}
                       </span>
                     )}
                     
                     <button
                       onClick={() => updateCart(item.id, 1)}
                       disabled={!!pendingOrder || item.currentStock === 0}
                       className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                     </button>
                   </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Troca de plantão, paciente específico..."
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Agendar Entrega (opcional)
            </label>
            <input
              type="datetime-local"
              value={scheduledDelivery}
              onChange={(e) => setScheduledDelivery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              id="toggle-bed-status"
              type="checkbox"
              checked={toggleBedStatus}
              onChange={(e) => setToggleBedStatus(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="toggle-bed-status" className="text-xs sm:text-sm text-gray-700">
              {bed.status === 'occupied' ? 'Marcar leito como livre' : 'Marcar leito como ocupado'}
            </label>
          </div>
        </div>

        {/* Cart Summary & Submit */}
        {getTotalItems() > 0 && (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 sticky bottom-4">
            <div className="mb-3 sm:mb-4">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Resumo do Pedido</h3>
              <div className="space-y-1">
                {Object.entries(cart).map(([itemId, quantity]) => {
                  const item = linenItems.find(i => i.id === itemId);
                  return (
                    <div key={itemId} className="flex justify-between text-xs sm:text-sm">
                      <span className="truncate">{quantity}x {item?.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2">
                <div className="flex justify-between font-medium text-xs sm:text-sm">
                  <span>Total de itens:</span>
                  <span>{getTotalItems()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !!pendingOrder}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-2 sm:py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm sm:text-base"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Enviar via WhatsApp
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <ConfirmDeliveryModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async ({ receiverName, confirmationType, file }) => {
          if (!pendingOrder) { setConfirmOpen(false); return; }
          
          setIsConfirmingDelivery(true);
          console.log('🔍 Confirmando entrega:', { orderId: pendingOrder.id, receiverName, confirmationType });
          
          const hasAuth = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && !!window.localStorage.getItem('token');
          if (hasAuth) {
            console.log('🔍 Usando fluxo autenticado');
            await confirmOrderDelivery({ orderId: pendingOrder.id, receiverName, confirmationType, file });
          } else {
            console.log('🔍 Usando fluxo público');
            // Public flow: upload and confirm via API directly
            const base = getApiBaseUrl();
            
            // 1) upload
            const form = new FormData(); 
            form.append('file', file);
            console.log('🔍 Fazendo upload do arquivo...');
            const up = await fetch(`${base}/public/uploads`, { method: 'POST', body: form });
            if (!up.ok) { 
              console.error('🔍 Erro no upload:', up.status);
              setConfirmOpen(false);
            setIsConfirmingDelivery(false);
            setIsConfirmingDelivery(false); 
              return; 
            }
            const { url } = await up.json();
            console.log('🔍 Upload realizado:', url);
            
            // 2) confirm (public guarded by token)
            const tokenParam = new URLSearchParams(location.search).get('token');
            console.log('🔍 Confirmando entrega com token:', tokenParam);
            
            const confirmRes = await fetch(`${base}/public/orders/${pendingOrder.id}/confirm-delivery`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: tokenParam, receiverName, confirmationType, confirmationUrl: url })
            });
            
                         if (!confirmRes.ok) {
               console.error('🔍 Erro ao confirmar entrega:', confirmRes.status);
               const errorText = await confirmRes.text();
               console.error('🔍 Detalhes do erro:', errorText);
               setIsConfirmingDelivery(false);
               return;
             }
            
                         console.log('🔍 Entrega confirmada com sucesso!');
             
             // Feedback visual para o usuário
             alert('✅ Entrega confirmada com sucesso!');
           }
           
           // Atualizar o estado imediatamente após confirmação
           setPublicPendingOrder(null); // Remove o pedido pendente da tela
           
           // Refresh public state para garantir sincronização
           try {
             const tokenParam = new URLSearchParams(location.search).get('token');
             if (tokenParam) {
               const base = getApiBaseUrl();
               const r = await fetch(`${base}/public/orders?token=${encodeURIComponent(tokenParam)}`);
               if (r.ok) {
                 const updatedOrder = await r.json();
                 setPublicPendingOrder(updatedOrder);
               } else {
                 // Se não há mais pedido pendente, limpar o estado
                 setPublicPendingOrder(null);
               }
             }
           } catch { 
             // Em caso de erro, limpar o estado para mostrar "sem entrega pendente"
             setPublicPendingOrder(null);
           }
           
           setConfirmOpen(false);
        }}
      />
    </div>
  );
};

export default OrderPage;