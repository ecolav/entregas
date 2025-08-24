import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AppContextType, Sector, Bed, LinenItem, Order, StockMovement, Client, SystemUser, SystemUserInput } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data for demo
const mockSectors: Sector[] = [
  { id: '1', name: 'UTI', description: 'Unidade de Terapia Intensiva', createdAt: '2024-01-01T10:00:00Z', clientId: 'c1' },
  { id: '2', name: 'Clínica Médica', description: 'Clínica Médica Geral', createdAt: '2024-01-01T10:00:00Z', clientId: 'c1' },
  { id: '3', name: 'Pediatria', description: 'Unidade Pediátrica', createdAt: '2024-01-01T10:00:00Z', clientId: 'c1' },
];

const mockBeds: Bed[] = [
  { id: '1', number: '201', sectorId: '1', status: 'occupied', token: 'bed-201-token-uuid' },
  { id: '2', number: '202', sectorId: '1', status: 'free', token: 'bed-202-token-uuid' },
  { id: '3', number: '301', sectorId: '2', status: 'occupied', token: 'bed-301-token-uuid' },
  { id: '4', number: '401', sectorId: '3', status: 'free', token: 'bed-401-token-uuid' },
];

const mockLinenItems: LinenItem[] = [
  { id: '1', name: 'Lençol', sku: 'LEN001', unit: 'unidade', currentStock: 50, minimumStock: 10, createdAt: '2024-01-01T10:00:00Z' },
  { id: '2', name: 'Fronha', sku: 'FRO001', unit: 'unidade', currentStock: 30, minimumStock: 8, createdAt: '2024-01-01T10:00:00Z' },
  { id: '3', name: 'Toalha', sku: 'TOA001', unit: 'unidade', currentStock: 25, minimumStock: 5, createdAt: '2024-01-01T10:00:00Z' },
  { id: '4', name: 'Cobertor', sku: 'COB001', unit: 'unidade', currentStock: 8, minimumStock: 12, createdAt: '2024-01-01T10:00:00Z' },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>(mockSectors);
  const [beds, setBeds] = useState<Bed[]>(mockBeds);
  const [linenItems, setLinenItems] = useState<LinenItem[]>(mockLinenItems);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([
    { id: 'c1', name: 'Hospital Central', document: '00.000.000/0001-00', contactName: 'Mariana', contactEmail: 'contato@hospital.com', contactPhone: '(11) 99999-0000', whatsappNumber: '5511999999999', createdAt: '2024-01-01T10:00:00Z' },
  ]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([
    { id: 'u1', name: 'Administrador', email: 'admin@hospital.com', role: 'admin', createdAt: '2024-01-01T10:00:00Z' },
    { id: 'u2', name: 'Gerente', email: 'gerente@hospital.com', role: 'manager', createdAt: '2024-01-01T10:00:00Z' },
  ]);

  const getBaseUrl = () => {
    const envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
    return envUrl && envUrl.length > 0 ? envUrl : 'http://localhost:4000';
  };

  // Load persisted data (clients, sectors, beds, linen, orders, stock)
  useEffect(() => {
    try {
      const savedClients = localStorage.getItem('app_clients');
      if (savedClients) setClients(JSON.parse(savedClients));
      const savedSectors = localStorage.getItem('app_sectors');
      if (savedSectors) setSectors(JSON.parse(savedSectors));
      const savedBeds = localStorage.getItem('app_beds');
      if (savedBeds) setBeds(JSON.parse(savedBeds));
      const savedLinen = localStorage.getItem('app_linen');
      if (savedLinen) setLinenItems(JSON.parse(savedLinen));
      const savedOrders = localStorage.getItem('app_orders');
      if (savedOrders) setOrders(JSON.parse(savedOrders));
      const savedStock = localStorage.getItem('app_stock');
      if (savedStock) setStockMovements(JSON.parse(savedStock));
    } catch {
      // ignore corrupt data
    }
  }, []);

  // Persist on changes
  useEffect(() => {
    try { localStorage.setItem('app_clients', JSON.stringify(clients)); } catch { /* no-op */ }
  }, [clients]);
  useEffect(() => {
    try { localStorage.setItem('app_sectors', JSON.stringify(sectors)); } catch { /* no-op */ }
  }, [sectors]);
  useEffect(() => {
    try { localStorage.setItem('app_beds', JSON.stringify(beds)); } catch { /* no-op */ }
  }, [beds]);
  useEffect(() => {
    try { localStorage.setItem('app_linen', JSON.stringify(linenItems)); } catch { /* no-op */ }
  }, [linenItems]);
  useEffect(() => {
    try { localStorage.setItem('app_orders', JSON.stringify(orders)); } catch { /* no-op */ }
  }, [orders]);
  useEffect(() => {
    try { localStorage.setItem('app_stock', JSON.stringify(stockMovements)); } catch { /* no-op */ }
  }, [stockMovements]);

  // Load from API if available
  useEffect(() => {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('token');
    if (!token) return; // evita 401 antes do login
    (async () => {
      try {
        const authHeaders = (() => {
          return { Authorization: `Bearer ${token}` } as const;
        })();
        const [clientsRes, sectorsRes, bedsRes, itemsRes, ordersRes, stockRes] = await Promise.all([
          fetch(`${baseUrl}/clients`, { headers: authHeaders }),
          fetch(`${baseUrl}/sectors`, { headers: authHeaders }),
          fetch(`${baseUrl}/beds`, { headers: authHeaders }),
          fetch(`${baseUrl}/items`, { headers: authHeaders }),
          fetch(`${baseUrl}/orders`, { headers: authHeaders }),
          fetch(`${baseUrl}/stock-movements`, { headers: authHeaders }),
        ]);
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (sectorsRes.ok) setSectors(await sectorsRes.json());
        if (bedsRes.ok) setBeds(await bedsRes.json());
        if (itemsRes.ok) setLinenItems(await itemsRes.json());
        if (ordersRes.ok) setOrders(await ordersRes.json());
        if (stockRes.ok) setStockMovements(await stockRes.json());
      } catch (_err) { void 0; }
    })();
  }, []);

  // Re-load from API when user logs in (token available)
  useEffect(() => {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    (async () => {
      try {
        const authHeaders = { Authorization: `Bearer ${token}` } as const;
        const [clientsRes, sectorsRes, bedsRes, itemsRes, ordersRes, stockRes] = await Promise.all([
          fetch(`${baseUrl}/clients`, { headers: authHeaders }),
          fetch(`${baseUrl}/sectors`, { headers: authHeaders }),
          fetch(`${baseUrl}/beds`, { headers: authHeaders }),
          fetch(`${baseUrl}/items`, { headers: authHeaders }),
          fetch(`${baseUrl}/orders`, { headers: authHeaders }),
          fetch(`${baseUrl}/stock-movements`, { headers: authHeaders }),
        ]);
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (sectorsRes.ok) setSectors(await sectorsRes.json());
        if (bedsRes.ok) setBeds(await bedsRes.json());
        if (itemsRes.ok) setLinenItems(await itemsRes.json());
        if (ordersRes.ok) setOrders(await ordersRes.json());
        if (stockRes.ok) setStockMovements(await stockRes.json());
      } catch (_err) { void 0; }
    })();
  }, [user]);

  // Add sector reference to beds
  const bedsWithSectors = beds.map(bed => ({
    ...bed,
    sector: sectors.find(s => s.id === bed.sectorId)
  }));

  // Add item reference to orders
  const ordersWithItems = orders.map(order => ({
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
      }
    })();
  };

  const updateBed = (id: string, bed: Partial<Bed>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setBeds(prev => prev.map(b => b.id === id ? { ...b, ...bed } : b));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const endpoint = Object.prototype.hasOwnProperty.call(bed, 'status') ? `${baseUrl}/beds/${id}/status` : `${baseUrl}/beds/${id}`;
      const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(bed) });
      if (res.ok) {
        const updated = await res.json();
        setBeds(prev => prev.map(b => b.id === id ? updated : b));
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

  const addLinenItem = (item: Omit<LinenItem, 'id' | 'createdAt'>) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      const newItem: LinenItem = { ...item, id: uuidv4(), createdAt: new Date().toISOString() };
      setLinenItems(prev => [...prev, newItem]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(item) });
      if (res.ok) {
        const created = await res.json();
        setLinenItems(prev => [...prev, created]);
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
        // refresh items stock from API
        try {
          const itemsRes = await fetch(`${baseUrl}/items`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (itemsRes.ok) setLinenItems(await itemsRes.json());
        } catch (_err) { void 0; }
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
        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === id ? updated : o));
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
        // refresh items
        try {
          const itemsRes = await fetch(`${baseUrl}/items`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (itemsRes.ok) setLinenItems(await itemsRes.json());
        } catch (_err) { void 0; }
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
    const baseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL || 'http://localhost:4000';
    const token = localStorage.getItem('token');
    const uploadRes = await fetch(`${baseUrl}/uploads`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: form });
    const uploadJson = await uploadRes.json();
    const url = uploadJson.url as string;

    // Confirm delivery
    const confirmRes = await fetch(`${baseUrl}/orders/${params.orderId}/confirm-delivery`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({
        receiverName: params.receiverName,
        confirmationType: params.confirmationType,
        confirmationUrl: url,
        deliveredByUserId: params.deliveredByUserId
      })
    });
    const updated = await confirmRes.json();
    // Locally update state
    setOrders(prev => prev.map(o => o.id === params.orderId ? { ...o, ...updated } : o));
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
    const baseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
    if (!baseUrl) {
      const newUser: SystemUser = { ...user, id: uuidv4(), createdAt: new Date().toISOString() };
      setSystemUsers(prev => [...prev, newUser]);
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(user) });
      if (res.ok) {
        const created = await res.json();
        setSystemUsers(prev => [...prev, created]);
      }
    })();
  };

  const updateSystemUser = (id: string, user: Partial<SystemUser> & { password?: string }) => {
    const baseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
    if (!baseUrl) {
      setSystemUsers(prev => prev.map(u => (u.id === id ? { ...u, ...user } : u)));
      return;
    }
    (async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(user) });
      if (res.ok) {
        const updated = await res.json();
        setSystemUsers(prev => prev.map(u => (u.id === id ? updated : u)));
      }
    })();
  };

  const deleteSystemUser = (id: string) => {
    const baseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
    if (!baseUrl) {
      setSystemUsers(prev => prev.filter(u => u.id !== id));
      return;
    }
    (async () => {
      const res = await fetch(`${baseUrl}/users/${id}`, { method: 'DELETE' });
      if (res.ok) setSystemUsers(prev => prev.filter(u => u.id !== id));
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
      addSector,
      updateSector,
      deleteSector,
      addBed,
      updateBed,
      deleteBed,
      addLinenItem,
      updateLinenItem,
      deleteLinenItem,
      addOrder,
      updateOrderStatus,
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