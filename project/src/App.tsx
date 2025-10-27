import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import { AppProvider, useApp } from './contexts/AppContext';
import { useLocation } from './hooks/useLocation';
import Login from './components/Login';
import Dashboard from './components/Dashboard/Dashboard';
import OrderPage from './components/OrderPage';
import LoadingSpinner from './components/LoadingSpinner';
// import ProgressiveLoading from './components/ProgressiveLoading';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Check if this is an order page (QR code scan)
  const isOrderPage = location.pathname === '/pedido' || location.search.includes('token=');
  
  // Manual test - add this temporarily
  if (location.pathname === '/test') {

    window.location.href = '/pedido?token=test';
    return null;
  }
  


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Inicializando aplicação..." />
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

  // Public routes
  if (!user) {
    return <Login />;
  }

  // Show dashboard if authenticated
  return (
    <AppProvider>
      <DashboardWrapper />
    </AppProvider>
  );
};

// Componente interno para usar useApp e verificar isInitialLoading
const DashboardWrapper: React.FC = () => {
  const { isInitialLoading, loadingStep, loadingProgress } = useApp();
  
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">
            Carregando - {loadingStep || 'carregando...'}
          </p>
        </div>
      </div>
    );
  }
  
  return <Dashboard />;
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
