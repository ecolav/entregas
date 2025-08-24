import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AppContextType, Sector, Bed, LinenItem, Order, StockMovement, Client, SystemUser } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    } catch (err) {
      // ignore corrupt data
    }
  }, []);

  // Persist on changes
  useEffect(() => {
    try { localStorage.setItem('app_clients', JSON.stringify(clients)); } catch {}
  }, [clients]);
  useEffect(() => {
    try { localStorage.setItem('app_sectors', JSON.stringify(sectors)); } catch {}
  }, [sectors]);
  useEffect(() => {
    try { localStorage.setItem('app_beds', JSON.stringify(beds)); } catch {}
  }, [beds]);
  useEffect(() => {
    try { localStorage.setItem('app_linen', JSON.stringify(linenItems)); } catch {}
  }, [linenItems]);
  useEffect(() => {
    try { localStorage.setItem('app_orders', JSON.stringify(orders)); } catch {}
  }, [orders]);
  useEffect(() => {
    try { localStorage.setItem('app_stock', JSON.stringify(stockMovements)); } catch {}
  }, [stockMovements]);

  // Add sector reference to beds
  const bedsWithSectors = beds.map(bed => ({
    ...bed,
    sector: sectors.find(s => s.id === bed.sectorId)
  }));

  // Add item reference to orders
  const ordersWithItems = orders.map(order => ({
    ...order,
    bed: bedsWithSectors.find(b => b.id === order.bedId),
    items: order.items.map(orderItem => ({
      ...orderItem,
      item: linenItems.find(i => i.id === orderItem.itemId)
    }))
  }));

  const addSector = (sector: Omit<Sector, 'id' | 'createdAt'>) => {
    const newSector: Sector = {
      ...sector,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    setSectors(prev => [...prev, newSector]);
  };

  const updateSector = (id: string, sector: Partial<Sector>) => {
    setSectors(prev => prev.map(s => s.id === id ? { ...s, ...sector } : s));
  };

  const deleteSector = (id: string) => {
    setSectors(prev => prev.filter(s => s.id !== id));
    setBeds(prev => prev.filter(b => b.sectorId !== id));
  };

  const addBed = (bed: Omit<Bed, 'id' | 'token'>) => {
    const newBed: Bed = {
      ...bed,
      id: uuidv4(),
      token: uuidv4()
    };
    setBeds(prev => [...prev, newBed]);
  };

  const updateBed = (id: string, bed: Partial<Bed>) => {
    setBeds(prev => prev.map(b => b.id === id ? { ...b, ...bed } : b));
  };

  const deleteBed = (id: string) => {
    setBeds(prev => prev.filter(b => b.id !== id));
  };

  const addLinenItem = (item: Omit<LinenItem, 'id' | 'createdAt'>) => {
    const newItem: LinenItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    setLinenItems(prev => [...prev, newItem]);
  };

  const updateLinenItem = (id: string, item: Partial<LinenItem>) => {
    setLinenItems(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
  };

  const deleteLinenItem = (id: string) => {
    setLinenItems(prev => prev.filter(i => i.id !== id));
  };

  const addOrder = (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const newOrder: Order = {
      ...order,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setOrders(prev => [...prev, newOrder]);

    // Update stock
    order.items.forEach(orderItem => {
      const item = linenItems.find(i => i.id === orderItem.itemId);
      if (item) {
        updateLinenItem(item.id, {
          currentStock: Math.max(0, item.currentStock - orderItem.quantity)
        });

        // Add stock movement
        addStockMovement({
          itemId: item.id,
          type: 'out',
          quantity: orderItem.quantity,
          orderId: newOrder.id,
          reason: `Pedido ${newOrder.id}`
        });
      }
    });
    return newOrder.id;
  };

  const updateOrderStatus = (id: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => 
      o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
    ));
  };

  const addStockMovement = (movement: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const newMovement: StockMovement = {
      ...movement,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    setStockMovements(prev => [...prev, newMovement]);
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
    const baseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';
    const uploadRes = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: form });
    const uploadJson = await uploadRes.json();
    const url = uploadJson.url as string;

    // Confirm delivery
    const confirmRes = await fetch(`${baseUrl}/orders/${params.orderId}/confirm-delivery`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

  // Clients CRUD
  const addClient = (client: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = { ...client, id: uuidv4(), createdAt: new Date().toISOString() };
    setClients(prev => [...prev, newClient]);
  };

  const updateClient = (id: string, client: Partial<Client>) => {
    setClients(prev => prev.map(c => (c.id === id ? { ...c, ...client } : c)));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    // Optionally detach users from this client
    setSystemUsers(prev => prev.map(u => (u.clientId === id ? { ...u, clientId: undefined } : u)));
  };

  // System Users CRUD
  const addSystemUser = (user: Omit<SystemUser, 'id' | 'createdAt'>) => {
    const newUser: SystemUser = { ...user, id: uuidv4(), createdAt: new Date().toISOString() };
    setSystemUsers(prev => [...prev, newUser]);
  };

  const updateSystemUser = (id: string, user: Partial<SystemUser>) => {
    setSystemUsers(prev => prev.map(u => (u.id === id ? { ...u, ...user } : u)));
  };

  const deleteSystemUser = (id: string) => {
    setSystemUsers(prev => prev.filter(u => u.id !== id));
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