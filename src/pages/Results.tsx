import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode, BET_STATUS_META } from '@/lib/services';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Edit2, Trash2 } from 'lucide-react';
import { useAuth, canAdmin } from '@/hooks/useAuth';
import EditBetDialog from '@/components/EditBetDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';

export default function Results() {
  const { role } = useAuth();
  const admin = canAdmin(role);
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', service: 'all', from: '', to: '', competition: '', market: '' });
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from('bets')
      .select('*, service:services(code,name,emoji), bookmaker:bookmakers(name)')
      .neq('status', 'pending')
      .order('bet_date', { ascending: false });
    setBets(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => bets.filter(b => {
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    if (admin && filters.service !== 'all' && b.service?.code !== filters.service) return false;
    if (filters.from && b.bet_date < filters.from) return false;
    if (filters.to && b.bet_date > filters.to) return false;
    if (filters.competition && !(b.competition ?? '').toLowerCase().includes(filters.competition.toLowerCase())) return false;
    if (filters.market && !(b.market ?? '').toLowerCase().includes(filters.market.toLowerCase())) return false;
    return true;
  }), [bets, filters, admin]);

  const totalProfit = filtered.reduce((s, b) => s + Number(b.profit_loss ?? 0), 0);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">{filtered.length} apostas • lucro <span className={totalProfit>=0?'text-success':'text-destructive'}>{totalProfit>=0?'+':''}{totalProfit.toFixed(2)}€</span></p>
      </div>

      <div className={`glass-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-${admin ? 6 : 5} gap-3`}>
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
        {admin && (
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
        )}
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
                {admin && <th className="text-left p-3">Serviço</th>}
                <th className="text-left p-3">Jogo</th>
                <th className="text-left p-3">Mercado</th>
                <th className="text-right p-3">Odd</th>
                <th className="text-right p-3">Stake</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Lucro</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{b.bet_date}</td>
                  {admin && <td className="p-3">{b.service?.emoji} <span className="text-xs">{b.service?.name}</span></td>}
                  <td className="p-3">
                    <div className="font-medium">{b.match}</div>
                    <div className="text-xs text-muted-foreground">{b.competition}</div>
                  </td>
                  <td className="p-3"><div>{b.market}</div><div className="text-xs text-muted-foreground">{b.selection}</div></td>
                  <td className="p-3 text-right font-mono">{Number(b.odd).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono">{Number(b.stake).toFixed(2)}€</td>
                  <td className="p-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${BET_STATUS_META[b.status]?.className}`}>{BET_STATUS_META[b.status]?.label}</span></td>
                  <td className={`p-3 text-right font-mono font-semibold ${(b.profit_loss ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{b.profit_loss != null ? `${b.profit_loss>=0?'+':''}${Number(b.profit_loss).toFixed(2)}€` : '—'}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={()=>setEditing(b)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={()=>setDeleting(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={admin ? 9 : 8} className="p-8 text-center text-muted-foreground">Sem resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <EditBetDialog bet={editing} onClose={()=>setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o)=>!o && setDeleting(null)}
        title="Apagar aposta?"
        description={`Tens a certeza que queres apagar esta aposta?\n\n${deleting?.match ?? ''}\n\nEsta ação não pode ser anulada e a banca será ajustada automaticamente.`}
        confirmLabel="Apagar"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase.from('bets').delete().eq('id', deleting.id);
          if (error) toast.error(error.message);
          else { toast.success('Aposta apagada'); load(); }
          setDeleting(null);
        }}
      />
    </div>
  );
}
