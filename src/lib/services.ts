export type ServiceCode = 'meisters_pick' | 'greenite_detected' | 'infection_alert';

export const SERVICE_META: Record<ServiceCode, { name: string; emoji: string; colorClass: string; badgeClass: string; ringClass: string }> = {
  meisters_pick:      { name: "Meister's Pick",     emoji: '🎩', colorClass: 'text-gold',            badgeClass: 'bg-gold/15 text-gold border-gold/30',            ringClass: 'ring-gold/40' },
  greenite_detected:  { name: 'Greenite Detected',  emoji: '🦠', colorClass: 'text-primary',         badgeClass: 'bg-primary/15 text-primary border-primary/30',    ringClass: 'ring-primary/40' },
  infection_alert:    { name: 'Infection Alert',    emoji: '☣️', colorClass: 'text-toxic',           badgeClass: 'bg-toxic/15 text-toxic border-toxic/30',          ringClass: 'ring-toxic/40' },
};

export const BET_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-muted text-muted-foreground border-border' },
  green:   { label: 'Green',    className: 'bg-success/20 text-success border-success/40' },
  red:     { label: 'Red',      className: 'bg-destructive/20 text-destructive border-destructive/40' },
  void:    { label: 'Void',     className: 'bg-muted text-muted-foreground border-border' },
  cashout: { label: 'Cashout',  className: 'bg-warning/20 text-warning border-warning/40' },
};

export function calcStakeFromTarget(targetProfit: number, odd: number): number {
  if (!odd || odd <= 1 || !targetProfit) return 0;
  return +(targetProfit / (odd - 1)).toFixed(2);
}

export function fillTemplate(tpl: string, bet: Record<string, any>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = bet[k];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  });
}
