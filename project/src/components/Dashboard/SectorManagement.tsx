import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, Building } from 'lucide-react';

const SectorManagement: React.FC = () => {
  const { sectors, addSector, updateSector, deleteSector, clients } = useApp();
  const { user } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', clientId: '' });

  const visibleSectors = useMemo(() => {
    if (user?.role === 'admin' || !user?.clientId) return sectors;
    return sectors.filter(s => s.clientId === user.clientId);
  }, [sectors, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSector) {
      updateSector(editingSector, { ...formData, clientId: user?.role === 'admin' ? (formData.clientId || undefined) : user?.clientId });
      setEditingSector(null);
    } else {
      const payload: { name: string; description?: string; clientId?: string } = {
        name: formData.name,
        description: formData.description,
        clientId: user?.role === 'admin' ? (formData.clientId || undefined) : user?.clientId,
      };
      addSector(payload);
      setIsAddModalOpen(false);
    }
    setFormData({ name: '', description: '', clientId: '' });
  };

  const handleEdit = (sector: { id: string; name: string; description?: string; clientId?: string }) => {
    setEditingSector(sector.id);
    setFormData({ name: sector.name, description: sector.description || '', clientId: sector.clientId || '' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este setor?')) {
      deleteSector(id);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Setores</h2>
          <p className="text-sm text-gray-600">Gerencie os setores do hospital</p>
        </div>
        <button
          onClick={() => {
            // Não pré-selecionar cliente para admin; forçar escolha explícita
            if (user?.role === 'admin') setFormData(prev => ({ ...prev, clientId: '' }));
            setIsAddModalOpen(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center space-x-2 transition-all text-sm"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Novo Setor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {visibleSectors.map((sector) => (
          <div key={sector.id} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{sector.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-600">{sector.description}</p>
                  {user?.role === 'admin' && (
                    <p className="text-xs text-gray-500 mt-1">Cliente: {clients.find(c => c.id === sector.clientId)?.name || '—'}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(sector)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(sector.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingSector) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
              {editingSector ? 'Editar Setor' : 'Novo Setor'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Setor
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows={3}
                />
              </div>
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente
                  </label>
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    required
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingSector(null);
                    setFormData({ name: '', description: '', clientId: '' });
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all text-sm"
                >
                  {editingSector ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorManagement;