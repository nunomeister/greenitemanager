import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SERVICE_META, ServiceCode, calcStakeFromTarget, fillTemplate } from '@/lib/services';
import { toast } from 'sonner';
import { Skull, Loader2, Copy, Sparkles } from 'lucide-react';
import { useAuth, canAdmin } from '@/hooks/useAuth';
import BetImagesUploader from '@/components/BetImagesUploader';

interface Service { id: string; code: string; name: string; emoji: string; }
interface Bookmaker { id: string; name: string; }
interface Settings { unit_1: number; unit_2: number; default_betlabel_link: string; }

type ExtractedBet = {
  match?: string;
  competition?: string;
  market?: string;
  selection?: string;
  player?: string | null;
  odd?: number;
  stake?: number;
  bet_date?: string | null;
  bet_time?: string | null;
  bet_code?: string | null;
  bookmaker?: string | null;
};

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function NewBet() {
  const nav = useNavigate();
  const { role, user } = useAuth();
  const admin = canAdmin(role);
  const [services, setServices] = useState<Service[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>({ unit_1: 50, unit_2: 100, default_betlabel_link: '' });
  const [loading, setLoading] = useState(false);
  const [analyzingPrint, setAnalyzingPrint] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const [form, setForm] = useState<any>({
    service_id: '',
    bet_date: new Date().toISOString().slice(0,10),
    bet_time: new Date().toTimeString().slice(0,5),
    competition: '', match: '', teams: '', market: '', selection: '', player: '',
    odd: '', stake: '', target_profit: '', target_units: '',
    confidence: 3, bet_code: '', bookmaker_id: '', betlabel_link: '',
    notes: '', match_minute: '', alert_type: '', score_at_entry: '',
    status: 'pending', profit_loss: '', result: '',
  });
  const [unitMode, setUnitMode] = useState<'1'|'2'|'custom'>('1');

  useEffect(() => {
    (async () => {
      const [s, b, t, cfg] = await Promise.all([
        supabase.from('services').select('*').eq('active', true).order('sort_order'),
        supabase.from('bookmakers').select('*').eq('active', true),
        supabase.from('telegram_templates').select('service_code, template_text'),
        supabase.from('settings').select('*'),
      ]);
      setServices((s.data ?? []) as any);
      setBookmakers((b.data ?? []) as any);
      const tpl: Record<string,string> = {};
      (t.data ?? []).forEach((r: any) => { tpl[r.service_code] = r.template_text; });
      setTemplates(tpl);
      const cfgMap: any = {};
      (cfg.data ?? []).forEach((r: any) => { cfgMap[r.key] = r.value; });
      setSettings({
        unit_1: Number(cfgMap.unit_1 ?? 50),
        unit_2: Number(cfgMap.unit_2 ?? 100),
        default_betlabel_link: String(cfgMap.default_betlabel_link ?? ''),
      });
      if (admin) setForm((f: any) => ({ ...f, betlabel_link: String(cfgMap.default_betlabel_link ?? '') }));
    })();
  }, [admin]);

  const currentService = services.find(s => s.id === form.service_id);
  const serviceCode = currentService?.code as ServiceCode | undefined;

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const applyExtractedBet = (bet: ExtractedBet) => {
    const matchedBookmaker = bet.bookmaker
      ? bookmakers.find(b => b.name.toLowerCase().includes(bet.bookmaker!.toLowerCase()) || bet.bookmaker!.toLowerCase().includes(b.name.toLowerCase()))
      : null;

    setForm((f: any) => ({
      ...f,
      bet_date: bet.bet_date || f.bet_date,
      bet_time: bet.bet_time || f.bet_time,
      competition: bet.competition ?? f.competition,
      match: bet.match ?? f.match,
      market: bet.market ?? f.market,
      selection: bet.selection ?? f.selection,
      player: bet.player ?? f.player,
      odd: bet.odd != null ? String(bet.odd) : f.odd,
      stake: bet.stake != null ? String(bet.stake) : f.stake,
      bet_code: admin ? (bet.bet_code ?? f.bet_code) : f.bet_code,
      bookmaker_id: matchedBookmaker?.id ?? f.bookmaker_id,
    }));
  };

  const analyzeUploadedPrints = async (files: File[]) => {
    const file = files.find(f => f.type.startsWith('image/'));
    if (!file) return;
    setAnalyzingPrint(true);
    try {
      const image = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke('parse-bet-slip', {
        body: { mode: 'slip', image },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      applyExtractedBet(data as ExtractedBet);
      toast.success('Print analisado — dados preenchidos automaticamente');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao analisar o print');
    } finally {
      setAnalyzingPrint(false);
    }
  };

  const applyUnit = (mode: '1'|'2'|'custom', customTarget?: number) => {
    setUnitMode(mode);
    const target = mode === '1' ? settings.unit_1 : mode === '2' ? settings.unit_2 : (customTarget ?? Number(form.target_profit || 0));
    const odd = Number(form.odd);
    const stake = odd > 1 ? calcStakeFromTarget(target, odd) : 0;
    setForm((f: any) => ({ ...f, target_profit: target, target_units: mode === '1' ? 1 : mode === '2' ? 2 : f.target_units, stake }));
  };

  const onOddChange = (v: string) => {
    const odd = Number(v);
    const target = Number(form.target_profit);
    setForm((f: any) => ({ ...f, odd: v, stake: odd > 1 && target ? calcStakeFromTarget(target, odd) : f.stake }));
  };

  const previewTelegram = () => {
    if (!serviceCode || !templates[serviceCode]) return '';
    return fillTemplate(templates[serviceCode], { ...form, confidence: form.confidence, stake: form.stake ? `${form.stake}€` : '' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validação essencial
    const errors: string[] = [];
    if (!form.competition?.trim()) errors.push('Competição');
    if (!form.match?.trim()) errors.push('Jogo');
    if (!form.market?.trim()) errors.push('Mercado');
    if (!form.selection?.trim()) errors.push('Aposta');
    const oddN = Number(form.odd), stakeN = Number(form.stake);
    if (!oddN || oddN <= 1) errors.push('Odd (>1)');
    if (!stakeN || stakeN <= 0) errors.push('Stake (>0)');
    if (admin && !form.service_id) errors.push('Serviço');
    if (errors.length) { toast.error('Preenche: ' + errors.join(', ')); return; }

    setLoading(true);
    const uid = user?.id;
    const telegram_text = admin ? previewTelegram() : null;
    let profit_loss: number | null = null;
    if (form.status === 'green') profit_loss = +(stakeN * (oddN - 1)).toFixed(2);
    else if (form.status === 'red') profit_loss = -stakeN;
    else if (form.status === 'void' || form.status === 'cashout') profit_loss = form.profit_loss !== '' ? Number(form.profit_loss) : 0;

    const payload: any = {
      service_id: admin ? form.service_id : null,
      bet_date: form.bet_date,
      bet_time: form.bet_time,
      competition: form.competition || null,
      match: form.match,
      teams: form.teams || null,
      market: form.market,
      selection: form.selection,
      player: form.player || null,
      odd: oddN,
      stake: stakeN,
      target_units: form.target_units ? Number(form.target_units) : null,
      target_profit: form.target_profit ? Number(form.target_profit) : null,
      confidence: Number(form.confidence),
      bet_code: admin ? (form.bet_code || null) : null,
      bookmaker_id: form.bookmaker_id || null,
      betlabel_link: admin ? (form.betlabel_link || null) : null,
      notes: form.notes || null,
      telegram_text,
      match_minute: admin && form.match_minute ? Number(form.match_minute) : null,
      alert_type: admin ? (form.alert_type || null) : null,
      score_at_entry: admin ? (form.score_at_entry || null) : null,
      status: form.status,
      profit_loss,
      result: form.result || null,
      image_urls: images,
      created_by: uid,
      user_id: uid,
    };
    const { error } = await supabase.from('bets').insert(payload as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Aposta criada.');
    nav(form.status === 'pending' ? '/bets/pending' : '/bets/results');
  };

  const isAlert = serviceCode === 'infection_alert';

  // Formulário simplificado para utilizadores normais
  if (!admin) {
    return (
      <form onSubmit={submit} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Nova aposta</h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider mt-1">☣ Registar aposta pessoal</p>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.bet_date} onChange={e=>update('bet_date', e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={form.bet_time} onChange={e=>update('bet_time', e.target.value)} /></div>
          </div>
          <div><Label>Competição *</Label><Input required value={form.competition} onChange={e=>update('competition', e.target.value)} placeholder="Ex: Primeira Liga" /></div>
          <div><Label>Jogo *</Label><Input required value={form.match} onChange={e=>update('match', e.target.value)} placeholder="Benfica vs Porto" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mercado *</Label><Input required value={form.market} onChange={e=>update('market', e.target.value)} placeholder="+2.5 golos" /></div>
            <div><Label>Aposta *</Label><Input required value={form.selection} onChange={e=>update('selection', e.target.value)} placeholder="Over 2.5" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Odd *</Label><Input required type="number" step="0.01" min="1.01" value={form.odd} onChange={e=>update('odd', e.target.value)} /></div>
            <div><Label>Stake (€) *</Label><Input required type="number" step="0.01" min="0.01" value={form.stake} onChange={e=>update('stake', e.target.value)} /></div>
            <div><Label>Resultado</Label>
              <Select value={form.status} onValueChange={v=>update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="cashout">Cashout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Casa de apostas</Label>
            <Select value={form.bookmaker_id} onValueChange={v=>update('bookmaker_id', v)}>
              <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
              <SelectContent>
                {bookmakers.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notas (opcional)</Label><Textarea value={form.notes} onChange={e=>update('notes', e.target.value)} rows={2} /></div>
          <div>
            <Label className="flex items-center gap-2">
              Prints da aposta
              {analyzingPrint && <span className="inline-flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> IA a preencher</span>}
            </Label>
            {user && <BetImagesUploader userId={user.id} value={images} onChange={setImages} onFilesUploaded={analyzeUploadedPrints} />}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="bg-gradient-neon text-primary-foreground shadow-neon">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar aposta
          </Button>
          <Button type="button" variant="outline" onClick={()=>nav(-1)}>Cancelar</Button>
        </div>
      </form>
    );
  }

  // Formulário admin completo
  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova aposta</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider mt-1">☣ Injetar novo prognóstico</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {services.map(s => {
          const m = SERVICE_META[s.code as ServiceCode];
          if (!m) return null;
          const active = form.service_id === s.id;
          return (
            <button key={s.id} type="button" onClick={() => update('service_id', s.id)}
              className={`glass-card rounded-xl p-3 text-left transition-all ${active ? `ring-2 ${m.ringClass} shadow-neon` : 'hover:border-primary/30'}`}>
              <div className="text-2xl">{s.emoji}</div>
              <div className={`text-sm font-semibold mt-1 ${m.colorClass}`}>{s.name}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Skull className="h-4 w-4 text-primary"/> Detalhes da aposta</h3>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.bet_date} onChange={e=>update('bet_date', e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={form.bet_time} onChange={e=>update('bet_time', e.target.value)} /></div>
          </div>
          <div><Label>Competição *</Label><Input required value={form.competition} onChange={e=>update('competition', e.target.value)} placeholder="Ex: Primeira Liga" /></div>
          <div><Label>Jogo *</Label><Input required value={form.match} onChange={e=>update('match', e.target.value)} placeholder="Benfica vs Porto" /></div>
          <div><Label>Equipas</Label><Input value={form.teams} onChange={e=>update('teams', e.target.value)} placeholder="Casa / Fora" /></div>
          <div><Label>Mercado *</Label><Input required value={form.market} onChange={e=>update('market', e.target.value)} placeholder="+2.5 golos" /></div>
          <div><Label>Aposta *</Label><Input required value={form.selection} onChange={e=>update('selection', e.target.value)} placeholder="Over 2.5" /></div>
          <div><Label>Jogador (se aplicável)</Label><Input value={form.player} onChange={e=>update('player', e.target.value)} /></div>

          {isAlert && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
              <div><Label>Minuto</Label><Input type="number" value={form.match_minute} onChange={e=>update('match_minute', e.target.value)} /></div>
              <div className="col-span-2"><Label>Tipo de alerta</Label>
                <Select value={form.alert_type} onValueChange={v=>update('alert_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pressão">Pressão</SelectItem>
                    <SelectItem value="Golo esperado">Golo esperado</SelectItem>
                    <SelectItem value="Remates">Remates</SelectItem>
                    <SelectItem value="Cantos">Cantos</SelectItem>
                    <SelectItem value="Odds movement">Odds movement</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3"><Label>Score no momento</Label><Input value={form.score_at_entry} onChange={e=>update('score_at_entry', e.target.value)} placeholder="1-0" /></div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">💰 Calculadora de stake</h3>

          <div>
            <Label>Unidade de lucro alvo</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <Button type="button" variant={unitMode==='1'?'default':'outline'} onClick={()=>applyUnit('1')} className={unitMode==='1'?'bg-gradient-neon text-primary-foreground':''}>1u = {settings.unit_1}€</Button>
              <Button type="button" variant={unitMode==='2'?'default':'outline'} onClick={()=>applyUnit('2')} className={unitMode==='2'?'bg-gradient-neon text-primary-foreground':''}>2u = {settings.unit_2}€</Button>
              <Button type="button" variant={unitMode==='custom'?'default':'outline'} onClick={()=>setUnitMode('custom')}>Personalizado</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Lucro alvo (€)</Label>
              <Input type="number" step="0.01" value={form.target_profit}
                onChange={e=>{ setUnitMode('custom'); const t = Number(e.target.value); const odd = Number(form.odd); setForm((f:any)=>({...f, target_profit: e.target.value, stake: odd>1?calcStakeFromTarget(t, odd):f.stake })); }}/>
            </div>
            <div><Label>Odd *</Label><Input required type="number" step="0.01" min="1.01" value={form.odd} onChange={e=>onOddChange(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Stake calculada (€) *</Label>
              <Input required type="number" step="0.01" min="0.01" value={form.stake} onChange={e=>update('stake', e.target.value)} className="font-mono text-lg neon-text" />
            </div>
            <div><Label>Confiança</Label>
              <Select value={String(form.confidence)} onValueChange={v=>update('confidence', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{'💀'.repeat(n)} ({n}/5)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Casa de apostas</Label>
              <Select value={form.bookmaker_id} onValueChange={v=>update('bookmaker_id', v)}>
                <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                <SelectContent>
                  {bookmakers.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Código da aposta</Label><Input value={form.bet_code} onChange={e=>update('bet_code', e.target.value)} /></div>
          </div>

          <div><Label>Link BetLabel</Label><Input value={form.betlabel_link} onChange={e=>update('betlabel_link', e.target.value)} placeholder="https://betlabel..." /></div>
          <div><Label>Notas internas</Label><Textarea value={form.notes} onChange={e=>update('notes', e.target.value)} rows={2} /></div>
          <div>
            <Label className="flex items-center gap-2">
              Prints da aposta
              {analyzingPrint && <span className="inline-flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> IA a preencher</span>}
            </Label>
            {user && <BetImagesUploader userId={user.id} value={images} onChange={setImages} onFilesUploaded={analyzeUploadedPrints} />}
          </div>
        </div>
      </div>

      {serviceCode && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">📱 Preview Telegram</h3>
            <Button type="button" size="sm" variant="outline" onClick={()=>{navigator.clipboard.writeText(previewTelegram()); toast.success('Copiado');}}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-sm bg-background/50 rounded-lg p-4 border border-border">{previewTelegram()}</pre>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="bg-gradient-neon text-primary-foreground shadow-neon">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} Criar aposta
        </Button>
        <Button type="button" variant="outline" onClick={()=>nav(-1)}>Cancelar</Button>
      </div>
    </form>
  );
}
