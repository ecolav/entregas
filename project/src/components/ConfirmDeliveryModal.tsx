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
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (open) {
      setReceiverName('');
      setPhotoFile(null);
      if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); }
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

  useEffect(() => {
    return () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl transform animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Confirmar Entrega</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recebido por</label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome de quem recebeu"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setMode('signature')} className={`px-3 py-2 rounded border ${mode==='signature'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <PenTool className="inline w-4 h-4 mr-1" /> Assinatura
            </button>
            <button onClick={() => setMode('photo')} className={`px-3 py-2 rounded border ${mode==='photo'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <Camera className="inline w-4 h-4 mr-1" /> Foto
            </button>
          </div>

          {mode === 'signature' ? (
            <div>
              <div className="mb-2 text-sm text-gray-600">Desenhe a assinatura abaixo</div>
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                className="border border-gray-300 rounded w-full"
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
              <input
                type="file"
                accept="image/*"
                onChange={async (e)=>{
                  const f = e.target.files?.[0] || null;
                  if (!f) { setPhotoFile(null); if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null);} return; }
                  if (f.size > 20 * 1024 * 1024) { addToast({ type:'error', message:'Imagem muito grande (limite 20MB).'}); return; }
                  const cf = await compressImageSafely(f, 1280, 0.8);
                  setPhotoFile(cf);
                  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                  setPhotoPreviewUrl(URL.createObjectURL(cf));
                }}
                className="block w-full text-sm"
              />
              {photoPreviewUrl && (
                <div className="mt-2">
                  <img src={photoPreviewUrl} alt="Preview" className="w-full max-h-48 object-cover rounded border" />
                  <button
                    type="button"
                    onClick={() => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); setPhotoFile(null);} }
                    className="mt-1 text-xs text-red-600 hover:text-red-800"
                  >Remover foto</button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
            <button disabled={isSubmitting || !receiverName || (mode==='photo' && !photoFile)} onClick={handleConfirm} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">
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


// Utilitário compartilhado com SpecialRolls: compressão segura de imagem
async function compressImageSafely(file: File, maxDim: number, quality: number): Promise<File> {
  try {
    if (!file.type.startsWith('image/')) return file;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    let { width, height } = bitmap;
    if (width <= maxDim && height <= maxDim) return file;
    const ratio = width > height ? maxDim / width : maxDim / height;
    const targetW = Math.round(width * ratio);
    const targetH = Math.round(height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b || file), mime, quality));
    return new File([blob], file.name.replace(/\.(png|jpg|jpeg|webp)$/i, mime === 'image/png' ? '.png' : '.jpg'), { type: blob.type });
  } catch {
    return file;
  }
}
