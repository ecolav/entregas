import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import Overview from './Overview';
import SectorManagement from './SectorManagement';
import BedManagement from './BedManagement';
import LinenManagement from './LinenManagement';
import OrderManagement from './OrderManagement';
import StockManagement from './StockManagement';
import Reports from './Reports';
import ClientManagement from './ClientManagement';
import UserManagement from './UserManagement';

type ActiveSection = 'overview' | 'sectors' | 'beds' | 'linen' | 'orders' | 'stock' | 'reports' | 'clients' | 'users';

const Dashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { sectors, beds, linenItems, orders, stockMovements, clients, systemUsers } = useApp();

  // Filter data based on role
  const scoped = useMemo(() => {
    if (!user) {
      return { sectors, beds, linenItems, orders, stockMovements, clients, systemUsers };
    }
    if (user.role === 'admin' || !user.clientId) {
      return { sectors, beds, linenItems, orders, stockMovements, clients, systemUsers };
    }
    // Manager: only see own client data
    const visibleSectors = sectors.filter(s => s.clientId === user.clientId);
    const visibleBeds = beds.filter(b => visibleSectors.some(s => s.id === b.sectorId));
    const visibleOrders = orders.filter(o => visibleBeds.some(b => b.id === o.bedId));
    const visibleClients = clients.filter(c => c.id === user.clientId);
    const visibleUsers = systemUsers.filter(u => u.clientId === user.clientId);
    return {
      sectors: visibleSectors,
      beds: visibleBeds,
      linenItems, // global catalog for now
      orders: visibleOrders,
      stockMovements, // keep global for now
      clients: visibleClients,
      systemUsers: visibleUsers,
    };
  }, [user, sectors, beds, linenItems, orders, stockMovements, clients, systemUsers]);

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <Overview />;
      case 'sectors':
        return <SectorManagement />;
      case 'beds':
        return <BedManagement />;
      case 'linen':
        return <LinenManagement />;
      case 'orders':
        return <OrderManagement />;
      case 'stock':
        return <StockManagement />;
      case 'reports':
        return <Reports />;
      case 'clients':
        return <ClientManagement />;
      case 'users':
        return <UserManagement />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;