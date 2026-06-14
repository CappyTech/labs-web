'use strict';

const Invoice        = require('../models/Invoice');
const Settlement     = require('../models/Settlement');
const AllocationRule = require('../models/AllocationRule');
const Member         = require('../models/Member');
const SplitEngine    = require('./SplitEngine');
const { UnknownProductError, ReconciliationError } = require('./errors');

async function getInvoiceById(invoiceId) {
  return Invoice.findById(invoiceId)
    .populate('deliveryDays.lineItems.product')
    .populate('deliveryDays.communalEvents.product')
    .populate('deliveryDays.communalEvents.participants', 'name')
    .populate('adjustments.member', 'name')
    .lean();
}

async function getRecentInvoices(limit = 10) {
  return Invoice.find()
    .sort({ receiptDate: -1 })
    .limit(limit)
    .lean();
}

async function createInvoice(data) {
  const invoice = new Invoice(data);
  return invoice.save();
}

/**
 * Compute the per-member split for an invoice and persist a Settlement.
 *
 * Steps:
 *  1. Load invoice (populated) + all active members.
 *  2. Load AllocationRules for every product in the invoice.
 *  3. Build ruleMap: productId → { type, assignments: [{memberId, fraction}] }.
 *  4. Flatten all LineItems across DeliveryDays.
 *  5. SplitEngine.allocateLines.
 *  6. For each DeliveryDay CommunalEvent: resolve buyer from WHOLE/FIXED rule,
 *     compute cost_per_pint, SplitEngine.applyCommunalEvents.
 *  7. SplitEngine.applyAdjustments (invoice-level member credits).
 *  8. SplitEngine.reconcile — throws ReconciliationError if totals don't match.
 *  9. Persist Settlement (invoiceIds: [invoiceId], cadence: 'ad-hoc').
 * 10. Mark invoice status = 'computed'.
 *
 * @param {string} invoiceId
 * @returns {import('../models/Settlement')}
 */
async function computeSettlement(invoiceId) {
  const invoice = await Invoice.findById(invoiceId)
    .populate('deliveryDays.lineItems.product')
    .populate('deliveryDays.communalEvents.product')
    .populate('deliveryDays.communalEvents.participants')
    .populate('adjustments.member')
    .lean();

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  // Load all active members.
  const members = await Member.find({ active: true }).lean();
  const memberList = members.map(m => ({ id: String(m._id) }));

  // Collect unique product IDs from all line items.
  const productIdSet = new Set();
  for (const day of invoice.deliveryDays) {
    for (const item of day.lineItems) {
      productIdSet.add(String(item.product._id));
    }
  }
  const productIds = [...productIdSet];

  // Load allocation rules and build ruleMap grouped by productId.
  // For FRACTION: multiple rows per product (one per member).
  const rules = await AllocationRule.find({ product: { $in: productIds } })
    .populate('member')
    .lean();

  const ruleMap = new Map();
  for (const rule of rules) {
    const pid = String(rule.product);
    if (!ruleMap.has(pid)) {
      ruleMap.set(pid, { type: rule.type, assignments: [] });
    }
    ruleMap.get(pid).assignments.push({
      memberId: String(rule.member._id),
      fraction: rule.fraction,
    });
  }

  // Ensure every product has a rule.
  for (const pid of productIds) {
    if (!ruleMap.has(pid)) {
      throw new UnknownProductError(`No allocation rule for product ${pid}`);
    }
  }

  // Flatten lineItems across all DeliveryDays.
  const lines = [];
  for (const day of invoice.deliveryDays) {
    for (const item of day.lineItems) {
      lines.push({ productId: String(item.product._id), totalP: item.totalP });
    }
  }

  // 1. Allocate lines.
  let shares = SplitEngine.allocateLines(lines, ruleMap, memberList);

  // 2. Apply communal events from each DeliveryDay.
  const communalEventsForEngine = [];
  for (const day of invoice.deliveryDays) {
    for (const evt of day.communalEvents) {
      const pid = String(evt.product._id);
      const rule = ruleMap.get(pid);

      if (!rule || !['WHOLE', 'FIXED'].includes(rule.type)) {
        throw new UnknownProductError(
          `CommunalEvent on product ${pid}: requires a WHOLE or FIXED rule to identify the buyer`
        );
      }
      const buyerId = rule.assignments[0].memberId;

      if (!evt.product.pintsPerBottle) {
        throw new UnknownProductError(
          `Product ${evt.product.name || pid} has no pintsPerBottle — cannot compute cost_per_pint`
        );
      }

      // Find the line for this product to get qty and totalP.
      let lineQty = null;
      let lineTotalP = null;
      outer: for (const day2 of invoice.deliveryDays) {
        for (const item of day2.lineItems) {
          if (String(item.product._id) === pid) {
            lineQty   = item.qty;
            lineTotalP = item.totalP;
            break outer;
          }
        }
      }

      const costPerPint = Math.floor(lineTotalP / (lineQty * evt.product.pintsPerBottle));

      communalEventsForEngine.push({
        units:          evt.units,
        costPerPint,
        buyerId,
        participantIds: evt.participants.map(p => String(p._id || p)),
      });
    }
  }

  if (communalEventsForEngine.length > 0) {
    shares = SplitEngine.applyCommunalEvents(shares, communalEventsForEngine);
  }

  // 3. Apply invoice-level member adjustments (backdated credits etc.).
  if (invoice.adjustments.length > 0) {
    const adjs = invoice.adjustments.map(a => ({
      memberId:   String(a.member._id || a.member),
      amountPence: a.amountP,
    }));
    shares = SplitEngine.applyAdjustments(shares, adjs);
  }

  // 4. Reconcile — throws if totals don't match.
  SplitEngine.reconcile(shares, invoice.totalP);

  // 5. Persist Settlement.
  const balances = [...shares.entries()].map(([memberId, owedP]) => ({ member: memberId, owedP }));

  const settlement = await Settlement.findOneAndUpdate(
    { invoiceIds: invoice._id },
    {
      cadence:     'ad-hoc',
      windowStart: invoice.receiptDate,
      windowEnd:   invoice.receiptDate,
      invoiceIds:  [invoice._id],
      balances,
    },
    { new: true, upsert: true }
  );

  await Invoice.findByIdAndUpdate(invoiceId, { status: 'computed' });

  return settlement;
}

module.exports = { getInvoiceById, getRecentInvoices, createInvoice, computeSettlement };
