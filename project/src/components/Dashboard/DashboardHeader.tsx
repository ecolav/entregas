import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, LogOut, User } from 'lucide-react';
// Logo principal (ECOLAV) em páginas autenticadas
import { User as UserType } from '../../types';
import { useApp } from '../../contexts/AppContext';
import EcolavLogo from '../EcolavLogo';

interface DashboardHeaderProps {
  user: UserType | null;
  onMenuClick: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user, onMenuClick }) => {
  const { logout } = useAuth();
  const { clients, adminClientIdFilter, setAdminClientIdFilter } = useApp();
  const isAdmin = user?.role === 'admin';
  const sortedClients = useMemo(() => clients.slice().sort((a,b)=>a.name.localeCompare(b.name)), [clients]);
  
  // Saudação baseada na hora do dia
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all lg:hidden shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden">
              <EcolavLogo size={28} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900"><span className="text-blue-600">Ecolav</span><span className="text-green-600">360</span></h1>
              <p className="text-sm text-gray-500">Sistema de Gestão</p>
            </div>
          </div>

          {isAdmin && setAdminClientIdFilter && (
            <select
              value={adminClientIdFilter ?? ''}
              onChange={(e)=>setAdminClientIdFilter(e.target.value || null)}
              className="px-2 py-1.5 border rounded-lg text-[11px] sm:text-sm min-w-0 flex-1 max-w-[180px] sm:max-w-[250px] text-left truncate"
              title="Filtrar por cliente"
            >
              <option value="">Todos</option>
              {sortedClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <>
              {/* Mobile: só saudação */}
              <div className="flex sm:hidden items-center">
                <span className="text-[11px] font-medium text-gray-700">{greeting}</span>
              </div>
              {/* Desktop: saudação com nome */}
              <div className="hidden sm:flex items-center">
                <span className="text-sm font-medium text-gray-700">{greeting}, {user.name?.split(' ')[0] || 'Usuário'}</span>
              </div>
            </>
          )}
          
          <button
            onClick={logout}
            className="flex items-center justify-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;