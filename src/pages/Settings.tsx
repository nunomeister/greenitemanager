import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [bankroll, setBankroll] = useState<any>({ initial_amount: 0, current_amount: 0 });
  const [bookmakers, setBookmakers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newBookie, setNewBookie] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [s, br, bk, pr, ur] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('bankroll').select('*').maybeSingle(),
      supabase.from('bookmakers').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    const map: any = {};
    (s.data ?? []).forEach((r: any) => { map[r.key] = r.value; });
    setSettings(map);
    setBankroll(br.data ?? { initial_amount: 0, current_amount: 0 });
    setBookmakers(bk.data ?? []);
    const byUser: Record<string, string[]> = {};
    (ur.data ?? []).forEach((r: any) => { (byUser[r.user_id] ??= []).push(r.role); });
    setUsers((pr.data ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveSetting = async (key: string, value: any) => {
    const { error } = await supabase.from('settings').update({ value }).eq('key', key);
    if (error) toast.error(error.message); else toast.success('Guardado');
  };

  const saveBankroll = async () => {
    const { error } = await supabase.from('bankroll').update({ initial_amount: bankroll.initial_amount, current_amount: bankroll.current_amount }).eq('singleton', true);
    if (error) toast.error(error.message); else toast.success('Banca atualizada');
  };

  const addBookie = async () => {
    if (!newBookie.trim()) return;
    const { error } = await supabase.from('bookmakers').insert({ name: newBookie.trim() });
    if (error) toast.error(error.message); else { setNewBookie(''); load(); }
  };
  const removeBookie = async (id: string) => {
    const { error } = await supabase.from('bookmakers').delete().eq('id', id);
    if (error) toast.error(error.message); else load();
  };

  const changeUserRole = async (userId: string, role: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: role as 'admin' | 'editor' | 'viewer' });
    toast.success('Função atualizada');
    load();
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Definições</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">☣ Configuração da infeção</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Unidades e stakes</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>1 unidade (€)</Label><Input type="number" value={settings.unit_1 ?? 50} onChange={e=>setSettings(s=>({...s, unit_1: Number(e.target.value)}))} onBlur={e=>saveSetting('unit_1', Number(e.target.value))} /></div>
            <div><Label>2 unidades (€)</Label><Input type="number" value={settings.unit_2 ?? 100} onChange={e=>setSettings(s=>({...s, unit_2: Number(e.target.value)}))} onBlur={e=>saveSetting('unit_2', Number(e.target.value))} /></div>
          </div>
          <div><Label>Link BetLabel padrão</Label><Input value={settings.default_betlabel_link ?? ''} onChange={e=>setSettings(s=>({...s, default_betlabel_link: e.target.value}))} onBlur={e=>saveSetting('default_betlabel_link', e.target.value)} /></div>
          <div><Label>Canal Telegram</Label><Input value={settings.telegram_channel ?? ''} onChange={e=>setSettings(s=>({...s, telegram_channel: e.target.value}))} onBlur={e=>saveSetting('telegram_channel', e.target.value)} /></div>
          <div><Label>Frase final</Label><Input value={settings.closing_phrase ?? ''} onChange={e=>setSettings(s=>({...s, closing_phrase: e.target.value}))} onBlur={e=>saveSetting('closing_phrase', e.target.value)} /></div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Banca</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Banca inicial</Label><Input type="number" value={bankroll.initial_amount} onChange={e=>setBankroll((b:any)=>({...b, initial_amount: Number(e.target.value)}))} /></div>
            <div><Label>Banca atual</Label><Input type="number" value={bankroll.current_amount} onChange={e=>setBankroll((b:any)=>({...b, current_amount: Number(e.target.value)}))} /></div>
          </div>
          <Button onClick={saveBankroll} className="bg-gradient-neon text-primary-foreground"><Save className="h-4 w-4 mr-2" /> Guardar banca</Button>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Casas de apostas</h3>
          <div className="flex gap-2">
            <Input placeholder="Nova casa..." value={newBookie} onChange={e=>setNewBookie(e.target.value)} />
            <Button onClick={addBookie}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {bookmakers.map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30">
                <span>{b.name}</span>
                <Button size="sm" variant="ghost" onClick={()=>removeBookie(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Utilizadores</h3>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-muted/30">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.display_name || '—'}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.id.slice(0,8)}</div>
                </div>
                <Select value={u.roles[0] ?? 'viewer'} onValueChange={v=>changeUserRole(u.id, v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
