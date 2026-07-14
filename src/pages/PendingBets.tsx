import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode, BET_STATUS_META, fillTemplate } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, X, Ban, RotateCcw, Edit2, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { useAuth, canAdmin } from '@/hooks/useAuth';
import EditBetDialog from '@/components/EditBetDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import BetLegsDisplay from '@/components/BetLegsDisplay';
import ResultCard from '@/components/ResultCard';

export default function PendingBets() {
  const [bets, setBets] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<any | null>(null);
  const [closeStatus, setCloseStatus] = useState<'green' | 'red' | 'void' | 'cashout'>('green');
  const [closeProfit, setCloseProfit] = useState('');
  const [closeResult, setCloseResult] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const { role } = useAuth();
  const admin = canAdmin(role);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [closingPhrase, setClosingPhrase] = useState('');
  const [printBet, setPrintBet] = useState<any | null>(null);
  // useRef em vez de useState: fica disponível de forma síncrona assim que o
  // <ResultCard> monta, sem depender de um segundo ciclo de render do React.
  const resultCardRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const [b, t, s] = await Promise.all([
      supabase.from('bets').select('*, service:services(code,name,emoji), bookmaker:bookmakers(name)').eq('status', 'pending').order('bet_date', { ascending: false }),
      supabase.from('telegram_templates').select('service_code, template_text'),
      supabase.from('settings').select('key, value').eq('key', 'closing_phrase').maybeSingle(),
    ]);
    setBets(b.data ?? []);
    const tpl: Record<string,string> = {};
    (t.data ?? []).forEach((r: any) => { tpl[r.service_code] = r.template_text; });
    setTemplates(tpl);
    if (s.data?.value) setClosingPhrase(typeof s.data.value === 'string' ? s.data.value : JSON.parse(JSON.stringify(s.data.value)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Depois de "printBet" ser definido, o ResultCard escondido já está montado no DOM
  // (o React garante isto de forma síncrona antes deste efeito correr) — esperamos
  // 2 frames para garantir que o browser já pintou, e só depois capturamos a imagem.
  useEffect(() => {
    if (!printBet) return;
    let cancelled = false;
    (async () => {
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (cancelled) return;
        if (!resultCardRef.current) {
          throw new Error('ResultCard não ficou disponível a tempo');
        }
        const dataUrl = await toPng(resultCardRef.current, { pixelRatio: 2 });
        const imageBase64 = dataUrl.split(',')[1];
        const caption = `${printBet.match ?? ''}\n${printBet.status === 'green' ? '✅ GREEN' : '❌ RED'}`;
        toast.loading('A publicar no Telegram...', { id: 'tg-post' });

        const { data, error } = await supabase.functions.invoke('send-telegram-result', {
          body: { imageBase64, caption, status: printBet.status },
        });

        console.log('Resposta Telegram:', { data, error });

        if (error) {
          throw new Error(error.message || 'Erro ao chamar a função do Telegram');
        }
        if (!data?.ok || !data?.photo) {
          throw new Error(
            data?.error ||
            data?.detail?.description ||
            JSON.stringify(data) ||
            'O Telegram não confirmou o envio'
          );
        }

        toast.success('Publicado no canal ✅', { id: 'tg-post' });
      } catch (e: any) {
        console.error('Erro Telegram:', e);
        toast.error(
          `Falha ao gerar/publicar: ${e?.message ?? String(e)}`,
          { id: 'tg-post', duration: 10000 }
        );
      } finally {
        if (!cancelled) setPrintBet(null);
      }
    })();
    return () => { cancelled = true; };
  }, [printBet]);

  const openClose = (bet: any, status: 'green'|'red'|'void'|'cashout') => {
    setClosing(bet);
    setCloseStatus(status);
    setCloseProfit(status === 'green' ? String(((bet.odd - 1) * bet.stake).toFixed(2)) : status === 'red' ? String((-bet.stake).toFixed(2)) : '0');
    setCloseResult(''); setCloseReason('');
  };

  const confirmClose = async () => {
    if (!closing) return;
    const update: any = { status: closeStatus, profit_loss: Number(closeProfit), result: closeResult || null };
    if (closeStatus === 'red') update.red_reason = closeReason || null;
    const { error } = await supabase.from('bets').update(update).eq('id', closing.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Aposta marcada como ${closeStatus}`);
    // Publicação automática no Telegram — só para green/red (não void/cashout).
    if (closeStatus === 'green' || closeStatus === 'red') {
      setPrintBet({ ...closing, ...update });
    }
    setClosing(null);
    load();
  };

  const duplicate = async (bet: any) => {
    const { id, created_at, updated_at, closed_at, status, profit_loss, result, red_reason, ...rest } = bet;
    delete rest.service; delete rest.bookmaker;
    const { error } = await supabase.from('bets').insert({ ...rest, status: 'pending' });
    if (error) toast.error(error.message); else { toast.success('Aposta duplicada'); load(); }
  };

  const copyTelegram = (bet: any) => {
    const code = bet.service?.code as ServiceCode;
    const tpl = templates[code];
    if (!tpl) { toast.error('Template não encontrado'); return; }
    const text = fillTemplate(tpl, { ...bet, confidence: bet.confidence, stake: `${bet.stake}€` });
    navigator.clipboard.writeText(text);
    toast.success('Texto Telegram copiado');
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Apostas pendentes</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">{bets.length} apostas em curso</p>
      </div>

      {bets.length === 0 && <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Sem apostas pendentes.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bets.map(bet => {
          const m = SERVICE_META[bet.service?.code as ServiceCode];
          return (
            <div key={bet.id} className={`glass-card rounded-xl p-5 border-l-4`} style={{ borderLeftColor: `hsl(var(--${bet.service?.code === 'meisters_pick' ? 'gold' : bet.service?.code === 'infection_alert' ? 'toxic' : 'primary'}))` }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${m?.badgeClass}`}>
                    {bet.service?.emoji} {bet.service?.name}
                  </div>
                  <h3 className="text-lg font-bold mt-2">{bet.match}</h3>
                  <div className="text-sm text-muted-foreground">{bet.competition} • {bet.bet_date} {bet.bet_time?.slice(0,5)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground font-mono">Odd</div>
                  <div className="text-2xl font-bold neon-text font-mono">{Number(bet.odd).toFixed(2)}</div>
                </div>
              </div>

              {bet.is_multiple ? (
                <div className="mb-3 space-y-3">
                  <BetLegsDisplay bet={bet} />
                  <div className="text-sm"><div className="text-xs text-muted-foreground">Stake</div><div className="font-medium font-mono">{Number(bet.stake).toFixed(2)}€</div></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div><div className="text-xs text-muted-foreground">Mercado</div><div className="font-medium">{bet.market}</div></div>
                  <div><div className="text-xs text-muted-foreground">Aposta</div><div className="font-medium">{bet.selection}</div></div>
                  <div><div className="text-xs text-muted-foreground">Stake</div><div className="font-medium font-mono">{Number(bet.stake).toFixed(2)}€</div></div>
                </div>
              )}

              {bet.confidence && <div className="mb-3 text-sm">Confiança: {'💀'.repeat(bet.confidence)}</div>}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Button size="sm" className="bg-success/20 hover:bg-success/30 text-success border border-success/40" onClick={()=>openClose(bet, 'green')}><Check className="h-3.5 w-3.5 mr-1" />Green</Button>
                <Button size="sm" className="bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/40" onClick={()=>openClose(bet, 'red')}><X className="h-3.5 w-3.5 mr-1" />Red</Button>
                <Button size="sm" variant="outline" onClick={()=>openClose(bet, 'void')}><Ban className="h-3.5 w-3.5 mr-1" />Void</Button>
                <Button size="sm" variant="outline" onClick={()=>openClose(bet, 'cashout')}>💵 Cashout</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={()=>setEditing(bet)}><Edit2 className="h-3.5 w-3.5 mr-1" />Editar</Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={()=>setDeleting(bet)}><Trash2 className="h-3.5 w-3.5 mr-1" />Apagar</Button>
                {admin && <Button size="sm" variant="ghost" onClick={()=>copyTelegram(bet)}><Copy className="h-3.5 w-3.5 mr-1" />Telegram</Button>}
                {admin && <Button size="sm" variant="ghost" onClick={()=>duplicate(bet)}><RotateCcw className="h-3.5 w-3.5 mr-1" />Duplicar</Button>}
              </div>
            </div>
          );
        })}
      </div>

      <EditBetDialog bet={editing} onClose={()=>setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o)=>!o && setDeleting(null)}
        title="Apagar aposta?"
        description={`Tens a certeza que queres apagar esta aposta?\n\n${deleting?.match ?? ''}\n\nEsta ação não pode ser anulada.`}
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

      <Dialog open={!!closing} onOpenChange={(o)=>!o && setClosing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar aposta como <span className="uppercase neon-text">{closeStatus}</span></DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Lucro/Prejuízo (€)</Label><Input type="number" step="0.01" value={closeProfit} onChange={e=>setCloseProfit(e.target.value)} /></div>
            <div><Label>Resultado final</Label><Input value={closeResult} onChange={e=>setCloseResult(e.target.value)} placeholder="2-1" /></div>
            {closeStatus === 'red' && <div><Label>Motivo do red</Label><Textarea value={closeReason} onChange={e=>setCloseReason(e.target.value)} rows={3} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setClosing(null)}>Cancelar</Button>
            <Button onClick={confirmClose} className="bg-gradient-neon text-primary-foreground">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card escondido, usado apenas para gerar o print enviado ao Telegram */}
      {printBet && (
        <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }}>
          <ResultCard ref={resultCardRef} bet={printBet} closingPhrase={closingPhrase} />
        </div>
      )}
    </div>
  );
}
