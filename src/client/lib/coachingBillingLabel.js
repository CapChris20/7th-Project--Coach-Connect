/** Client coaching subscription pill copy (dashboard trainer card). */

export function formatMonthlyRateLabel(rate) {
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  const dollars = n >= 100 ? n / 100 : n;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}/mo`;
}

/**
 * @returns {{ label: string, tone: 'success'|'warning'|'error'|'neutral' }}
 */
export function getClientCoachingBillingDisplay({
  paymentStatus = 'inactive',
  monthlyRate = null,
  trainerPricingPerMonth = null,
} = {}) {
  const effectiveRate = monthlyRate ?? trainerPricingPerMonth ?? null;
  const rateLabel = formatMonthlyRateLabel(effectiveRate);
  const status = paymentStatus || 'inactive';

  if (status === 'active' && rateLabel) return { label: `Coaching · ${rateLabel}`, tone: 'success' };
  if (status === 'past_due') {
    return { label: rateLabel ? `Past due · ${rateLabel}` : 'Coaching · Past due', tone: 'error' };
  }
  if (status === 'payment_required') {
    return {
      label: rateLabel ? `Set up · ${rateLabel}` : 'Coaching · Payment required',
      tone: 'warning',
    };
  }
  if (rateLabel) return { label: `Set up · ${rateLabel}`, tone: 'warning' };
  return { label: 'Coaching subscription', tone: 'neutral' };
}
