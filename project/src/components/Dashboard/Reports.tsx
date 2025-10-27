import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, TrendingUp, Download, Package, Bed, FileText, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../../utils/whatsapp';
import ClientFilterAlert from '../ClientFilterAlert';
import { getApiBaseUrl } from '../../config';

interface DistributedItem {
  id: string;
  linenItemId: string;
  bedId: string;
  status: string;
  allocatedAt: string;
  bed?: { id: string; number: string; sectorId: string; sector?: { id: string; name: string; clientId?: string } };
  linenItem?: { id: string; name: string };
}

const Reports: React.FC = () => {
  const { orders, sectors, clients, linenItems, beds } = useApp();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSector, setSelectedSector] = useState('all');
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [distributedItems, setDistributedItems] = useState<DistributedItem[]>([]);
  const api = getApiBaseUrl();
  const token = localStorage.getItem('token') || '';

  // Buscar distributed-items
  const fetchDistributedItems = useCallback(async () => {
    try {
      const url = new URL(`${api}/distributed-items`);
      if (user?.role === 'admin' && selectedClientId !== 'all') {
        url.searchParams.set('clientId', selectedClientId);
      }
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        // Enriquecer com dados de bed e item
        const enriched = data.map((di: any) => {
          const bed = beds.find(b => b.id === di.bedId);
          const item = linenItems.find(i => i.id === di.linenItemId);
          return {
            ...di,
            bed: bed ? { ...bed, sector: sectors.find(s => s.id === bed.sectorId) } : undefined,
            linenItem: item
          };
        });
        setDistributedItems(enriched);
      }
    } catch (err) {
      console.error('Erro ao buscar distributed-items:', err);
    }
  }, [api, token, user?.role, selectedClientId, beds, linenItems, sectors]);

  useEffect(() => {
    fetchDistributedItems();
  }, [fetchDistributedItems]);

  // Calculate report data
  const visibleClientId = user?.role === 'admin' ? (selectedClientId === 'all' ? undefined : selectedClientId) : user?.clientId;

  const reportData = useMemo(() => {
    // Filtrar pedidos
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const matchesDateRange = !dateRange.start || !dateRange.end || 
        (orderDate >= new Date(dateRange.start) && orderDate <= new Date(dateRange.end));
      const matchesSector = selectedSector === 'all' || order.bed?.sectorId === selectedSector;
      const matchesClient = !visibleClientId || order.bed?.sector?.clientId === visibleClientId;
      
      return matchesDateRange && matchesSector && matchesClient;
    });

    // Filtrar distribuições diretas
    const filteredDistributions = distributedItems.filter(dist => {
      const distDate = new Date(dist.allocatedAt);
      const matchesDateRange = !dateRange.start || !dateRange.end || 
        (distDate >= new Date(dateRange.start) && distDate <= new Date(dateRange.end));
      const matchesSector = selectedSector === 'all' || dist.bed?.sectorId === selectedSector;
      const matchesClient = !visibleClientId || dist.bed?.sector?.clientId === visibleClientId;
      
      return matchesDateRange && matchesSector && matchesClient;
    });

    // Items consumption (pedidos + distribuições)
    const itemConsumption: { [key: string]: { name: string; quantity: number; orders: number } } = {};
    
    // Consumo de pedidos
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

    // Consumo de distribuições diretas
    filteredDistributions.forEach(dist => {
      if (!itemConsumption[dist.linenItemId]) {
        itemConsumption[dist.linenItemId] = {
          name: dist.linenItem?.name || 'Item desconhecido',
          quantity: 0,
          orders: 0
        };
      }
      itemConsumption[dist.linenItemId].quantity += 1; // Cada distributed-item é 1 peça
      itemConsumption[dist.linenItemId].orders += 1; // Conta como uma "saída"
    });

    // Sector consumption (pedidos + distribuições)
    const sectorConsumption: { [key: string]: { name: string; orders: number; items: number } } = {};
    
    // Pedidos por setor
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

    // Distribuições por setor
    filteredDistributions.forEach(dist => {
      const sectorId = dist.bed?.sectorId;
      const sectorName = dist.bed?.sector?.name || 'Setor desconhecido';
      
      if (sectorId) {
        if (!sectorConsumption[sectorId]) {
          sectorConsumption[sectorId] = { name: sectorName, orders: 0, items: 0 };
        }
        sectorConsumption[sectorId].orders += 1;
        sectorConsumption[sectorId].items += 1;
      }
    });

    // Bed consumption (pedidos + distribuições)
    const bedConsumption: { [key: string]: { bed: string; sector: string; orders: number; items: number } } = {};
    
    // Pedidos por leito
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

    // Distribuições por leito
    filteredDistributions.forEach(dist => {
      const bedKey = `${dist.bed?.sectorId}-${dist.bed?.number}`;
      
      if (!bedConsumption[bedKey]) {
        bedConsumption[bedKey] = {
          bed: dist.bed?.number || 'Leito desconhecido',
          sector: dist.bed?.sector?.name || 'Setor desconhecido',
          orders: 0,
          items: 0
        };
      }
      bedConsumption[bedKey].orders += 1;
      bedConsumption[bedKey].items += 1;
    });

    // Totais combinados
    const totalOrders = filteredOrders.length + filteredDistributions.length;
    const totalItemsFromOrders = filteredOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const totalItemsFromDistributions = filteredDistributions.length; // Cada dist é 1 item

    return {
      totalOrders,
      totalItems: totalItemsFromOrders + totalItemsFromDistributions,
      itemConsumption: Object.values(itemConsumption).sort((a, b) => b.quantity - a.quantity),
      sectorConsumption: Object.values(sectorConsumption).sort((a, b) => b.orders - a.orders),
      bedConsumption: Object.values(bedConsumption).sort((a, b) => b.orders - a.orders)
    };
  }, [orders, distributedItems, dateRange, selectedSector, visibleClientId]);

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

  const exportPdf = () => {
    const title = 'Relatório de Consumo de Enxoval';
    const period = `${dateRange.start || 'Início'} até ${dateRange.end || 'Agora'}`;
    const sectorName = selectedSector === 'all' ? 'Todos os setores' : (sectors.find(s => s.id === selectedSector)?.name || '—');
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color:#111827; margin:24px; }
      h1 { font-size:20px; margin:0 0 8px; }
      .muted { color:#6b7280; margin-bottom:16px; }
      .card { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin:12px 0; }
      .section-title { font-weight:600; margin-bottom:8px; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #f3f4f6; font-size:12px; }
      .brand { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
      .brand img { height:40px; }
    </style>
  </head>
  <body>
    <div class="brand">
      <img src="${window.location.origin}/ecolav.png" alt="ECOLAV" />
      <h1>${title} • ECOLAV</h1>
    </div>
    <div class="muted">Período: ${period} • Setor: ${sectorName}</div>
    <div class="card"><div class="section-title">Resumo</div>
      <div>Total de pedidos: <b>${reportData.totalOrders}</b></div>
      <div>Total de itens: <b>${reportData.totalItems}</b></div>
    </div>
    <div class="card"><div class="section-title">Consumo por Item</div>
      <table><thead><tr><th>Item</th><th>Qtd</th><th>Pedidos</th></tr></thead><tbody>
      ${reportData.itemConsumption.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.orders}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card"><div class="section-title">Consumo por Setor</div>
      <table><thead><tr><th>Setor</th><th>Pedidos</th><th>Itens</th></tr></thead><tbody>
      ${reportData.sectorConsumption.map(s => `<tr><td>${s.name}</td><td>${s.orders}</td><td>${s.items}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card"><div class="section-title">Consumo por Leito (Top 10)</div>
      <table><thead><tr><th>Setor</th><th>Leito</th><th>Pedidos</th><th>Itens</th></tr></thead><tbody>
      ${reportData.bedConsumption.slice(0,10).map(b => `<tr><td>${b.sector}</td><td>${b.bed}</td><td>${b.orders}</td><td>${b.items}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
    const w = window.open('', 'print');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const exportWhatsApp = () => {
    const lines: string[] = [];
    lines.push('🧾 *Relatório de Enxoval*');
    lines.push(`Período: *${dateRange.start || 'Início'}* até *${dateRange.end || 'Agora'}*`);
    lines.push(`Setor: *${selectedSector === 'all' ? 'Todos' : (sectors.find(s => s.id === selectedSector)?.name || '—')}*`);
    lines.push('');
    lines.push(`📦 Total de pedidos: *${reportData.totalOrders}*`);
    lines.push(`🧺 Total de itens: *${reportData.totalItems}*`);
    lines.push('');
    if (reportData.itemConsumption.length) {
      lines.push('*Consumo por Item:*');
      lines.push(...reportData.itemConsumption.map(i => `- ${i.name}: ${i.quantity} unidades em ${i.orders} pedidos`));
      lines.push('');
    }
    if (reportData.sectorConsumption.length) {
      lines.push('*Consumo por Setor:*');
      lines.push(...reportData.sectorConsumption.map(s => `- ${s.name}: ${s.orders} pedidos, ${s.items} itens`));
      lines.push('');
    }
    if (reportData.bedConsumption.length) {
      lines.push('*Consumo por Leito (Top 10):*');
      lines.push(...reportData.bedConsumption.slice(0, 10).map(b => `- ${b.sector} / Leito ${b.bed}: ${b.orders} pedidos, ${b.items} itens`));
    }
    const clientNumber = (clients.find(c => c.id === visibleClientId || '')?.whatsappNumber) || undefined;
    const url = buildWhatsAppUrl({ text: lines.join('\n'), phone: clientNumber });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <ClientFilterAlert showOnAction />
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Relatórios</h2>
        <p className="text-gray-600">Análise de consumo e indicadores de desempenho</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {user?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
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
              {sectors.filter(s => !visibleClientId || s.clientId === visibleClientId).map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            onClick={exportData}
            className="flex items-center space-x-1 sm:space-x-2 bg-gray-100 text-gray-800 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-200 transition-all text-xs sm:text-sm"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Exportar JSON</span>
            <span className="sm:hidden">JSON</span>
          </button>
          <button
            onClick={exportPdf}
            className="flex items-center space-x-1 sm:space-x-2 bg-blue-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-xs sm:text-sm"
          >
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={exportWhatsApp}
            className="flex items-center space-x-1 sm:space-x-2 bg-green-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-all text-xs sm:text-sm"
          >
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Enviar WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
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