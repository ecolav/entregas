import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppContextType, Sector, Bed, LinenItem, Order, StockMovement, Client, SystemUser, SystemUserInput } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../config';
import { useToast } from './ToastContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

// Sistema de cache removido para garantir atualizações em tempo real

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [linenItems, setLinenItems] = useState<LinenItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [adminClientIdFilter, setAdminClientIdFilter] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('validating');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const ordersChannelRef = useRef<BroadcastChannel | null>(null);
  const hasLoadedOnce = useRef(false);
  const getBaseUrl = () => getApiBaseUrl();

  // Função simplificada para carregar dados sempre frescos
  // silent = true: não mostra loading (para refresh em background)
  const loadData = useCallback(async (silent = false) => {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('token');
    if (!baseUrl || !token) {
      setIsInitialLoading(false);
      return;
    }

    // ⚠️ BLOQUEIO CRÍTICO: Se é admin com clientId mas filtro não está setado, ABORTAR!
    if (user?.role === 'admin' && user.clientId && !adminClientIdFilter) {
      console.error('🚫 BLOQUEADO: Admin tem clientId mas filtro não está setado!', {
        userClientId: user.clientId,
        adminClientIdFilter
      });
      setIsInitialLoading(false); // IMPORTANTE: definir como false mesmo quando bloqueado
      return; // NÃO CARREGA NADA
    }

    if (!silent) {
      setIsLoading(true);
      setLoadingStep('validating');
      setLoadingProgress(0);
    }
    const authHeaders = { Authorization: `Bearer ${token}` } as const;

    try {
      const qs = (user?.role === 'admin' && adminClientIdFilter) ? `?clientId=${encodeURIComponent(adminClientIdFilter)}` : '';
      
      
      // Carregamento progressivo
      if (!silent) {
        setLoadingStep('clients');
        setLoadingProgress(10);
      }
      
      const clientsRes = await fetch(`${baseUrl}/clients`, { headers: authHeaders });
      const clientsData = clientsRes.ok ? await clientsRes.json() : [];
      setClients(clientsData);
      
      if (!silent) {
        setLoadingStep('sectors');
        setLoadingProgress(30);
      }
      
      const sectorsRes = await fetch(`${baseUrl}/sectors${qs}`, { headers: authHeaders });
      const sectorsData = sectorsRes.ok ? await sectorsRes.json() : [];
      setSectors(sectorsData);
      
      if (!silent) {
        setLoadingStep('beds');
        setLoadingProgress(50);
      }
      
      const bedsRes = await fetch(`${baseUrl}/beds${qs}`, { headers: authHeaders });
      const bedsData = bedsRes.ok ? await bedsRes.json() : [];
      setBeds(bedsData);
      
      if (!silent) {
        setLoadingStep('items');
        setLoadingProgress(70);
      }
      
      const itemsRes = await fetch(`${baseUrl}/items${qs}`, { headers: authHeaders });
      const itemsData = itemsRes.ok ? await itemsRes.json() : [];
      setLinenItems(itemsData);
      
      if (!silent) {
        setLoadingStep('orders');
        setLoadingProgress(85);
      }
      
      const ordersRes = await fetch(`${baseUrl}/orders${qs}`, { headers: authHeaders });
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      setOrders(ordersData);
      
      if (!silent) {
        setLoadingStep('finalizing');
        setLoadingProgress(95);
      }
      
      // Carregar dados restantes em paralelo
      const [stockRes, usersRes] = await Promise.all([
        fetch(`${baseUrl}/stock-movements${qs}`, { headers: authHeaders }),
        fetch(`${baseUrl}/users`, { headers: authHeaders }),
      ]);

      // Se qualquer chamada retornar 401, forçar logout para renovar o token
      const anyUnauthorized = [clientsRes, sectorsRes, bedsRes, itemsRes, ordersRes, stockRes, usersRes].some(r => r.status === 401);
      if (anyUnauthorized) {
        logout();
        return;
      }

      const [stockData, usersData] = await Promise.all([
        stockRes.ok ? stockRes.json() : [],
        usersRes.ok ? usersRes.json() : [],
      ]);

      setStockMovements(stockData);
      setSystemUsers(usersData);

      setLastRefresh(Date.now());
      
      if (!silent) {
        setLoadingStep('completed');
        setLoadingProgress(100);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      if (!silent) {
        addToast({ type: 'error', message: 'Erro ao carregar dados. Tente novamente.' });
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      setIsInitialLoading(false);
    }
  }, [user?.id, user?.role, adminClientIdFilter, addToast, logout]);

  const refreshAll = useCallback(async (silent = true) => {
    await loadData(silent);
  }, [loadData]);

  const notify = (type: string) => {
    try { new BroadcastChannel('ecolav-app').postMessage({ type }); } catch { /* no-op */ }
  };

  // Carregar dados quando user logar ou filtro mudar
  useEffect(() => {
    if (!user) {
      hasLoadedOnce.current = false;
      setIsInitialLoading(false);
      return;
    }
    
    // Se é admin com clientId, settar filtro ANTES de qualquer coisa
    if (user.role === 'admin' && user.clientId) {
      if (adminClientIdFilter !== user.clientId) {
        setAdminClientIdFilter(user.clientId);
        return; // Espera o próximo render com filtro correto
      }
    }
    
    // Agora o filtro está correto (ou não é necessário), pode carregar
    loadData(false).finally(() => {
      setIsInitialLoading(false);
    });
    hasLoadedOnce.current = true;
  }, [user, adminClientIdFilter, loadData]);

  // Limpar dados quando o usuário sair
  useEffect(() => {
    if (!user) {
      setSectors([]);
      setBeds([]);
      setLinenItems([]);
      setOrders([]);
      setStockMovements([]);
      setClients([]);
      setSystemUsers([]);
      setAdminClientIdFilter(null);
      hasLoadedOnce.current = false;
    }
  }, [user]);

  // Auto-refresh a cada 30 segundos se o usuário estiver ativo
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastRefresh > 30 * 1000) { // 30 segundos
        loadData();
      }
    }, 10 * 1000); // Verificar a cada 10 segundos

    return () => clearInterval(interval);
  }, [user, lastRefresh, loadData]);

  // Cross-tab/tab-to-dashboard updates: listen for events and refresh data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      ordersChannelRef.current = new BroadcastChannel('ecolav-app');
      ordersChannelRef.current.onmessage = async (ev) => {
        const type = ev?.data?.type as string | undefined;
        if (!type) return;
        // Refresh everything on any known event to keep UI consistent
        if (type === 'orders-changed' || type === 'beds-changed' || type === 'sectors-changed' || type === 'items-changed') {
          await refreshAll();
        }
      };
    } catch { /* ignore */ }
    const onFocus = async () => {
      // Atualizar todos os dados quando a aba ganhar foco
      await refreshAll();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      try { ordersChannelRef.current?.close(); } catch { /* ignore */ }
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshAll]);

  // Periodic refresh while authenticated (cross-device updates when QR flow is used)
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Atualizar a cada 5 segundos (reduzido de 1s para melhorar performance)
    const id = setInterval(() => {
      void refreshAll();
    }, 5000);
    
    return () => clearInterval(id);
  }, [user, refreshAll]);

  // Add sector reference to beds
  const bedsWithSectors = beds.map(bed => ({
    ...bed,
    sector: sectors.find(s => s.id === bed.sectorId)
  }));

  // Ensure orders are unique by id (avoid transient duplicates on UI)
  const uniqueOrders = useMemo(() => {
    const byId = new Map<string, Order>();
    for (const o of orders) byId.set(o.id, o);
    return Array.from(byId.values());
  }, [orders]);

  // Add item reference to orders
  const ordersWithItems = uniqueOrders.map(order => ({
    ...order,
    bed: bedsWithSectors.find(b => b.id === order.bedId),
    items: (order.items || []).map(orderItem => ({
      ...orderItem,
      item: linenItems.find(i => i.id === orderItem.itemId)
    }))
  }));

  const addSector = (sector: Omit<Sector, 'id' | 'createdAt'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newSector: Sector = { ...sector, id: uuidv4(), createdAt: new Date().toISOString() };
      setSectors(prev => [...prev, newSector]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/sectors`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(sector) });
      if (res.ok) {
        const created = await res.json();
        setSectors(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        notify('sectors-changed');
        addToast({ type: 'success', message: 'Setor criado com sucesso' });
      }
    })();
  };

  const updateSector = (id: string, sector: Partial<Sector>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setSectors(prev => prev.map(s => s.id === id ? { ...s, ...sector } : s));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/sectors/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(sector) });
      if (res.ok) {
        const updated = await res.json();
        setSectors(prev => prev.map(s => s.id === id ? updated : s));
        // Atualização imediata para tempo real
        await refreshAll();
        notify('sectors-changed');
        addToast({ type: 'success', message: 'Setor atualizado com sucesso' });
      }
    })();
  };

  const deleteSector = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setSectors(prev => prev.filter(s => s.id !== id));
      setBeds(prev => prev.filter(b => b.sectorId !== id));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/sectors/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) {
        setSectors(prev => prev.filter(s => s.id !== id));
        setBeds(prev => prev.filter(b => b.sectorId !== id));
      }
    })();
  };

  const addBed = (bed: Omit<Bed, 'id' | 'token'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newBed: Bed = { ...bed, id: uuidv4(), token: uuidv4() };
      setBeds(prev => [...prev, newBed]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/beds`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(bed) });
      if (res.ok) {
        const created = await res.json();
        setBeds(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        notify('beds-changed');
        addToast({ type: 'success', message: 'Leito criado com sucesso' });
      }
    })();
  };

  const updateBed = (id: string, bed: Partial<Bed>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setBeds(prev => prev.map(b => b.id === id ? { ...b, ...bed } : b));
      // Notify other contexts to refresh
      notify('beds-changed');
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const endpoint = Object.prototype.hasOwnProperty.call(bed, 'status') ? `${baseUrl}/beds/${id}/status` : `${baseUrl}/beds/${id}`;
      const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(bed) });
      if (res.ok) {
        const updated = await res.json();
        setBeds(prev => prev.map(b => b.id === id ? updated : b));
        await refreshAll();
        notify('beds-changed');
      }
    })();
  };

  const deleteBed = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setBeds(prev => prev.filter(b => b.id !== id));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/beds/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) setBeds(prev => prev.filter(b => b.id !== id));
    })();
  };

  const getOrCreateVirtualSectorBed = async (sectorId: string): Promise<Bed | null> => {
    // Busca por um leito virtual padronizado para distribuição por setor
    const existing = beds.find(b => b.sectorId === sectorId && b.number === 'Sem leito (Setor)');
    if (existing) return existing;
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newBed: Bed = { id: uuidv4(), number: 'Sem leito (Setor)', sectorId, status: 'free', token: uuidv4() } as Bed;
      setBeds(prev => [...prev, newBed]);
      return newBed;
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`${baseUrl}/beds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ number: 'Sem leito (Setor)', sectorId, status: 'free' })
    });
    if (!res.ok) return null;
    const created = await res.json();
    // Refresh e broadcast para manter realtime
    await refreshAll();
    notify('beds-changed');
    return created as Bed;
  };

  const addLinenItem = (item: Omit<LinenItem, 'id' | 'createdAt'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newItem: LinenItem = { ...item, id: uuidv4(), createdAt: new Date().toISOString() };
      setLinenItems(prev => [...prev, newItem]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const payload = {
        ...item,
        // Se admin estiver filtrando um cliente, criar o item vinculado a esse cliente
        clientId: (user?.role === 'admin' && adminClientIdFilter) ? adminClientIdFilter : (item as Partial<LinenItem>).clientId
      };
      const res = await fetch(`${baseUrl}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const created = await res.json();
        setLinenItems(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        notify('items-changed');
        addToast({ type: 'success', message: 'Item criado com sucesso' });
      }
    })();
  };

  const updateLinenItem = (id: string, item: Partial<LinenItem>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setLinenItems(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(item) });
      if (res.ok) {
        const updated = await res.json();
        setLinenItems(prev => prev.map(i => i.id === id ? updated : i));
        // Atualização imediata para tempo real
        await refreshAll();
        notify('items-changed');
        addToast({ type: 'success', message: 'Item atualizado com sucesso' });
      }
    })();
  };

  const deleteLinenItem = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setLinenItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/items/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) setLinenItems(prev => prev.filter(i => i.id !== id));
    })();
  };

  const addOrder = (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newOrder: Order = { ...order, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setOrders(prev => [...prev, newOrder]);
      // local stock update
      order.items.forEach(orderItem => {
        const item = linenItems.find(i => i.id === orderItem.itemId);
        if (item) updateLinenItem(item.id, { currentStock: Math.max(0, item.currentStock - orderItem.quantity) });
      });
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ bedId: order.bedId, items: order.items, observations: order.observations, scheduledDelivery: order.scheduledDelivery }) });
      if (res.ok) {
        const created = await res.json();
        setOrders(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        notify('orders-changed');
        addToast({ type: 'success', message: 'Pedido criado com sucesso' });
      }
    })();
  };

  const deleteOrder = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setOrders(prev => prev.filter(o => o.id !== id));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/orders/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) {
        await refreshAll();
        notify('orders-changed');
        addToast({ type: 'success', message: 'Pedido excluído com sucesso' });
      }
    })();
  };

  const updateOrderStatus = (id: string, status: Order['status']) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ status }) });
      if (res.ok) {
         await res.json();
         // Atualização imediata para tempo real
        await refreshAll();
        notify('orders-changed');
         addToast({ type: 'success', message: 'Status do pedido atualizado com sucesso' });
      }
    })();
  };

  const addStockMovement = (movement: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newMovement: StockMovement = { ...movement, id: uuidv4(), createdAt: new Date().toISOString() };
      setStockMovements(prev => [...prev, newMovement]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/stock-movements`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(movement) });
      if (res.ok) {
        const created = await res.json();
        setStockMovements(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        addToast({ type: 'success', message: 'Movimento de estoque registrado com sucesso' });
      }
    })();
  };

  const getBedByToken = (token: string): Bed | undefined => {
    return bedsWithSectors.find(bed => bed.token === token);
  };

  const confirmOrderDelivery = async (params: {
    orderId: string;
    receiverName: string;
    confirmationType: 'signature' | 'photo';
    file: Blob;
    deliveredByUserId?: string;
  }) => {
    // Upload file
    const form = new FormData();
    form.append('file', params.file);
    const baseUrl = getApiBaseUrl();
    const token = localStorage.getItem('token');
    
    try {
      const uploadRes = await fetch(`${baseUrl}/uploads`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: form });
      
      if (!uploadRes.ok) {
        let message = 'Falha ao enviar comprovante';
        try { const j = await uploadRes.json(); message = j?.error || message; } catch { /* ignore */ }
        addToast({ type: 'error', message });
        return;
      }
      const uploadJson = await uploadRes.json();
      const url = uploadJson.url as string;

      // Confirm delivery
      const confirmPayload = {
          receiverName: params.receiverName,
          confirmationType: params.confirmationType,
          confirmationUrl: url,
          deliveredByUserId: params.deliveredByUserId
      };
      
      const confirmRes = await fetch(`${baseUrl}/orders/${params.orderId}/confirm-delivery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(confirmPayload)
      });
      
      if (!confirmRes.ok) {
        let message = 'Falha ao confirmar entrega';
        try { const j = await confirmRes.json(); message = j?.error || message; } catch { /* ignore */ }
        addToast({ type: 'error', message });
        return;
      }
             await confirmRes.json();
      
      // Atualizar todos os dados e notificar outras abas
      await refreshAll();
      notify('orders-changed');
      
      addToast({ type: 'success', message: 'Entrega confirmada com sucesso' });
    } catch {
      addToast({ type: 'error', message: 'Erro de rede na confirmação' });
    }
  };

  // Clients CRUD (API-aware)
  const normalizeClient = (c: Partial<Client>): Partial<Client> => {
    const norm: Partial<Client> = { ...c };
    const toNullIfEmpty = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
    norm.document = toNullIfEmpty(norm.document) as string | undefined | null;
    norm.contactName = toNullIfEmpty(norm.contactName) as string | undefined | null;
    norm.contactEmail = toNullIfEmpty(norm.contactEmail) as string | undefined | null;
    norm.contactPhone = toNullIfEmpty(norm.contactPhone) as string | undefined | null;
    if (norm.whatsappNumber !== undefined && norm.whatsappNumber !== null) {
      const raw = String(norm.whatsappNumber);
      norm.whatsappNumber = raw.trim() === '' ? null : raw.replace(/\D/g, '');
    }
    return norm;
  };

  const addClient = (client: Omit<Client, 'id' | 'createdAt'>) => {
    const baseUrl = getBaseUrl();
    const payload = normalizeClient(client) as Omit<Client, 'id' | 'createdAt'>;
    if (!baseUrl) {
      const newClient: Client = { ...payload, id: uuidv4(), createdAt: new Date().toISOString() } as Client;
      setClients(prev => [...prev, newClient]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const created = await res.json();
        setClients(prev => [...prev, created]);
      }
    })();
  };

  const updateClient = (id: string, client: Partial<Client>) => {
    const baseUrl = getBaseUrl();
    const payload = normalizeClient(client);
    if (!baseUrl) {
      setClients(prev => prev.map(c => (c.id === id ? { ...c, ...payload } : c)));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const updated = await res.json();
        setClients(prev => prev.map(c => (c.id === id ? updated : c)));
        // Atualização imediata para tempo real
        await refreshAll();
        addToast({ type: 'success', message: 'Cliente atualizado com sucesso' });
      }
    })();
  };

  const deleteClient = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setClients(prev => prev.filter(c => c.id !== id));
      setSystemUsers(prev => prev.map(u => (u.clientId === id ? { ...u, clientId: undefined } : u)));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/clients/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== id));
        setSystemUsers(prev => prev.map(u => (u.clientId === id ? { ...u, clientId: undefined } : u)));
      }
    })();
  };

  // System Users CRUD (API-aware)
  const addSystemUser = (user: SystemUserInput) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
          body: JSON.stringify(user)
        });
        if (res.ok) {
          const created = await res.json();
          setSystemUsers(prev => [...prev, created]);
        // Atualização imediata para tempo real
        await refreshAll();
        addToast({ type: 'success', message: 'Usuário criado com sucesso' });
        } else {
          let message = 'Falha ao criar usuário';
          try { const j = await res.json(); message = j?.error || message; } catch { /* ignore */ }
          addToast({ type: 'error', message });
        }
      } catch {
        addToast({ type: 'error', message: 'Erro de rede ao criar usuário' });
      }
    })();
  };

  const updateSystemUser = (id: string, user: Partial<SystemUser> & { password?: string }) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${baseUrl}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
          body: JSON.stringify(user)
        });
        if (res.ok) {
          const updated = await res.json();
          setSystemUsers(prev => prev.map(u => (u.id === id ? updated : u)));
        // Atualização imediata para tempo real
        await refreshAll();
        addToast({ type: 'success', message: 'Usuário atualizado com sucesso' });
        } else {
          let message = 'Falha ao atualizar usuário';
          try { const j = await res.json(); message = j?.error || message; } catch { /* ignore */ }
          addToast({ type: 'error', message });
        }
      } catch {
        addToast({ type: 'error', message: 'Erro de rede ao atualizar usuário' });
      }
    })();
  };

  const deleteSystemUser = (id: string) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${baseUrl}/users/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (res.ok) {
          setSystemUsers(prev => prev.filter(u => u.id !== id));
        } else {
          let message = 'Falha ao excluir usuário';
          try { const j = await res.json(); message = j?.error || message; } catch { /* ignore */ }
          addToast({ type: 'error', message });
        }
      } catch {
        addToast({ type: 'error', message: 'Erro de rede ao excluir usuário' });
      }
    })();
  };

  return (
    <AppContext.Provider value={{
      sectors,
      beds: bedsWithSectors,
      linenItems,
      orders: ordersWithItems,
      stockMovements,
      clients,
      systemUsers,
      isLoading,
      isInitialLoading,
      adminClientIdFilter,
      setAdminClientIdFilter,
      loadingStep,
      loadingProgress,
      addSector,
      updateSector,
      deleteSector,
      addBed,
      updateBed,
      deleteBed,
      getOrCreateVirtualSectorBed,
      addLinenItem,
      updateLinenItem,
      deleteLinenItem,
      addOrder,
      updateOrderStatus,
      deleteOrder,
      addStockMovement,
      getBedByToken,
      confirmOrderDelivery,
      addClient,
      updateClient,
      deleteClient,
      addSystemUser,
      updateSystemUser,
      deleteSystemUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};