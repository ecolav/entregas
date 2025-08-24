import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Package, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';

const StockManagement: React.FC = () => {
  const { linenItems, addStockMovement, updateLinenItem } = useApp();
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');

  const handleStockMovement = (e: React.FormEvent) => {
    e.preventDefault();
    
    const item = linenItems.find(i => i.id === selectedItem);
    if (!item) return;

    const newStock = movementType === 'in' 
      ? item.currentStock + quantity
      : Math.max(0, item.currentStock - quantity);

    updateLinenItem(item.id, { currentStock: newStock });
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

  const lowStockItems = linenItems.filter(item => item.currentStock <= item.minimumStock);
  const totalItems = linenItems.length;
  const totalStock = linenItems.reduce((sum, item) => sum + item.currentStock, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Controle de Estoque</h2>
        <p className="text-gray-600">Gerencie os estoques e movimentações</p>
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
                {linenItems.map((item) => (
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
            {linenItems.map((item) => (
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