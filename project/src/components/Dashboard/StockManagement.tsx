import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Package, TrendingUp, TrendingDown, Plus, Minus, FileText, MessageCircle, Calendar, X, Download, Info } from 'lucide-react';
import { buildWhatsAppUrl } from '../../utils/whatsapp';
import { getApiBaseUrl } from '../../config';
import ClientFilterAlert from '../ClientFilterAlert';

interface StockMovementItem {
  id: string;
  itemId: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  createdAt: string;
  item?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
}

// Motivos predefinidos com descrições
const ENTRY_REASONS = [
  { value: 'Roupa nova', label: 'Roupa nova', description: 'Peças novas adquiridas/compradas para o estoque' },
  { value: 'Retorno', label: 'Retorno', description: 'Roupa limpa retornando da lavanderia' },
  { value: 'Ajuste', label: 'Ajuste', description: 'Ajuste de estoque para correção de inventário' },
];

const EXIT_REASONS = [
  { value: 'Distribuição', label: 'Distribuição', description: 'Distribuição normal para leitos/setores' },
  { value: 'Relavagem', label: 'Relavagem', description: 'Peças enviadas para nova lavagem por problemas de qualidade' },
  { value: 'Descarte', label: 'Descarte', description: 'Peças descartadas por desgaste ou danos irreparáveis' },
];

