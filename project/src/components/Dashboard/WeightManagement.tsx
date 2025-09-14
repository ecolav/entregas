import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { Scale, Plus, Trash2, Edit } from 'lucide-react';
import { getApiBaseUrl } from '../../config';
import { Cage, WeighingControl, WeighingEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, SkeletonCard } from '../Skeleton';
// duplicate import removed
type ActiveTab = 'control' | 'cages';

const WeightManagement: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('control');

  // Data: Cages
  const [cages, setCages] = useState<Cage[]>([]);
  const [isCageModalOpen, setIsCageModalOpen] = useState(false);
  const [editingCage, setEditingCage] = useState<Cage | null>(null);
  const [cageForm, setCageForm] = useState({ barcode: '', tareWeight: '' });

  // Data: Control & Entries
  const [currentControl, setCurrentControl] = useState<WeighingControl | null>(null);
  const [controlGross, setControlGross] = useState('');
  const [controlKind, setControlKind] = useState<'suja'|'limpa'>('limpa');
  const [expectedDate, setExpectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0,10);
  });
  // date is automatic by backend
  const [entries, setEntries] = useState<WeighingEntry[]>([]);
  const [entryForm, setEntryForm] = useState<{ cageIdOrManual: 'cage' | 'manual'; cageId?: string; tare?: string; total: string }>({ cageIdOrManual: 'cage', cageId: undefined, tare: '', total: '' });
  const [loadingCages, setLoadingCages] = useState(false);
  const [loadingControl, setLoadingControl] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const { user } = useAuth();
  const { adminClientIdFilter } = useApp();
  const api = getApiBaseUrl();

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const fetchCages = React.useCallback(async () => {
    setLoadingCages(true);
    try {
      const res = await fetch(`${api}/gaiolas`, { headers: { Authorization: `Bearer ${token}` } as HeadersInit });
      if (res.ok) {
        const data = (await res.json()) as Array<{ id: string; barcode: string; tareWeight: string | number; createdAt: string }>;
        const mapped: Cage[] = data.map((c) => ({ id: c.id, barcode: c.barcode, tareWeight: Number(c.tareWeight), createdAt: c.createdAt }));
        setCages(mapped);
      }
    } catch (_err) { /* no-op */ }
    finally { setLoadingCages(false); }
  }, [api, token]);

  const openNewCage = () => { setEditingCage(null); setCageForm({ barcode: '', tareWeight: '' }); setIsCageModalOpen(true); };
  const submitCage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const payload = { codigo_barras: cageForm.barcode.trim(), peso_tara: Number(cageForm.tareWeight) };
      const url = editingCage ? `${api}/gaiolas/${editingCage.id}` : `${api}/gaiolas`;
      const method: 'PUT' | 'POST' = editingCage ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders as HeadersInit, body: JSON.stringify(payload) });
      if (res.status === 409) { addToast({ type: 'error', message: 'Código de barras já cadastrado.' }); return; }
      if (res.ok) {
        setIsCageModalOpen(false);
        await fetchCages();
        addToast({ type: 'success', message: editingCage ? 'Gaiola atualizada!' : 'Gaiola cadastrada!' });
      }
    } catch (_err) { /* no-op */ }
  };
  const deleteCage = async (id: string) => {
    if (!confirm('Excluir esta gaiola?')) return;
    await fetch(`${api}/gaiolas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await fetchCages();
  };

  const startControl = async () => {
    if (controlKind === 'limpa' && (!controlGross || Number(controlGross) <= 0)) {
      addToast({ type: 'error', message: 'Informe o peso bruto para roupa limpa.' });
      return;
    }
    const payload: any = { tipo: controlKind };
    if (controlKind === 'limpa') payload.peso_bruto_lavanderia = Number(controlGross);
    if (controlKind === 'suja' && expectedDate && /^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) payload.prevista = expectedDate;
    // Admin pode direcionar controle para cliente específico via filtro ativo
    if (user?.role === 'admin' && adminClientIdFilter) (payload as any).clientId = adminClientIdFilter;
    const res = await fetch(`${api}/controles`, { method: 'POST', headers: authHeaders as any, body: JSON.stringify(payload) });
    if (res.ok) {
      const c = (await res.json()) as {
        id: string; laundryGrossWeight: string | number; clientTotalNetWeight: string | number; differenceWeight: string | number; differencePercent: string | number; kind: 'suja'|'limpa'; referenceDate: string; createdAt: string;
      };
      const normalized: WeighingControl = {
        id: c.id,
        laundryGrossWeight: Number(c.laundryGrossWeight),
        clientTotalNetWeight: Number(c.clientTotalNetWeight),
        differenceWeight: Number(c.differenceWeight),
        differencePercent: Number(c.differencePercent),
        kind: c.kind,
        referenceDate: c.referenceDate,
        createdAt: c.createdAt,
      };
      setCurrentControl(normalized);
      setEntries([]);
      addToast({ type: 'success', message: 'Controle iniciado!' });
      // reset form fields
      setControlGross('');
    }
  };

  const refreshControl = async (id: string) => {
    setLoadingControl(true);
    try {
      const res = await fetch(`${api}/controles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = (await res.json()) as {
          id: string; laundryGrossWeight: string | number; clientTotalNetWeight: string | number; differenceWeight: string | number; differencePercent: string | number; createdAt: string; entries: Array<any>;
        };
        const normalized: WeighingControl = {
          id: data.id,
          laundryGrossWeight: Number(data.laundryGrossWeight),
          clientTotalNetWeight: Number(data.clientTotalNetWeight),
          differenceWeight: Number(data.differenceWeight),
          differencePercent: Number(data.differencePercent),
          createdAt: data.createdAt,
        };
        setCurrentControl(normalized);
        const mapped: WeighingEntry[] = (data.entries || []).map((e: Record<string, unknown>) => ({
          id: String(e.id),
          controlId: String(e.controlId),
          cageId: (e.cageId as string) || undefined,
          tareWeight: Number(e.tareWeight),
          totalWeight: Number(e.totalWeight),
          netWeight: Number(e.netWeight),
          createdAt: String(e.createdAt),
          cage: (e as any).cage ? { id: (e as any).cage.id as string, barcode: (e as any).cage.barcode as string, tareWeight: Number((e as any).cage.tareWeight), createdAt: (e as any).cage.createdAt as string } : undefined
        }));
        setEntries(mapped);
      }
    } finally { setLoadingControl(false); }
  };

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentControl) return;
    const body: any = { control_id: currentControl.id, peso_total: Number(entryForm.total) };
    if (entryForm.cageIdOrManual === 'cage') body.cage_id = entryForm.cageId;
    else body.peso_tara = Number(entryForm.tare || 0);
    setLoadingEntries(true);
    try {
      const res = await fetch(`${api}/pesagens`, { method: 'POST', headers: authHeaders as HeadersInit, body: JSON.stringify(body) });
      if (res.ok) {
        await refreshControl(currentControl.id);
        setEntryForm({ cageIdOrManual: 'cage', cageId: undefined, tare: '', total: '' });
        addToast({ type: 'success', message: 'Pesagem adicionada!' });
      }
    } finally { setLoadingEntries(false); }
  };

  useEffect(() => { fetchCages(); }, [fetchCages]);

  const pctStatus = (pct: number) => {
    if (pct <= 5) return { text: 'Dentro do padrão', cls: 'text-green-600 bg-green-100' };
    if (pct <= 10) return { text: 'Atenção', cls: 'text-yellow-600 bg-yellow-100' };
    return { text: 'Fora do padrão', cls: 'text-red-600 bg-red-100' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => setActiveTab('control')} className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm ${activeTab==='control'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>Controle</button>
        <button onClick={() => setActiveTab('cages')} className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm ${activeTab==='cages'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>Gaiolas</button>
      </div>

      {activeTab === 'cages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Cadastro de Gaiolas</h2>
              <p className="text-gray-600">Gerencie as gaiolas e suas taras.</p>
            </div>
            <button onClick={openNewCage} className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-3 py-2 rounded-lg flex items-center text-sm">
              <Plus className="w-4 h-4 mr-2"/> Nova Gaiola
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y">
              {loadingCages && (
                <div className="p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </div>
              )}
              {cages.length === 0 && !loadingCages && (
                <div className="p-6 text-center text-gray-500">Nenhuma gaiola cadastrada.</div>
              )}
              {cages.map(c => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{c.barcode}</div>
                    <div className="text-gray-600">Tara: {c.tareWeight} kg</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingCage(c); setCageForm({ barcode: c.barcode, tareWeight: String(c.tareWeight) }); setIsCageModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                    <button onClick={() => deleteCage(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isCageModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">{editingCage ? 'Editar Gaiola' : 'Nova Gaiola'}</h3>
                <form onSubmit={submitCage} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                    <input value={cageForm.barcode} onChange={(e)=>setCageForm(v=>({...v, barcode: e.target.value}))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso Tara (kg)</label>
                    <input type="number" step="0.01" min="0" value={cageForm.tareWeight} onChange={(e)=>setCageForm(v=>({...v, tareWeight: e.target.value}))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={()=>{ setIsCageModalOpen(false); setEditingCage(null); }} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
                    <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-white bg-gradient-to-r from-blue-600 to-green-600">Salvar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'control' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Controle de Pesagem</h2>
              <p className="text-gray-600 text-sm sm:text-base">Lance as pesagens e acompanhe as diferenças.</p>
            </div>
          </div>

          {!currentControl ? (
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4 items-end">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={controlKind} onChange={(e)=>setControlKind(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="limpa">Roupa Limpa</option>
                    <option value="suja">Roupa Suja</option>
                  </select>
                </div>
                {controlKind === 'limpa' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Peso bruto informado pela lavanderia (kg)</label>
                    <input type="number" step="0.01" min="0" value={controlGross} onChange={(e)=>setControlGross(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                )}
                {controlKind === 'suja' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Data prevista de entrega</label>
                    <input type="date" value={expectedDate} onChange={(e)=>setExpectedDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                )}
                <button onClick={startControl} className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg text-sm">Iniciar Controle</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
                {loadingControl ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  <>
                    <div className="bg-white rounded-xl p-4 border">
                      <p className="text-xs text-gray-600">Peso bruto lavanderia</p>
                      <p className="text-2xl font-bold">{currentControl.laundryGrossWeight} kg</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border">
                      <p className="text-xs text-gray-600">Somatório líquidos</p>
                      <p className="text-2xl font-bold">{currentControl.clientTotalNetWeight} kg</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border">
                      <p className="text-xs text-gray-600">Diferença</p>
                      <p className="text-2xl font-bold">{currentControl.differenceWeight} kg</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">Percentual</p>
                        <p className="text-2xl font-bold">{currentControl.differencePercent}%</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${pctStatus(currentControl.differencePercent).cls}`}>{pctStatus(currentControl.differencePercent).text}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl p-6 border space-y-4">
                <h3 className="font-semibold">Adicionar Pesagem</h3>
                <form onSubmit={submitEntry} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end opacity-100">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tara</label>
                    <div className="flex gap-2">
                      <select value={entryForm.cageIdOrManual} onChange={(e)=>setEntryForm(v=>({...v, cageIdOrManual: e.target.value as any}))} className="px-2 py-2 border rounded-lg">
                        <option value="cage">Gaiola</option>
                        <option value="manual">Manual</option>
                      </select>
                      {entryForm.cageIdOrManual === 'cage' ? (
                        <select value={entryForm.cageId || ''} onChange={(e)=>setEntryForm(v=>({...v, cageId: e.target.value || undefined}))} className="flex-1 px-2 py-2 border rounded-lg">
                          <option value="">Selecione a gaiola</option>
                          {cages.map(c => (
                            <option key={c.id} value={c.id}>{c.barcode} — {c.tareWeight} kg</option>
                          ))}
                        </select>
                      ) : (
                        <input type="number" step="0.01" min="0" placeholder="Tara (kg)" value={entryForm.tare} onChange={(e)=>setEntryForm(v=>({...v, tare: e.target.value}))} className="flex-1 px-3 py-2 border rounded-lg" />
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso Total (kg)</label>
                    <input type="number" step="0.01" min="0" value={entryForm.total} onChange={(e)=>setEntryForm(v=>({...v, total: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" required />
                  </div>
                  <button type="submit" disabled={loadingEntries} className={`px-4 py-2 rounded-lg text-white ${loadingEntries ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {loadingEntries ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="divide-y">
                  {loadingEntries && (
                    <div className="p-3 sm:p-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6 mt-2" />
                    </div>
                  )}
                  {entries.length === 0 && !loadingEntries && (
                    <div className="p-6 text-center text-gray-500">Nenhuma pesagem lançada.</div>
                  )}
                  {entries.map(e => (
                    <div key={e.id} className="p-4 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <Scale className="w-4 h-4 text-gray-400"/>
                        <div>
                          <div className="text-gray-900 font-medium">{e.cage ? `Gaiola ${e.cage.barcode}` : 'Tara manual'} — Líquido {e.netWeight} kg</div>
                          <div className="text-gray-600">Total {e.totalWeight} kg · Tara {e.tareWeight} kg · {new Date(e.createdAt).toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={()=>setCurrentControl(null)} className="px-4 py-2 border rounded-lg">Cancelar</button>
                <button onClick={async ()=>{
                  if (!currentControl) return;
                  setLoadingControl(true);
                  await fetch(`${api}/controles/${currentControl.id}/finalizar`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
                  addToast({ type: 'success', message: 'Pesagem finalizada! Vá em Acompanhamento para visualizar o comparativo.' });
                  // limpar formulários
                  setEntryForm({ cageIdOrManual: 'cage', cageId: undefined, tare: '', total: '' });
                  setControlGross('');
                  setControlKind('limpa');
                  setCurrentControl(null);
                  setLoadingControl(false);
                }} disabled={loadingControl} className={`px-4 py-2 rounded-lg text-white ${loadingControl ? 'bg-green-500/70 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-green-600'}`}>${''}Finalizar Pesagem</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WeightManagement;
