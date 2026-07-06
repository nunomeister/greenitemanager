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
import { Skull, Loader2, Copy } from 'lucide-react';

interface Service { id: string; code: string; name: string; emoji: string; }
interface Bookmaker { id: string; name: string; }
interface Settings { unit_1: number; unit_2: number; default_betlabel_link: string; }

export default function NewBet() {
  const nav = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>({ unit_1: 50, unit_2: 100, default_betlabel_link: '' });
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<any>({
    service_id: '',
    bet_date: new Date().toISOString().slice(0,10),
    bet_time: new Date().toTimeString().slice(0,5),
    competition: '', match: '', teams: '', market: '', selection: '', player: '',
    odd: '', stake: '', target_profit: '', target_units: '',
    confidence: 3, bet_code: '', bookmaker_id: '', betlabel_link: '',
    notes: '', match_minute: '', alert_type: '', score_at_entry: '',
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
      setForm((f: any) => ({ ...f, betlabel_link: String(cfgMap.default_betlabel_link ?? '') }));
    })();
  }, []);

  const currentService = services.find(s => s.id === form.service_id);
  const serviceCode = currentService?.code as ServiceCode | undefined;
  const meta = serviceCode ? SERVICE_META[serviceCode] : null;

  // Auto-calc stake from target profit + odd
  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const applyUnit = (mode: '1'|'2'|'custom', customTarget?: number) => {
    setUnitMode(mode);
    const target = mode === '1' ? settings.unit_1 : mode === '2' ? settings.unit_2 : customTarget ?? Number(form.target_profit) ?? 0;
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
    return fillTemplate(templates[serviceCode], {
      ...form,
      confidence: form.confidence,
      stake: form.stake ? `${form.stake}€` : '',
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.service_id) { toast.error('Escolhe um serviço'); return; }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const telegram_text = previewTelegram();
    const payload = {
      service_id: form.service_id,
      bet_date: form.bet_date,
      bet_time: form.bet_time,
      competition: form.competition || null,
      match: form.match,
      teams: form.teams || null,
      market: form.market,
      selection: form.selection,
      player: form.player || null,
      odd: Number(form.odd),
      stake: Number(form.stake),
      target_units: form.target_units ? Number(form.target_units) : null,
      target_profit: form.target_profit ? Number(form.target_profit) : null,
      confidence: Number(form.confidence),
      bet_code: form.bet_code || null,
      bookmaker_id: form.bookmaker_id || null,
      betlabel_link: form.betlabel_link || null,
      notes: form.notes || null,
      telegram_text,
      match_minute: form.match_minute ? Number(form.match_minute) : null,
      alert_type: form.alert_type || null,
      score_at_entry: form.score_at_entry || null,
      created_by: userData.user?.id,
      user_id: userData.user?.id,
    };
    const { error } = await supabase.from('bets').insert(payload as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Aposta criada.');
    nav('/bets/pending');
  };

  const isAlert = serviceCode === 'infection_alert';

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova aposta</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider mt-1">☣ Injetar novo prognóstico</p>
      </div>

      {/* Service selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {services.map(s => {
          const m = SERVICE_META[s.code as ServiceCode];
          const active = form.service_id === s.id;
          return (
            <button key={s.id} type="button" onClick={() => update('service_id', s.id)}
              className={`glass-card rounded-xl p-3 text-left transition-all ${active ? `ring-2 ${m?.ringClass} shadow-neon` : 'hover:border-primary/30'}`}>
              <div className="text-2xl">{s.emoji}</div>
              <div className={`text-sm font-semibold mt-1 ${m?.colorClass ?? ''}`}>{s.name}</div>
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
          <div><Label>Competição</Label><Input value={form.competition} onChange={e=>update('competition', e.target.value)} placeholder="Ex: Primeira Liga" /></div>
          <div><Label>Jogo</Label><Input required value={form.match} onChange={e=>update('match', e.target.value)} placeholder="Benfica vs Porto" /></div>
          <div><Label>Equipas</Label><Input value={form.teams} onChange={e=>update('teams', e.target.value)} placeholder="Casa / Fora" /></div>
          <div><Label>Mercado</Label><Input required value={form.market} onChange={e=>update('market', e.target.value)} placeholder="+2.5 golos" /></div>
          <div><Label>Aposta</Label><Input required value={form.selection} onChange={e=>update('selection', e.target.value)} placeholder="Over 2.5" /></div>
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
            <div><Label>Odd</Label><Input required type="number" step="0.01" min="1.01" value={form.odd} onChange={e=>onOddChange(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Stake calculada (€)</Label>
              <Input required type="number" step="0.01" value={form.stake} onChange={e=>update('stake', e.target.value)} className="font-mono text-lg neon-text" />
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
        </div>
      </div>

      {/* Telegram preview */}
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
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar aposta
        </Button>
        <Button type="button" variant="outline" onClick={()=>nav(-1)}>Cancelar</Button>
      </div>
    </form>
  );
}
