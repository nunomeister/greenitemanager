import { forwardRef } from 'react';
import { SERVICE_META, ServiceCode } from '@/lib/services';

interface ResultCardProps {
  bet: any;
  closingPhrase?: string;
}

const eur = (n: number) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}€`;

// Card usado para gerar o print automático enviado para o Telegram.
// Mantido fora do fluxo normal de layout (ver uso em PendingBets.tsx).
const ResultCard = forwardRef<HTMLDivElement, ResultCardProps>(({ bet, closingPhrase }, ref) => {
  const m = SERVICE_META[bet.service?.code as ServiceCode];
  const isGreen = bet.status === 'green';
  const isRed = bet.status === 'red';
  const statusLabel = bet.status === 'green' ? 'GREEN ✅' : bet.status === 'red' ? 'RED ❌' : bet.status === 'void' ? 'VOID ⚪' : 'CASHOUT 💵';
  const statusColor = isGreen ? '#39ff14' : isRed ? '#ff3b3b' : '#b8b8b8';

  return (
    <div
      ref={ref}
      style={{
        width: 600,
        padding: 32,
        background: 'linear-gradient(160deg, #0a0e0a 0%, #0f1a10 100%)',
        border: `2px solid ${statusColor}55`,
        borderRadius: 20,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#f2f2f2',
        boxShadow: `0 0 40px ${statusColor}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 700, letterSpacing: 1,
          padding: '4px 12px', borderRadius: 999, border: '1px solid #39ff1455', color: '#39ff14',
        }}>
          {m?.emoji ?? '☣️'} {bet.service?.name ?? 'Greenite'}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>@greenitehub</div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{bet.match}</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>
        {bet.competition} {bet.market ? `• ${bet.market}` : ''} {bet.selection ? `• ${bet.selection}` : ''}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#ffffff08', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Odd</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#39ff14' }}>{Number(bet.odd).toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: '#ffffff08', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Stake</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(bet.stake).toFixed(2)}€</div>
        </div>
      </div>

      <div style={{
        textAlign: 'center', padding: '20px 0', borderRadius: 14,
        background: `${statusColor}18`, border: `1px solid ${statusColor}55`, marginBottom: 16,
      }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: statusColor, letterSpacing: 1 }}>{statusLabel}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: statusColor, marginTop: 4 }}>{eur(Number(bet.profit_loss ?? 0))}</div>
      </div>

      {closingPhrase && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#777', fontStyle: 'italic' }}>{closingPhrase}</div>
      )}
    </div>
  );
});

ResultCard.displayName = 'ResultCard';

export default ResultCard;
