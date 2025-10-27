import React, { useMemo } from 'react';

interface FloatingIcon {
	id: string;
	x: number; // 0..100 vw
	y: number; // 0..100 vh
	delay: number; // seconds
	duration: number; // seconds
	size: number; // px
	type: 'shirt' | 'pants' | 'cross' | 'pc' | 'hanger' | 'washing';
	rot: number; // initial rotation
}

const IconSvg: React.FC<{ type: FloatingIcon['type']; size: number }> = ({ type, size }) => {
	switch (type) {
		case 'shirt':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<path d="M20 10 L32 16 L44 10 L54 22 L46 28 L46 54 L18 54 L18 28 L10 22 Z" fill="#60a5fa" />
					<circle cx="32" cy="22" r="3" fill="#93c5fd" />
				</svg>
			);
		case 'pants':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<path d="M18 10 H46 L42 54 H34 L32 34 L30 54 H22 Z" fill="#34d399" />
				</svg>
			);
		case 'cross':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<rect x="26" y="10" width="12" height="44" rx="3" fill="#ef4444" />
					<rect x="10" y="26" width="44" height="12" rx="3" fill="#ef4444" />
				</svg>
			);
		case 'pc':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<rect x="10" y="14" width="44" height="28" rx="4" fill="#0ea5e9" />
					<rect x="22" y="46" width="20" height="4" rx="2" fill="#94a3b8" />
				</svg>
			);
		case 'hanger':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<path d="M32 14 a6 6 0 1 1 6 6 h-2 c0 -2 -2 -4 -4 -4 s-4 2 -4 4 v2" stroke="#64748b" strokeWidth="3" fill="none" />
					<path d="M6 40 L32 26 L58 40" stroke="#64748b" strokeWidth="3" fill="none" />
				</svg>
			);
		case 'washing':
			return (
				<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
					<rect x="12" y="12" width="40" height="40" rx="6" fill="#22c55e" />
					<circle cx="32" cy="32" r="12" fill="#ffffff" opacity="0.9" />
					<circle cx="32" cy="32" r="8" fill="#22c55e" opacity="0.6" />
				</svg>
			);
	}
};

const AnimatedLoginBackground: React.FC = () => {
	const icons = useMemo<FloatingIcon[]>(() => {
		const types: FloatingIcon['type'][] = ['shirt', 'pants', 'cross', 'pc', 'hanger', 'washing'];
		return new Array(10).fill(0).map((_, i) => ({
			id: `f-${i}`,
			x: 10 + Math.round(Math.random() * 60), // manter do lado esquerdo/centro
			y: Math.round(Math.random() * 100),
			delay: Math.random() * 3,
			duration: 8 + Math.random() * 6,
			size: 24 + Math.round(Math.random() * 16),
			type: types[i % types.length],
			rot: -8 + Math.random() * 16,
		}));
	}, []);

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
			{/* gradient base */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-green-50 to-white" />

			{/* side image (right) */}
			<div className="absolute inset-y-0 right-0 w-1/2 hidden lg:block">
				<div className="absolute inset-0" style={{
					backgroundImage: 'url(/login-side.png)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					filter: 'saturate(1.05)'
				}} />
				{/* overlay com marca */}
				<div className="absolute inset-0 bg-white/10" />
			</div>

			{/* floating icons (lado esquerdo/centro, atrás do card) */}
			{icons.map((ic) => (
				<div
					key={ic.id}
					className="absolute opacity-40 hover:opacity-70 transition-opacity"
					style={{
						left: `${ic.x}vw`,
						top: `${ic.y}vh`,
						transform: `translate(-50%, -50%) rotate(${ic.rot}deg)`,
						animation: `floatY ${ic.duration}s ease-in-out ${ic.delay}s infinite`
					}}
				>
					<IconSvg type={ic.type} size={ic.size} />
				</div>
			))}

			{/* sutil pattern */}
			<div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:16px_16px]" />
		</div>
	);
};

export default AnimatedLoginBackground;
