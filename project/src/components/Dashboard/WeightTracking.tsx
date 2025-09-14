import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../config';
import { BarChart3, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

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

  const startEnd = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return { start: '', end: '' };
    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    return { start, end };
  }, [month]);

  const fetchData = async () => {
    if (!startEnd.start) return;
    const url = new URL(`${api}/pesagens/relatorio`);
    url.searchParams.set('start', startEnd.start);
    url.searchParams.set('end', startEnd.end);
    if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = await res.json();
      setData(j);
    }
  };

  useEffect(() => { fetchData(); }, [month, adminClientIdFilter, user?.role]);

  const openDay = async (date: string) => {
    setSelectedDay(date);
    const url = new URL(`${api}/pesagens/por-dia`);
    url.searchParams.set('date', date);
    if (user?.role === 'admin' && adminClientIdFilter) url.searchParams.set('clientId', adminClientIdFilter);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = await res.json();
      setDayEntries(j.entries || []);
    }
  };

  const deleteEntry = async (id: string) => {
    await fetch(`${api}/pesagens/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (selectedDay) openDay(selectedDay);
    // refresh monthly totals too
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Acompanhamento de Pesagem</h2>
          <p className="text-gray-600">Comparativo diário (suja vs limpa) e total do mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="grid grid-cols-5 gap-0 text-sm font-medium bg-gray-50 border-b">
          <div className="p-3">Data</div>
          <div className="p-3 text-blue-700">Suja (kg)</div>
          <div className="p-3 text-green-700">Limpa (kg)</div>
          <div className="p-3">Diferença (kg)</div>
          <div className="p-3">Sujidade (%)</div>
        </div>
        <div className="divide-y">
          {data.length === 0 && (<div className="p-6 text-center text-gray-500">Sem registros no período.</div>)}
          {data.map((r)=> (
            <div key={r.date} className="grid grid-cols-5 text-sm hover:bg-gray-50 cursor-pointer" onClick={()=>openDay(r.date)}>
              <div className="p-3 underline text-blue-700">{(() => { const [y,m,d]=r.date.split('-'); return `${d}/${m}/${y}`; })()}</div>
              <div className="p-3">{r.peso_suja}</div>
              <div className="p-3">{r.peso_limpa}</div>
              <div className="p-3">{r.diferenca}</div>
              <div className="p-3">{r.sujidade_percentual}%</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 bg-gray-50 text-sm font-semibold border-t">
          <div className="p-3">Totais do mês</div>
          <div className="p-3 text-blue-700">{totals.suja}</div>
          <div className="p-3 text-green-700">{totals.limpa}</div>
          <div className="p-3">{totals.diff}</div>
          <div className="p-3">{totals.perc}%</div>
        </div>
      </div>

      {selectedDay && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="font-semibold">Entradas do dia {(() => { const [y,m,d]=selectedDay.split('-'); return `${d}/${m}/${y}`; })()}</h3>
              <p className="text-xs text-gray-500">Clique no ícone para excluir uma pesagem.</p>
            </div>
            <button onClick={()=>{ setSelectedDay(''); setDayEntries([]); }} className="px-3 py-2 border rounded-lg text-sm">Fechar</button>
          </div>
          <div className="divide-y">
            {dayEntries.length === 0 && (<div className="p-6 text-center text-gray-500">Sem lançamentos</div>)}
            {dayEntries.map(e => (
              <div key={e.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">{e.kind === 'suja' ? 'Roupa Suja' : 'Roupa Limpa'} — Líquido {e.netWeight} kg</div>
                  <div className="text-gray-600">Total {e.totalWeight} kg · Tara {e.tareWeight} kg · {new Date(e.createdAt).toLocaleString('pt-BR')} {e.cage ? `· Gaiola ${e.cage.barcode}` : ''}</div>
                </div>
                <button onClick={()=>deleteEntry(e.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightTracking;
