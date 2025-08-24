import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, Bed, Download, Copy, Check, Printer } from 'lucide-react';

const BedManagement: React.FC = () => {
  const { beds, sectors, addBed, updateBed, deleteBed } = useApp();
  const { user } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({ number: '', sectorId: '', status: 'free' as const });
  const [batchMode, setBatchMode] = useState<'A7' | 'A6' | 'THERMAL'>('THERMAL');
  const [thermalWidthMm, setThermalWidthMm] = useState<number>(50);
  const [thermalHeightMm, setThermalHeightMm] = useState<number>(30);
  const [thermalMarginMm, setThermalMarginMm] = useState<number>(3);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);

  const visibleSectors = useMemo(() => {
    if (user?.role === 'admin' || !user?.clientId) return sectors;
    return sectors.filter(s => s.clientId === user.clientId);
  }, [sectors, user]);

  const visibleBeds = useMemo(() => {
    const sectorIds = new Set(visibleSectors.map(s => s.id));
    return beds.filter(b => sectorIds.has(b.sectorId));
  }, [beds, visibleSectors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBed) {
      updateBed(editingBed, formData);
      setEditingBed(null);
    } else {
      addBed(formData);
      setIsAddModalOpen(false);
    }
    setFormData({ number: '', sectorId: '', status: 'free' });
  };

  const handleSetStatus = (id: string, status: 'occupied' | 'free') => {
    updateBed(id, { status });
  };

  const handlePrintLabel = (
    bed: { id: string; number: string; token: string; sector?: { name?: string | undefined } },
    mode: 'A7' | 'A6' | 'THERMAL'
  ) => {
    const url = `${window.location.origin}/pedido?token=${bed.token}`;
    const a6 = { w: 105, h: 148 };
    const a7 = { w: 74, h: 105 };
    const wmm = mode === 'A6' ? a6.w : mode === 'A7' ? a7.w : thermalWidthMm;
    const hmm = mode === 'A6' ? a6.h : mode === 'A7' ? a7.h : thermalHeightMm;
    const margin = mode === 'THERMAL' ? thermalMarginMm : 6;
    const cardWidth = mode === 'THERMAL' ? '100%' : (mode === 'A6' ? '480px' : '320px');
    const qr = mode === 'THERMAL' ? Math.round(Math.min(wmm, hmm) * 8 * 0.7) : (mode === 'A6' ? 220 : 180);
    const logo = mode === 'THERMAL' ? Math.round(Math.min(wmm, hmm) * 0.25) : (mode === 'A6' ? 40 : 32);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qr}x${qr}&data=${encodeURIComponent(url)}`;
    const labelHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Etiqueta Leito ${bed.number}</title>
    <style>
      @media print { @page { size: ${wmm}mm ${hmm}mm; margin: ${margin}mm; } }
      body { font-family: Arial, sans-serif; margin: 0; padding: 12px; }
      .card { width: ${cardWidth}; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .title { font-size: 16px; font-weight: 700; color: #111827; }
      .subtitle { font-size: 12px; color: #6b7280; }
      .qr { display: flex; align-items: center; justify-content: center; margin: 8px 0; }
      .meta { font-size: 12px; color: #374151; }
      .logo { width: ${logo}px; height: ${Math.round(logo + logo * 0.25)}px; }
      .footer { margin-top: 8px; font-size: 10px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <div>
          <div class="title">ECOLAV</div>
          <div class="subtitle">Etiqueta de Leito</div>
        </div>
        <div class="logo">
          <svg viewBox="0 0 64 80" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="ECOLAV">
            <defs>
              <linearGradient id="ecoGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#2563eb" />
                <stop offset="100%" stop-color="#16a34a" />
              </linearGradient>
            </defs>
            <g>
              <ellipse cx="32" cy="72" rx="16" ry="6" fill="#0f172a22">
                <animate attributeName="rx" values="15;18;15" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.4;0.25" dur="2s" repeatCount="indefinite" />
              </ellipse>
              <g>
                <path d="M32 6 C24 20 16 30 16 40 C16 52 23 60 32 60 C41 60 48 52 48 40 C48 30 40 20 32 6 Z" fill="url(#ecoGradient)">
                  <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0" dur="2s" repeatCount="indefinite" />
                </path>
                <path d="M27 18 C24 24 24 30 27 32" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round">
                  <animate attributeName="stroke-opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                </path>
                <circle cx="32" cy="46" r="6" fill="#ffffff22">
                  <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0.35;0.2" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
            </g>
          </svg>
        </div>
      </div>
      <div class="meta">Setor: ${bed.sector?.name || ''}</div>
      <div class="meta" style="margin-bottom:6px;">Leito: ${bed.number}</div>
      <div class="qr">
        <img src="${qrUrl}" alt="QR" width="${qr}" height="${qr}"/>
      </div>
      <div class="meta">URL: ${url}</div>
      <div class="footer">Escaneie para abrir o pedido de enxoval.</div>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
    const w = window.open('', 'print');
    if (w) {
      w.document.write(labelHtml);
      w.document.close();
    }
  };

  const toggleSelectBed = (id: string) => {
    setSelectedBedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllVisible = () => {
    setSelectedBedIds(visibleBeds.map(b => b.id));
  };

  const clearSelection = () => setSelectedBedIds([]);

  const handlePrintBatch = () => {
    const bedsToPrint = visibleBeds.filter(b => selectedBedIds.length === 0 || selectedBedIds.includes(b.id));
    if (bedsToPrint.length === 0) return;

    const buildLabel = (bed: { number: string; token: string; sector?: { name?: string } }) => {
      const url = `${window.location.origin}/pedido?token=${bed.token}`;
      // Estimate QR pixels for thermal based on 203 dpi (~8 dots/mm)
      const dotsPerMm = 8;
      const qrPxThermal = Math.max(120, Math.round(Math.min(thermalWidthMm, thermalHeightMm) * dotsPerMm * 0.7));
      const qrPxA = batchMode === 'A6' ? 220 : 180;
      const qrPx = batchMode === 'THERMAL' ? qrPxThermal : qrPxA;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrPx}x${qrPx}&data=${encodeURIComponent(url)}`;

      return `
      <div class="card">
        <div class="header">
          <div>
            <div class="title">ECOLAV</div>
            <div class="subtitle">Etiqueta de Leito</div>
          </div>
          <div class="logo">
            <svg viewBox="0 0 64 80" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="ECOLAV">
              <defs>
                <linearGradient id="ecoGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#2563eb" />
                  <stop offset="100%" stop-color="#16a34a" />
                </linearGradient>
              </defs>
              <g>
                <ellipse cx="32" cy="72" rx="16" ry="6" fill="#0f172a22"></ellipse>
                <g>
                  <path d="M32 6 C24 20 16 30 16 40 C16 52 23 60 32 60 C41 60 48 52 48 40 C48 30 40 20 32 6 Z" fill="url(#ecoGradient)"></path>
                  <path d="M27 18 C24 24 24 30 27 32" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"></path>
                  <circle cx="32" cy="46" r="6" fill="#ffffff22"></circle>
                </g>
              </g>
            </svg>
          </div>
        </div>
        <div class="meta">Setor: ${bed.sector?.name || ''}</div>
        <div class="meta" style="margin-bottom:6px;">Leito: ${bed.number}</div>
        <div class="qr">
          <img src="${qrUrl}" alt="QR" width="${qrPx}" height="${qrPx}"/>
        </div>
        <div class="meta">URL: ${url}</div>
        <div class="footer">Escaneie para abrir o pedido de enxoval.</div>
      </div>`;
    };

    const pageCss = batchMode === 'THERMAL'
      ? `@page { size: ${thermalWidthMm}mm ${thermalHeightMm}mm; margin: ${thermalMarginMm}mm; } .page { page-break-after: always; } .card { width: 100%; } .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4mm;} .title{font-size:4mm;font-weight:700;color:#111827;} .subtitle{font-size:3mm;color:#6b7280;} .qr{display:flex;align-items:center;justify-content:center;margin:3mm 0;} .meta{font-size:3mm;color:#374151;} .logo{width:8mm;height:10mm;} .footer{margin-top:3mm;font-size:2.5mm;color:#6b7280;}`
      : `@page { size: ${batchMode} portrait; margin: 6mm; } .page { page-break-after: always; } .card { width: ${batchMode === 'A6' ? 480 : 320}px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; } .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;} .title{font-size:16px;font-weight:700;color:#111827;} .subtitle{font-size:12px;color:#6b7280;} .qr{display:flex;align-items:center;justify-content:center;margin:8px 0;} .meta{font-size:12px;color:#374151;} .logo{width:${batchMode==='A6'?40:32}px;height:${batchMode==='A6'?50:40}px;} .footer{margin-top:8px;font-size:10px;color:#6b7280;}`;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Etiquetas de Leitos</title>
    <style>
      ${pageCss}
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      .wrap { padding: 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${bedsToPrint.map(b => `<div class="page">${buildLabel(b)}</div>`).join('')}
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;

    const w = window.open('', 'print');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const handleEdit = (bed: { id: string; number: string; sectorId: string; status: 'occupied' | 'free' }) => {
    setEditingBed(bed.id);
    setFormData({ number: bed.number, sectorId: bed.sectorId, status: bed.status });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este leito?')) {
      deleteBed(id);
    }
  };

  const handleCopyToken = async (token: string) => {
    const url = `${window.location.origin}/pedido?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const generateQRUrl = (token: string) => {
    const url = `${window.location.origin}/pedido?token=${token}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Leitos</h2>
          <p className="text-gray-600">Gerencie os leitos e seus QR Codes</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center space-x-2 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Leito</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleBeds.map((bed) => (
          <div key={bed.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${bed.status === 'occupied' ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Bed className={`w-6 h-6 ${bed.status === 'occupied' ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Leito {bed.number}</h3>
                  <p className="text-sm text-gray-600">{bed.sector?.name}</p>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                    bed.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {bed.status === 'occupied' ? 'Ocupado' : 'Livre'}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <input
                  type="checkbox"
                  checked={selectedBedIds.includes(bed.id)}
                  onChange={() => toggleSelectBed(bed.id)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  title="Selecionar para impressão em lote"
                />
                <button
                  onClick={() => handleEdit({ id: bed.id, number: bed.number, sectorId: bed.sectorId, status: bed.status })}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(bed.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <img
                  src={generateQRUrl(bed.token)}
                  alt={`QR Code para leito ${bed.number}`}
                  className="w-24 h-24 border border-gray-200 rounded"
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleCopyToken(bed.token)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all text-sm"
                >
                  {copiedToken === bed.token ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Link</span>
                    </>
                  )}
                </button>
                <a
                  href={generateQRUrl(bed.token)}
                  download={`qr-leito-${bed.number}.png`}
                  className="flex items-center justify-center px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handlePrintLabel({ id: bed.id, number: bed.number, token: bed.token, sector: { name: bed.sector?.name } }, batchMode)}
                  className="flex items-center justify-center px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all"
                  title="Imprimir etiqueta"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <div className="flex items-center space-x-2">
                  {bed.status === 'free' ? (
                    <button
                      onClick={() => handleSetStatus(bed.id, 'occupied')}
                      className="px-3 py-1 text-xs rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800 transition-all"
                    >
                      Marcar Ocupado
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSetStatus(bed.id, 'free')}
                      className="px-3 py-1 text-xs rounded bg-green-100 hover:bg-green-200 text-green-800 transition-all"
                    >
                      Marcar Livre
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Batch print controls */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllVisible}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Selecionar Todos
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpar Seleção
            </button>
            <span className="text-sm text-gray-600">Selecionados: {selectedBedIds.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={batchMode}
              onChange={(e) => setBatchMode(e.target.value as 'A7' | 'A6' | 'THERMAL')}
              className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Formato"
            >
              <option value="THERMAL">Térmica (mm)</option>
              <option value="A7">A7</option>
              <option value="A6">A6</option>
            </select>
            {batchMode === 'THERMAL' && (
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600">Largura (mm)</label>
                <input
                  type="number"
                  min={20}
                  max={110}
                  value={thermalWidthMm}
                  onChange={(e) => setThermalWidthMm(parseInt(e.target.value) || 50)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded"
                />
                <label className="text-gray-600">Altura (mm)</label>
                <input
                  type="number"
                  min={20}
                  max={200}
                  value={thermalHeightMm}
                  onChange={(e) => setThermalHeightMm(parseInt(e.target.value) || 30)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded"
                />
                <label className="text-gray-600">Margem (mm)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={thermalMarginMm}
                  onChange={(e) => setThermalMarginMm(parseInt(e.target.value) || 3)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded"
                />
              </div>
            )}
            <button
              onClick={handlePrintBatch}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
            >
              Imprimir Selecionados
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingBed) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingBed ? 'Editar Leito' : 'Novo Leito'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Leito
                </label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Setor
                </label>
                <select
                  value={formData.sectorId}
                  onChange={(e) => setFormData({ ...formData, sectorId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um setor</option>
                  {visibleSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'occupied' | 'free' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="free">Livre</option>
                  <option value="occupied">Ocupado</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingBed(null);
                    setFormData({ number: '', sectorId: '', status: 'free' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all"
                >
                  {editingBed ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BedManagement;