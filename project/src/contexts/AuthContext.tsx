import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: (User & { password: string })[] = [
  {
    id: '1',
    name: 'Administrador',
    email: 'admin@hospital.com',
    password: '123456',
    role: 'admin',
    clientId: undefined
  },
  {
    id: '2',
    name: 'Gerente Lavanderia',
    email: 'gerente@hospital.com',
    password: '123456',
    role: 'manager',
    clientId: 'c1'
  }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const baseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
      if (baseUrl) {
        const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (res.ok) {
          const json = await res.json();
          const { token, ...logged } = json as User & { token: string };
          setUser(logged);
          localStorage.setItem('user', JSON.stringify(logged));
          localStorage.setItem('token', token);
          setIsLoading(false);
          return true;
        }
      } else {
        // fallback mock
        const foundUser = mockUsers.find(u => u.email === email && u.password === password);
        if (foundUser) {
          const { password: _pw, ...userWithoutPassword } = foundUser;
          setUser(userWithoutPassword);
          localStorage.setItem('user', JSON.stringify(userWithoutPassword));
          setIsLoading(false);
          return true;
        }
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};