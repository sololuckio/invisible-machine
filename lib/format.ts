/** Number formatting for readouts. All formatters are locale-stable (en-US). */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtHours(h: number): string {
  if (h >= 72) return `${(h / 24).toFixed(1)} d`;
  if (h >= 10) return `${Math.round(h)} h`;
  return `${h.toFixed(1)} h`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

export function fmtRate(perHour: number): string {
  return `${Math.round(perHour)}/h`;
}

export function fmtMult(n: number): string {
  return `${n.toFixed(1)}×`;
}
