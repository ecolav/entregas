import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLocation } from '../hooks/useLocation';
import { Bed, Plus, Minus, MessageCircle, Calendar, AlertCircle } from 'lucide-react';
import EcolavLogo from './EcolavLogo';
import ConfirmDeliveryModal from './ConfirmDeliveryModal';

const OrderPage: React.FC = () => {
  const { getBedByToken, linenItems, addOrder, updateBed, clients, orders, confirmOrderDelivery } = useApp();
  const location = useLocation();
  
  const [bed, setBed] = useState<any>(null);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [observations, setObservations] = useState('');
  const [scheduledDelivery, setScheduledDelivery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toggleBedStatus, setToggleBedStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Get token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token) {
      const foundBed = getBedByToken(token);
      setBed(foundBed);
    }
  }, [location.search, getBedByToken]);

  const pendingOrder = useMemo(() => {
    if (!bed) return undefined;
    const list = orders.filter(o => o.bedId === bed.id && o.status !== 'delivered' && o.status !== 'cancelled');
    if (list.length === 0) return undefined;
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [orders, bed]);

  const updateCart = (itemId: string, change: number) => {
    setCart(prev => {
      const newQuantity = (prev[itemId] || 0) + change;
      if (newQuantity <= 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQuantity };
    });
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const generateWhatsAppMessage = () => {
    const items = Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = linenItems.find(i => i.id === itemId);
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

    addOrder({
      bedId: bed.id,
      status: 'pending',
      items: orderItems,
      observations: observations || undefined,
      scheduledDelivery: scheduledDelivery || undefined
    });

    // Optionally toggle bed status (occupied <-> free)
    if (toggleBedStatus) {
      const nextStatus = bed.status === 'occupied' ? 'free' : 'occupied';
      updateBed(bed.id, { status: nextStatus });
      setBed((prev: any) => ({ ...prev, status: nextStatus }));
    }

    // Generate WhatsApp link (prefer client-configured number)
    const client = clients.find(c => c.id === bed?.sector?.clientId);
    const number = client?.whatsappNumber;
    const message = generateWhatsAppMessage();
    if (number) {
      const sanitized = number.replace(/\D/g, '');
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${sanitized}&text=${message}&type=phone_number&app_absent=0`;
      window.open(whatsappUrl, '_blank');
    }

    setSubmitted(true);
    setIsSubmitting(false);
  };

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

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Bed Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`p-2 rounded-lg ${bed.status === 'occupied' ? 'bg-red-100' : 'bg-green-100'}`}>
              <Bed className={`w-6 h-6 ${bed.status === 'occupied' ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Leito {bed.number}</h2>
              <p className="text-gray-600">{bed.sector?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              bed.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {bed.status === 'occupied' ? '🔴 Ocupado' : '🟢 Livre'}
            </span>
          </div>
        </div>

        {/* Pending Delivery */}
        {pendingOrder ? (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Entrega pendente</h3>
            <p className="text-sm text-gray-600 mb-3">
              Pedido criado em {new Date(pendingOrder.createdAt).toLocaleString('pt-BR')} — {pendingOrder.items.reduce((s,i)=>s+i.quantity,0)} unidades
            </p>
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
            >
              Confirmar Entrega (Assinatura/Foto)
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem entrega pendente</h3>
            <p className="text-sm text-gray-600">Crie um novo pedido abaixo e envie via WhatsApp.</p>
          </div>
        )}

        {/* Items Menu */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Itens Disponíveis</h3>
            <p className="text-sm text-gray-600">Selecione os itens necessários</p>
          </div>

          <div className="divide-y divide-gray-100">
            {linenItems.map((item) => (
              <div key={item.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{item.name}</h4>
                    <p className="text-sm text-gray-600">
                      SKU: {item.sku} • {item.unit}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Estoque: {item.currentStock} {item.unit}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {cart[item.id] > 0 && (
                      <button
                        onClick={() => updateCart(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                    
                    {cart[item.id] > 0 && (
                      <span className="w-8 text-center font-medium text-gray-900">
                        {cart[item.id]}
                      </span>
                    )}
                    
                    <button
                      onClick={() => updateCart(item.id, 1)}
                      disabled={!!pendingOrder || item.currentStock === 0}
                      className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Troca de plantão, paciente específico..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label htmlFor="toggle-bed-status" className="text-sm text-gray-700">
              {bed.status === 'occupied' ? 'Marcar leito como livre' : 'Marcar leito como ocupado'}
            </label>
          </div>
        </div>

        {/* Cart Summary & Submit */}
        {getTotalItems() > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky bottom-4">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Resumo do Pedido</h3>
              <div className="space-y-1">
                {Object.entries(cart).map(([itemId, quantity]) => {
                  const item = linenItems.find(i => i.id === itemId);
                  return (
                    <div key={itemId} className="flex justify-between text-sm">
                      <span>{quantity}x {item?.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2">
                <div className="flex justify-between font-medium">
                  <span>Total de itens:</span>
                  <span>{getTotalItems()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !!pendingOrder}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-5 h-5 mr-2" />
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
          await confirmOrderDelivery({
            orderId: pendingOrder.id,
            receiverName,
            confirmationType,
            file,
          });
          setConfirmOpen(false);
        }}
      />
    </div>
  );
};

export default OrderPage;