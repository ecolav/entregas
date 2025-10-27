import React from 'react';

const WashingMachineAnimation: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
    </div>
  );
};

export default WashingMachineAnimation;
