import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getApiBaseUrl } from '../config';
import { useToast } from '../contexts/ToastContext';
import ClientFilterAlert from './ClientFilterAlert';

type Tab = 'manual' | 'rfid';

const Distribution: React.FC = () => {
  const { user } = useAuth();
  const { sectors, beds, linenItems, getOrCreateVirtualSectorBed } = useApp();
  const { addToast } = useToast();
  const api = getApiBaseUrl();
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';

  const [tab, setTab] = useState<Tab>('manual');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [distributeWithoutBed, setDistributeWithoutBed] = useState(false);

  const sectorsForClient = useMemo(() => {
    return sectors;
  }, [sectors]);

  const bedsForSector = useMemo(() => beds.filter(b => !selectedSectorId || b.sectorId === selectedSectorId), [beds, selectedSectorId]);

  const itemsForClient = useMemo(() => linenItems, [linenItems]);

  const availableItems = useMemo(() => {
    return [...itemsForClient].filter(i => (i.currentStock ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
  }, [itemsForClient]);

  const distributorLabel = useMemo(() => {
    const name = user?.name || '—';
    const email = user?.email || '—';
    const when = new Date().toLocaleString('pt-BR');
    return `${name} (${email}) · ${when}`;
  }, [user?.name, user?.email]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api || !token) {
      addToast({ type: 'error', message: 'Sessão expirada. Faça login novamente.' });
      return;
    }
    if (!selectedBedId && !distributeWithoutBed) { addToast({ type: 'error', message: 'Selecione o leito ou ative “Distribuir sem leito”.' }); return; }
    if (!selectedItemId) { addToast({ type: 'error', message: 'Selecione o item.' }); return; }
    if (quantity <= 0) { addToast({ type: 'error', message: 'Quantidade inválida.' }); return; }

    const item = itemsForClient.find(i => i.id === selectedItemId);
    if (!item) { addToast({ type: 'error', message: 'Item inválido.' }); return; }
    if (item.currentStock < quantity) { addToast({ type: 'error', message: 'Estoque insuficiente.' }); return; }

    setIsSubmitting(true);
    try {
      // Garantir bedId quando for por setor criando/obtendo leito virtual do setor
      let targetBedId = selectedBedId;
      if (distributeWithoutBed) {
        const vb = await getOrCreateVirtualSectorBed(selectedSectorId);
        if (!vb) throw new Error('Falha ao criar leito virtual do setor');
        targetBedId = vb.id;
      }

      // Registrar movimento de estoque PRIMEIRO (isso abate o estoque)
      const sectorName = sectorsForClient.find(s => s.id === selectedSectorId)?.name || 'Setor';
      const bedName = distributeWithoutBed ? 'Sem leito (Setor)' : (beds.find(b => b.id === selectedBedId)?.number || 'Leito');
      const reason = distributeWithoutBed
        ? `Distribuição manual por setor (${sectorName}) por ${user?.name} (${user?.email})`
        : `Distribuição manual para ${sectorName} - Leito ${bedName} por ${user?.name} (${user?.email})`;
      
      // Fazer request direto para garantir que seja síncrono e só uma vez
      const stockRes = await fetch(`${api}/stock-movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId: selectedItemId, type: 'out', quantity, reason })
      });
      if (!stockRes.ok) throw new Error('Falha ao registrar movimento de estoque');

      // DEPOIS criar registros de distribuição (um por peça)
      for (let i = 0; i < quantity; i++) {
        const res = await fetch(`${api}/distributed-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ linenItemId: selectedItemId, bedId: targetBedId, status: 'allocated' })
        });
        if (!res.ok) throw new Error('Falha ao criar distribuição');
      }

      addToast({ type: 'success', message: 'Distribuição realizada com sucesso.' });
      setQuantity(1);
    } catch {
      addToast({ type: 'error', message: 'Falha ao distribuir. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = selectedSectorId && (distributeWithoutBed || selectedBedId) && selectedItemId && quantity > 0;

  const clearForm = () => {
    setSelectedSectorId('');
    setSelectedBedId('');
    setSelectedItemId('');
    setQuantity(1);
  };

  return (
    <div className="space-y-6">
      <ClientFilterAlert showOnAction />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900">Distribuição</h2>
          <p className="text-gray-600">Distribuidor: {distributorLabel}</p>
        </div>
        <div className="inline-flex rounded-full border bg-white overflow-hidden shadow-sm">
          <button
            onClick={()=>setTab('manual')}
            className={`px-4 py-2 text-sm transition ${tab==='manual'?'bg-brand-600 text-white':'text-gray-700 hover:bg-gray-50'}`}
          >Manual</button>
          <button
            onClick={()=>setTab('rfid')}
            className={`px-4 py-2 text-sm transition ${tab==='rfid'?'bg-gray-900 text-white':'text-gray-700 hover:bg-gray-50'}`}
          >RFID</button>
        </div>
      </div>

      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="max-w-3xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-100 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">Dados da distribuição</h3>
            <p className="text-sm text-gray-600">Selecione o Setor, Leito e Item para distribuir.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
              <select value={selectedSectorId} onChange={(e)=>{ setSelectedSectorId(e.target.value); setSelectedBedId(''); }} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600" required>
                <option value="">Selecione</option>
                {sectorsForClient.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Escolha o setor para filtrar os leitos.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leito</label>
              <select value={selectedBedId} onChange={(e)=>setSelectedBedId(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600 disabled:bg-gray-50 disabled:text-gray-500" disabled={!selectedSectorId || distributeWithoutBed} required={!distributeWithoutBed}>
                <option value="">Selecione</option>
                {bedsForSector.map(b => (
                  <option key={b.id} value={b.id}>Leito {b.number}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">{distributeWithoutBed ? 'Distribuição por setor não exige leito.' : 'Somente os leitos do setor selecionado.'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
              <select value={selectedItemId} onChange={(e)=>setSelectedItemId(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600" required>
                <option value="">Selecione</option>
                {availableItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name} · SKU {i.sku} · Estoque {i.currentStock}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Aparecem apenas itens com estoque disponível.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-600" checked={distributeWithoutBed} onChange={(e)=>{ setDistributeWithoutBed(e.target.checked); if (e.target.checked) setSelectedBedId(''); }} />
              Distribuir sem leito (por setor)
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <div className="flex rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-brand-600/50">
                <button type="button" className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-r" onClick={()=>setQuantity(q=>Math.max(1, q-1))}>−</button>
                <input type="number" min={1} value={quantity} onChange={(e)=>setQuantity(Math.max(1, parseInt(e.target.value||'1', 10)))} className="w-full px-3 py-2 focus:outline-none" />
                <button type="button" className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-l" onClick={()=>setQuantity(q=>q+1)}>+</button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Será criado um registro por peça distribuída.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || !isValid} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm">{isSubmitting ? 'Distribuindo...' : 'Distribuir'}</button>
            <button type="button" onClick={clearForm} disabled={isSubmitting} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">Limpar</button>
          </div>
        </form>
      )}

      {tab === 'rfid' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-gray-900">Distribuição via RFID</h3>
            <p className="text-gray-600">Em desenvolvimento. Será exibida uma página dedicada quando este fluxo estiver disponível.</p>
          </div>
          <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-700">Planejado para este fluxo:</p>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Leitura automática da tag RFID do item.</li>
              <li>Identificação do leito por QR/RFID do cabeceiro.</li>
              <li>Registro em lote com validação de estoque e logs.</li>
            </ul>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>setTab('manual')} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black">Voltar ao Manual</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Distribution;


