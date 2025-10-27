import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import EcolavLogo from './EcolavLogo';
import { getApiBaseUrl } from '../config';
import AnimatedLoginBackground from './AnimatedLoginBackground';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { isLoading, user, login: authLogin } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isAnimating) return;
    setError('');

    // validações simples
    if (!email || !password) {
      setError('Preencha email e senha.');
      setShake(true); setTimeout(() => setShake(false), 300);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido.');
      setShake(true); setTimeout(() => setShake(false), 300);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await authLogin(email, password);
      
      if (success) {
        console.log('✅ Login bem-sucedido, iniciando animação...');
        // Iniciar animação da "máquina de lavar" antes de navegar
        setIsAnimating(true);
        setIsSubmitting(false);
        console.log('🎬 isAnimating definido como true');
        
        // Manter animação por 2 segundos antes de permitir transição
        setTimeout(() => {
          console.log('⏰ Animação finalizada, permitindo transição...');
        }, 2000);
        
        // Não recarregar - deixar o AuthContext gerenciar a transição
        return;
      } else {
        setError('Email ou senha incorretos.');
        setShake(true); setTimeout(() => setShake(false), 300);
      }
    } catch (err) {
      setError('Falha na conexão. Tente novamente.');
      setShake(true); setTimeout(() => setShake(false), 300);
    } finally {
      if (!isAnimating) setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <AnimatedLoginBackground />
      {/* marca d'água ecolav no lado direito */}
      <img src="/ecolav.png" alt="Ecolav" className="hidden lg:block absolute right-6 bottom-6 w-16 h-16 opacity-80" />

      <div className={`relative bg-white/90 backdrop-blur rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/60 ${shake ? 'animate-[shake_0.3s]' : ''}`}>
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-transform duration-300 ${isSubmitting || isAnimating ? 'scale-95' : 'scale-100'}`}>
            <EcolavLogo size={56} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2"><span className="text-blue-600">Ecolav</span><span className="text-green-600">360</span></h1>
          <p className="text-gray-600">Sistema de Gestão de Enxoval</p>
        </div>

         {/* Formulário ou Máquina de Lavar */}
         {isAnimating ? (
           <div className="flex flex-col items-center justify-center space-y-6 py-8">
             <div className="relative w-56 h-56">
               {/* aro */}
               <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-200 to-white shadow-inner" />
               {/* porta */}
               <div className="absolute inset-3 rounded-full bg-slate-800/90 border-4 border-slate-300 overflow-hidden">
                 {/* água/ondas */}
                 <svg viewBox="0 0 100 100" className="w-full h-full">
                   <defs>
                     <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#60a5fa" />
                       <stop offset="100%" stopColor="#22c55e" />
                     </linearGradient>
                   </defs>
                   <g className="origin-center animate-[spin_1.2s_ease-in-out_infinite]">
                     <path d="M0,65 Q25,55 50,65 T100,65 L100,100 L0,100 Z" fill="url(#wash)" opacity="0.85"/>
                     <path d="M0,70 Q25,60 50,70 T100,70 L100,100 L0,100 Z" fill="#60a5fa" opacity="0.65"/>
                     {/* bolhas */}
                     <circle cx="20" cy="60" r="3" fill="#fff" className="animate-[bubble_1.2s_ease-in-out_infinite]" />
                     <circle cx="80" cy="62" r="2.5" fill="#fff" className="animate-[bubble_1.2s_ease-in-out_0.2s_infinite]" />
                     <circle cx="50" cy="58" r="2" fill="#fff" className="animate-[bubble_1.2s_ease-in-out_0.4s_infinite]" />
                   </g>
                 </svg>
               </div>
             </div>
             <p className="text-lg font-medium text-gray-700">Carregando...</p>
           </div>
         ) : (
           <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSubmitting || isAnimating}>
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
            disabled={isSubmitting || isAnimating || isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-2 sm:py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm sm:text-base"
          >
            {(isSubmitting || isAnimating) ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Entrar
              </>
             )}
           </button>
         </form>
         )}

        {/* Versão */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-blue-700 font-medium">Versão Beta 0.2.0</p>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default Login;