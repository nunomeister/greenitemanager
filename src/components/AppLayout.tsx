import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Clock, ListChecks, Wallet, MessageSquare, Settings, LogOut, Skull, Menu, X, Sparkles } from 'lucide-react';
import { useAuth, canAdmin, canEdit } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bets/new', icon: PlusCircle, label: 'Nova Aposta', requireEdit: true },
  { to: '/bets/import', icon: Sparkles, label: 'Import IA', requireEdit: true },
  { to: '/bets/pending', icon: Clock, label: 'Pendentes' },
  { to: '/bets/results', icon: ListChecks, label: 'Resultados' },
  { to: '/bankroll', icon: Wallet, label: 'Banca' },
  { to: '/templates', icon: MessageSquare, label: 'Templates' },
  { to: '/settings', icon: Settings, label: 'Definições', requireAdmin: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const items = navItems.filter(i => {
    if (i.requireAdmin) return canAdmin(role);
    if (i.requireEdit) return canEdit(role);
    return true;
  });

  const Sidebar = (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-neon flex items-center justify-center shadow-neon">
            <Skull className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight neon-text">GREENITE</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Manager v1.0</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="px-3 py-2 text-xs">
          <div className="text-muted-foreground truncate">{user?.email}</div>
          <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono uppercase text-[10px] tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {role ?? 'viewer'}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={async () => { await signOut(); navigate('/auth'); }}>
          <LogOut className="h-4 w-4" /> Terminar sessão
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden md:flex">{Sidebar}</div>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-neon flex items-center justify-center">
            <Skull className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold neon-text">GREENITE</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-30 pt-14 bg-background/95 backdrop-blur">
          {Sidebar}
        </div>
      )}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
