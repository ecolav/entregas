import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Camera, PenTool } from 'lucide-react';

interface ConfirmDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (args: { receiverName: string; confirmationType: 'signature' | 'photo'; file: Blob; }) => Promise<void>;
}

const ConfirmDeliveryModal: React.FC<ConfirmDeliveryModalProps> = ({ open, onClose, onConfirm }) => {
  const [receiverName, setReceiverName] = useState('');
  const [mode, setMode] = useState<'signature' | 'photo'>('signature');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (open) {
      setReceiverName('');
      setPhotoFile(null);
      setMode('signature');
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [open]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    draw(e);
  };
  const handleEnd = () => { drawing.current = false; };
  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left; const y = clientY - rect.top;
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirm = async () => {
    if (!receiverName) return;
    setIsSubmitting(true);
    try {
      let blob: Blob;
      if (mode === 'signature') {
        const canvas = canvasRef.current!;
        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch(dataUrl); blob = await res.blob();
      } else {
        if (!photoFile) return; blob = photoFile;
      }
      await onConfirm({ receiverName, confirmationType: mode, file: blob });
      addToast({ type: 'success', message: 'Entrega confirmada com sucesso!' });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-3 sm:p-4 transition-opacity animate-fade-in">
      <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl transform animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold">Confirmar Entrega</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recebido por</label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Nome de quem recebeu"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setMode('signature')} className={`px-3 py-2 text-sm rounded border ${mode==='signature'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <PenTool className="inline w-4 h-4 mr-1" /> Assinatura
            </button>
            <button onClick={() => setMode('photo')} className={`px-3 py-2 text-sm rounded border ${mode==='photo'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <Camera className="inline w-4 h-4 mr-1" /> Foto
            </button>
          </div>

          {mode === 'signature' ? (
            <div>
              <div className="mb-2 text-sm text-gray-600">Desenhe a assinatura abaixo</div>
              <canvas
                ref={canvasRef}
                width={600}
                height={240}
                className="border border-gray-300 rounded w-full h-40 sm:h-48"
                onMouseDown={handleStart}
                onMouseMove={draw}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={draw}
                onTouchEnd={handleEnd}
              />
              <button onClick={clearCanvas} className="mt-2 text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Limpar</button>
            </div>
          ) : (
            <div>
              <input type="file" accept="image/*" onChange={(e)=>setPhotoFile(e.target.files?.[0]||null)} className="block w-full text-sm" />
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button onClick={onClose} className="px-3 sm:px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">Cancelar</button>
            <button disabled={isSubmitting || !receiverName || (mode==='photo' && !photoFile)} onClick={handleConfirm} className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              {isSubmitting ? 'Enviando...' : 'Confirmar Entrega'}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
        .animate-fade-in { animation: fade-in 150ms ease-out }
        @keyframes scale-in { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        .animate-scale-in { animation: scale-in 160ms ease-out }
      `}</style>
    </div>
  );
};

export default ConfirmDeliveryModal;


