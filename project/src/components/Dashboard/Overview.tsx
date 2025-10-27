import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { getApiBaseUrl } from '../../config';
import { SkeletonCard } from '../Skeleton';
import ClientFilterAlert from '../ClientFilterAlert';

const Overview: React.FC = () => {
  const { sectors, beds, linenItems, orders, adminClientIdFilter } = useApp();
  const { user } = useAuth();
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);

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

  // Monthly weights for dashboard quick cards
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [weights, setWeights] = useState<{ suja: number; limpa: number; diff: number; perc: number }>({ suja: 0, limpa: 0, diff: 0, perc: 0 });
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [rollsPendingCount, setRollsPendingCount] = useState(0);
  const monthRange = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    return { start, end };
  }, []);

  const fetchMonthlyWeights = useCallback(async () => {
    setLoadingWeights(true);
    try {
      const url = new URL(`${api}/pesagens/relatorio`);
      url.searchParams.set('start', monthRange.start);
      url.searchParams.set('end', monthRange.end);
      if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const rows: Array<{ peso_suja: number; peso_limpa: number }> = await res.json();
        const suja = rows.reduce((s, r) => s + (Number(r.peso_suja) || 0), 0);
        const limpa = rows.reduce((s, r) => s + (Number(r.peso_limpa) || 0), 0);
        const diff = suja - limpa;
        const perc = suja > 0 ? Number(((diff / suja) * 100).toFixed(2)) : 0;
        setWeights({ suja: Number(suja.toFixed(2)), limpa: Number(limpa.toFixed(2)), diff: Number(diff.toFixed(2)), perc });
      }
    } finally {
      setLoadingWeights(false);
    }
  }, [api, monthRange.end, monthRange.start, adminClientIdFilter, token, user?.role]);

  useEffect(() => { fetchMonthlyWeights(); }, [fetchMonthlyWeights]);

  // Fetch alerts: items >24h in bed and pending special rolls
  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      // Distributed items
      const urlItems = new URL(`${api}/distributed-items`);
      if (user?.role === 'admin' && adminClientIdFilter) urlItems.searchParams.set('clientId', adminClientIdFilter);
      const [resItems, resRollsReady, resRollsReceived, resRollsWashing, resRollsDrying, resRollsQC] = await Promise.all([
        fetch(urlItems.toString(), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${api}/special-rolls?status=ready&page=1&pageSize=1${user?.role === 'admin' && adminClientIdFilter ? `&clientId=${encodeURIComponent(adminClientIdFilter)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${api}/special-rolls?status=received&page=1&pageSize=1${user?.role === 'admin' && adminClientIdFilter ? `&clientId=${encodeURIComponent(adminClientIdFilter)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${api}/special-rolls?status=washing&page=1&pageSize=1${user?.role === 'admin' && adminClientIdFilter ? `&clientId=${encodeURIComponent(adminClientIdFilter)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${api}/special-rolls?status=drying&page=1&pageSize=1${user?.role === 'admin' && adminClientIdFilter ? `&clientId=${encodeURIComponent(adminClientIdFilter)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${api}/special-rolls?status=quality_check&page=1&pageSize=1${user?.role === 'admin' && adminClientIdFilter ? `&clientId=${encodeURIComponent(adminClientIdFilter)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let overdue = 0;
      if (resItems.ok) {
        const items = await resItems.json();
        const now = Date.now();
        overdue = (items as Array<{ allocatedAt: string; status: string }>).filter(it => it.status !== 'collected' && (now - new Date(it.allocatedAt).getTime()) >= 24 * 60 * 60 * 1000).length;
      }

      const getTotal = async (res: Response) => (res.ok ? Number((await res.json())?.total || 0) : 0);
      const [tReady, tReceived, tWashing, tDrying, tQC] = await Promise.all([
        getTotal(resRollsReady), getTotal(resRollsReceived), getTotal(resRollsWashing), getTotal(resRollsDrying), getTotal(resRollsQC)
      ]);
      setOverdueCount(overdue);
      setRollsPendingCount(tReady + tReceived + tWashing + tDrying + tQC);
    } finally {
      setLoadingAlerts(false);
    }
  }, [api, adminClientIdFilter, token, user?.role]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return (
    <div className="space-y-8">
      <ClientFilterAlert />
      
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
            {loadingAlerts && (
              <div className="text-xs text-gray-500">Carregando alertas...</div>
            )}
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

            {overdueCount > 0 ? (
              <div className="flex items-center justify-between p-2 sm:p-3 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-red-900 text-sm sm:text-base">Peças &gt; 24h no leito</p>
                  <p className="text-xs sm:text-sm text-red-700">{overdueCount} peças aguardando coleta</p>
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

            {rollsPendingCount > 0 ? (
              <div className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div>
                  <p className="font-medium text-blue-900 text-sm sm:text-base">ROLs Especiais Pendentes</p>
                  <p className="text-xs sm:text-sm text-blue-700">{rollsPendingCount} em andamento/aguardando</p>
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

      {/* Pesagem - KPIs Rápidos (mês atual) */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Resumo de Pesagem (mês)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {loadingWeights ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs sm:text-sm text-gray-600">Coletado (suja)</p>
                  <Package className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{weights.suja} kg</p>
                <p className="text-[11px] sm:text-xs text-gray-500">{monthRange.start} a {monthRange.end}</p>
              </div>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs sm:text-sm text-gray-600">Entregue (limpa)</p>
                  <Bed className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{weights.limpa} kg</p>
                <p className="text-[11px] sm:text-xs text-gray-500">{monthRange.start} a {monthRange.end}</p>
              </div>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs sm:text-sm text-gray-600">Retenção</p>
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{weights.diff} kg</p>
                <p className="text-[11px] sm:text-xs text-gray-500">{weights.perc}% não retornou</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;