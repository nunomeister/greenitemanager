import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  requireRole?: AppRole | AppRole[];
}

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!role || !allowed.includes(role)) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="glass-card rounded-xl p-8 text-center max-w-md">
            <div className="text-6xl mb-4">☣️</div>
            <h2 className="text-2xl font-bold mb-2">Acesso restrito</h2>
            <p className="text-muted-foreground">Precisas de permissões de {allowed.join(' ou ')} para aceder a esta área.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
