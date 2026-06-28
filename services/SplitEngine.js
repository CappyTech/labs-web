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

const { FractionsDoNotSumError, UnknownProductError, ReconciliationError, UnknownMemberError, FixedQtyMismatchError } = require('./errors');

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
 * @param {{ productId: string, totalP: number, qty?: number }[]} lines
 *   qty is only required to validate multi-member FIXED lines.
 * @param {Map<string, {
 *   type: 'WHOLE'|'FRACTION'|'FIXED'|'UNASSIGNED',
 *   assignments: { memberId: string, fraction?: number, fixedQty?: number }[],
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
      case 'WHOLE': {
        const mid = rule.assignments[0].memberId;
        shares.set(mid, shares.get(mid) + line.totalP);
        break;
      }
      case 'FIXED': {
        const split = allocateFixed(line, rule.assignments);
        for (const [mid, pence] of split) {
          shares.set(mid, (shares.get(mid) || 0) + pence);
        }
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
 * Apportion a FIXED line across its assigned members.
 *
 *  - One assignment (or no usable quantities) → the whole line goes to the first
 *    member. This is the original FIXED behaviour (e.g. a bundle taken outright)
 *    and is preserved for backward compatibility.
 *  - Two or more assignments with quantities → split the line in proportion to
 *    each member's `fixedQty` (largest-remainder so pennies reconcile). When the
 *    line `qty` is known, the quantities must sum to it, else FixedQtyMismatchError.
 *
 * @param {{ productId: string, totalP: number, qty?: number }} line
 * @param {{ memberId: string, fixedQty?: number }[]} assignments
 * @returns {Map<string, number>}
 */
function allocateFixed(line, assignments) {
  const totalQty = assignments.reduce((s, a) => s + (a.fixedQty || 0), 0);

  // Single owner, or quantities not declared — whole line to the first member.
  if (assignments.length < 2 || totalQty <= 0) {
    return new Map([[assignments[0].memberId, line.totalP]]);
  }

  // Validate against the line quantity when we know it.
  if (line.qty != null && totalQty !== line.qty) {
    throw new FixedQtyMismatchError(
      `FIXED quantities for product ${line.productId} sum to ${totalQty} but the line quantity is ${line.qty}`
    );
  }

  return largestRemainder(
    line.totalP,
    assignments.map(a => ({ id: a.memberId, weight: (a.fixedQty || 0) / totalQty }))
  );
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
    if (!result.has(adj.memberId)) {
      throw new UnknownMemberError(`Adjustment references unknown member ${adj.memberId}`);
    }
    result.set(adj.memberId, result.get(adj.memberId) + adj.amountPence);
  }
  return result;
}

/**
 * Apply communal consumption events.
 *
 * For each event:
 *  - The buyer already holds the full product line cost in `shares`.
 *  - Credit the buyer the communal portion (communalCostPence).
 *  - Re-charge that exact amount equally across participants (largest-remainder).
 *
 * Hard invariant: buyer never subsidises the group and never profits.
 * communalCostPence is the value of the communally-consumed units as a share of
 * the line — round(lineTotalPence × unitsCommunal / totalUnits) — computed by the
 * caller. Valuing the portion directly (rather than via a per-unit rate floored
 * to whole pence and then multiplied) keeps it penny-exact and never biases the
 * buyer: when the whole line is communal the buyer is reimbursed the full line.
 *
 * @param {Map<string, number>} shares
 * @param {{
 *   units: number,             // communal units — carried for labelling only
 *   communalCostPence: number, // integer pence value of those units
 *   buyerId: string,
 *   participantIds: string[]
 * }[]} communalEvents
 * @returns {Map<string, number>}
 */
function applyCommunalEvents(shares, communalEvents) {
  const result = new Map(shares);

  for (const event of communalEvents) {
    const communalCostPence = event.communalCostPence;

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
 * Apply invoice-level charges (fees, discounts, membership, balance carry-forwards).
 *
 * splitType 'equal'          — divided evenly across all members.
 * splitType 'proportional'   — divided in proportion to each member's current positive share.
 *                              Falls back to equal if no member has a positive share.
 * splitType 'account-holder' — entire charge assigned to the member flagged isBuyer.
 *                              Falls back to equal if no buyer found.
 *
 * @param {Map<string, number>} shares
 * @param {{ amountP: number, splitType: 'equal'|'proportional'|'account-holder' }[]} charges
 * @param {{ id: string, isBuyer?: boolean }[]} members
 * @returns {Map<string, number>}
 */
function applyCharges(shares, charges, members) {
  const result = new Map(shares);

  for (const charge of charges) {
    let parts;

    if (charge.splitType === 'account-holder') {
      const buyer = members.find(m => m.isBuyer);
      if (buyer) {
        result.set(buyer.id, (result.get(buyer.id) || 0) + charge.amountP);
        continue;
      }
      // No buyer found — fall through to equal.
    }

    if (charge.splitType === 'proportional') {
      const positiveTotal = [...result.values()].filter(v => v > 0).reduce((s, v) => s + v, 0);
      if (positiveTotal > 0) {
        parts = members.map(m => {
          const share = result.get(m.id) || 0;
          return { id: m.id, weight: share > 0 ? share / positiveTotal : 0 };
        });
        // Weights may not sum to exactly 1 due to float arithmetic; normalize.
        const wSum = parts.reduce((s, p) => s + p.weight, 0);
        if (wSum > 0) parts = parts.map(p => ({ id: p.id, weight: p.weight / wSum }));
        // Fall through using these weights.
      } else {
        // No positive shares — fall back to equal.
        parts = members.map(m => ({ id: m.id, weight: 1 / members.length }));
      }
    } else {
      parts = members.map(m => ({ id: m.id, weight: 1 / members.length }));
    }

    const split = largestRemainder(charge.amountP, parts);
    for (const [mid, pence] of split) {
      result.set(mid, (result.get(mid) || 0) + pence);
    }
  }

  return result;
}

/**
 * Build a per-member itemised ledger explaining how each member's final share
 * is composed. PURE and non-authoritative: it replays the exact same pipeline
 * operations (allocateLines → applyCommunalEvents → applyAdjustments →
 * applyCharges) one item at a time and records the per-member delta of each
 * step. Because it reuses the very same primitives, the sum of a member's
 * entries equals that member's total from the normal pipeline — the maths is
 * never re-implemented here, only attributed.
 *
 * Entry shape (amountP is integer pence, may be negative for credits):
 *  - line:       { source:'line', productId, ruleType, fraction?, amountP }
 *  - communal:   { source:'communal', productId, units, role:'buyer'|'participant', amountP }
 *  - adjustment: { source:'adjustment', index, amountP }
 *  - charge:     { source:'charge', index, amountP }
 *
 * @returns {Map<string, object[]>} memberId → entries (in pipeline order)
 */
function explainSplit(lines, rules, members, { communalEvents = [], adjustments = [], charges = [] } = {}) {
  const ledger = new Map(members.map(m => [m.id, []]));
  let running = new Map(members.map(m => [m.id, 0]));

  // 1. Lines — attribute each line in isolation (allocateLines is additive).
  for (const line of lines) {
    const lineShares = allocateLines([line], rules, members);
    const rule = rules.get(line.productId);
    const assignment = m => rule.assignments.find(a => a.memberId === m.id);
    for (const m of members) {
      const amountP = lineShares.get(m.id) || 0;
      if (amountP !== 0) {
        const a = assignment(m);
        ledger.get(m.id).push({
          source:    'line',
          productId: line.productId,
          ruleType:  rule.type,
          fraction:  rule.type === 'FRACTION' ? a?.fraction : undefined,
          fixedQty:  rule.type === 'FIXED'    ? a?.fixedQty : undefined,
          lineQty:   line.qty,
          amountP,
        });
      }
      running.set(m.id, running.get(m.id) + amountP);
    }
  }

  // 2. Communal events — one event at a time, record the net delta per member.
  for (const event of communalEvents) {
    const before = new Map(running);
    running = applyCommunalEvents(running, [event]);
    for (const m of members) {
      const amountP = running.get(m.id) - before.get(m.id);
      if (amountP !== 0) {
        ledger.get(m.id).push({ source: 'communal', productId: event.productId, units: event.units, role: m.id === event.buyerId ? 'buyer' : 'participant', amountP });
      }
    }
  }

  // 3. Adjustments.
  for (let i = 0; i < adjustments.length; i++) {
    const before = new Map(running);
    running = applyAdjustments(running, [adjustments[i]]);
    for (const m of members) {
      const amountP = running.get(m.id) - before.get(m.id);
      if (amountP !== 0) ledger.get(m.id).push({ source: 'adjustment', index: i, amountP });
    }
  }

  // 4. Charges.
  for (let i = 0; i < charges.length; i++) {
    const before = new Map(running);
    running = applyCharges(running, [charges[i]], members);
    for (const m of members) {
      const amountP = running.get(m.id) - before.get(m.id);
      if (amountP !== 0) ledger.get(m.id).push({ source: 'charge', index: i, amountP });
    }
  }

  return ledger;
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
  applyCharges,
  explainSplit,
  reconcile,
};
