import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Wallet, AlertTriangle, Zap } from 'lucide-react';

export default function Bankroll() {
  const [bankroll, setBankroll] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [pendingExposure, setPendingExposure] = useState(0);
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [br, mv, bp, ba] = await Promise.all([
        supabase.from('bankroll').select('*').single(),
        supabase.from('bankroll_movements').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('bets').select('stake').eq('status', 'pending'),
        supabase.from('bets').select('status, profit_loss, closed_at').neq('status', 'pending').order('closed_at'),
      ]);
      setBankroll(br.data);
      setMovements(mv.data ?? []);
      setPendingExposure((bp.data ?? []).reduce((s: number, b: any) => s + Number(b.stake), 0));
      setBets(ba.data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  const initial = Number(bankroll?.initial_amount ?? 0);
  const current = Number(bankroll?.current_amount ?? 0);
  const profit = current - initial;
  const roi = initial ? (profit / initial) * 100 : 0;

  // Drawdown & streaks
  let peak = initial, maxDD = 0, running = initial;
  let bestGreen = 0, worstRed = 0, cg = 0, cr = 0;
  bets.forEach(b => {
    running += Number(b.profit_loss ?? 0);
    if (running > peak) peak = running;
    const dd = peak - running; if (dd > maxDD) maxDD = dd;
    if (b.status === 'green') { cg++; cr = 0; if (cg > bestGreen) bestGreen = cg; }
    else if (b.status === 'red') { cr++; cg = 0; if (cr > worstRed) worstRed = cr; }
    else { cg = 0; cr = 0; }
  });

  const units = { unit: 50 };
  const unitsWon = profit / units.unit;

  const Stat = ({ label, value, tone = 'default', icon: Icon }: any) => (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-widest text-muted-foreground font-mono">{label}</span>{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}</div>
      <div className={`text-2xl font-bold font-mono ${tone === 'green' ? 'text-success' : tone === 'red' ? 'text-destructive' : tone === 'neon' ? 'neon-text' : ''}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Banca Greenite</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">☣ Estado da tesouraria da infeção</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Banca inicial" value={`${initial.toFixed(2)}€`} icon={Wallet} />
        <Stat label="Banca atual" value={`${current.toFixed(2)}€`} tone="neon" icon={Wallet} />
        <Stat label="Lucro acumulado" value={`${profit>=0?'+':''}${profit.toFixed(2)}€`} tone={profit>=0?'green':'red'} icon={profit>=0?TrendingUp:TrendingDown} />
        <Stat label="ROI" value={`${roi.toFixed(2)}%`} tone={roi>=0?'green':'red'} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Exposição pendente" value={`${pendingExposure.toFixed(2)}€`} icon={AlertTriangle} />
        <Stat label="Unidades" value={`${unitsWon.toFixed(2)}u`} tone={unitsWon>=0?'green':'red'} />
        <Stat label="Drawdown máx" value={`${maxDD.toFixed(2)}€`} tone="red" />
        <Stat label="Melhor / pior seq" value={`${bestGreen}G / ${worstRed}R`} icon={Zap} />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Histórico de movimentos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-right p-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{new Date(m.created_at).toLocaleString('pt-PT')}</td>
                  <td className="p-3 uppercase text-xs font-mono">{m.type}</td>
                  <td className="p-3">{m.description}</td>
                  <td className={`p-3 text-right font-mono ${Number(m.amount)>=0?'text-success':'text-destructive'}`}>{Number(m.amount)>=0?'+':''}{Number(m.amount).toFixed(2)}€</td>
                  <td className="p-3 text-right font-mono">{m.balance_after != null ? `${Number(m.balance_after).toFixed(2)}€` : '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Sem movimentos ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
