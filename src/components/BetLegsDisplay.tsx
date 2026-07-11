import type { BetLeg } from '@/lib/services';

interface Props {
  bet: {
    is_multiple?: boolean;
    legs?: BetLeg[] | null;
    odd?: number | string | null;
  };
  compact?: boolean;
}

export default function BetLegsDisplay({ bet, compact }: Props) {
  const legs = Array.isArray(bet.legs) ? bet.legs : [];
  if (!bet.is_multiple || legs.length === 0) return null;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {legs.map((leg, index) => (
        <div key={`${leg.match}-${index}`} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{leg.competition || '—'}</div>
              <div className="font-medium truncate">{index + 1}. {leg.match || 'Seleção'}</div>
              <div className="text-xs text-muted-foreground truncate">{leg.market || '—'} • {leg.selection || '—'}</div>
            </div>
            <div className="shrink-0 text-right font-mono text-primary font-semibold">
              @{Number(leg.odd || 0).toFixed(2)}
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 font-mono">
        <span className="text-xs uppercase tracking-wider text-primary">Odd total</span>
        <span className="text-lg font-bold neon-text">{Number(bet.odd || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}