import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { UserPlus, Edit, Trash2, User, Building } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const UserManagement: React.FC = () => {
  const { systemUsers, clients, addSystemUser, updateSystemUser, deleteSystemUser } = useApp();
  const { user } = useAuth();
  const visibleUsers = useMemo(() => {
    if (user?.role === 'admin' || !user?.clientId) return systemUsers;
    return systemUsers.filter(u => u.clientId === user.clientId);
  }, [systemUsers, user]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'manager' as const,
    clientId: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { name: string; email: string; role: 'admin' | 'manager'; clientId?: string; password?: string } = { ...formData, clientId: formData.clientId || undefined };
    if (editingUser) {
      if (!payload.password) delete (payload as unknown as { password?: string }).password;
    }
    if (editingUser) {
      updateSystemUser(editingUser, payload);
      setEditingUser(null);
    } else {
      addSystemUser(payload);
      setIsAddModalOpen(false);
    }
    setFormData({ name: '', email: '', role: 'manager', clientId: '', password: '' });
  };

  const handleEdit = (user: { id: string; name: string; email: string; role: 'admin' | 'manager'; clientId?: string }) => {
    setEditingUser(user.id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'manager',
      clientId: user.clientId || ''
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      deleteSystemUser(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuários</h2>
          <p className="text-gray-600">Cadastre e gerencie usuários do sistema</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center space-x-2 transition-all"
          >
            <UserPlus className="w-5 h-5" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {visibleUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum usuário cadastrado</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleUsers.map((u) => (
              <div key={u.id} className="p-6 flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <p className="text-sm text-gray-600">{u.email}</p>
                    <div className="flex items-center space-x-2 mt-1 text-xs text-gray-600">
                      <span className={`px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                      {u.clientId && (
                        <span className="flex items-center space-x-1">
                          <Building className="w-3 h-3" />
                          <span>{clients.find(c => c.id === u.clientId)?.name || 'Cliente'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(u)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(isAddModalOpen || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha {editingUser ? '(deixe em branco para manter)' : ''}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sem vínculo</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingUser(null);
                    setFormData({ name: '', email: '', role: 'manager', clientId: '', password: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all"
                >
                  {editingUser ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;


