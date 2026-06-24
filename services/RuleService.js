'use strict';

const AllocationRule = require('../models/AllocationRule');

// Matches the FRACTION-sum tolerance enforced in SplitEngine.splitFraction.
const FRACTION_TOLERANCE = 1e-9;

/**
 * Summarise how completely one product's allocation rules cover the line — i.e.
 * whether the assignment adds up to a whole (100%) of the product's price. PURE
 * (no I/O); takes the lean rule rows for a single product.
 *
 * This is the proactive form of the FRACTION-sums-to-1 invariant that
 * SplitEngine.splitFraction would otherwise only raise at split time.
 *
 * Note: FIXED qty is informational only — the engine assigns the whole line to
 * a single FIXED/WHOLE owner, so coverage for those is "exactly one owner",
 * not a quantity sum.
 *
 * @param {{ type: string, fraction?: number, member?: { name?: string } }[]} rules
 * @returns {{ type: string|null, status: 'ok'|'under'|'over'|'conflict'|'none',
 *            coveragePct: number|null, message: string }}
 */
function computeCoverage(rules) {
  if (!rules || rules.length === 0) {
    return { type: null, status: 'none', coveragePct: 0, message: 'No rules yet' };
  }

  const types = new Set(rules.map(r => r.type));
  if (types.size > 1) {
    return {
      type: 'MIXED', status: 'conflict', coveragePct: null,
      message: `Mixed rule types (${[...types].join(', ')}) — one product needs a single consistent type`,
    };
  }

  const type = rules[0].type;

  if (type === 'WHOLE' || type === 'FIXED') {
    if (rules.length === 1) {
      return { type, status: 'ok', coveragePct: 100, message: `Whole line to ${rules[0].member?.name || 'one member'}` };
    }
    return {
      type, status: 'conflict', coveragePct: null,
      message: `${rules.length} ${type} rules — only one member can take the whole line`,
    };
  }

  // FRACTION — the assignable fractions must sum to exactly 1.
  const sum = rules.reduce((s, r) => s + (r.fraction || 0), 0);
  const coveragePct = +(sum * 100).toFixed(2);

  if (Math.abs(sum - 1) <= FRACTION_TOLERANCE) {
    return { type, status: 'ok', coveragePct: 100, message: 'Fractions cover 100%' };
  }
  if (sum < 1) {
    return { type, status: 'under', coveragePct, message: `Fractions cover ${coveragePct}% — ${+(100 - coveragePct).toFixed(2)}% uncovered` };
  }
  return { type, status: 'over', coveragePct, message: `Fractions cover ${coveragePct}% — over-allocated by ${+(coveragePct - 100).toFixed(2)}%` };
}

/** Return all rules, populated with product and member names. */
async function getAllRules() {
  return AllocationRule.find()
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

/** Return all rules for a specific product. */
async function getRulesForProduct(productId) {
  return AllocationRule.find({ product: productId })
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

/** Return a single rule by its own _id. */
async function getRuleById(id) {
  return AllocationRule.findById(id)
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

async function createRule(data) {
  const rule = new AllocationRule(data);
  return rule.save();
}

async function updateRule(id, data) {
  return AllocationRule.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

async function deleteRule(id) {
  return AllocationRule.findByIdAndDelete(id);
}

module.exports = { getAllRules, getRulesForProduct, getRuleById, createRule, updateRule, deleteRule, computeCoverage };
