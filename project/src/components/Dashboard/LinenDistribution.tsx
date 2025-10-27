import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DistributedItem, Sector, Bed } from '../../types';
import { getApiBaseUrl } from '../../config';
import { AlertTriangle, ChevronDown, ChevronRight, FileDown, Eraser, CheckCircle2 } from 'lucide-react';
import { SkeletonCard } from '../Skeleton';
import { formatDateTimeISOToBR } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import ClientFilterAlert from '../ClientFilterAlert';

type SectorWithBeds = Sector & { beds: Bed[] };

const LinenDistribution: React.FC = () => {
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const { user } = useAuth();
  const { sectors, beds, linenItems, stockMovements, adminClientIdFilter } = useApp();
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [items, setItems] = useState<DistributedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCollected, setShowCollected] = useState(false);
  const [onlySectorVirtual, setOnlySectorVirtual] = useState(false);

  const sectorsForClient: SectorWithBeds[] = useMemo(() => {
    const sectorList = sectors.filter(s => !sectorFilter || s.id === sectorFilter);
    return sectorList.map(s => ({ ...s, beds: beds.filter(b => b.sectorId === s.id) }));
  }, [sectors, beds, sectorFilter]);

  const fetchDistributed = React.useCallback(async () => {
    setLoading(true);
    const url = new URL(`${api}/distributed-items`);
    if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
    if (sectorFilter) url.searchParams.set('sectorId', sectorFilter);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = (await res.json()) as DistributedItem[];
      setItems(data);
    }
    setLoading(false);
  }, [api, adminClientIdFilter, sectorFilter, token, user?.role]);

  useEffect(() => { fetchDistributed(); }, [fetchDistributed]);

  const byBed = useMemo(() => {
    const map = new Map<string, DistributedItem[]>();
    for (const it of items) {
      const key = it.bedId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  const elapsedHours = (iso: string) => {
    const start = new Date(iso).getTime();
    const now = Date.now();
    return Math.floor((now - start) / (1000 * 60 * 60));
  };

  const exportCsv = () => {
    const rows = [['Setor', 'Leito', 'Peça', 'SKU', 'Alocado em', 'Horas no leito', 'Status']];
    for (const sector of sectorsForClient) {
      for (const bed of sector.beds) {
        const list = byBed.get(bed.id) || [];
        for (const it of list) {
          const item = linenItems.find(li => li.id === it.linenItemId);
          rows.push([
            sector.name,
            bed.number,
            item?.name || it.linenItemId,
            item?.sku || '',
            formatDateTimeISOToBR(it.allocatedAt),
            String(elapsedHours(it.allocatedAt)),
            it.status
          ]);
        }
      }
    }
    const csv = rows.map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'distribuicao_enxoval.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const findDistributorName = (di: DistributedItem): string | null => {
    try {
      const allocatedTime = new Date(di.allocatedAt).getTime();
      const windowMs = 5 * 60 * 1000; // 5 minutes
      const candidates = stockMovements.filter(sm => {
        if (sm.itemId !== di.linenItemId) return false;
        if (sm.type !== 'out') return false as unknown as boolean; // type exists as string in model
        const t = new Date(sm.createdAt).getTime();
        return Math.abs(t - allocatedTime) <= windowMs && typeof sm.reason === 'string' && sm.reason.includes('Distribuição manual');
      });
      if (candidates.length === 0) return null;
      // pick closest by time
      candidates.sort((a,b) => Math.abs(new Date(a.createdAt).getTime() - allocatedTime) - Math.abs(new Date(b.createdAt).getTime() - allocatedTime));
      const reason = candidates[0].reason;
      const m = reason.match(/por\s+([^(]+)\s*\(/i);
      if (m && m[1]) return m[1].trim();
      return null;
    } catch {
      return null;
    }
  };

  const updateDistributedStatus = async (id: string, status: DistributedItem['status']) => {
    try {
      const res = await fetch(`${api}/distributed-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        addToast({ type: 'error', message: 'Falha ao atualizar item' });
        return;
      }
      addToast({ type: 'success', message: status === 'collected' ? 'Item coletado' : 'Item marcado para coleta' });
      await fetchDistributed();
    } catch {
      addToast({ type: 'error', message: 'Erro de rede' });
    }
  };

  const collectAllFromBed = async (bedId: string) => {
    const perBed = (byBed.get(bedId) || []).filter(it => it.status !== 'collected');
    if (perBed.length === 0) return;
    try {
      await Promise.all(perBed.map(it => fetch(`${api}/distributed-items/${it.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'collected' })
      })));
      addToast({ type: 'success', message: 'Leito limpo (itens coletados)' });
      await fetchDistributed();
    } catch {
      addToast({ type: 'error', message: 'Erro ao limpar leito' });
    }
  };

  return (
    <div className="space-y-6">
      <ClientFilterAlert />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Enxoval</h2>
          <p className="text-gray-600 text-sm sm:text-base">Visualize a alocação de peças por setor e leito</p>
        </div>
        <button onClick={exportCsv} className="px-2 sm:px-3 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg flex items-center text-xs sm:text-sm self-start sm:self-auto">
          <FileDown className="w-4 h-4 mr-2"/>
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">Exportar</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="w-full sm:w-64">
          <label className="block text-xs sm:text-sm text-gray-700 mb-1">Filtrar por Setor</label>
          <select value={sectorFilter} onChange={(e)=>setSectorFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">Todos</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs sm:text-sm text-gray-700">
            <input type="checkbox" className="mr-2" checked={showCollected} onChange={(e)=>setShowCollected(e.target.checked)} />
            Mostrar coletados
          </label>
          <label className="text-xs sm:text-sm text-gray-700">
            <input type="checkbox" className="mr-2" checked={onlySectorVirtual} onChange={(e)=>setOnlySectorVirtual(e.target.checked)} />
            Somente Por setor
          </label>
          <button onClick={()=>{ setSectorFilter(''); setShowCollected(false); }} className="px-3 py-2 border rounded-lg text-sm">Limpar filtro</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border divide-y">
        {loading && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
        {sectorsForClient.map(sector => {
          const bedsForDisplay = onlySectorVirtual ? sector.beds.filter(b => b.number === 'Sem leito (Setor)') : sector.beds;
          const totalPieces = bedsForDisplay.reduce((acc, bed) => acc + (byBed.get(bed.id)?.length || 0), 0);
          const activeBeds = sector.beds.length;
          const isOpen = !!expanded[sector.id];
          return (
            <div key={sector.id}>
              <button onClick={()=>setExpanded(prev => ({ ...prev, [sector.id]: !isOpen }))} className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm sm:text-base">{sector.name}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Peças alocadas: {totalPieces} · Leitos: {activeBeds}</div>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5"/> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5"/>}
              </button>
              {isOpen && (
                <div className="px-3 sm:px-4 py-3 bg-gray-50">
                  <div className="space-y-3">
                    {bedsForDisplay.map(bed => {
                      const listRaw = byBed.get(bed.id) || [];
                      const list = showCollected ? listRaw : listRaw.filter(x => x.status !== 'collected');
                      const isVirtual = bed.number === 'Sem leito (Setor)';
                      return (
                        <div key={bed.id} className="bg-white rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900 text-sm sm:text-base">
                              Leito {bed.number}
                              {isVirtual && (
                                <span className="ml-2 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">Por setor</span>
                              )}
                            </div>
                            {listRaw.some(x => x.status !== 'collected') && (
                              <button onClick={()=>collectAllFromBed(bed.id)} className="text-xs sm:text-sm px-2 py-1 border rounded-lg flex items-center gap-1 hover:bg-gray-50">
                                <Eraser className="w-4 h-4" /> Limpar leito
                              </button>
                            )}
                          </div>
                          {list.length === 0 ? (
                            <div className="text-xs sm:text-sm text-gray-500">Sem peças alocadas</div>
                          ) : (
                            <div className="divide-y">
                              {list.map(di => {
                                const item = linenItems.find(li => li.id === di.linenItemId);
                                const hrs = elapsedHours(di.allocatedAt);
                                const alert = hrs >= 24;
                                const distributorFromApi = (di as DistributedItem & { distributedByName?: string }).distributedByName;
                                const distributor = distributorFromApi || findDistributorName(di);
                                return (
                                  <div key={di.id} className="py-2 flex items-center justify-between">
                                    <div>
                                      <div className="text-xs sm:text-sm font-medium text-gray-900">{item?.name || di.linenItemId} {alert && <span className="inline-flex items-center text-red-600 ml-2"><AlertTriangle className="w-4 h-4 mr-1"/> {'>'}24h</span>}</div>
                                      <div className="text-[11px] sm:text-xs text-gray-600">SKU {item?.sku || ''} · Alocado em {formatDateTimeISOToBR(di.allocatedAt)} · {hrs}h no leito{distributor ? ` · Distribuído por ${distributor}` : ''}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] sm:text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                        {di.status === 'allocated' ? 'Alocado' : (di.status === 'pendingCollection' ? 'Para coleta' : 'Coletado')}
                                      </span>
                                      {distributor && (
                                        <span className="text-[11px] sm:text-xs px-2 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">por {distributor}</span>
                                      )}
                                      {di.status !== 'collected' && (
                                        <>
                                          <button onClick={()=>updateDistributedStatus(di.id, 'pendingCollection')} className="text-[11px] sm:text-xs px-2 py-1 border rounded-lg hover:bg-gray-50">Marcar coleta</button>
                                          <button onClick={()=>updateDistributedStatus(di.id, 'collected')} className="text-[11px] sm:text-xs px-2 py-1 rounded-lg text-white bg-green-600 hover:bg-green-700 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3"/> Coletado
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinenDistribution;


