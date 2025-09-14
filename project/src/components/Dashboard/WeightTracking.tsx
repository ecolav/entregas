import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../config';
import { Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { Skeleton, SkeletonCard } from '../Skeleton';

const WeightTracking: React.FC = () => {
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const { user } = useAuth();
  const { adminClientIdFilter } = useApp();
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [data, setData] = useState<Array<{ date: string; peso_suja: number; peso_limpa: number; diferenca: number; sujidade_percentual: number }>>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [dayEntries, setDayEntries] = useState<Array<{ id: string; controlId: string; kind: 'suja'|'limpa'; tareWeight: number; totalWeight: number; netWeight: number; createdAt: string; cage?: { id: string; barcode: string } | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);

  const startEnd = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return { start: '', end: '' };
    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    return { start, end };
  }, [month]);

  const fetchData = useCallback(async () => {
    if (!startEnd.start) return;
    setLoading(true);
    const url = new URL(`${api}/pesagens/relatorio`);
    url.searchParams.set('start', startEnd.start);
    url.searchParams.set('end', startEnd.end);
    if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = await res.json();
      setData(j);
    }
    setLoading(false);
  }, [api, startEnd.start, startEnd.end, adminClientIdFilter, token, user?.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDay = useCallback(async (date: string) => {
    setSelectedDay(date);
    setDayLoading(true);
    const url = new URL(`${api}/pesagens/por-dia`);
    url.searchParams.set('date', date);
    if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = await res.json();
      setDayEntries(j.entries || []);
    }
    setDayLoading(false);
  }, [api, adminClientIdFilter, token, user?.role]);

  const deleteEntry = async (id: string) => {
    await fetch(`${api}/pesagens/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (selectedDay) openDay(selectedDay);
    fetchData();
  };

  const totals = useMemo(() => {
    const suja = data.reduce((s, r) => s + r.peso_suja, 0);
    const limpa = data.reduce((s, r) => s + r.peso_limpa, 0);
    const diff = suja - limpa;
    const perc = suja > 0 ? Number(((diff / suja) * 100).toFixed(2)) : 0;
    return { suja: Number(suja.toFixed(2)), limpa: Number(limpa.toFixed(2)), diff: Number(diff.toFixed(2)), perc };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Acompanhamento de Pesagem</h2>
          <p className="text-gray-600 text-sm sm:text-base">Comparativo diário (suja vs limpa) e total do mês.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="px-2 sm:px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="grid grid-cols-5 gap-0 text-xs sm:text-sm font-medium bg-gray-50 border-b">
          <div className="p-3">Data</div>
          <div className="p-3 text-blue-700">Suja (kg)</div>
          <div className="p-3 text-green-700">Limpa (kg)</div>
          <div className="p-3">Diferença (kg)</div>
          <div className="p-3">Sujidade (%)</div>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="p-4 grid grid-cols-1 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Sem registros no período.</div>
          ) : (
            data.map((r)=> (
              <div key={r.date} className="grid grid-cols-5 text-xs sm:text-sm hover:bg-gray-50 cursor-pointer" onClick={()=>openDay(r.date)}>
                <div className="p-3 underline text-blue-700">{(() => { const [y,m,d]=r.date.split('-'); return `${d}/${m}/${y}`; })()}</div>
                <div className="p-3">{r.peso_suja}</div>
                <div className="p-3">{r.peso_limpa}</div>
                <div className="p-3">{r.diferenca}</div>
                <div className="p-3">{r.sujidade_percentual}%</div>
              </div>
            ))
          )}
        </div>
        <div className="grid grid-cols-5 bg-gray-50 text-xs sm:text-sm font-semibold border-t">
          <div className="p-3">Totais do mês</div>
          <div className="p-3 text-blue-700">{totals.suja}</div>
          <div className="p-3 text-green-700">{totals.limpa}</div>
          <div className="p-3">{totals.diff}</div>
          <div className="p-3">{totals.perc}%</div>
        </div>
      </div>

      {selectedDay && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b">
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Entradas do dia {(() => { const [y,m,d]=selectedDay.split('-'); return `${d}/${m}/${y}`; })()}</h3>
              <p className="text-[11px] sm:text-xs text-gray-500">Clique no ícone para excluir uma pesagem.</p>
            </div>
            <button onClick={()=>{ setSelectedDay(''); setDayEntries([]); }} className="px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm">Fechar</button>
          </div>
          <div className="divide-y">
            {dayLoading ? (
              <div className="p-3 sm:p-4">
                <SkeletonCard />
                <SkeletonCard className="mt-2" />
              </div>
            ) : dayEntries.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Sem lançamentos</div>
            ) : (
              dayEntries.map(e => (
                <div key={e.id} className="p-3 sm:p-4 flex items-center justify-between text-xs sm:text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{e.kind === 'suja' ? 'Roupa Suja' : 'Roupa Limpa'} — Líquido {e.netWeight} kg</div>
                    <div className="text-gray-600">Total {e.totalWeight} kg · Tara {e.tareWeight} kg · {new Date(e.createdAt).toLocaleString('pt-BR')} {e.cage ? `· Gaiola ${e.cage.barcode}` : ''}</div>
                  </div>
                  <button onClick={()=>deleteEntry(e.id)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightTracking;
