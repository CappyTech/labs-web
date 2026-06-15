'use strict';

const Settlement = require('../models/Settlement');
const Invoice    = require('../models/Invoice');

/**
 * Return all settlements, newest first.
 */
async function getAllSettlements() {
  return Settlement.find()
    .populate('invoiceIds', 'number receiptDate totalP')
    .populate('balances.member', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Return all settlements whose window overlaps the given range, newest first.
 */
async function getSettlementsInWindow(from, to) {
  return Settlement.find({
    windowStart: { $lte: to },
    windowEnd:   { $gte: from },
  })
    .populate('invoiceIds', 'number receiptDate totalP')
    .populate('balances.member', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Return the settlement that covers a specific invoice, if one exists.
 */
async function getSettlementForInvoice(invoiceId) {
  return Settlement.findOne({ invoiceIds: invoiceId })
    .populate('invoiceIds', 'number receiptDate totalP')
    .populate('balances.member', 'name')
    .lean();
}

/**
 * Return a single Settlement by id.
 */
async function getSettlementById(id) {
  return Settlement.findById(id)
    .populate('invoiceIds', 'number receiptDate totalP')
    .populate('balances.member', 'name')
    .lean();
}

/**
 * Create a window-level Settlement by aggregating per-invoice Settlements
 * that were already computed (invoice status = 'computed' | 'settled').
 * Marks all included invoices as 'settled'.
 *
 * @param {{ cadence: string, windowStart: Date, windowEnd: Date }} opts
 */
async function createWindowSettlement({ cadence, windowStart, windowEnd }) {
  // Find per-invoice settlements whose invoices fall in the window.
  const invoicesInWindow = await Invoice.find({
    receiptDate: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ['computed', 'settled'] },
  }).lean();

  const invoiceIds = invoicesInWindow.map(i => i._id);

  const perInvoiceSettlements = await Settlement.find({
    invoiceIds: { $in: invoiceIds },
  }).populate('balances.member').lean();

  // Aggregate per-member owedP across all settlements.
  const totals = new Map();
  for (const s of perInvoiceSettlements) {
    for (const b of s.balances) {
      const mid = String(b.member._id || b.member);
      const entry = totals.get(mid) || { member: b.member, owedP: 0 };
      entry.owedP += b.owedP;
      totals.set(mid, entry);
    }
  }

  const balances = [...totals.values()].map(({ member, owedP }) => ({
    member: member._id || member,
    owedP,
  }));

  const settlement = new Settlement({ cadence, windowStart, windowEnd, invoiceIds, balances });
  await settlement.save();

  // Mark all included invoices as settled.
  if (invoiceIds.length > 0) {
    await Invoice.updateMany({ _id: { $in: invoiceIds } }, { status: 'settled' });
  }

  return settlement;
}

module.exports = { getAllSettlements, getSettlementsInWindow, getSettlementForInvoice, getSettlementById, createWindowSettlement };
