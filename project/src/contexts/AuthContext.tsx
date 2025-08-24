import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Sem usuários mock: sempre autenticar na API

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
      const baseUrl = envUrl && envUrl.length > 0 ? envUrl : 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (res.ok) {
        const json = await res.json();
        const { token, ...logged } = json as User & { token: string };
        setUser(logged);
        localStorage.setItem('token', token);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch {
      // ignore
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    // Limpeza padronizada: somente token é persistido; no logout limpamos tudo
    try { localStorage.clear(); } catch { /* no-op */ }
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