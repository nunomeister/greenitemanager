import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_META, ServiceCode } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, canAdmin } from '@/hooks/useAuth';

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const { role } = useAuth();
  const isAdmin = canAdmin(role);

  const load = async () => {
    const { data } = await supabase.from('telegram_templates').select('*');
    setTemplates(data ?? []);
    const map: Record<string,string> = {};
    (data ?? []).forEach((t: any) => { map[t.service_code] = t.template_text; });
    setEditing(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (code: string) => {
    const { error } = await supabase.from('telegram_templates').update({ template_text: editing[code] }).eq('service_code', code);
    if (error) toast.error(error.message); else toast.success('Template guardado');
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates Telegram</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">
          Placeholders disponíveis: {'{'}competition{'}'}, {'{'}match{'}'}, {'{'}market{'}'}, {'{'}selection{'}'}, {'{'}player{'}'}, {'{'}odd{'}'}, {'{'}stake{'}'}, {'{'}confidence{'}'}, {'{'}bet_code{'}'}, {'{'}betlabel_link{'}'}, {'{'}profit_loss{'}'}, {'{'}result{'}'}, {'{'}red_reason{'}'}, {'{'}match_minute{'}'}, {'{'}alert_type{'}'}
        </p>
        <p className="text-muted-foreground text-xs font-mono mt-1">
          Texto condicional: {'{#if player}'}Jogador: {'{player}'}{'{/if}'} — só aparece se o campo estiver preenchido nesta aposta.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map(t => {
          const m = SERVICE_META[t.service_code as ServiceCode];
          return (
            <div key={t.id} className={`glass-card rounded-xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex items-center gap-2 font-semibold ${m?.colorClass}`}>
                  <span className="text-xl">{m?.emoji}</span> {m?.name}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=>{navigator.clipboard.writeText(editing[t.service_code]); toast.success('Copiado');}}><Copy className="h-3.5 w-3.5" /></Button>
                  {isAdmin && <Button size="sm" onClick={()=>save(t.service_code)} className="bg-gradient-neon text-primary-foreground"><Save className="h-3.5 w-3.5 mr-1" /> Guardar</Button>}
                </div>
              </div>
              <Textarea
                rows={14}
                value={editing[t.service_code] ?? ''}
                onChange={e=>setEditing(s=>({...s, [t.service_code]: e.target.value}))}
                readOnly={!isAdmin}
                className="font-mono text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
