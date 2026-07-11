import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth, canAdmin } from '@/hooks/useAuth';
import BetImagesUploader from '@/components/BetImagesUploader';
import type { BetLeg } from '@/lib/services';

interface Props {
  bet: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyLeg = (): BetLeg => ({ competition: '', match: '', market: '', selection: '', odd: '' });

export default function EditBetDialog({ bet, onClose, onSaved }: Props) {
  const { role, user } = useAuth();
  const admin = canAdmin(role);
  const [form, setForm] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookmakers, setBookmakers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bet) { setForm(null); return; }
    setForm({
      bet_date: bet.bet_date ?? '',
      bet_time: bet.bet_time?.slice(0,5) ?? '',
      competition: bet.competition ?? '',
      match: bet.match ?? '',
      market: bet.market ?? '',
      selection: bet.selection ?? '',
      odd: bet.odd ?? '',
      stake: bet.stake ?? '',
      status: bet.status ?? 'pending',
      profit_loss: bet.profit_loss ?? '',
      result: bet.result ?? '',
      notes: bet.notes ?? '',
      service_id: bet.service_id ?? '',
      bet_code: bet.bet_code ?? '',
      bookmaker_id: bet.bookmaker_id ?? '',
      betlabel_link: bet.betlabel_link ?? '',
      telegram_text: bet.telegram_text ?? '',
      image_urls: Array.isArray(bet.image_urls) ? bet.image_urls : [],
      is_multiple: !!bet.is_multiple,
      legs: Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [emptyLeg(), emptyLeg()],
    });
    if (admin) {
      (async () => {
        const [s, b] = await Promise.all([
          supabase.from('services').select('*').eq('active', true).order('sort_order'),
          supabase.from('bookmakers').select('*').eq('active', true),
        ]);
        setServices(s.data ?? []);
        setBookmakers(b.data ?? []);
      })();
    }
  }, [bet, admin]);

  if (!bet || !form) return null;

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const normalizedLegs = () => (form.legs ?? []).map((leg: BetLeg) => ({
    competition: String(leg.competition ?? '').trim(),
    match: String(leg.match ?? '').trim(),
    market: String(leg.market ?? '').trim(),
    selection: String(leg.selection ?? '').trim(),
    odd: Number(leg.odd),
  }));

  const oddTotal = form.is_multiple
    ? normalizedLegs().reduce((total: number, leg: BetLeg) => total * (Number(leg.odd) || 0), 1)
    : Number(form.odd || 0);

  const updateLeg = (index: number, key: keyof BetLeg, value: string) => {
    upd('legs', (form.legs ?? []).map((leg: BetLeg, i: number) => i === index ? { ...leg, [key]: value } : leg));
  };

  const addLeg = () => upd('legs', [...(form.legs ?? []), emptyLeg()]);

  const removeLeg = (index: number) => {
    if ((form.legs ?? []).length <= 2) return;
    upd('legs', (form.legs ?? []).filter((_: BetLeg, i: number) => i !== index));
  };

  const renderLegsEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Seleções da acumulada</Label>
        <Button type="button" size="sm" variant="outline" onClick={addLeg}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>
      {(form.legs ?? []).map((leg: BetLeg, index: number) => (
        <div key={index} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-primary font-mono">Seleção {index + 1}</div>
            <Button type="button" size="sm" variant="ghost" disabled={(form.legs ?? []).length <= 2} onClick={() => removeLeg(index)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div><Label>Competição</Label><Input value={leg.competition ?? ''} onChange={e=>updateLeg(index, 'competition', e.target.value)} /></div>
          <div><Label>Jogo</Label><Input value={leg.match ?? ''} onChange={e=>updateLeg(index, 'match', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mercado</Label><Input value={leg.market ?? ''} onChange={e=>updateLeg(index, 'market', e.target.value)} /></div>
            <div><Label>Aposta</Label><Input value={leg.selection ?? ''} onChange={e=>updateLeg(index, 'selection', e.target.value)} /></div>
          </div>
          <div><Label>Odd</Label><Input type="number" step="0.01" min="1.01" value={leg.odd ?? ''} onChange={e=>updateLeg(index, 'odd', e.target.value)} /></div>
        </div>
      ))}
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-center justify-between gap-3">
        <Label>Odd total</Label>
        <div className="font-mono text-2xl font-bold neon-text">{oddTotal > 0 ? oddTotal.toFixed(2) : '—'}</div>
      </div>
    </div>
  );

  const save = async () => {
    const cleanLegs = normalizedLegs();
    const errors: string[] = [];
    if (form.is_multiple) {
      if (cleanLegs.length < 2) errors.push('mínimo 2 seleções');
      cleanLegs.forEach((leg: BetLeg, index: number) => {
        if (!leg.competition || !leg.match || !leg.market || !leg.selection || !leg.odd || Number(leg.odd) <= 1) errors.push(`seleção ${index + 1}`);
      });
      if (!oddTotal || oddTotal <= 1) errors.push('odd total');
    }
    if (!Number(form.stake) || Number(form.stake) <= 0) errors.push('stake');
    if (errors.length) { toast.error('Corrige: ' + errors.join(', ')); return; }

    setSaving(true);
    const summary = form.is_multiple ? {
      competition: 'Acumulada',
      match: `Acumulada (${cleanLegs.length} seleções)`,
      market: 'Acumulada',
      selection: cleanLegs.map((leg: BetLeg) => `${leg.match}: ${leg.selection}`).join(' + '),
    } : null;
    const payload: any = {
      bet_date: form.bet_date,
      bet_time: form.bet_time || null,
      competition: form.is_multiple ? summary?.competition : (form.competition || null),
      match: form.is_multiple ? summary?.match : form.match,
      market: form.is_multiple ? summary?.market : form.market,
      selection: form.is_multiple ? summary?.selection : form.selection,
      odd: form.is_multiple ? oddTotal : Number(form.odd),
      stake: Number(form.stake),
      status: form.status,
      profit_loss: form.profit_loss === '' ? null : Number(form.profit_loss),
      result: form.result || null,
      notes: form.notes || null,
      image_urls: form.image_urls ?? [],
      is_multiple: !!form.is_multiple,
      legs: form.is_multiple ? cleanLegs : [],
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    };
    if (admin) {
      payload.service_id = form.service_id || null;
      payload.bet_code = form.bet_code || null;
      payload.bookmaker_id = form.bookmaker_id || null;
      payload.betlabel_link = form.betlabel_link || null;
      payload.telegram_text = form.telegram_text || null;
    }
    const { error } = await supabase.from('bets').update(payload).eq('id', bet.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Aposta atualizada');
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!bet} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar aposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.bet_date} onChange={e=>upd('bet_date', e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={form.bet_time} onChange={e=>upd('bet_time', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-1">
            <Button type="button" variant={!form.is_multiple ? 'default' : 'ghost'} onClick={() => upd('is_multiple', false)} className={!form.is_multiple ? 'bg-gradient-neon text-primary-foreground' : ''}>Aposta simples</Button>
            <Button type="button" variant={form.is_multiple ? 'default' : 'ghost'} onClick={() => upd('is_multiple', true)} className={form.is_multiple ? 'bg-gradient-neon text-primary-foreground' : ''}>Aposta acumulada</Button>
          </div>
          {form.is_multiple ? renderLegsEditor() : (
            <>
              <div><Label>Competição</Label><Input value={form.competition} onChange={e=>upd('competition', e.target.value)} /></div>
              <div><Label>Jogo</Label><Input value={form.match} onChange={e=>upd('match', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Mercado</Label><Input value={form.market} onChange={e=>upd('market', e.target.value)} /></div>
                <div><Label>Aposta</Label><Input value={form.selection} onChange={e=>upd('selection', e.target.value)} /></div>
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>{form.is_multiple ? 'Odd total' : 'Odd'}</Label><Input readOnly={form.is_multiple} type="number" step="0.01" value={form.is_multiple ? (oddTotal > 0 ? oddTotal.toFixed(2) : '') : form.odd} onChange={e=>upd('odd', e.target.value)} className={form.is_multiple ? 'font-mono neon-text' : ''} /></div>
            <div><Label>Stake (€)</Label><Input type="number" step="0.01" value={form.stake} onChange={e=>upd('stake', e.target.value)} /></div>
            <div><Label>Estado</Label>
              <Select value={form.status} onValueChange={v=>upd('status', v)}>
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
          {form.status !== 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lucro / Prejuízo (€)</Label><Input type="number" step="0.01" value={form.profit_loss} onChange={e=>upd('profit_loss', e.target.value)} /></div>
              <div><Label>Resultado final</Label><Input value={form.result} onChange={e=>upd('result', e.target.value)} /></div>
            </div>
          )}
          <div><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={e=>upd('notes', e.target.value)} /></div>

          <div>
            <Label>Prints da aposta</Label>
            {user && (
              <BetImagesUploader
                userId={bet.user_id ?? user.id}
                value={form.image_urls ?? []}
                onChange={(urls)=>upd('image_urls', urls)}
                canEdit={admin || bet.user_id === user.id}
              />
            )}
          </div>


          {admin && (
            <div className="pt-3 mt-2 border-t border-border space-y-3">
              <div className="text-xs uppercase tracking-widest text-primary font-mono">Campos administrativos</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Serviço</Label>
                  <Select value={form.service_id || 'none'} onValueChange={v=>upd('service_id', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem serviço —</SelectItem>
                      {services.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Casa de apostas</Label>
                  <Select value={form.bookmaker_id || 'none'} onValueChange={v=>upd('bookmaker_id', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {bookmakers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Código da aposta</Label><Input value={form.bet_code} onChange={e=>upd('bet_code', e.target.value)} /></div>
                <div><Label>Link BetLabel</Label><Input value={form.betlabel_link} onChange={e=>upd('betlabel_link', e.target.value)} /></div>
              </div>
              <div><Label>Texto Telegram</Label><Textarea rows={3} value={form.telegram_text} onChange={e=>upd('telegram_text', e.target.value)} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-neon text-primary-foreground">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Guardar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
