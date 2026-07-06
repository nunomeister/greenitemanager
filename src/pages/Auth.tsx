import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Skull, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup' | 'reset'>('login');
  const nav = useNavigate();
  const loc = useLocation() as any;
  const { user } = useAuth();

  useEffect(() => {
    if (user) nav(loc.state?.from?.pathname ?? '/', { replace: true });
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Sessão iniciada.');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: displayName } },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Conta criada. Verifica o email se necessário.');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Verifica o email para recuperar a password.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 virus-grid">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-neon items-center justify-center shadow-neon mb-4 animate-pulse-neon">
            <Skull className="h-9 w-9 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight neon-text">GREENITE MANAGER</h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">☣ Acesso restrito ☣</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Registo</TabsTrigger>
              <TabsTrigger value="reset">Recuperar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-neon text-primary-foreground hover:opacity-90 shadow-neon">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div><Label>Nome</Label><Input required value={displayName} onChange={e=>setDisplayName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-neon text-primary-foreground hover:opacity-90 shadow-neon">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">O primeiro utilizador registado torna-se admin automaticamente.</p>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleReset} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link de recuperação'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
