import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Package, TrendingUp, TrendingDown, Plus, Minus, FileText, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../../utils/whatsapp';

const StockManagement: React.FC = () => {
  const { linenItems, addStockMovement, clients } = useApp();
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');

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

  const visibleClientId = user?.role === 'admin' ? (selectedClientId || undefined) : user?.clientId;
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
          ${visibleItems.map(i => `<tr><td>${i.name}</td><td>${i.sku}</td><td>${i.currentStock} ${i.unit}</td><td>${i.minimumStock} ${i.unit}</td><td><span class=\"badge ${i.currentStock <= i.minimumStock ? 'low' : 'ok'}\">${i.currentStock <= i.minimumStock ? 'Baixo' : 'OK'}</span></td></tr>`).join('')}
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

    const visibleClientId = user?.role === 'admin' ? (selectedClientId || undefined) : user?.clientId;
    const clientNumber = (clients.find(c => c.id === visibleClientId || '')?.whatsappNumber) || undefined;
    const url = buildWhatsAppUrl({ text: lines.join('\n'), phone: clientNumber });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Controle de Estoque</h2>
          <p className="text-sm sm:text-base text-gray-600">Gerencie os estoques e movimentações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <select value={selectedClientId} onChange={(e)=>setSelectedClientId(e.target.value)} className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm">
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
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
                    onChange={(e) => setMovementType(e.target.value as 'in')}
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
                    onChange={(e) => setMovementType(e.target.value as 'out')}
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
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Compra, Reposição, Ajuste de inventário..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
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
    </div>
  );
};

export default StockManagement;