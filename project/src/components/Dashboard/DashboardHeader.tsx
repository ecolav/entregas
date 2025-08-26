import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, LogOut, User } from 'lucide-react';
// Logo principal (ECOLAV) em páginas autenticadas
import { User as UserType } from '../../types';

interface DashboardHeaderProps {
  user: UserType | null;
  onMenuClick: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user, onMenuClick }) => {
  const { logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden">
              <img src="/ecolav.png" alt="ECOLAV" className="h-8 w-8 object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">ECOLAV</h1>
              <p className="text-sm text-gray-500">Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          )}
          
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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