import React from 'react';
import { useToast } from '../contexts/ToastContext';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[1000] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`transform transition-all duration-300 ease-out animate-slide-in shadow-lg rounded-lg px-4 py-3 text-white cursor-pointer ${
            t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes slide-in { from { opacity: 0; transform: translateY(-10px); } to { opacity:1; transform: translateY(0);} }
        .animate-slide-in { animation: slide-in 200ms ease-out; }
      `}</style>
    </div>
  );
};

export default ToastContainer;


