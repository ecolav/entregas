import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import EcolavLogo from './EcolavLogo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = await login(email, password);
    if (!success) {
      // Mensagens mais claras conforme casos comuns
      if (!email || !password) {
        setError('Preencha email e senha.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Email inválido.');
        return;
      }
      setError('Email ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
            <EcolavLogo size={56} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ECOLAV</h1>
          <p className="text-gray-600">Sistema de Gestão de Enxoval</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="admin@hospital.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-2 sm:py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm sm:text-base"
          >
            {isLoading ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-blue-700 font-medium">Versão Beta 1.1.0</p>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;