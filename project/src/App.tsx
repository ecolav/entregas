import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import { AppProvider } from './contexts/AppContext';
import { useLocation } from './hooks/useLocation';
import Login from './components/Login';
import Dashboard from './components/Dashboard/Dashboard';
import OrderPage from './components/OrderPage';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Check if this is an order page (QR code scan)
  const isOrderPage = location.pathname === '/pedido' || location.search.includes('token=');
  
  // Manual test - add this temporarily
  if (location.pathname === '/test') {
    console.log('🔍 Manual Test - Direct navigation to /pedido?token=test');
    window.location.href = '/pedido?token=test';
    return null;
  }
  


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show order page for QR code access (no authentication required)
  if (isOrderPage) {
    return (
      <AppProvider>
        <OrderPage />
      </AppProvider>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  // Show dashboard if authenticated
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;