import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { BarChart3, TrendingUp, Download, Calendar, Package, Bed } from 'lucide-react';

const Reports: React.FC = () => {
  const { orders, linenItems, beds, sectors } = useApp();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSector, setSelectedSector] = useState('all');

  // Calculate report data
  const reportData = useMemo(() => {
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const matchesDateRange = !dateRange.start || !dateRange.end || 
        (orderDate >= new Date(dateRange.start) && orderDate <= new Date(dateRange.end));
      const matchesSector = selectedSector === 'all' || order.bed?.sectorId === selectedSector;
      
      return matchesDateRange && matchesSector;
    });

    // Items consumption
    const itemConsumption: { [key: string]: { name: string; quantity: number; orders: number } } = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach(orderItem => {
        if (!itemConsumption[orderItem.itemId]) {
          itemConsumption[orderItem.itemId] = {
            name: orderItem.item?.name || 'Item desconhecido',
            quantity: 0,
            orders: 0
          };
        }
        itemConsumption[orderItem.itemId].quantity += orderItem.quantity;
        itemConsumption[orderItem.itemId].orders += 1;
      });
    });

    // Sector consumption
    const sectorConsumption: { [key: string]: { name: string; orders: number; items: number } } = {};
    
    filteredOrders.forEach(order => {
      const sectorId = order.bed?.sectorId;
      const sectorName = order.bed?.sector?.name || 'Setor desconhecido';
      
      if (sectorId) {
        if (!sectorConsumption[sectorId]) {
          sectorConsumption[sectorId] = { name: sectorName, orders: 0, items: 0 };
        }
        sectorConsumption[sectorId].orders += 1;
        sectorConsumption[sectorId].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
      }
    });

    // Bed consumption
    const bedConsumption: { [key: string]: { bed: string; sector: string; orders: number; items: number } } = {};
    
    filteredOrders.forEach(order => {
      const bedKey = `${order.bed?.sectorId}-${order.bed?.number}`;
      
      if (!bedConsumption[bedKey]) {
        bedConsumption[bedKey] = {
          bed: order.bed?.number || 'Leito desconhecido',
          sector: order.bed?.sector?.name || 'Setor desconhecido',
          orders: 0,
          items: 0
        };
      }
      bedConsumption[bedKey].orders += 1;
      bedConsumption[bedKey].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    return {
      totalOrders: filteredOrders.length,
      totalItems: filteredOrders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ),
      itemConsumption: Object.values(itemConsumption).sort((a, b) => b.quantity - a.quantity),
      sectorConsumption: Object.values(sectorConsumption).sort((a, b) => b.orders - a.orders),
      bedConsumption: Object.values(bedConsumption).sort((a, b) => b.orders - a.orders)
    };
  }, [orders, dateRange, selectedSector]);

  const exportData = () => {
    const data = {
      period: `${dateRange.start || 'Início'} até ${dateRange.end || 'Agora'}`,
      sector: selectedSector === 'all' ? 'Todos os setores' : sectors.find(s => s.id === selectedSector)?.name,
      summary: {
        totalOrders: reportData.totalOrders,
        totalItems: reportData.totalItems
      },
      itemConsumption: reportData.itemConsumption,
      sectorConsumption: reportData.sectorConsumption,
      bedConsumption: reportData.bedConsumption
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-enxoval-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Relatórios</h2>
        <p className="text-gray-600">Análise de consumo e indicadores de desempenho</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setor
            </label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Setores</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={exportData}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.totalOrders}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Itens</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.totalItems}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Setores Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.sectorConsumption.length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Leitos com Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.bedConsumption.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Bed className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Item Consumption */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Consumo por Item</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {reportData.itemConsumption.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.orders} pedidos</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{item.quantity}</p>
                  <p className="text-xs text-gray-500">unidades</p>
                </div>
              </div>
            ))}
            {reportData.itemConsumption.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum consumo encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Sector Consumption */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Consumo por Setor</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {reportData.sectorConsumption.map((sector, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{sector.name}</p>
                  <p className="text-sm text-gray-600">{sector.items} itens solicitados</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{sector.orders}</p>
                  <p className="text-xs text-gray-500">pedidos</p>
                </div>
              </div>
            ))}
            {reportData.sectorConsumption.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum consumo encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bed Consumption */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Consumo por Leito</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-3 font-medium text-gray-900">Setor</th>
                <th className="text-left p-3 font-medium text-gray-900">Leito</th>
                <th className="text-right p-3 font-medium text-gray-900">Pedidos</th>
                <th className="text-right p-3 font-medium text-gray-900">Itens</th>
              </tr>
            </thead>
            <tbody>
              {reportData.bedConsumption.slice(0, 10).map((bed, index) => (
                <tr key={index} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 text-gray-900">{bed.sector}</td>
                  <td className="p-3 text-gray-900">{bed.bed}</td>
                  <td className="p-3 text-right font-medium text-blue-600">{bed.orders}</td>
                  <td className="p-3 text-right font-medium text-green-600">{bed.items}</td>
                </tr>
              ))}
              {reportData.bedConsumption.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    <Bed className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhum consumo encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;