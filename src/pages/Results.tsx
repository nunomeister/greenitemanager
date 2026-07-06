import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode, BET_STATUS_META } from '@/lib/services';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export default function Results() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', service: 'all', from: '', to: '', competition: '', market: '' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('bets')
        .select('*, service:services(code,name,emoji), bookmaker:bookmakers(name)')
        .neq('status', 'pending')
        .order('bet_date', { ascending: false });
      setBets(data ?? []); setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => bets.filter(b => {
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    if (filters.service !== 'all' && b.service?.code !== filters.service) return false;
    if (filters.from && b.bet_date < filters.from) return false;
    if (filters.to && b.bet_date > filters.to) return false;
    if (filters.competition && !(b.competition ?? '').toLowerCase().includes(filters.competition.toLowerCase())) return false;
    if (filters.market && !(b.market ?? '').toLowerCase().includes(filters.market.toLowerCase())) return false;
    return true;
  }), [bets, filters]);

  const totalProfit = filtered.reduce((s, b) => s + (b.profit_loss ?? 0), 0);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">{filtered.length} apostas • lucro <span className={totalProfit>=0?'text-success':'text-destructive'}>{totalProfit>=0?'+':''}{totalProfit.toFixed(2)}€</span></p>
      </div>

      <div className="glass-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Estado</label>
          <Select value={filters.status} onValueChange={v=>setFilters(f=>({...f, status:v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="void">Void</SelectItem>
              <SelectItem value="cashout">Cashout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Serviço</label>
          <Select value={filters.service} onValueChange={v=>setFilters(f=>({...f, service:v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(SERVICE_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.emoji} {m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={filters.from} onChange={e=>setFilters(f=>({...f, from:e.target.value}))} /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={filters.to} onChange={e=>setFilters(f=>({...f, to:e.target.value}))} /></div>
        <div><label className="text-xs text-muted-foreground">Competição</label><Input value={filters.competition} onChange={e=>setFilters(f=>({...f, competition:e.target.value}))} /></div>
        <div><label className="text-xs text-muted-foreground">Mercado</label><Input value={filters.market} onChange={e=>setFilters(f=>({...f, market:e.target.value}))} /></div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Serviço</th>
                <th className="text-left p-3">Jogo</th>
                <th className="text-left p-3">Mercado</th>
                <th className="text-right p-3">Odd</th>
                <th className="text-right p-3">Stake</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{b.bet_date}</td>
                  <td className="p-3">{b.service?.emoji} <span className="text-xs">{b.service?.name}</span></td>
                  <td className="p-3">
                    <div className="font-medium">{b.match}</div>
                    <div className="text-xs text-muted-foreground">{b.competition}</div>
                  </td>
                  <td className="p-3"><div>{b.market}</div><div className="text-xs text-muted-foreground">{b.selection}</div></td>
                  <td className="p-3 text-right font-mono">{Number(b.odd).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono">{Number(b.stake).toFixed(2)}€</td>
                  <td className="p-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${BET_STATUS_META[b.status]?.className}`}>{BET_STATUS_META[b.status]?.label}</span></td>
                  <td className={`p-3 text-right font-mono font-semibold ${(b.profit_loss ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{b.profit_loss != null ? `${b.profit_loss>=0?'+':''}${Number(b.profit_loss).toFixed(2)}€` : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sem resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
