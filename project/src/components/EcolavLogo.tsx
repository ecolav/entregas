import React from 'react';

interface EcolavLogoProps {
  className?: string;
  size?: number;
}

// Animated droplet logo for ECOLAV
const EcolavLogo: React.FC<EcolavLogoProps> = ({ className, size = 40 }) => {
  const width = size;
  const height = size + size * 0.25; // slightly taller for drop shape

  return (
    <div className={className} style={{ width, height }}>
      <svg
        viewBox="0 0 64 80"
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ECOLAV"
      >
        {/* Float animation */}
        <defs>
          <linearGradient id="ecoGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>

        <g>
          {/* Shadow ellipse */}
          <ellipse cx="32" cy="72" rx="16" ry="6" fill="#0f172a22">
            <animate
              attributeName="rx"
              values="15;18;15"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.25;0.4;0.25"
              dur="2s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Droplet */}
          <g>
            <path
              d="M32 6 C24 20 16 30 16 40 C16 52 23 60 32 60 C41 60 48 52 48 40 C48 30 40 20 32 6 Z"
              fill="url(#ecoGradient)"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -2; 0 0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>

            {/* Shine highlight */}
            <path
              d="M27 18 C24 24 24 30 27 32"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.6"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.4;0.8;0.4"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>

            {/* Inner ripple */}
            <circle cx="32" cy="46" r="6" fill="#ffffff22">
              <animate
                attributeName="r"
                values="5;7;5"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.2;0.35;0.2"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default EcolavLogo;


