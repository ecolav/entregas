import React, { useMemo } from 'react';
import {
  Home,
  Building,
  Bed,
  Package,
  ShoppingCart,
  BarChart3,
  Scale,
  TrendingUp,
  Briefcase,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type ActiveSection = 'overview' | 'sectors' | 'beds' | 'linen' | 'orders' | 'stock' | 'weight' | 'reports' | 'clients' | 'users';

interface MenuItem {
  id: ActiveSection;
  label: string;
  icon: React.ReactNode;
}

interface DashboardSidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeSection,
  onSectionChange,
  isOpen,
  onToggle
}) => {
  const { user } = useAuth();

  const menuItems: MenuItem[] = useMemo(() => {
    const base: MenuItem[] = [
      { id: 'overview', label: 'Visão Geral', icon: <Home className="w-5 h-5" /> },
      { id: 'sectors', label: 'Setores', icon: <Building className="w-5 h-5" /> },
      { id: 'beds', label: 'Leitos', icon: <Bed className="w-5 h-5" /> },
      { id: 'linen', label: 'Itens de Enxoval', icon: <Package className="w-5 h-5" /> },
      { id: 'orders', label: 'Pedidos', icon: <ShoppingCart className="w-5 h-5" /> },
      { id: 'stock', label: 'Estoque', icon: <BarChart3 className="w-5 h-5" /> },
      { id: 'weight', label: 'Pesagem', icon: <Scale className="w-5 h-5" /> },
      { id: 'reports', label: 'Relatórios', icon: <TrendingUp className="w-5 h-5" /> },
    ];
    if (user?.role === 'admin') {
      base.push(
        { id: 'clients', label: 'Clientes', icon: <Briefcase className="w-5 h-5" /> },
        { id: 'users', label: 'Usuários', icon: <Users className="w-5 h-5" /> },
      );
    }
    return base;
  }, [user]);
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 lg:hidden">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button
              onClick={onToggle}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSectionChange(item.id);
                  onToggle();
                }}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg
                  transition-all duration-200
                  ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;