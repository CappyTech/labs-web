'use strict';

/**
 * SplitEngine — pure functions, no I/O, no DB, no HTTP.
 *
 * All monetary values are integer pence. Never use floats for money storage
 * or final results. Floating-point arithmetic is used only transiently during
 * weight calculations before the largest-remainder pass rounds back to pence.
 *
 * Invariants (each must be covered by tests):
 *  1. Per line, allocations sum to full line total (fractions sum to 1).
 *  2. Sum of all member shares == invoice grand total (incl. adjustments + fee).
 *  3. A member share is negative only via a net adjustment credit.
 *  4. Communal participants ⊆ members; equal split; reconciles to communal cost.
 *  5. Rounding via largest-remainder — never lose or invent a penny.
 */

const { FractionsDoNotSumError, UnknownProductError, ReconciliationError } = require('./errors');

// ── Rounding ──────────────────────────────────────────────────────────────────

/**
 * Distribute `totalPence` (integer) across parts using largest-remainder method.
 * @param {number} totalPence
 * @param {{ id: string, weight: number }[]} parts  weights must sum to 1
 * @returns {Map<string, number>}
 */
function largestRemainder(totalPence, parts) {
  const working = parts.map(p => {
    const exact = p.weight * totalPence;
    return { id: p.id, floor: Math.floor(exact), remainder: exact % 1 };
  });

  let leftover = totalPence - working.reduce((s, p) => s + p.floor, 0);

  // Distribute remaining pennies to the parts with the largest fractional remainders.
  working.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));

  const result = new Map();
  for (const p of working) {
    result.set(p.id, p.floor + (leftover-- > 0 ? 1 : 0));
  }
  return result;
}

// ── Core split operations ─────────────────────────────────────────────────────

/**
 * Split a line total by declared fractions across members.
 * Fractions must sum to exactly 1 (within floating-point tolerance 1e-9).
 *
 * @param {number} lineTotalPence
 * @param {{ memberId: string, fraction: number }[]} fractions
 * @returns {Map<string, number>}
 */
function splitFraction(lineTotalPence, fractions) {
  const sum = fractions.reduce((s, f) => s + f.fraction, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new FractionsDoNotSumError(
      `Fractions sum to ${sum}, expected 1 (diff: ${Math.abs(sum - 1)})`
    );
  }
  return largestRemainder(
    lineTotalPence,
    fractions.map(f => ({ id: f.memberId, weight: f.fraction }))
  );
}

/**
 * Allocate invoice lines to members according to a rules map.
 *
 * @param {{ productId: string, lineTotalPence: number }[]} lines
 * @param {Map<string, {
 *   type: 'WHOLE'|'FRACTION'|'FIXED'|'UNASSIGNED',
 *   assignments: { memberId: string, fraction?: number }[],
 *   fallback?: 'assign-to-member'|'split-evenly'|'exclude',
 *   fallbackMemberId?: string
 * }>} rules  keyed by productId string
 * @param {{ id: string }[]} members
 * @returns {Map<string, number>}  memberId → pence
 */
function allocateLines(lines, rules, members) {
  const shares = new Map(members.map(m => [m.id, 0]));

  for (const line of lines) {
    const pid = line.productId;
    const rule = rules.get(pid);

    if (!rule) {
      throw new UnknownProductError(`No allocation rule for product ${pid}`);
    }

    switch (rule.type) {
      case 'WHOLE':
      case 'FIXED': {
        const mid = rule.assignments[0].memberId;
        shares.set(mid, shares.get(mid) + line.totalP);
        break;
      }
      case 'FRACTION': {
        const split = splitFraction(line.totalP, rule.assignments);
        for (const [mid, pence] of split) {
          shares.set(mid, (shares.get(mid) || 0) + pence);
        }
        break;
      }
      default:
        throw new UnknownProductError(`Unknown rule type '${rule.type}' for product ${pid}`);
    }
  }

  return shares;
}

/**
 * Apply backdated credits and manual adjustments.
 * amountPence is negative for credits.
 *
 * @param {Map<string, number>} shares
 * @param {{ memberId: string, amountPence: number }[]} adjustments
 * @returns {Map<string, number>}
 */
function applyAdjustments(shares, adjustments) {
  const result = new Map(shares);
  for (const adj of adjustments) {
    result.set(adj.memberId, (result.get(adj.memberId) || 0) + adj.amountPence);
  }
  return result;
}

/**
 * Apply communal consumption events.
 *
 * For each event:
 *  - The buyer already holds the full product line cost in `shares`.
 *  - Credit the buyer the communal portion (units × costPerPint).
 *  - Re-charge that exact amount equally across participants (largest-remainder).
 *
 * Hard invariant: buyer never subsidises the group and never profits.
 * costPerPint = lineTotalPence / (quantity × pintsPerBottle), caller computes it.
 *
 * @param {Map<string, number>} shares
 * @param {{
 *   units: number,          // communal pints
 *   costPerPint: number,    // integer pence (rounded down by caller)
 *   buyerId: string,
 *   participantIds: string[]
 * }[]} communalEvents
 * @returns {Map<string, number>}
 */
function applyCommunalEvents(shares, communalEvents) {
  const result = new Map(shares);

  for (const event of communalEvents) {
    const communalCostPence = event.units * event.costPerPint;

    // Credit the buyer; they paid for this portion up front.
    result.set(event.buyerId, result.get(event.buyerId) - communalCostPence);

    // Re-distribute equally among participants.
    const split = largestRemainder(
      communalCostPence,
      event.participantIds.map(id => ({ id, weight: 1 / event.participantIds.length }))
    );
    for (const [mid, pence] of split) {
      result.set(mid, (result.get(mid) || 0) + pence);
    }
  }

  return result;
}

/**
 * Assert that the sum of all member shares equals grandTotalPence exactly.
 * Throws ReconciliationError otherwise.
 *
 * @param {Map<string, number>} shares
 * @param {number} grandTotalPence
 */
function reconcile(shares, grandTotalPence) {
  const sum = [...shares.values()].reduce((s, v) => s + v, 0);
  if (sum !== grandTotalPence) {
    throw new ReconciliationError(
      `Shares sum to ${sum}p but invoice grand total is ${grandTotalPence}p ` +
      `(diff: ${sum - grandTotalPence}p)`
    );
  }
}

module.exports = {
  largestRemainder,
  splitFraction,
  allocateLines,
  applyAdjustments,
  applyCommunalEvents,
  reconcile,
};
