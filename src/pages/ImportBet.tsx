import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Upload, Sparkles, FileCode, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { BetLeg } from '@/lib/services';

interface Service { id: string; code: string; name: string; emoji: string }

type ExtractedBet = {
  match?: string; competition?: string; market?: string; selection?: string;
  player?: string | null; odd?: number; stake?: number;
  bet_date?: string | null; bet_time?: string | null;
  bet_code?: string | null; bookmaker?: string | null;
  status?: 'pending' | 'green' | 'red' | 'void'; profit_loss?: number | null; result?: string | null;
  is_multiple?: boolean; legs?: BetLeg[];
};

const fileToDataUrl = (file: File): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = rej;
  r.readAsDataURL(file);
});
const fileToText = (file: File): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = rej;
  r.readAsText(file);
});

const cleanLegs = (legs?: BetLeg[]) => Array.isArray(legs) ? legs.map((leg) => ({
  competition: String(leg.competition ?? '').trim(),
  match: String(leg.match ?? '').trim(),
  market: String(leg.market ?? '').trim(),
  selection: String(leg.selection ?? '').trim(),
  odd: Number(leg.odd),
})).filter((leg) => leg.match && leg.selection && leg.odd > 1) : [];

const summarizeBet = (bet: ExtractedBet) => {
  const legs = cleanLegs(bet.legs);
  const isMultiple = !!bet.is_multiple || legs.length >= 2;
  if (!isMultiple) {
    return {
      isMultiple: false,
      legs: [],
      competition: bet.competition ?? null,
      match: bet.match ?? 'Sem descrição',
      market: bet.market ?? '—',
      selection: bet.selection ?? '—',
      odd: Number(bet.odd ?? 0),
    };
  }
  return {
    isMultiple: true,
    legs,
    competition: 'Acumulada',
    match: `Acumulada (${legs.length} seleções)`,
    market: 'Acumulada',
    selection: legs.map((leg) => `${leg.match}: ${leg.selection}`).join(' + '),
    odd: Number(bet.odd ?? legs.reduce((total, leg) => total * (Number(leg.odd) || 1), 1)),
  };
};

