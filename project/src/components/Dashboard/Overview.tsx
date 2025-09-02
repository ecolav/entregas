import React from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  Users,
  Bed,
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock
} from 'lucide-react';

const Overview: React.FC = () => {
  const { sectors, beds, linenItems, orders } = useApp();

  const occupiedBeds = beds.filter(bed => bed.status === 'occupied').length;
  const pendingOrders = orders.filter(order => order.status === 'pending').length;
  const lowStockItems = linenItems.filter(item => item.currentStock <= item.minimumStock).length;
  // const todayOrders = orders.filter(order => {
  //   const orderDate = new Date(order.createdAt);
  //   const today = new Date();
  //   return orderDate.toDateString() === today.toDateString();
  // }).length;

  const stats = [
    {
      title: 'Setores',
      value: sectors.length,
      icon: <Users className="w-8 h-8" />,
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Leitos Ocupados',
      value: `${occupiedBeds}/${beds.length}`,
      icon: <Bed className="w-8 h-8" />,
      color: 'from-green-500 to-green-600'
    },
    {
      title: 'Itens de Estoque',
      value: linenItems.length,
      icon: <Package className="w-8 h-8" />,
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Pedidos Pendentes',
      value: pendingOrders,
      icon: <ShoppingCart className="w-8 h-8" />,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Visão Geral</h2>
        <p className="text-gray-600">Dashboard do sistema de gestão de enxoval</p>
      </div>



      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-2 sm:p-3 bg-gradient-to-r ${stat.color} rounded-lg text-white`}>
                <div className="w-6 h-6 sm:w-8 sm:h-8">
                  {stat.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Alerts */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Alertas</h3>
          </div>
          
                     <div className="space-y-2 sm:space-y-3">
             {lowStockItems > 0 ? (
               <div className="flex items-center justify-between p-2 sm:p-3 bg-red-50 rounded-lg border border-red-100">
                 <div>
                   <p className="font-medium text-red-900 text-sm sm:text-base">Estoque Baixo</p>
                   <p className="text-xs sm:text-sm text-red-700">{lowStockItems} itens abaixo do estoque mínimo</p>
                 </div>
                 <div className="text-red-500">
                   <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                 </div>
               </div>
             ) : null}

             {pendingOrders > 0 ? (
               <div className="flex items-center justify-between p-2 sm:p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                 <div>
                   <p className="font-medium text-yellow-900 text-sm sm:text-base">Pedidos Pendentes</p>
                   <p className="text-xs sm:text-sm text-yellow-700">{pendingOrders} pedidos aguardando processamento</p>
                 </div>
                 <div className="text-yellow-500">
                   <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                 </div>
               </div>
             ) : null}

             {lowStockItems === 0 && pendingOrders === 0 ? (
               <div className="text-center py-6 sm:py-8 text-gray-500">
                 <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-green-500" />
                 <p className="text-sm sm:text-base">Tudo funcionando perfeitamente!</p>
               </div>
             ) : null}
           </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Pedidos Recentes</h3>
          </div>
          
                     <div className="space-y-2 sm:space-y-3">
             {recentOrders.length > 0 ? (
               recentOrders.map((order) => (
                 <div key={order.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                   <div className="flex-1 min-w-0">
                     <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                       {order.bed?.sector?.name} - Leito {order.bed?.number}
                     </p>
                     <p className="text-xs sm:text-sm text-gray-600">
                       {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} - {order.items.reduce((sum, item) => sum + item.quantity, 0)} unidades
                     </p>
                   </div>
                   <div className="text-right ml-2">
                     <span className={`
                       px-2 py-1 rounded-full text-xs font-medium
                       ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                         order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                         order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                         'bg-red-100 text-red-800'}
                     `}>
                       {order.status === 'pending' ? 'Pendente' :
                        order.status === 'preparing' ? 'Preparando' :
                        order.status === 'delivered' ? 'Entregue' : 'Cancelado'}
                     </span>
                   </div>
                 </div>
               ))
             ) : (
               <div className="text-center py-6 sm:py-8 text-gray-500">
                 <ShoppingCart className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2" />
                 <p className="text-sm sm:text-base">Nenhum pedido encontrado</p>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Ações Rápidas</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 border-2 border-dashed border-gray-200 rounded-lg text-center hover:border-blue-300 transition-colors cursor-pointer">
            <Package className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-xs sm:text-sm font-medium text-gray-700">Adicionar Item de Enxoval</p>
          </div>
          
          <div className="p-3 sm:p-4 border-2 border-dashed border-gray-200 rounded-lg text-center hover:border-blue-300 transition-colors cursor-pointer">
            <Bed className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-xs sm:text-sm font-medium text-gray-700">Cadastrar Novo Leito</p>
          </div>
          
          <div className="p-3 sm:p-4 border-2 border-dashed border-gray-200 rounded-lg text-center hover:border-blue-300 transition-colors cursor-pointer sm:col-span-2 lg:col-span-1">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-xs sm:text-sm font-medium text-gray-700">Ver Relatórios</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;