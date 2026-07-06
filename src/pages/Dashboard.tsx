import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode } from '@/lib/services';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Target, Award, AlertCircle, CheckCircle2, XCircle, Clock, Percent, Coins } from 'lucide-react';

interface Bet {
  id: string; service_id: string; status: string; stake: number; profit_loss: number | null; odd: number;
  bet_date: string; closed_at: string | null; service?: { code: string; name: string; emoji: string };
}

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: any) {
  const tones: Record<string, string> = {
    default: 'text-foreground',
    green: 'text-success',
    red: 'text-destructive',
    neon: 'neon-text',
    warning: 'text-warning',
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-mono">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={`text-2xl md:text-3xl font-bold font-mono ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const eur = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}€`;

export default function Dashboard() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [bankroll, setBankroll] = useState<{ initial_amount: number; current_amount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [b, br] = await Promise.all([
        supabase.from('bets').select('*, service:services(code,name,emoji)').order('bet_date', { ascending: false }),
        supabase.from('bankroll').select('*').single(),
      ]);
      setBets((b.data ?? []) as any);
      setBankroll(br.data as any);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">A carregar...</div>;

  const closed = bets.filter(b => b.status !== 'pending');
  const green = bets.filter(b => b.status === 'green');
  const red = bets.filter(b => b.status === 'red');
  const voidBets = bets.filter(b => b.status === 'void');
  const pending = bets.filter(b => b.status === 'pending');

  const totalProfit = closed.reduce((s, b) => s + (b.profit_loss ?? 0), 0);
  const totalStaked = closed.reduce((s, b) => s + (b.status === 'void' ? 0 : b.stake), 0);
  const roi = totalStaked ? (totalProfit / totalStaked) * 100 : 0;
  const hitRate = (green.length + red.length) ? (green.length / (green.length + red.length)) * 100 : 0;
  const exposure = pending.reduce((s, b) => s + b.stake, 0);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const dailyProfit = closed.filter(b => b.bet_date === today).reduce((s, b) => s + (b.profit_loss ?? 0), 0);
  const weeklyProfit = closed.filter(b => b.bet_date >= weekAgo).reduce((s, b) => s + (b.profit_loss ?? 0), 0);
  const monthlyProfit = closed.filter(b => b.bet_date >= monthAgo).reduce((s, b) => s + (b.profit_loss ?? 0), 0);

  // per service
  const perService: Record<string, { profit: number; count: number; staked: number; name: string; emoji: string; code: string }> = {};
  closed.forEach(b => {
    const key = (b.service as any)?.code ?? 'other';
    if (!perService[key]) perService[key] = { profit: 0, count: 0, staked: 0, name: (b.service as any)?.name ?? key, emoji: (b.service as any)?.emoji ?? '', code: key };
    perService[key].profit += b.profit_loss ?? 0;
    perService[key].count += 1;
    perService[key].staked += b.status === 'void' ? 0 : b.stake;
  });
  const serviceArr = Object.values(perService);
  const best = serviceArr.length ? serviceArr.reduce((a, b) => a.profit > b.profit ? a : b) : null;
  const worst = serviceArr.length ? serviceArr.reduce((a, b) => a.profit < b.profit ? a : b) : null;

  // bankroll evolution
  const initial = bankroll?.initial_amount ?? 0;
  const sortedByDate = [...closed].filter(b => b.closed_at).sort((a, b) => (a.closed_at! > b.closed_at! ? 1 : -1));
  let running = initial;
  const bankrollData = [{ date: 'Início', banca: initial }, ...sortedByDate.map(b => { running += b.profit_loss ?? 0; return { date: b.bet_date, banca: +running.toFixed(2) }; })];

  // daily results
  const dailyMap: Record<string, number> = {};
  closed.forEach(b => { dailyMap[b.bet_date] = (dailyMap[b.bet_date] ?? 0) + (b.profit_loss ?? 0); });
  const dailyData = Object.entries(dailyMap).sort(([a],[b])=>a>b?1:-1).slice(-14).map(([date, lucro]) => ({ date: date.slice(5), lucro: +lucro.toFixed(2) }));

  const serviceChart = serviceArr.map(s => ({ name: `${s.emoji} ${s.name.split("'")[0]}`, lucro: +s.profit.toFixed(2) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1 font-mono uppercase tracking-wider">☣ Estado da infeção</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Lucro total"    value={eur(totalProfit)}  icon={totalProfit>=0?TrendingUp:TrendingDown} tone={totalProfit>=0?'green':'red'} />
        <StatCard label="ROI"            value={`${roi.toFixed(1)}%`} icon={Percent} tone={roi>=0?'green':'red'} />
        <StatCard label="Taxa de acerto" value={`${hitRate.toFixed(1)}%`} icon={Target} tone="neon" />
        <StatCard label="Banca atual"    value={`${(bankroll?.current_amount ?? 0).toFixed(2)}€`} sub={`Inicial ${initial.toFixed(2)}€`} icon={Coins} tone="neon" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Hoje"    value={eur(dailyProfit)}   tone={dailyProfit>=0?'green':'red'} />
        <StatCard label="7 dias"  value={eur(weeklyProfit)}  tone={weeklyProfit>=0?'green':'red'} />
        <StatCard label="30 dias" value={eur(monthlyProfit)} tone={monthlyProfit>=0?'green':'red'} />
        <StatCard label="Exposição" value={`${exposure.toFixed(2)}€`} sub={`${pending.length} pendentes`} tone="warning" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Apostas"  value={bets.length} icon={AlertCircle} />
        <StatCard label="Greens"   value={green.length} icon={CheckCircle2} tone="green" />
        <StatCard label="Reds"     value={red.length}   icon={XCircle}      tone="red" />
        <StatCard label="Voids"    value={voidBets.length} icon={AlertCircle} />
        <StatCard label="Pendentes" value={pending.length} icon={Clock} tone="warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução da banca</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={bankrollData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Line type="monotone" dataKey="banca" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Lucro por dia (últimos 14)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3">Lucro por serviço</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serviceChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {best && (
            <div className="glass-card rounded-xl p-4 border-success/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Melhor serviço</div>
              <div className="text-lg font-bold">{best.emoji} {best.name}</div>
              <div className="text-success font-mono text-xl mt-1">{eur(best.profit)}</div>
            </div>
          )}
          {worst && (
            <div className="glass-card rounded-xl p-4 border-destructive/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Pior serviço</div>
              <div className="text-lg font-bold">{worst.emoji} {worst.name}</div>
              <div className="text-destructive font-mono text-xl mt-1">{eur(worst.profit)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
