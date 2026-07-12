import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode } from '@/lib/services';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Target, Award, AlertCircle, CheckCircle2, XCircle, Clock, Percent, Coins, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, canAdmin } from '@/hooks/useAuth';

interface Bet {
  id: string; service_id: string; status: string; stake: number; profit_loss: number | null; odd: number;
  bet_date: string; closed_at: string | null; market?: string; competition?: string; selection?: string;
  service?: { code: string; name: string; emoji: string };
}

function StatCard({ label, value, sub, icon: Icon, tone = 'default', trend }: any) {
  const tones: Record<string, string> = {
    default: 'text-foreground',
    green: 'text-success',
    red: 'text-destructive',
    neon: 'neon-text',
    warning: 'text-warning',
  };
  const hasTrend = typeof trend === 'number' && isFinite(trend);
  const trendUp = hasTrend && trend >= 0;
  return (
    <div className="stat-card p-5 md:p-6">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-mono">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className={`text-2xl md:text-3xl font-bold font-mono ${tones[tone]}`}>{value}</div>
        {hasTrend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${trendUp ? 'text-success' : 'text-destructive'}`}>
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'neon' }) {
  const cls =
    tone === 'green' ? 'text-success drop-shadow-[0_0_18px_hsl(var(--success)/0.55)]' :
    tone === 'red'   ? 'text-destructive drop-shadow-[0_0_18px_hsl(var(--destructive)/0.55)]' :
                       'neon-text';
  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 shadow-neon flex flex-col justify-between min-h-[140px]">
      <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-muted-foreground font-mono">{label}</span>
      <div className={`font-mono font-black leading-none tracking-tight text-4xl md:text-6xl mt-4 ${cls}`}>{value}</div>
    </div>
  );
}

const eur = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}€`;

export default function Dashboard() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [bankroll, setBankroll] = useState<{ initial_amount: number; current_amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const admin = canAdmin(role);
  const [f, setF] = useState({ from: '', to: '', competition: '', market: '', selection: '', service: 'all', status: 'all' });
  const setPeriod = (kind: 'today'|'7d'|'30d'|'month'|'all') => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0,10);
    if (kind === 'today') setF(x => ({ ...x, from: iso(today), to: iso(today) }));
    else if (kind === '7d') setF(x => ({ ...x, from: iso(new Date(Date.now()-7*86400000)), to: iso(today) }));
    else if (kind === '30d') setF(x => ({ ...x, from: iso(new Date(Date.now()-30*86400000)), to: iso(today) }));
    else if (kind === 'month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); setF(x => ({ ...x, from: iso(d), to: iso(today) })); }
    else setF(x => ({ ...x, from: '', to: '' }));
  };

  useEffect(() => {
    (async () => {
      const [b, br] = await Promise.all([
        supabase.from('bets').select('*, service:services(code,name,emoji)').order('bet_date', { ascending: false }),
        supabase.from('bankroll').select('*').maybeSingle(),
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

  // Streak (últimas apostas fechadas cronologicamente)
  const chronological = sortedByDate.filter(b => b.status === 'green' || b.status === 'red');
  let streakType: 'green' | 'red' | null = null;
  let streakCount = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const s = chronological[i].status as 'green' | 'red';
    if (streakType === null) { streakType = s; streakCount = 1; }
    else if (s === streakType) streakCount++;
    else break;
  }
  const showStreak = streakCount >= 2;

  // Trends: período atual vs anterior (mesma duração)
  const pctDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : (curr > 0 ? 100 : -100);
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const prev7Start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const prevWeekly = closed.filter(b => b.bet_date >= prev7Start && b.bet_date < weekAgo).reduce((s, b) => s + (b.profit_loss ?? 0), 0);
  const prevMonthly = closed.filter(b => b.bet_date >= prev30Start && b.bet_date < monthAgo).reduce((s, b) => s + (b.profit_loss ?? 0), 0);
  const weeklyTrend = pctDelta(weeklyProfit, prevWeekly);
  const monthlyTrend = pctDelta(monthlyProfit, prevMonthly);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono uppercase tracking-wider">☣ Estado da infeção</p>
        </div>
        {showStreak && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-sm font-bold uppercase tracking-wider ${
            streakType === 'green'
              ? 'bg-success/10 border-success/50 text-success shadow-[0_0_20px_hsl(var(--success)/0.35)]'
              : 'bg-destructive/10 border-destructive/50 text-destructive shadow-[0_0_20px_hsl(var(--destructive)/0.35)]'
          }`}>
            {streakType === 'green' ? '🔥' : '🥶'} {streakCount} {streakType}s seguidos
          </div>
        )}
      </div>

      {/* HERO — números de destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <HeroStat label="Lucro total" value={eur(totalProfit)} tone={totalProfit >= 0 ? 'green' : 'red'} />
        <HeroStat label="ROI" value={`${roi.toFixed(1)}%`} tone={roi >= 0 ? 'green' : 'red'} />
        <HeroStat label="Win rate" value={`${hitRate.toFixed(1)}%`} tone="neon" />
      </div>

      {/* Banca + resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Banca atual"    value={`${(bankroll?.current_amount ?? 0).toFixed(2)}€`} sub={`Inicial ${initial.toFixed(2)}€`} icon={Coins} tone="neon" />
        <StatCard label="Hoje"    value={eur(dailyProfit)}   tone={dailyProfit>=0?'green':'red'} icon={dailyProfit>=0?TrendingUp:TrendingDown} />
        <StatCard label="7 dias"  value={eur(weeklyProfit)}  tone={weeklyProfit>=0?'green':'red'} trend={weeklyTrend} />
        <StatCard label="30 dias" value={eur(monthlyProfit)} tone={monthlyProfit>=0?'green':'red'} trend={monthlyTrend} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Apostas"  value={bets.length} icon={AlertCircle} />
        <StatCard label="Greens"   value={green.length} icon={CheckCircle2} tone="green" />
        <StatCard label="Reds"     value={red.length}   icon={XCircle}      tone="red" />
        <StatCard label="Voids"    value={voidBets.length} icon={AlertCircle} />
        <StatCard label="Pendentes" value={pending.length} sub={`Exposição ${exposure.toFixed(2)}€`} icon={Clock} tone="warning" />
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

      {admin && (
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
      )}

      {/* ========== ANÁLISE AVANÇADA ========== */}
      <AdvancedAnalysis bets={bets} admin={admin} f={f} setF={setF} setPeriod={setPeriod} />
    </div>
  );
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--toxic))', 'hsl(var(--gold))'];
const RESULT_COLORS: Record<string, string> = {
  Green: 'hsl(var(--success))',
  Red: 'hsl(var(--destructive))',
  Void: 'hsl(var(--muted-foreground))',
  Cashout: 'hsl(var(--warning))',
};

function AdvancedAnalysis({ bets, admin, f, setF, setPeriod }: any) {
  const filtered = useMemo(() => bets.filter((b: any) => {
    if (b.status === 'pending') return false;
    if (f.from && b.bet_date < f.from) return false;
    if (f.to && b.bet_date > f.to) return false;
    if (f.status !== 'all' && b.status !== f.status) return false;
    if (f.competition && !(b.competition ?? '').toLowerCase().includes(f.competition.toLowerCase())) return false;
    if (f.market && !(b.market ?? '').toLowerCase().includes(f.market.toLowerCase())) return false;
    if (f.selection && !(b.selection ?? '').toLowerCase().includes(f.selection.toLowerCase())) return false;
    if (admin && f.service !== 'all' && (b.service?.code ?? '') !== f.service) return false;
    return true;
  }), [bets, f, admin]);

  const total = filtered.length;
  const staked = filtered.reduce((s: number, b: any) => s + (b.status === 'void' ? 0 : Number(b.stake)), 0);
  const profit = filtered.reduce((s: number, b: any) => s + Number(b.profit_loss ?? 0), 0);
  const gains = filtered.filter((b: any) => (b.profit_loss ?? 0) > 0).reduce((s: number, b: any) => s + Number(b.profit_loss), 0);
  const losses = filtered.filter((b: any) => (b.profit_loss ?? 0) < 0).reduce((s: number, b: any) => s + Number(b.profit_loss), 0);
  const greens = filtered.filter((b: any) => b.status === 'green').length;
  const reds = filtered.filter((b: any) => b.status === 'red').length;
  const decided = greens + reds;
  const roi = staked ? (profit / staked) * 100 : 0;
  const hitRate = decided ? (greens / decided) * 100 : 0;
  const avgOdd = total ? filtered.reduce((s: number, b: any) => s + Number(b.odd), 0) / total : 0;
  const avgStake = total ? filtered.reduce((s: number, b: any) => s + Number(b.stake), 0) / total : 0;

  const groupBy = (key: string) => {
    const map: Record<string, { name: string; count: number; profit: number; staked: number; greens: number; reds: number }> = {};
    filtered.forEach((b: any) => {
      const k = (b[key] ?? '—') || '—';
      const g = (map[k] ??= { name: k, count: 0, profit: 0, staked: 0, greens: 0, reds: 0 });
      g.count += 1;
      g.profit += Number(b.profit_loss ?? 0);
      g.staked += b.status === 'void' ? 0 : Number(b.stake);
      if (b.status === 'green') g.greens += 1;
      if (b.status === 'red') g.reds += 1;
    });
    return Object.values(map).map(g => ({
      ...g,
      roi: g.staked ? (g.profit / g.staked) * 100 : 0,
      hitRate: (g.greens + g.reds) ? (g.greens / (g.greens + g.reds)) * 100 : 0,
    }));
  };

  const byMarket = groupBy('market').sort((a, b) => b.profit - a.profit);
  const byCompetition = groupBy('competition').sort((a, b) => b.profit - a.profit);
  const bestMarket = byMarket[0]; const worstMarket = byMarket[byMarket.length - 1];
  const bestComp = byCompetition[0]; const worstComp = byCompetition[byCompetition.length - 1];

  const distribution = [
    { name: 'Green', value: greens },
    { name: 'Red', value: reds },
    { name: 'Void', value: filtered.filter((b: any) => b.status === 'void').length },
    { name: 'Cashout', value: filtered.filter((b: any) => b.status === 'cashout').length },
  ].filter(x => x.value > 0);

  const Metric = ({ label, value, tone }: any) => (
    <div className="stat-card">
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-1">{label}</div>
      <div className={`text-xl md:text-2xl font-bold font-mono ${tone === 'green' ? 'text-success' : tone === 'red' ? 'text-destructive' : tone === 'neon' ? 'neon-text' : ''}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-xl md:text-2xl font-bold">Análise avançada</h2>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPeriod('today')}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => setPeriod('7d')}>7 dias</Button>
          <Button size="sm" variant="outline" onClick={() => setPeriod('30d')}>30 dias</Button>
          <Button size="sm" variant="outline" onClick={() => setPeriod('month')}>Este mês</Button>
          <Button size="sm" variant="outline" onClick={() => setPeriod('all')}>Todo o histórico</Button>
        </div>
        <div className={`grid grid-cols-2 md:grid-cols-${admin ? 7 : 6} gap-3`}>
          <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={f.from} onChange={e=>setF((x: any)=>({...x, from:e.target.value}))} /></div>
          <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={f.to} onChange={e=>setF((x: any)=>({...x, to:e.target.value}))} /></div>
          <div><label className="text-xs text-muted-foreground">Competição</label><Input value={f.competition} onChange={e=>setF((x: any)=>({...x, competition:e.target.value}))} /></div>
          <div><label className="text-xs text-muted-foreground">Mercado</label><Input value={f.market} onChange={e=>setF((x: any)=>({...x, market:e.target.value}))} /></div>
          <div><label className="text-xs text-muted-foreground">Aposta</label><Input value={f.selection} onChange={e=>setF((x: any)=>({...x, selection:e.target.value}))} /></div>
          <div>
            <label className="text-xs text-muted-foreground">Resultado</label>
            <Select value={f.status} onValueChange={v => setF((x: any) => ({ ...x, status: v }))}>
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
              <Select value={f.service} onValueChange={v => setF((x: any) => ({ ...x, service: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(SERVICE_META).map(([k, m]: any) => <SelectItem key={k} value={k}>{m.emoji} {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Apostas" value={total} tone="neon" />
        <Metric label="Total apostado" value={`${staked.toFixed(2)}€`} />
        <Metric label="Lucro líquido" value={`${profit>=0?'+':''}${profit.toFixed(2)}€`} tone={profit>=0?'green':'red'} />
        <Metric label="ROI" value={`${roi.toFixed(1)}%`} tone={roi>=0?'green':'red'} />
        <Metric label="Taxa de acerto" value={`${hitRate.toFixed(1)}%`} tone="neon" />
        <Metric label="Ganhos brutos" value={`+${gains.toFixed(2)}€`} tone="green" />
        <Metric label="Perdas brutas" value={`${losses.toFixed(2)}€`} tone="red" />
        <Metric label="Odd / Stake médias" value={`${avgOdd.toFixed(2)} / ${avgStake.toFixed(2)}€`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3">Lucro por mercado (top 10)</h3>
          <ResponsiveContainer width="100%" height={Math.max(260, Math.min(byMarket.length, 10) * 34 + 40)}>
            <BarChart data={byMarket.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v)=>`${v}€`} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} interval={0} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}€`, 'Lucro']}
              />
              <Bar dataKey="profit" radius={[0,4,4,0]}>
                {byMarket.slice(0, 10).map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3">Lucro por competição (top 10)</h3>
          <ResponsiveContainer width="100%" height={Math.max(260, Math.min(byCompetition.length, 10) * 34 + 40)}>
            <BarChart data={byCompetition.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v)=>`${v}€`} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} interval={0} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}€`, 'Lucro']}
              />
              <Bar dataKey="profit" radius={[0,4,4,0]}>
                {byCompetition.slice(0, 10).map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="font-semibold mb-3">Distribuição de resultados</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {distribution.map((entry, i) => <Cell key={i} fill={RESULT_COLORS[entry.name] ?? 'hsl(var(--muted-foreground))'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {bestMarket && (
            <div className="glass-card rounded-xl p-4 border-success/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Melhor mercado</div>
              <div className="text-base font-bold truncate">{bestMarket.name}</div>
              <div className="text-success font-mono text-lg">{bestMarket.profit>=0?'+':''}{bestMarket.profit.toFixed(2)}€ · ROI {bestMarket.roi.toFixed(1)}%</div>
            </div>
          )}
          {worstMarket && worstMarket !== bestMarket && (
            <div className="glass-card rounded-xl p-4 border-destructive/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Pior mercado</div>
              <div className="text-base font-bold truncate">{worstMarket.name}</div>
              <div className="text-destructive font-mono text-lg">{worstMarket.profit.toFixed(2)}€ · ROI {worstMarket.roi.toFixed(1)}%</div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {bestComp && (
            <div className="glass-card rounded-xl p-4 border-success/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Melhor competição</div>
              <div className="text-base font-bold truncate">{bestComp.name}</div>
              <div className="text-success font-mono text-lg">{bestComp.profit>=0?'+':''}{bestComp.profit.toFixed(2)}€ · ROI {bestComp.roi.toFixed(1)}%</div>
            </div>
          )}
          {worstComp && worstComp !== bestComp && (
            <div className="glass-card rounded-xl p-4 border-destructive/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Pior competição</div>
              <div className="text-base font-bold truncate">{worstComp.name}</div>
              <div className="text-destructive font-mono text-lg">{worstComp.profit.toFixed(2)}€ · ROI {worstComp.roi.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border"><h3 className="font-semibold">Breakdown por mercado</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Mercado</th>
                <th className="text-right p-3">Apostas</th>
                <th className="text-right p-3">Apostado</th>
                <th className="text-right p-3">Lucro</th>
                <th className="text-right p-3">ROI</th>
                <th className="text-right p-3">Taxa acerto</th>
              </tr>
            </thead>
            <tbody>
              {byMarket.map(m => (
                <tr key={m.name} className="border-t border-border">
                  <td className="p-3">{m.name}</td>
                  <td className="p-3 text-right font-mono">{m.count}</td>
                  <td className="p-3 text-right font-mono">{m.staked.toFixed(2)}€</td>
                  <td className={`p-3 text-right font-mono ${m.profit>=0?'text-success':'text-destructive'}`}>{m.profit>=0?'+':''}{m.profit.toFixed(2)}€</td>
                  <td className={`p-3 text-right font-mono ${m.roi>=0?'text-success':'text-destructive'}`}>{m.roi.toFixed(1)}%</td>
                  <td className="p-3 text-right font-mono">{m.hitRate.toFixed(1)}%</td>
                </tr>
              ))}
              {byMarket.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

