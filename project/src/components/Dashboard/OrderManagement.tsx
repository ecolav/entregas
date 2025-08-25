import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Search, Filter, Eye, Clock, CheckCircle, XCircle, Package } from 'lucide-react';
import ConfirmDeliveryModal from '../ConfirmDeliveryModal';

const OrderManagement: React.FC = () => {
  const { orders, updateOrderStatus, confirmOrderDelivery } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<null | import('../../types').Order>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // receiver handled by ConfirmDeliveryModal

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.bed?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.bed?.sector?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'preparing':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'preparing':
        return 'Em Separação';
      case 'delivered':
        return 'Entregue';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const handleStatusChange = (orderId: string, newStatus: import('../../types').Order['status']) => {
    updateOrderStatus(orderId, newStatus);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestão de Pedidos</h2>
        <p className="text-gray-600">Gerencie todos os pedidos de enxoval</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por leito ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="preparing">Em Separação</option>
              <option value="delivered">Entregue</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido encontrado</h3>
            <p className="text-gray-500">Não há pedidos que correspondam aos filtros selecionados.</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-gray-100">
            {filteredOrders.map((order) => (
              <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors transform animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {order.bed?.sector?.name} - Leito {order.bed?.number}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(order.status)}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <p><span className="font-medium">Itens:</span> {order.items.map(item => `${item.quantity}x ${item.item?.name}`).join(', ')}</p>
                      <p><span className="font-medium">Data:</span> {new Date(order.createdAt).toLocaleString('pt-BR')}</p>
                      {order.status === 'delivered' && order.receiverName && (
                        <p><span className="font-medium">Recebido por:</span> {order.receiverName}</p>
                      )}
                      {order.status === 'delivered' && order.deliveredAt && (
                        <p><span className="font-medium">Entregue em:</span> {new Date(order.deliveredAt).toLocaleString('pt-BR')}</p>
                      )}
                      {order.status === 'delivered' && order.confirmationUrl && (
                        <p className="mt-1"><span className="font-medium">Comprovante:</span> <a href={order.confirmationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">ver arquivo</a></p>
                      )}
                      {order.observations && (
                        <p><span className="font-medium">Observações:</span> {order.observations}</p>
                      )}
                      {order.scheduledDelivery && (
                        <p><span className="font-medium">Entrega agendada:</span> {new Date(order.scheduledDelivery).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {order.status !== 'delivered' && (
                      <button
                        onClick={() => { setSelectedOrder(order); setConfirmOpen(true); }}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                      >
                        Confirmar Entrega
                      </button>
                    )}
                    
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">Pendente</option>
                      <option value="preparing">Em Separação</option>
                      <option value="delivered">Entregue</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @keyframes fade-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
            .animate-fade-in { animation: fade-in 180ms ease-out }
          `}</style>
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes do Pedido</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Informações do Leito</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p><span className="font-medium">Setor:</span> {selectedOrder.bed?.sector?.name}</p>
                  <p><span className="font-medium">Leito:</span> {selectedOrder.bed?.number}</p>
                  <p><span className="font-medium">Status do Leito:</span> 
                    <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                      selectedOrder.bed?.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedOrder.bed?.status === 'occupied' ? 'Ocupado' : 'Livre'}
                    </span>
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Itens Solicitados</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item: import('../../types').OrderItem, index: number) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium">{item.item?.name}</p>
                        <p className="text-sm text-gray-600">SKU: {item.item?.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{item.quantity} {item.item?.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Informações Adicionais</h4>
                <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <p><span className="font-medium">Status:</span> 
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedOrder.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                      selectedOrder.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {getStatusText(selectedOrder.status)}
                    </span>
                  </p>
                  <p><span className="font-medium">Data do Pedido:</span> {new Date(selectedOrder.createdAt).toLocaleString('pt-BR')}</p>
                  <p><span className="font-medium">Última Atualização:</span> {new Date(selectedOrder.updatedAt).toLocaleString('pt-BR')}</p>
                  {selectedOrder.observations && (
                    <p><span className="font-medium">Observações:</span> {selectedOrder.observations}</p>
                  )}
                  {selectedOrder.scheduledDelivery && (
                    <p><span className="font-medium">Entrega Agendada:</span> {new Date(selectedOrder.scheduledDelivery).toLocaleString('pt-BR')}</p>
                  )}
                  {selectedOrder.status === 'delivered' && selectedOrder.receiverName && (
                    <p><span className="font-medium">Recebido por:</span> {selectedOrder.receiverName}</p>
                  )}
                  {selectedOrder.status === 'delivered' && selectedOrder.deliveredAt && (
                    <p><span className="font-medium">Entregue em:</span> {new Date(selectedOrder.deliveredAt).toLocaleString('pt-BR')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeliveryModal
        open={confirmOpen && !!selectedOrder}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async ({ receiverName, confirmationType, file }) => {
          if (!selectedOrder) return;
          await confirmOrderDelivery({ orderId: selectedOrder.id, receiverName, confirmationType, file });
          setConfirmOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
};

export default OrderManagement;