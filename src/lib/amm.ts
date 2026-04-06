import Decimal from "decimal.js";

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

/** LMSR: C(q) = b * ln(sum_i exp(q_i/b)) */
export function lmsrCost(q: Decimal[], b: Decimal): Decimal {
  let sum = new Decimal(0);
  for (const qi of q) {
    sum = sum.plus(qi.div(b).exp());
  }
  return b.mul(sum.ln());
}

/** Precios p_i = exp(q_i/b) / sum_j exp(q_j/b) */
export function lmsrPrices(q: Decimal[], b: Decimal): Decimal[] {
  const exps = q.map((qi) => qi.div(b).exp());
  const sum = exps.reduce((a, e) => a.plus(e), new Decimal(0));
  if (sum.isZero()) return q.map(() => new Decimal(1).div(q.length));
  return exps.map((e) => e.div(sum));
}

/** Coste marginal de comprar delta unidades en el outcome `outcomeIdx`. */
export function lmsrBuyCost(
  q: Decimal[],
  b: Decimal,
  outcomeIdx: number,
  delta: Decimal
): Decimal {
  const before = lmsrCost(q, b);
  const q2 = q.map((x) => new Decimal(x));
  q2[outcomeIdx] = q2[outcomeIdx].plus(delta);
  const after = lmsrCost(q2, b);
  return after.minus(before);
}

/**
 * Encuentra delta >= 0 tal que el coste LMSR sea ~ presupuesto `maxPay`.
 */
export function findDeltaForBudget(
  q: Decimal[],
  b: Decimal,
  outcomeIdx: number,
  maxPay: Decimal,
  iterations = 80
): Decimal {
  if (maxPay.lte(0)) return new Decimal(0);

  let lo = new Decimal(0);
  let hi = new Decimal(1);
  while (
    lmsrBuyCost(q, b, outcomeIdx, hi).lt(maxPay) &&
    hi.lt("1e24")
  ) {
    hi = hi.mul(2);
  }

  for (let i = 0; i < iterations; i++) {
    const mid = lo.plus(hi).div(2);
    const cost = lmsrBuyCost(q, b, outcomeIdx, mid);
    if (cost.lt(maxPay)) lo = mid;
    else hi = mid;
  }
  return lo.plus(hi).div(2);
}
