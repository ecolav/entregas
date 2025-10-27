import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../config';
import { Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { Skeleton, SkeletonCard } from '../Skeleton';
import ClientFilterAlert from '../ClientFilterAlert';
// icons removed from buttons to garantir visibilidade do texto em todas as telas
import { buildWhatsAppUrl } from '../../utils/whatsapp';

const WeightTracking: React.FC = () => {
  const api = getApiBaseUrl();
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const { user } = useAuth();
  const { adminClientIdFilter, clients } = useApp();
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [data, setData] = useState<Array<{ 
    date: string; 
    peso_suja: number; 
    peso_limpa: number; 
    diferenca: number; 
    sujidade_percentual: number;
    peso_bruto_lavanderia: number;
    peso_pesado_liquido: number;
    diferenca_lavanderia: number;
    percentual_diferenca_lavanderia: number;
    peso_suja_pesada_hoje: number;
  }>>([]);
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
    // Comparativo lavanderia
    const bruto = data.reduce((s, r) => s + (r.peso_bruto_lavanderia || 0), 0);
    const pesado = data.reduce((s, r) => s + (r.peso_pesado_liquido || 0), 0);
    const diffLav = bruto - pesado;
    const percLav = bruto > 0 ? Number(((Math.abs(diffLav) / bruto) * 100).toFixed(2)) : 0;
    return { 
      suja: Number(suja.toFixed(2)), 
      limpa: Number(limpa.toFixed(2)), 
      diff: Number(diff.toFixed(2)), 
      perc,
      bruto: Number(bruto.toFixed(2)),
      pesado: Number(pesado.toFixed(2)),
      diffLav: Number(diffLav.toFixed(2)),
      percLav
    };
  }, [data]);

  // Resumo diário do modal: usa dados da tabela agregada (que já seguem a lógica correta)
  // Roupa suja usa expectedDeliveryDate, roupa limpa usa referenceDate
  const daySummary = useMemo(() => {
    if (!selectedDay) {
      return { suja: 0, limpa: 0, diff: 0, perc: 0, sujaPesadaHoje: 0 };
    }
    // Busca o dia selecionado nos dados agregados
    const dayData = data.find(d => d.date === selectedDay);
    if (!dayData) {
      return { suja: 0, limpa: 0, diff: 0, perc: 0, sujaPesadaHoje: 0 };
    }
    return {
      suja: dayData.peso_suja,
      limpa: dayData.peso_limpa,
      diff: dayData.diferenca,
      perc: dayData.sujidade_percentual,
      sujaPesadaHoje: dayData.peso_suja_pesada_hoje,
    };
  }, [selectedDay, data]);

  // Nome do cliente para relatórios (usa filtro do admin ou clientId do usuário)
  const selectedClientName = useMemo(() => {
    const clientId = (user?.role === 'admin') ? (adminClientIdFilter || null) : (user?.clientId || null);
    if (!clientId) return null;
    const found = clients.find(c => c.id === clientId);
    return found?.name || null;
  }, [user?.role, user?.clientId, adminClientIdFilter, clients]);

  // Exportar PDF do dia selecionado
  const exportDayPdf = useCallback(() => {
    if (!selectedDay) return;
    const [y, m, d] = selectedDay.split('-');
    const title = `Relatório Diário de Pesagem — ${d}/${m}/${y}`;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color:#111827; margin:24px; }
      h1 { font-size:20px; margin:0 0 8px; }
      .muted { color:#6b7280; margin-bottom:16px; }
      .card { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin:12px 0; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #f3f4f6; font-size:12px; }
      .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; }
      .brand { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
      .brand img { height:40px; }
    </style>
  </head>
  <body>
    <div class="brand">
      <img src="${window.location.origin}/ecolav.png" alt="ECOLAV" />
      <h1>${title} • ECOLAV</h1>
    </div>
    <div class="muted">Cliente: ${selectedClientName || '—'} • Data: ${d}/${m}/${y}</div>
    <div class="card">
      <div style="font-weight:600; margin-bottom:8px;">Resumo (Comparativo Suja vs Limpa)</div>
      <div style="padding:8px; background:#eff6ff; border-radius:4px; margin-bottom:8px; font-size:11px;">
        <strong>Nota:</strong> Compara roupa suja que saiu (voltará limpa neste dia) com roupa limpa que voltou (pesada neste dia).
      </div>
      <div class="grid">
        <div style="background:#dcfce7; padding:4px; border-radius:4px;">Limpa que Voltou (kg): <b>${daySummary.limpa.toFixed(2)}</b></div>
        <div>Suja que Saiu (kg): <b>${daySummary.suja.toFixed(2)}</b></div>
        <div style="background:#fee2e2; padding:4px; border-radius:4px;">Suja Pesada Hoje (kg): <b>${daySummary.sujaPesadaHoje.toFixed(2)}</b></div>
        <div>Diferença (kg): <b>${daySummary.diff.toFixed(2)}</b></div>
        <div>Sujidade (%): <b>${daySummary.perc.toFixed(2)}%</b></div>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:600; margin-bottom:8px;">Movimentações</div>
      <table>
        <thead><tr><th>Tipo</th><th>Líquido (kg)</th><th>Total (kg)</th><th>Tara (kg)</th><th>Data/Hora</th><th>Gaiola</th></tr></thead>
        <tbody>
          ${dayEntries.map(e => `<tr>
            <td>${e.kind === 'suja' ? 'Suja' : 'Limpa'}</td>
            <td>${Number(e.netWeight).toFixed(2)}</td>
            <td>${Number(e.totalWeight).toFixed(2)}</td>
            <td>${Number(e.tareWeight).toFixed(2)}</td>
            <td>${new Date(e.createdAt).toLocaleString('pt-BR')}</td>
            <td>${e.cage?.barcode || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
    const w = window.open('', 'print');
    if (w) { w.document.write(html); w.document.close(); }
  }, [selectedDay, dayEntries, daySummary.diff, daySummary.limpa, daySummary.perc, daySummary.suja, user?.role, adminClientIdFilter]);

  // Compartilhar WhatsApp do dia selecionado
  const exportDayWhatsApp = useCallback(() => {
    if (!selectedDay) return;
    const [y, m, d] = selectedDay.split('-');
    const lines: string[] = [];
    lines.push('🧾 *Relatório Diário de Pesagem*');
    lines.push(`Data: *${d}/${m}/${y}*`);
    if (selectedClientName) lines.push(`Cliente: *${selectedClientName}*`);
    lines.push('');
    lines.push('_Comparativo: Suja que Saiu vs Limpa que Voltou_');
    lines.push(`🧽 Limpa que Voltou (kg): *${daySummary.limpa.toFixed(2)}*`);
    lines.push(`🧼 Suja que Saiu (kg): *${daySummary.suja.toFixed(2)}*`);
    lines.push(`🔴 Suja Pesada Hoje (kg): *${daySummary.sujaPesadaHoje.toFixed(2)}*`);
    lines.push(`⚖️ Diferença (kg): *${daySummary.diff.toFixed(2)}*`);
    lines.push(`% Sujidade: *${daySummary.perc.toFixed(2)}%*`);
    lines.push('');
    if (dayEntries.length) {
      lines.push('*Movimentações:*');
      lines.push(...dayEntries.slice(0, 20).map(e => `- ${e.kind === 'suja' ? 'Suja' : 'Limpa'} • Líq ${Number(e.netWeight).toFixed(2)} kg • Tot ${Number(e.totalWeight).toFixed(2)} kg • Tara ${Number(e.tareWeight).toFixed(2)} kg • ${new Date(e.createdAt).toLocaleString('pt-BR')}${e.cage?.barcode ? ` • Gaiola ${e.cage.barcode}` : ''}`));
      if (dayEntries.length > 20) lines.push(`… e mais ${dayEntries.length - 20} registros`);
    }
    const url = buildWhatsAppUrl({ text: lines.join('\n') });
    window.open(url, '_blank');
  }, [selectedDay, dayEntries, daySummary.diff, daySummary.limpa, daySummary.perc, daySummary.suja, selectedClientName]);

  return (
    <div className="space-y-6">
      <ClientFilterAlert showOnAction />
      
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

      {/* Tabela 1: Sujidade (Suja vs Limpa) */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-50 to-green-50 border-b">
          <h3 className="font-semibold text-xs sm:text-sm">📊 Comparativo Suja vs Limpa (Sujidade)</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-6 gap-0 text-[11px] sm:text-sm font-medium bg-gray-50 border-b">
              <div className="p-2 sm:p-3">Data</div>
              <div className="p-2 sm:p-3">Suja (kg)</div>
              <div className="p-2 sm:p-3 text-green-600">Limpa (kg)</div>
              <div className="p-2 sm:p-3 text-red-600">Suja Pesada Hoje (kg)</div>
              <div className="p-2 sm:p-3">Diferença (kg)</div>
              <div className="p-2 sm:p-3">Sujidade (%)</div>
            </div>
            <div className="divide-y">
              {loading ? (
                <div className="p-3 sm:p-4 grid grid-cols-1 gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : data.length === 0 ? (
                <div className="p-4 sm:p-6 text-center text-gray-500 text-sm">Sem registros no período.</div>
              ) : (
                data.map((r)=> (
                  <div key={r.date} className="grid grid-cols-6 text-[11px] sm:text-sm hover:bg-gray-50 cursor-pointer" onClick={()=>openDay(r.date)}>
                    <div className="p-2 sm:p-3 underline text-blue-700">{(() => { const [y,m,d]=r.date.split('-'); return `${d}/${m}/${y}`; })()}</div>
                    <div className="p-2 sm:p-3">{r.peso_suja}</div>
                    <div className="p-2 sm:p-3 text-green-600 font-medium">{r.peso_limpa}</div>
                    <div className="p-2 sm:p-3 text-red-600 font-medium">{r.peso_suja_pesada_hoje}</div>
                    <div className="p-2 sm:p-3">{r.diferenca}</div>
                    <div className="p-2 sm:p-3">{r.sujidade_percentual}%</div>
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-6 bg-gray-50 text-[11px] sm:text-sm font-semibold border-t">
              <div className="p-2 sm:p-3">Totais do mês</div>
              <div className="p-2 sm:p-3">{totals.suja}</div>
              <div className="p-2 sm:p-3 text-green-600">{totals.limpa}</div>
              <div className="p-2 sm:p-3 text-red-600">{data.reduce((sum, r) => sum + r.peso_suja_pesada_hoje, 0).toFixed(2)}</div>
              <div className="p-2 sm:p-3">{totals.diff}</div>
              <div className="p-2 sm:p-3">{totals.perc}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela 2: Comparativo ROL Lavanderia vs Peso Pesado */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <h3 className="font-semibold text-xs sm:text-sm">⚖️ Comparativo ROL Lavanderia vs Peso Pesado</h3>
          <p className="text-[10px] sm:text-xs text-gray-600">Apenas roupa limpa (para conferência do romaneio da lavanderia)</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-5 gap-0 text-[11px] sm:text-sm font-medium bg-gray-50 border-b">
              <div className="p-2 sm:p-3">Data</div>
              <div className="p-2 sm:p-3 text-purple-700">ROL Lavanderia (kg)</div>
              <div className="p-2 sm:p-3 text-pink-700">Peso Pesado (kg)</div>
              <div className="p-2 sm:p-3">Diferença (kg)</div>
              <div className="p-2 sm:p-3">Diferença (%)</div>
            </div>
            <div className="divide-y">
              {loading ? (
                <div className="p-3 sm:p-4 grid grid-cols-1 gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : data.length === 0 ? (
                <div className="p-4 sm:p-6 text-center text-gray-500 text-sm">Sem registros no período.</div>
              ) : (
                data.map((r)=> {
                  const hasBruto = (r.peso_bruto_lavanderia || 0) > 0;
                  if (!hasBruto) return null; // Só mostra dias com roupa limpa
                  return (
                    <div key={`lav-${r.date}`} className="grid grid-cols-5 text-[11px] sm:text-sm hover:bg-gray-50 cursor-pointer" onClick={()=>openDay(r.date)}>
                      <div className="p-2 sm:p-3 underline text-blue-700">{(() => { const [y,m,d]=r.date.split('-'); return `${d}/${m}/${y}`; })()}</div>
                      <div className="p-2 sm:p-3">{r.peso_bruto_lavanderia?.toFixed(2) || '0.00'}</div>
                      <div className="p-2 sm:p-3">{r.peso_pesado_liquido?.toFixed(2) || '0.00'}</div>
                      <div className="p-2 sm:p-3">{r.diferenca_lavanderia?.toFixed(2) || '0.00'}</div>
                      <div className={`p-2 sm:p-3 ${(r.percentual_diferenca_lavanderia || 0) > 5 ? 'text-red-600 font-semibold' : ''}`}>
                        {r.percentual_diferenca_lavanderia?.toFixed(2) || '0.00'}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="grid grid-cols-5 bg-gray-50 text-[11px] sm:text-sm font-semibold border-t">
              <div className="p-2 sm:p-3">Totais do mês</div>
              <div className="p-2 sm:p-3 text-purple-700">{totals.bruto}</div>
              <div className="p-2 sm:p-3 text-pink-700">{totals.pesado}</div>
              <div className="p-2 sm:p-3">{totals.diffLav}</div>
              <div className={`p-2 sm:p-3 ${totals.percLav > 5 ? 'text-red-600' : ''}`}>{totals.percLav}%</div>
            </div>
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border-b">
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Entradas do dia {(() => { const [y,m,d]=selectedDay.split('-'); return `${d}/${m}/${y}`; })()}</h3>
              <p className="text-[11px] sm:text-xs text-gray-500">Clique no ícone para excluir uma pesagem.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={exportDayPdf} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm">
                PDF
              </button>
              <button onClick={exportDayWhatsApp} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm">
                WhatsApp
              </button>
              <button onClick={()=>{ setSelectedDay(''); setDayEntries([]); }} className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm">Fechar</button>
            </div>
          </div>
          {/* Resumo diário: comparação entre roupa suja que saiu e roupa limpa que voltou (igual à primeira tabela) */}
          <div className="p-2 sm:p-3 bg-blue-50 border-b">
            <p className="text-[10px] sm:text-xs text-blue-800">
              <strong>Atenção:</strong> Este resumo compara a roupa <strong>suja que saiu</strong> (e voltará limpa neste dia) 
              com a roupa <strong>limpa que voltou</strong> (pesada neste dia). Segue a mesma lógica da primeira tabela.
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[550px]">
              <div className="grid grid-cols-5 gap-0 text-[11px] sm:text-sm font-medium bg-gray-50 border-b">
                <div className="p-2 sm:p-3">Limpa que Voltou (kg)</div>
                <div className="p-2 sm:p-3">Suja que Saiu (kg)</div>
                <div className="p-2 sm:p-3">Suja Pesada Hoje (kg)</div>
                <div className="p-2 sm:p-3">Diferença (kg)</div>
                <div className="p-2 sm:p-3">Sujidade (%)</div>
              </div>
              <div className="grid grid-cols-5 text-[11px] sm:text-sm">
                <div className="p-2 sm:p-3 text-green-600 font-semibold">{daySummary.limpa.toFixed(2)}</div>
                <div className="p-2 sm:p-3">{daySummary.suja.toFixed(2)}</div>
                <div className="p-2 sm:p-3 text-red-600 font-semibold">{daySummary.sujaPesadaHoje.toFixed(2)}</div>
                <div className="p-2 sm:p-3">{daySummary.diff.toFixed(2)}</div>
                <div className="p-2 sm:p-3">{daySummary.perc.toFixed(2)}%</div>
              </div>
            </div>
          </div>
          <div className="divide-y">
            {dayLoading ? (
              <div className="p-3 sm:p-4">
                <SkeletonCard />
                <SkeletonCard className="mt-2" />
              </div>
            ) : dayEntries.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-gray-500 text-sm">Sem lançamentos</div>
            ) : (
              dayEntries.map(e => (
                <div key={e.id} className="p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-[11px] sm:text-sm break-words">{e.kind === 'suja' ? 'Roupa Suja' : 'Roupa Limpa'} — Líquido {e.netWeight} kg</div>
                    <div className="text-gray-600 text-[10px] sm:text-xs break-words">Total {e.totalWeight} kg · Tara {e.tareWeight} kg · {new Date(e.createdAt).toLocaleString('pt-BR')} {e.cage ? `· Gaiola ${e.cage.barcode}` : ''}</div>
                  </div>
                  <button onClick={()=>deleteEntry(e.id)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0" title="Excluir">
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
