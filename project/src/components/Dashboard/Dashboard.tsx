import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import Overview from './Overview';
import SectorManagement from './SectorManagement';
import BedManagement from './BedManagement';
import LinenManagement from './LinenManagement';
import OrderManagement from './OrderManagement';
import StockManagement from './StockManagement';
import WeightManagement from './WeightManagement';
import LinenDistribution from './LinenDistribution';
import Distribution from '../Distribution';
import Reports from './Reports';
import WeightTracking from './WeightTracking';
import ClientManagement from './ClientManagement';
import UserManagement from './UserManagement';
import SpecialRolls from './SpecialRolls';

type ActiveSection = 'overview' | 'sectors' | 'beds' | 'linen' | 'orders' | 'stock' | 'weight' | 'weight-tracking' | 'linen-distribution' | 'distribution' | 'reports' | 'clients' | 'users' | 'special-rolls';

const Dashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

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
      case 'weight':
        return <WeightManagement />;
      case 'weight-tracking':
        return <WeightTracking />;
      case 'linen-distribution':
        return <LinenDistribution />;
      case 'distribution':
        return <Distribution />;
      case 'reports':
        return <Reports />;
      case 'clients':
        return <ClientManagement />;
      case 'users':
        return <UserManagement />;
      case 'special-rolls':
        return <SpecialRolls />;
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