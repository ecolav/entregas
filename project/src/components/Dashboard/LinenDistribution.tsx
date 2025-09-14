import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DistributedItem, Sector, Bed, LinenItem } from '../../types';
import { getApiBaseUrl } from '../../config';
import { AlertTriangle, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import { Skeleton, SkeletonCard } from '../Skeleton';
import { formatDateTimeISOToBR } from '../../utils/date';

type SectorWithBeds = Sector & { beds: Bed[] };

const LinenDistribution: React.FC = () => {
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const { user } = useAuth();
  const { sectors, beds, linenItems, adminClientIdFilter } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [items, setItems] = useState<DistributedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const sectorsForClient: SectorWithBeds[] = useMemo(() => {
    const sectorList = sectors.filter(s => !sectorFilter || s.id === sectorFilter);
    return sectorList.map(s => ({ ...s, beds: beds.filter(b => b.sectorId === s.id) }));
  }, [sectors, beds, sectorFilter]);

  const fetchDistributed = async () => {
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
  };

  useEffect(() => { fetchDistributed(); }, [adminClientIdFilter, sectorFilter, user?.role]);

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

  return (
    <div className="space-y-6">
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
      </div>

      <div className="bg-white rounded-xl border divide-y">
        {loading && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
        {sectorsForClient.map(sector => {
          const totalPieces = sector.beds.reduce((acc, bed) => acc + (byBed.get(bed.id)?.length || 0), 0);
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
                    {sector.beds.map(bed => {
                      const list = byBed.get(bed.id) || [];
                      return (
                        <div key={bed.id} className="bg-white rounded-lg border p-3">
                          <div className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Leito {bed.number}</div>
                          {list.length === 0 ? (
                            <div className="text-xs sm:text-sm text-gray-500">Sem peças alocadas</div>
                          ) : (
                            <div className="divide-y">
                              {list.map(di => {
                                const item = linenItems.find(li => li.id === di.linenItemId);
                                const hrs = elapsedHours(di.allocatedAt);
                                const alert = hrs >= 24;
                                return (
                                  <div key={di.id} className="py-2 flex items-center justify-between">
                                    <div>
                                      <div className="text-xs sm:text-sm font-medium text-gray-900">{item?.name || di.linenItemId} {alert && <span className="inline-flex items-center text-red-600 ml-2"><AlertTriangle className="w-4 h-4 mr-1"/> {'>'}24h</span>}</div>
                                      <div className="text-[11px] sm:text-xs text-gray-600">SKU {item?.sku || ''} · Alocado em {formatDateTimeISOToBR(di.allocatedAt)} · {hrs}h no leito</div>
                                    </div>
                                    <div className="text-[11px] sm:text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{di.status}</div>
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