export default function ImportBet() {
  const nav = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [defaultService, setDefaultService] = useState<string>('');

  // Slip state
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string>('');
  const [slipLoading, setSlipLoading] = useState(false);
  const [slipBet, setSlipBet] = useState<ExtractedBet | null>(null);
  const [slipService, setSlipService] = useState<string>('');

  // History state
  const [histFile, setHistFile] = useState<File | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histBets, setHistBets] = useState<ExtractedBet[]>([]);
  const [histSelected, setHistSelected] = useState<Record<number, boolean>>({});
  const [histService, setHistService] = useState<string>('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('services').select('*').eq('active', true).order('sort_order');
      const svc = (data ?? []) as any;
      setServices(svc);
      const d = svc[0]?.id ?? '';
      setDefaultService(d);
      setSlipService(d);
      setHistService(d);
    })();
  }, []);

  const analyzeSlip = async () => {
    if (!slipFile) return;
    setSlipLoading(true);
    try {
      const dataUrl = await fileToDataUrl(slipFile);
      const { data, error } = await supabase.functions.invoke('parse-bet-slip', {
        body: { mode: 'slip', image: dataUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSlipBet(data as ExtractedBet);
      toast.success('Aposta extraída — revê e guarda');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao analisar');
    } finally {
      setSlipLoading(false);
    }
  };

  const saveSlipBet = async () => {
    if (!slipBet || !slipService) { toast.error('Escolhe um serviço'); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const now = new Date();
    const summary = summarizeBet(slipBet);
    const payload = {
      service_id: slipService,
      user_id: u.user.id,
      created_by: u.user.id,
      bet_date: slipBet.bet_date || now.toISOString().slice(0, 10),
      bet_time: slipBet.bet_time || now.toTimeString().slice(0, 5),
      competition: summary.competition,
      match: summary.match,
      market: summary.market,
      selection: summary.selection,
      player: slipBet.player ?? null,
      odd: summary.odd,
      stake: Number(slipBet.stake ?? 0),
      bet_code: slipBet.bet_code ?? null,
      confidence: 3,
      is_multiple: summary.isMultiple,
      legs: summary.legs,
    };
    if (!payload.odd || !payload.stake) { toast.error('Odd e stake são obrigatórios'); return; }
    const { error } = await supabase.from('bets').insert(payload as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Aposta criada');
    nav('/bets/pending');
  };

  const analyzeHistory = async () => {
    if (!histFile) return;
    setHistLoading(true);
    try {
      const text = await fileToText(histFile);
      const { data, error } = await supabase.functions.invoke('parse-bet-slip', {
        body: { mode: 'history', html: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const bets: ExtractedBet[] = Array.isArray(data?.bets) ? data.bets : [];
      setHistBets(bets);
      const sel: Record<number, boolean> = {};
      bets.forEach((_, i) => { sel[i] = true; });
      setHistSelected(sel);
      toast.success(`${bets.length} apostas extraídas`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao analisar');
    } finally {
      setHistLoading(false);
    }
  };

  const importHistory = async () => {
    if (!histService) { toast.error('Escolhe um serviço'); return; }
    const chosen = histBets.filter((_, i) => histSelected[i]);
    if (!chosen.length) { toast.error('Nenhuma aposta selecionada'); return; }
    setImporting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setImporting(false); return; }
    const rows = chosen.map(b => {
      const summary = summarizeBet(b);
      return {
        service_id: histService,
        user_id: u.user!.id,
        created_by: u.user!.id,
        bet_date: b.bet_date || new Date().toISOString().slice(0, 10),
        bet_time: b.bet_time || '00:00',
        competition: summary.competition,
        match: summary.match,
        market: summary.market,
        selection: summary.selection,
        player: b.player ?? null,
        odd: summary.odd,
        stake: Number(b.stake ?? 0),
        bet_code: b.bet_code ?? null,
        status: (b.status ?? 'pending') as any,
        profit_loss: b.profit_loss ?? null,
        result: b.result ?? null,
        confidence: 3,
        closed_at: b.status && b.status !== 'pending' ? new Date().toISOString() : null,
        is_multiple: summary.isMultiple,
        legs: summary.legs,
      };
    });
    // Filter invalid
    const valid = rows.filter(r => r.odd > 0 && r.stake > 0);
    if (!valid.length) { toast.error('Sem apostas válidas (odd/stake em falta)'); setImporting(false); return; }
    const { error } = await supabase.from('bets').insert(valid as any);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${valid.length} apostas importadas`);
    nav('/bets/results');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Import automático
        </h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider mt-1">☣ IA extrai apostas do BetLabel</p>
      </div>

      <Tabs defaultValue="slip" className="space-y-4">
        <TabsList>
          <TabsTrigger value="slip"><ImageIcon className="h-4 w-4 mr-2" /> Screenshot do boletim</TabsTrigger>
          <TabsTrigger value="history"><FileCode className="h-4 w-4 mr-2" /> Histórico HTML</TabsTrigger>
        </TabsList>

        {/* SCREENSHOT TAB */}
        <TabsContent value="slip" className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div>
              <Label>Screenshot do boletim (PNG/JPG)</Label>
              <Input type="file" accept="image/*" onChange={async e => {
                const f = e.target.files?.[0] ?? null;
                setSlipFile(f);
                setSlipBet(null);
                setSlipPreview(f ? await fileToDataUrl(f) : '');
              }} />
            </div>
            {slipPreview && (
              <img src={slipPreview} alt="boletim" className="max-h-80 rounded-lg border border-border" />
            )}
            <Button onClick={analyzeSlip} disabled={!slipFile || slipLoading} className="bg-gradient-neon text-primary-foreground">
              {slipLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analisar com IA
            </Button>
          </div>

          {slipBet && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="font-semibold">Dados extraídos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Serviço</Label>
                  <Select value={slipService} onValueChange={setSlipService}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data</Label><Input type="date" value={slipBet.bet_date ?? ''} onChange={e=>setSlipBet({...slipBet, bet_date: e.target.value})} /></div>
                <div><Label>Hora</Label><Input type="time" value={slipBet.bet_time ?? ''} onChange={e=>setSlipBet({...slipBet, bet_time: e.target.value})} /></div>
                <div><Label>Competição</Label><Input value={slipBet.competition ?? ''} onChange={e=>setSlipBet({...slipBet, competition: e.target.value})} /></div>
                <div className="col-span-2"><Label>Jogo</Label><Input value={slipBet.match ?? ''} onChange={e=>setSlipBet({...slipBet, match: e.target.value})} /></div>
                <div><Label>Mercado</Label><Input value={slipBet.market ?? ''} onChange={e=>setSlipBet({...slipBet, market: e.target.value})} /></div>
                <div><Label>Aposta</Label><Input value={slipBet.selection ?? ''} onChange={e=>setSlipBet({...slipBet, selection: e.target.value})} /></div>
                <div><Label>Odd</Label><Input type="number" step="0.01" value={slipBet.odd ?? ''} onChange={e=>setSlipBet({...slipBet, odd: Number(e.target.value)})} /></div>
                <div><Label>Stake (€)</Label><Input type="number" step="0.01" value={slipBet.stake ?? ''} onChange={e=>setSlipBet({...slipBet, stake: Number(e.target.value)})} /></div>
                <div><Label>Código</Label><Input value={slipBet.bet_code ?? ''} onChange={e=>setSlipBet({...slipBet, bet_code: e.target.value})} /></div>
              </div>
              <Button onClick={saveSlipBet} className="bg-gradient-neon text-primary-foreground">
                <Upload className="h-4 w-4 mr-2" /> Guardar aposta
              </Button>
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div>
              <Label>Página de histórico BetLabel (.html / .htm)</Label>
              <Input type="file" accept=".html,.htm,text/html" onChange={e => { setHistFile(e.target.files?.[0] ?? null); setHistBets([]); }} />
              <p className="text-xs text-muted-foreground mt-1">Na BetLabel: Histórico → botão direito → Guardar como → "Página Web, apenas HTML".</p>
            </div>
            <Button onClick={analyzeHistory} disabled={!histFile || histLoading} className="bg-gradient-neon text-primary-foreground">
              {histLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Extrair apostas
            </Button>
          </div>

          {histBets.length > 0 && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">{histBets.length} apostas encontradas</h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Serviço p/ todas:</Label>
                  <Select value={histService} onValueChange={setHistService}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Jogo</th>
                      <th className="p-2 text-left">Seleção</th>
                      <th className="p-2 text-right">Odd</th>
                      <th className="p-2 text-right">Stake</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histBets.map((b, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2"><Checkbox checked={!!histSelected[i]} onCheckedChange={v => setHistSelected(s => ({ ...s, [i]: !!v }))} /></td>
                        <td className="p-2 font-mono text-xs">{b.bet_date ?? '—'}</td>
                        <td className="p-2">{b.is_multiple ? `Acumulada (${cleanLegs(b.legs).length} seleções)` : (b.match ?? '—')}</td>
                        <td className="p-2">{b.is_multiple ? cleanLegs(b.legs).map(l => l.selection).join(' + ') : (b.selection ?? '—')}</td>
                        <td className="p-2 text-right font-mono">{b.odd ?? '—'}</td>
                        <td className="p-2 text-right font-mono">{b.stake ?? '—'}€</td>
                        <td className="p-2 text-center uppercase text-xs font-mono">{b.status ?? 'pending'}</td>
                        <td className={`p-2 text-right font-mono ${(b.profit_loss ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{b.profit_loss != null ? `${b.profit_loss >= 0 ? '+' : ''}${b.profit_loss}€` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={importHistory} disabled={importing} className="bg-gradient-neon text-primary-foreground">
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar selecionadas
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