const StockManagement: React.FC = () => {
  const { linenItems, addStockMovement, clients, adminClientIdFilter, setAdminClientIdFilter } = useApp();
  const { user } = useAuth();
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [showEntriesModal, setShowEntriesModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [entriesData, setEntriesData] = useState<StockMovementItem[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const handleStockMovement = (e: React.FormEvent) => {
    e.preventDefault();
    
    const item = linenItems.find(i => i.id === selectedItem);
    if (!item) return;

    // Removida a atualização manual do estoque - addStockMovement já faz isso no backend
    addStockMovement({
      itemId: item.id,
      type: movementType,
      quantity,
      reason
    });

    setSelectedItem('');
    setQuantity(0);
    setReason('');
  };

  const visibleClientId = user?.role === 'admin' ? (adminClientIdFilter || undefined) : user?.clientId;
  const visibleItems = linenItems.filter(i => (i.clientId ? i.clientId === visibleClientId : true));
  const lowStockItems = visibleItems.filter(item => item.currentStock <= item.minimumStock);
  const totalItems = visibleItems.length;
  const totalStock = visibleItems.reduce((sum, item) => sum + item.currentStock, 0);

  const exportPdf = () => {
    const title = 'Status do Estoque';
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
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #f3f4f6; font-size:12px; }
      .badge { display:inline-block; padding:2px 6px; border-radius:999px; font-size:11px; }
      .ok { background:#d1fae5; color:#065f46; }
      .low { background:#fee2e2; color:#991b1b; }
      .brand { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
      .brand img { height:40px; }
    </style>
  </head>
  <body>
    <div class="brand">
      <img src="${window.location.origin}/ecolav.png" alt="ECOLAV" />
      <h1>${title} • ECOLAV</h1>
    </div>
    <div class="muted">Resumo do estoque atual</div>
    <div class="card">
      <div>Total de itens: <b>${totalItems}</b></div>
      <div>Estoque total (unid.): <b>${totalStock}</b></div>
      <div>Itens com estoque baixo: <b>${lowStockItems.length}</b></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Item</th><th>SKU</th><th>Estoque</th><th>Mínimo</th><th>Status</th></tr></thead>
        <tbody>
          ${visibleItems.map(i => `<tr><td>${i.name}</td><td>${i.sku}</td><td>${i.currentStock} ${i.unit}</td><td>${i.minimumStock} ${i.unit}</td><td><span class="badge ${i.currentStock <= i.minimumStock ? 'low' : 'ok'}">${i.currentStock <= i.minimumStock ? 'Baixo' : 'OK'}</span></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
    const w = window.open('', 'print');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const exportWhatsApp = () => {
    const lines: string[] = [];
    const lowItems = visibleItems.filter(i => i.currentStock <= i.minimumStock);
    const okItems = visibleItems.filter(i => i.currentStock > i.minimumStock);

    const formatItem = (i: typeof visibleItems[number]) => [
      `• ${i.name} (SKU ${i.sku})`,
      `  Quantidade: ${i.currentStock} ${i.unit}`,
      `  Mínimo: ${i.minimumStock} ${i.unit}`,
      `  Status: ${i.currentStock <= i.minimumStock ? 'Baixo' : 'OK'}`
    ].join('\n');

    lines.push('📦 *Relatório Completo de Estoque*');
    lines.push('');
    lines.push(`Total de itens: *${totalItems}*`);
    lines.push(`Estoque total (unid.): *${totalStock}*`);
    lines.push('');

    if (lowItems.length > 0) {
      lines.push('⚠️ *Itens com estoque baixo*');
      lines.push('');
      lowItems.forEach(i => { lines.push(formatItem(i)); lines.push(''); });
    }

    if (okItems.length > 0) {
      lines.push('✅ *Itens com estoque OK*');
      lines.push('');
      okItems.forEach(i => { lines.push(formatItem(i)); lines.push(''); });
    }

    const clientId = user?.role === 'admin' ? (adminClientIdFilter || undefined) : user?.clientId;
    const clientNumber = (clients.find(c => c.id === clientId || '')?.whatsappNumber) || undefined;
    const url = buildWhatsAppUrl({ text: lines.join('\n'), phone: clientNumber });
    window.open(url, '_blank');
  };

  const fetchStockEntries = useCallback(async (date: string) => {
    if (!api || !token) return;
    setLoadingEntries(true);
    try {
      const url = new URL(`${api}/stock-movements`);
      if (user?.role === 'admin' && adminClientIdFilter) {
        url.searchParams.set('clientId', adminClientIdFilter);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: StockMovementItem[] = await res.json();
        // Filtrar movimentações do dia, excluindo "Distribuição" (mostra apenas entradas + relavagem/descarte)
        const filtered = data.filter(m => {
          const movementDate = new Date(m.createdAt).toISOString().split('T')[0];
          if (movementDate !== date) return false;
          // Excluir distribuições normais do relatório (qualquer motivo que comece com "Distribuição")
          if (m.reason && m.reason.toLowerCase().includes('distribuição')) return false;
          return true;
        });
        setEntriesData(filtered);
      }
    } catch (err) {
      console.error('Erro ao buscar entradas:', err);
    } finally {
      setLoadingEntries(false);
    }
  }, [api, token, user?.role, adminClientIdFilter]);

  const openEntriesModal = () => {
    setShowEntriesModal(true);
    fetchStockEntries(selectedDate);
  };

  useEffect(() => {
    if (showEntriesModal) {
      fetchStockEntries(selectedDate);
    }
  }, [selectedDate, showEntriesModal, fetchStockEntries]);

  const entriesSummary = useMemo(() => {
    const entradas = entriesData.filter(e => e.type === 'in');
    const saidas = entriesData.filter(e => e.type === 'out');
    
    const totalEntradas = entradas.reduce((sum, e) => sum + e.quantity, 0);
    const totalSaidas = saidas.reduce((sum, e) => sum + e.quantity, 0);
    const uniqueItems = new Set(entriesData.map(e => e.itemId)).size;
    
    // Contar relavagem e descarte (saídas especiais)
    const relavagens = entriesData.filter(e => e.reason === 'Relavagem');
    const descartes = entriesData.filter(e => e.reason === 'Descarte');
    const totalRelavagem = relavagens.reduce((sum, e) => sum + e.quantity, 0);
    const totalDescarte = descartes.reduce((sum, e) => sum + e.quantity, 0);
    
    // Total de movimentações relevantes (não conta distribuições)
    const movimentacoesRelevantes = entradas.length + relavagens.length + descartes.length;
    
    return { 
      totalEntradas,
      totalSaidas,
      uniqueItems, 
      totalEntries: entriesData.length,
      totalMovimentacoes: movimentacoesRelevantes,
      relavagens: relavagens.length,
      descartes: descartes.length,
      totalRelavagem,
      totalDescarte
    };
  }, [entriesData]);

  const exportEntriesPdf = () => {
    const [y, m, d] = selectedDate.split('-');
    const title = `Relatório de Entradas de Estoque — ${d}/${m}/${y}`;
    const clientName = user?.role === 'admin' && adminClientIdFilter 
      ? clients.find(c => c.id === adminClientIdFilter)?.name 
      : user?.clientId ? clients.find(c => c.id === user.clientId)?.name : '';
    
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
    <div class="muted">${clientName ? `Cliente: ${clientName} • ` : ''}Data: ${d}/${m}/${y}</div>
    <div class="card">
      <div style="font-weight:600; margin-bottom:8px;">Resumo do Dia</div>
      <div>Entradas: <b>+${entriesSummary.totalEntradas} peças</b></div>
      <div>Saídas: <b>-${entriesSummary.totalSaidas} peças</b></div>
      <div>Total de movimentações: <b>${entriesSummary.totalMovimentacoes}</b></div>
      <div>Itens diferentes: <b>${entriesSummary.uniqueItems}</b></div>
      ${entriesSummary.relavagens > 0 || entriesSummary.descartes > 0 ? `
        <div style="margin-top:12px; padding:12px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px;">
          <div style="font-weight:600; color:#991b1b; margin-bottom:4px;">⚠️ Atenção - Saídas Especiais</div>
          ${entriesSummary.relavagens > 0 ? `<div style="color:#991b1b;">🔄 Relavagens: <b>${entriesSummary.relavagens} registros (${entriesSummary.totalRelavagem} peças)</b></div>` : ''}
          ${entriesSummary.descartes > 0 ? `<div style="color:#991b1b;">🗑️ Descartes: <b>${entriesSummary.descartes} registros (${entriesSummary.totalDescarte} peças)</b></div>` : ''}
        </div>
      ` : ''}
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Hora</th><th>Item</th><th>SKU</th><th>Quantidade</th><th>Motivo</th></tr></thead>
        <tbody>
          ${entriesData.map(e => {
            const isSpecial = e.reason === 'Relavagem' || e.reason === 'Descarte';
            return `<tr${isSpecial ? ' style="background:#fef2f2; border-left:4px solid #dc2626;"' : ''}>
              <td>${new Date(e.createdAt).toLocaleTimeString('pt-BR')}</td>
              <td>${e.item?.name || '—'}</td>
              <td>${e.item?.sku || '—'}</td>
              <td>${e.quantity} ${e.item?.unit || ''}</td>
              <td>${isSpecial ? `<b style="color:#991b1b;">${e.reason === 'Relavagem' ? '🔄' : '🗑️'} ${e.reason}</b>` : e.reason}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
    const w = window.open('', 'print');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-6">
      <ClientFilterAlert showOnAction />
      
             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Controle de Estoque</h2>
          <p className="text-sm sm:text-base text-gray-600">Gerencie os estoques e movimentações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <select value={adminClientIdFilter ?? ''} onChange={(e)=>setAdminClientIdFilter && setAdminClientIdFilter(e.target.value || null)} className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm">
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={openEntriesModal} className="flex items-center space-x-1 sm:space-x-2 bg-purple-600 text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-purple-700 transition-all text-xs sm:text-sm">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Movimentações por Dia</span>
            <span className="sm:hidden">Movimentações</span>
          </button>
          <button onClick={exportPdf} className="flex items-center space-x-1 sm:space-x-2 bg-blue-600 text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-blue-700 transition-all text-xs sm:text-sm">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button onClick={exportWhatsApp} className="flex items-center space-x-1 sm:space-x-2 bg-green-600 text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-green-700 transition-all text-xs sm:text-sm">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Enviar WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Itens</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Estoque Total</p>
              <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Estoque Baixo</p>
              <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stock Movement Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Movimentação de Estoque</h3>
          
          <form onSubmit={handleStockMovement} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item
              </label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Selecione um item</option>
                {visibleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.currentStock} {item.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Movimentação
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="in"
                    checked={movementType === 'in'}
                    onChange={(e) => {
                      setMovementType(e.target.value as 'in');
                      setReason(''); // Limpar motivo ao mudar tipo
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center">
                    <Plus className="w-4 h-4 text-green-500 mr-1" />
                    Entrada
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="out"
                    checked={movementType === 'out'}
                    onChange={(e) => {
                      setMovementType(e.target.value as 'out');
                      setReason(''); // Limpar motivo ao mudar tipo
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center">
                    <Minus className="w-4 h-4 text-red-500 mr-1" />
                    Saída
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Selecione o motivo</option>
                {movementType === 'in' && (
                  <>
                    {ENTRY_REASONS.map((r) => (
                      <option key={r.value} value={r.value} title={r.description}>
                        {r.label}
                      </option>
                    ))}
                  </>
                )}
                {movementType === 'out' && (
                  <>
                    {EXIT_REASONS.map((r) => (
                      <option key={r.value} value={r.value} title={r.description}>
                        {r.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
              
              {/* Tooltips informativos */}
              <div className="mt-2 space-y-1">
                {movementType === 'in' && ENTRY_REASONS.map((r) => (
                  <div key={r.value} className="flex items-start gap-2 text-xs text-gray-600">
                    <Info className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span><strong>{r.label}:</strong> {r.description}</span>
                  </div>
                ))}
                {movementType === 'out' && EXIT_REASONS.map((r) => (
                  <div key={r.value} className="flex items-start gap-2 text-xs text-gray-600">
                    <Info className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span><strong>{r.label}:</strong> {r.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedItem || !quantity || !reason}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Registrar Movimentação
            </button>
          </form>
        </div>

        {/* Stock Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Status do Estoque</h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {visibleItems.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    item.currentStock <= item.minimumStock 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.currentStock} {item.unit}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Mínimo: {item.minimumStock} {item.unit}</span>
                  <span>SKU: {item.sku}</span>
                </div>
                
                {/* Stock bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      item.currentStock <= item.minimumStock ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (item.currentStock / (item.minimumStock * 2)) * 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Entradas por Dia */}
      {showEntriesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Movimentações de Estoque por Dia</h3>
                <p className="text-sm text-gray-600">Entradas + Saídas Especiais (Relavagem e Descarte)</p>
              </div>
              <button 
                onClick={() => setShowEntriesModal(false)} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 border-b space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Selecione a Data:</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="bg-green-50 rounded-lg p-2 sm:p-3">
                  <div className="text-[10px] sm:text-xs text-green-600 mb-1">Entradas</div>
                  <div className="text-base sm:text-xl font-bold text-green-700">+{entriesSummary.totalEntradas}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 sm:p-3">
                  <div className="text-[10px] sm:text-xs text-red-600 mb-1">Saídas</div>
                  <div className="text-base sm:text-xl font-bold text-red-700">-{entriesSummary.totalSaidas}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
                  <div className="text-[10px] sm:text-xs text-blue-600 mb-1">Movimentações</div>
                  <div className="text-base sm:text-xl font-bold text-blue-700">{entriesSummary.totalMovimentacoes}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 sm:p-3">
                  <div className="text-[10px] sm:text-xs text-purple-600 mb-1">Itens Diferentes</div>
                  <div className="text-base sm:text-xl font-bold text-purple-700">{entriesSummary.uniqueItems}</div>
                </div>
              </div>

              {/* Alerta de Saídas Especiais */}
              {(entriesSummary.relavagens > 0 || entriesSummary.descartes > 0) && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-red-600 text-lg">⚠️</div>
                    <div className="flex-1">
                      <div className="font-semibold text-red-900 mb-2">Atenção - Saídas Especiais</div>
                      <div className="space-y-1 text-sm">
                        {entriesSummary.relavagens > 0 && (
                          <div className="text-red-800">
                            🔄 <strong>Relavagens:</strong> {entriesSummary.relavagens} registros ({entriesSummary.totalRelavagem} peças)
                          </div>
                        )}
                        {entriesSummary.descartes > 0 && (
                          <div className="text-red-800">
                            🗑️ <strong>Descartes:</strong> {entriesSummary.descartes} registros ({entriesSummary.totalDescarte} peças)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  onClick={exportEntriesPdf}
                  disabled={entriesData.length === 0}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {loadingEntries ? (
                <div className="text-center py-8 text-gray-500 text-sm">Carregando...</div>
              ) : entriesData.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Nenhuma movimentação registrada nesta data
                </div>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-700">Hora</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-700">Item</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-700">SKU</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-700">Quantidade</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-700">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entriesData.map((entry) => {
                        const isRelavagem = entry.reason === 'Relavagem';
                        const isDescarte = entry.reason === 'Descarte';
                        const isSpecial = isRelavagem || isDescarte;
                        
                        return (
                          <tr 
                            key={entry.id} 
                            className={`hover:bg-gray-50 ${isSpecial ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}
                          >
                            <td className="p-2 sm:p-3 text-[11px] sm:text-sm">
                              {new Date(entry.createdAt).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </td>
                            <td className="p-2 sm:p-3 text-[11px] sm:text-sm font-medium">{entry.item?.name || '—'}</td>
                            <td className="p-2 sm:p-3 text-[11px] sm:text-sm text-gray-600">{entry.item?.sku || '—'}</td>
                            <td className="p-2 sm:p-3 text-[11px] sm:text-sm">
                              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium text-[10px] sm:text-xs ${
                                entry.type === 'in' 
                                  ? 'bg-green-100 text-green-800' 
                                  : isSpecial 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.type === 'in' ? '+' : '-'}{entry.quantity} {entry.item?.unit || ''}
                              </span>
                            </td>
                            <td className="p-2 sm:p-3 text-[11px] sm:text-sm">
                              {isSpecial ? (
                                <span className="font-semibold text-red-800 flex items-center gap-1">
                                  {isRelavagem ? '🔄' : '🗑️'} {entry.reason}
                                </span>
                              ) : (
                                <span className="text-gray-600">{entry.reason}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;