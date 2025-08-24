export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager';
  clientId?: string;
}

// Represents a client (hospital/unidade) served by the system
export interface Client {
  id: string;
  name: string;
  document?: string; // CNPJ/CPF ou identificador
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string; // E.164 ex: 5511999999999
  createdAt: string;
}

// Represents a system user (login) associated optionally to a client
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager';
  clientId?: string; // vínculo opcional a um cliente
  createdAt: string;
}

// Payload para criar/editar usuário no frontend
export type SystemUserInput = {
  name: string;
  email: string;
  role: 'admin' | 'manager';
  clientId?: string;
  password?: string; // opcional no update
};

export interface Sector {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  clientId?: string;
}

export interface Bed {
  id: string;
  number: string;
  sectorId: string;
  status: 'occupied' | 'free';
  token: string;
  sector?: Sector;
}

export interface LinenItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  createdAt: string;
  clientId?: string;
}

export interface OrderItem {
  itemId: string;
  quantity: number;
  item?: LinenItem;
}

export interface Order {
  id: string;
  bedId: string;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  items: OrderItem[];
  observations?: string;
  scheduledDelivery?: string;
  createdAt: string;
  updatedAt: string;
  bed?: Bed;
  deliveredAt?: string;
  deliveredByUserId?: string;
  receiverName?: string;
  confirmationType?: 'signature' | 'photo';
  confirmationUrl?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'in' | 'out';
  quantity: number;
  orderId?: string;
  reason: string;
  createdAt: string;
  item?: LinenItem;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

export interface AppContextType {
  sectors: Sector[];
  beds: Bed[];
  linenItems: LinenItem[];
  orders: Order[];
  stockMovements: StockMovement[];
  clients: Client[];
  systemUsers: SystemUser[];
  addSector: (sector: Omit<Sector, 'id' | 'createdAt'>) => void;
  updateSector: (id: string, sector: Partial<Sector>) => void;
  deleteSector: (id: string) => void;
  addBed: (bed: Omit<Bed, 'id' | 'token'>) => void;
  updateBed: (id: string, bed: Partial<Bed>) => void;
  deleteBed: (id: string) => void;
  addLinenItem: (item: Omit<LinenItem, 'id' | 'createdAt'>) => void;
  updateLinenItem: (id: string, item: Partial<LinenItem>) => void;
  deleteLinenItem: (id: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateOrderStatus: (id: string, status: Order['status']) => void;
  addStockMovement: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => void;
  getBedByToken: (token: string) => Bed | undefined;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addSystemUser: (user: SystemUserInput) => void;
  updateSystemUser: (id: string, user: Partial<SystemUser> & { password?: string }) => void;
  deleteSystemUser: (id: string) => void;
  confirmOrderDelivery: (params: {
    orderId: string;
    receiverName: string;
    confirmationType: 'signature' | 'photo';
    file: Blob;
    deliveredByUserId?: string;
  }) => Promise<void>;
}