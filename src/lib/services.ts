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

export type BetLeg = {
  competition?: string | null;
  match?: string | null;
  market?: string | null;
  selection?: string | null;
  odd?: number | string | null;
};

export function calcStakeFromTarget(targetProfit: number, odd: number): number {
  if (!odd || odd <= 1 || !targetProfit) return 0;
  return +(targetProfit / (odd - 1)).toFixed(2);
}

export function formatBetLegs(legs: BetLeg[] = []): string {
  return legs.map((leg, index) => {
    const odd = Number(leg.odd || 0);
    return `${index + 1}. ${leg.match || 'Jogo'} — ${leg.market || 'Mercado'} — ${leg.selection || 'Seleção'} @ ${odd ? odd.toFixed(2) : '—'}`;
  }).join('\n');
}

export function getBetOddTotal(bet: Record<string, any>): number {
  if (bet.odd) return Number(bet.odd);
  const legs = Array.isArray(bet.legs) ? bet.legs : [];
  return legs.reduce((total: number, leg: BetLeg) => total * (Number(leg.odd) || 1), 1);
}

export function enrichBetForTemplate(bet: Record<string, any>): Record<string, any> {
  if (!bet.is_multiple) return bet;
  const legs = Array.isArray(bet.legs) ? bet.legs as BetLeg[] : [];
  if (legs.length === 0) return bet;

  const legsList = formatBetLegs(legs);
  const oddTotal = getBetOddTotal(bet);
  const selectionSummary = legs.map((leg) => `${leg.match || 'Jogo'}: ${leg.selection || 'Seleção'}`).join(' + ');

  return {
    ...bet,
    competition: bet.competition || 'Acumulada',
    match: `Acumulada (${legs.length} seleções)\n${legsList}`,
    market: 'Acumulada',
    selection: selectionSummary,
    odd: oddTotal ? oddTotal.toFixed(2) : bet.odd,
    odd_total: oddTotal ? oddTotal.toFixed(2) : bet.odd,
    legs_list: legsList,
  };
}

export function fillTemplate(tpl: string, bet: Record<string, any>): string {
  const data = enrichBetForTemplate(bet);

  // Blocos condicionais: {#if campo}texto{/if} — o texto só aparece se o campo
  // tiver um valor preenchido nesta aposta (ex: nem todas as apostas têm "player").
  let result = tpl.replace(/\{#if (\w+)\}([\s\S]*?)\{\/if\}\n?/g, (_, key, content) => {
    const v = data[key];
    const hasValue = v !== null && v !== undefined && v !== '';
    return hasValue ? content : '';
  });

  result = result.replace(/\{(\w+)\}/g, (_, k) => {
    const v = data[k];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  });

  return result;
}
