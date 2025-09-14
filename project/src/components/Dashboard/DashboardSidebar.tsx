import React, { useMemo, useState } from 'react';
import { 
  Home,
  Building,
  Bed,
  Package,
  ShoppingCart,
  BarChart3,
  Scale,
  CalendarDays,
  TrendingUp,
  Briefcase,
  Users,
  X,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type ActiveSection = 'overview' | 'sectors' | 'beds' | 'linen' | 'orders' | 'stock' | 'weight' | 'weight-tracking' | 'distribution' | 'reports' | 'clients' | 'users';

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
  const [showAppInfo, setShowAppInfo] = useState(false);

  const menuItems: MenuItem[] = useMemo(() => {
    const base: MenuItem[] = [
      { id: 'overview', label: 'Visão Geral', icon: <Home className="w-5 h-5" /> },
      { id: 'sectors', label: 'Setores', icon: <Building className="w-5 h-5" /> },
      { id: 'beds', label: 'Leitos', icon: <Bed className="w-5 h-5" /> },
      { id: 'linen', label: 'Itens de Enxoval', icon: <Package className="w-5 h-5" /> },
      { id: 'orders', label: 'Pedidos', icon: <ShoppingCart className="w-5 h-5" /> },
      { id: 'stock', label: 'Estoque', icon: <BarChart3 className="w-5 h-5" /> },
      { id: 'weight', label: 'Pesagem', icon: <Scale className="w-5 h-5" /> },
      { id: 'weight-tracking', label: 'Acompanhamento', icon: <CalendarDays className="w-5 h-5" /> },
      { id: 'distribution', label: 'Gestão de Enxoval', icon: <CalendarDays className="w-5 h-5" /> },
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
          <div className="flex items-center justify-between p-3 lg:hidden">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button
              onClick={onToggle}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-2 sm:px-4 py-4 sm:py-6 space-y-2 overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSectionChange(item.id);
                  onToggle();
                }}
                className={`
                  w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-3 text-left rounded-lg
                  transition-all duration-200
                  ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="font-medium text-sm sm:text-base truncate">{item.label}</span>
              </button>
            ))}
          </nav>

           {/* App Info Button */}
           <div className="px-4 pb-4">
             <button
               onClick={() => setShowAppInfo(!showAppInfo)}
               className="w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg text-gray-600 hover:bg-gray-100 transition-all duration-200"
             >
               <Info className="w-5 h-5" />
               <span className="font-medium text-sm">Informações do App</span>
             </button>
           </div>
                 </div>
       </aside>

       {/* App Info Modal */}
       {showAppInfo && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-md">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-semibold text-gray-900">Informações do App</h3>
               <button
                 onClick={() => setShowAppInfo(false)}
                 className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="space-y-4">
                                <div className="text-center">
                   <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Scale className="w-8 h-8 text-white" />
                   </div>
                   <h4 className="text-xl font-bold text-gray-900 mb-2">Sistema de Gestão Ecolav</h4>
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium inline-block">
                     Versão Beta 1.1.0
                   </div>
                   <p className="text-sm text-gray-600 mt-2">
                     Parte do ambiente <span className="font-medium text-blue-600">Ecolav 360</span>
                   </p>
                 </div>
               
               <div className="space-y-3">
                 <div className="bg-gray-50 p-4 rounded-lg">
                   <h5 className="font-medium text-gray-900 mb-2">Contato</h5>
                   <p className="text-gray-600 text-sm">
                     <span className="font-medium">Email:</span> ti@textilecolav.com.br
                   </p>
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded-lg">
                   <h5 className="font-medium text-gray-900 mb-2">Desenvolvimento</h5>
                   <p className="text-gray-600 text-sm">
                     Sistema desenvolvido para otimizar o controle de pedidos, estoque e pesagem da lavanderia.
                   </p>
                 </div>
                 
                 <div className="text-center pt-4 border-t border-gray-200">
                   <p className="text-xs text-gray-500">
                     © 2024 Todos os direitos reservados a<br />
                     <span className="font-medium">Ecolav Serviços Técnicos de Lavanderia</span>
                   </p>
                 </div>
               </div>
             </div>
           </div>
         </div>
       )}
     </>
   );
 };

export default DashboardSidebar;