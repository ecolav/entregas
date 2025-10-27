import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

interface ClientFilterAlertProps {
  /** Se true, mostra aviso em páginas de lançamento/ação (mais forte) */
  showOnAction?: boolean;
}

const ClientFilterAlert: React.FC<ClientFilterAlertProps> = ({ showOnAction = false }) => {
  const { user } = useAuth();
  const { adminClientIdFilter, clients } = useApp();

  // Apenas para admins
  if (user?.role !== 'admin') return null;

  const userHasClient = !!user.clientId;
  const currentClient = clients.find(c => c.id === adminClientIdFilter);
  const userClient = clients.find(c => c.id === user.clientId);
  
  // Admin SEM cliente associado
  if (!userHasClient) {
    // Mostra apenas em páginas de ação/lançamento
    if (!showOnAction) return null;
    
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800">
              {adminClientIdFilter ? (
                <>
                  <span className="font-semibold">Visualizando cliente:</span> {currentClient?.name || 'Desconhecido'}
                </>
              ) : (
                <>
                  <span className="font-semibold">⚠️ Atenção:</span> Você está visualizando <strong>TODOS os clientes</strong>. 
                  Se precisar de dados de um cliente específico, selecione-o no filtro acima.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin COM cliente associado - verificar se está vendo OUTRO cliente
  const isViewingOtherClient = adminClientIdFilter && adminClientIdFilter !== user.clientId;
  
  if (isViewingOtherClient) {
    return (
      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-orange-800">
              <span className="font-semibold">⚠️ Você não está no SEU cliente!</span>
              <br />
              Cliente atual: <strong>{currentClient?.name || 'Desconhecido'}</strong>
              {userClient && (
                <>
                  {' • '}Seu cliente: <strong>{userClient.name}</strong>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin vendo seu próprio cliente - sem aviso
  return null;
};

export default ClientFilterAlert;

