 nforimport React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Scale, Package, CheckCircle, AlertTriangle, Plus, Trash2, Edit } from 'lucide-react';

interface WeightRecord {
  id: string;
  date: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  targetWeight: number;
  percentage: number;
  notes: string;
  confirmed: boolean;
}

const WeightManagement: React.FC = () => {
  const { addToast } = useApp();
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [formData, setFormData] = useState({
    grossWeight: '',
    tareWeight: '',
    targetWeight: '',
    notes: ''
  });

  const calculateNetWeight = (gross: number, tare: number) => {
    return Math.max(0, gross - tare);
  };

  const calculatePercentage = (net: number, target: number) => {
    if (target <= 0) return 0;
    return Math.round((net / target) * 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const grossWeight = parseFloat(formData.grossWeight);
    const tareWeight = parseFloat(formData.tareWeight);
    const targetWeight = parseFloat(formData.targetWeight);
    const netWeight = calculateNetWeight(grossWeight, tareWeight);
    const percentage = calculatePercentage(netWeight, targetWeight);

    const newRecord: WeightRecord = {
      id: editingRecord?.id || Date.now().toString(),
      date: new Date().toISOString(),
      grossWeight,
      tareWeight,
      netWeight,
      targetWeight,
      percentage,
      notes: formData.notes,
      confirmed: false
    };

    if (editingRecord) {
      setWeightRecords(prev => prev.map(record => 
        record.id === editingRecord.id ? newRecord : record
      ));
      setEditingRecord(null);
    } else {
      setWeightRecords(prev => [newRecord, ...prev]);
    }

    setIsAddModalOpen(false);
    setFormData({ grossWeight: '', tareWeight: '', targetWeight: '', notes: '' });
    addToast({ type: 'success', message: editingRecord ? 'Pesagem atualizada!' : 'Pesagem registrada!' });
  };

  const handleEdit = (record: WeightRecord) => {
    setEditingRecord(record);
    setFormData({
      grossWeight: record.grossWeight.toString(),
      tareWeight: record.tareWeight.toString(),
      targetWeight: record.targetWeight.toString(),
      notes: record.notes
    });
    setIsAddModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      setWeightRecords(prev => prev.filter(record => record.id !== id));
      addToast({ type: 'success', message: 'Registro excluído!' });
    }
  };

  const handleConfirm = (id: string) => {
    setWeightRecords(prev => prev.map(record => 
      record.id === id ? { ...record, confirmed: true } : record
    ));
    addToast({ type: 'success', message: 'Pesagem confirmada!' });
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 95 && percentage <= 105) return 'text-green-600 bg-green-100';
    if (percentage >= 90 && percentage <= 110) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusText = (percentage: number) => {
    if (percentage >= 95 && percentage <= 105) return 'Dentro do padrão';
    if (percentage >= 90 && percentage <= 110) return 'Atenção';
    return 'Fora do padrão';
  };

  const totalRecords = weightRecords.length;
  const confirmedRecords = weightRecords.filter(r => r.confirmed).length;
  const averagePercentage = weightRecords.length > 0 
    ? Math.round(weightRecords.reduce((sum, r) => sum + r.percentage, 0) / weightRecords.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Controle de Pesagem</h2>
          <p className="text-gray-600">Gerencie o controle de peso das roupas da lavanderia</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center space-x-1 sm:space-x-2 transition-all text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Nova Pesagem</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Pesagens</p>
              <p className="text-2xl font-bold text-gray-900">{totalRecords}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Scale className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Confirmadas</p>
              <p className="text-2xl font-bold text-green-600">{confirmedRecords}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Média %</p>
              <p className="text-2xl font-bold text-gray-900">{averagePercentage}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Weight Records List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {weightRecords.length === 0 ? (
          <div className="p-8 text-center">
            <Scale className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma pesagem registrada</h3>
            <p className="text-gray-500">Comece registrando uma nova pesagem.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {weightRecords.map((record) => (
              <div key={record.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                        Pesagem #{record.id.slice(-6)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {record.confirmed ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.confirmed ? 'Confirmada' : 'Pendente'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(record.percentage)}`}>
                          {getStatusText(record.percentage)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs sm:text-sm text-gray-600 mb-3">
                      <p><span className="font-medium">Data:</span> {new Date(record.date).toLocaleString('pt-BR')}</p>
                      <p><span className="font-medium">Peso Bruto:</span> {record.grossWeight} kg</p>
                      <p><span className="font-medium">Tara da Gaiola:</span> {record.tareWeight} kg</p>
                      <p><span className="font-medium">Peso Líquido:</span> {record.netWeight} kg</p>
                      <p><span className="font-medium">Peso Informado:</span> {record.targetWeight} kg</p>
                      <p><span className="font-medium">Percentual:</span> {record.percentage}%</p>
                      {record.notes && (
                        <p><span className="font-medium">Observações:</span> {record.notes}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:space-x-2">
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    {!record.confirmed && (
                      <button
                        onClick={() => handleConfirm(record.id)}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        <span className="hidden sm:inline">Confirmar</span>
                        <span className="sm:hidden">OK</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingRecord ? 'Editar Pesagem' : 'Nova Pesagem'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso Bruto (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.grossWeight}
                  onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tara da Gaiola (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tareWeight}
                  onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso Informado pela Lavanderia (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.targetWeight}
                  onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {formData.grossWeight && formData.tareWeight && formData.targetWeight && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Peso Líquido:</span> {calculateNetWeight(parseFloat(formData.grossWeight), parseFloat(formData.tareWeight))} kg
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Percentual:</span> {calculatePercentage(calculateNetWeight(parseFloat(formData.grossWeight), parseFloat(formData.tareWeight)), parseFloat(formData.targetWeight))}%
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Observações sobre a pesagem..."
                />
              </div>
              
              <div className="flex space-x-2 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRecord(null);
                    setFormData({ grossWeight: '', tareWeight: '', targetWeight: '', notes: '' });
                  }}
                  className="flex-1 px-2 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all text-xs sm:text-sm"
                >
                  {editingRecord ? 'Salvar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightManagement;
