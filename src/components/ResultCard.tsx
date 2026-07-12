import { forwardRef } from 'react';
import { SERVICE_META, ServiceCode, getBetOddTotal } from '@/lib/services';

interface Props {
  bet: any;
  status: 'green' | 'red' | 'void' | 'cashout';
  profit: number;
  closingPhrase?: string;
}

const STATUS_META: Record<string, { label: string; color: string; glow: string; emoji: string }> = {
  green:   { label: 'GREEN',   color: '#22ff88', glow: '0 0 40px rgba(34,255,136,0.6)', emoji: '✅' },
  red:     { label: 'RED',     color: '#ff2b5c', glow: '0 0 40px rgba(255,43,92,0.6)',  emoji: '❌' },
  void:    { label: 'VOID',    color: '#9ca3af', glow: '0 0 40px rgba(156,163,175,0.4)', emoji: '⚪' },
  cashout: { label: 'CASHOUT', color: '#f5c542', glow: '0 0 40px rgba(245,197,66,0.5)', emoji: '💵' },
};

const ResultCard = forwardRef<HTMLDivElement, Props>(({ bet, status, profit, closingPhrase }, ref) => {
  const meta = STATUS_META[status];
  const service = SERVICE_META[bet?.service?.code as ServiceCode];
  const oddTotal = getBetOddTotal(bet);
  const isMultiple = !!bet?.is_multiple && Array.isArray(bet?.legs) && bet.legs.length > 0;
  const profitStr = `${profit >= 0 ? '+' : ''}${Number(profit).toFixed(2)}€`;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        padding: 56,
        background: 'radial-gradient(circle at 20% 0%, #0a1a10 0%, #050505 60%, #000 100%)',
        border: `3px solid ${meta.color}`,
        borderRadius: 28,
        boxShadow: meta.glow,
        fontFamily: "'JetBrains Mono', 'Space Grotesk', ui-monospace, monospace",
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, letterSpacing: 6, color: '#22ff88', fontWeight: 700, textTransform: 'uppercase' }}>
          ☣ Greenite Manager
        </div>
        {service && (
          <div style={{
            padding: '10px 20px', border: `2px solid ${meta.color}`, borderRadius: 999,
            fontSize: 20, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.03)',
          }}>
            {service.emoji} {service.name}
          </div>
        )}
      </div>

      {/* status big */}
      <div style={{ textAlign: 'center', margin: '20px 0 32px' }}>
        <div style={{ fontSize: 24, letterSpacing: 8, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Resultado</div>
        <div style={{
          fontSize: 140, lineHeight: 1, fontWeight: 900, color: meta.color,
          textShadow: `0 0 30px ${meta.color}`, letterSpacing: 4,
        }}>
          {meta.emoji} {meta.label}
        </div>
      </div>

      {/* match / event */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ fontSize: 18, color: '#888', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>
          {bet?.competition || '—'}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 20, lineHeight: 1.15 }}>
          {isMultiple ? `Acumulada · ${bet.legs.length} seleções` : (bet?.match || '—')}
        </div>

        {isMultiple ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bet.legs.slice(0, 6).map((leg: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: '#ddd' }}>
                <span style={{ opacity: 0.9 }}>{i + 1}. {leg.match || 'Jogo'} — <b style={{ color: '#fff' }}>{leg.selection || '—'}</b></span>
                <span style={{ color: '#22ff88', fontWeight: 700 }}>@ {Number(leg.odd || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 40, fontSize: 24 }}>
            <div>
              <div style={{ color: '#888', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Mercado</div>
              <div style={{ fontWeight: 700 }}>{bet?.market || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Seleção</div>
              <div style={{ fontWeight: 700 }}>{bet?.selection || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'rgba(34,255,136,0.06)', border: '1px solid rgba(34,255,136,0.3)', borderRadius: 14, padding: 22 }}>
          <div style={{ color: '#888', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Odd</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#22ff88', textShadow: '0 0 20px rgba(34,255,136,0.5)' }}>
            {Number(oddTotal || bet?.odd || 0).toFixed(2)}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 22 }}>
          <div style={{ color: '#888', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Stake</div>
          <div style={{ fontSize: 44, fontWeight: 900 }}>{Number(bet?.stake || 0).toFixed(2)}€</div>
        </div>
        <div style={{
          background: `${meta.color}12`, border: `1px solid ${meta.color}55`, borderRadius: 14, padding: 22,
        }}>
          <div style={{ color: '#888', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Lucro</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: meta.color, textShadow: `0 0 20px ${meta.color}` }}>
            {profitStr}
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, textAlign: 'center', color: '#888', fontSize: 20, letterSpacing: 2 }}>
        {closingPhrase || '☣ INFECT THE ODDS · GREENITE'}
      </div>
    </div>
  );
});

ResultCard.displayName = 'ResultCard';
export default ResultCard;
