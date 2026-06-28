'use strict';

const Invoice        = require('../models/Invoice');
const Settlement     = require('../models/Settlement');
const AllocationRule = require('../models/AllocationRule');
const Member         = require('../models/Member');
const Product        = require('../models/Product');
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

async function getAllInvoices() {
  return Invoice.find()
    .sort({ receiptDate: -1, _id: -1 })
    .lean();
}

async function getRecentInvoices(limit = 10) {
  return Invoice.find()
    .sort({ receiptDate: -1, _id: -1 })
    .limit(limit)
    .lean();
}

async function getInvoiceRaw(invoiceId) {
  return Invoice.findById(invoiceId).lean();
}

/**
 * Count invoices still awaiting a split (status 'pending'). These contribute
 * nothing to outstanding balances yet — any adjustments or line allocations on
 * them are invisible until split — so callers surface this as a warning that an
 * outstanding figure may understate what is actually owed.
 */
async function getPendingCount() {
  return Invoice.countDocuments({ status: 'pending' });
}

/**
 * Return invoices in which a member is directly involved — either as the target
 * of an adjustment or as a participant in a communal event. Newest first.
 */
async function getInvoicesForMember(memberId) {
  return Invoice.find({
    $or: [
      { 'adjustments.member': memberId },
      { 'deliveryDays.communalEvents.participants': memberId },
    ],
  })
    .sort({ receiptDate: -1, _id: -1 })
    .populate('deliveryDays.communalEvents.product', 'name')
    .lean();
}

async function findByNumber(number) {
  return Invoice.findOne({ number: number?.trim() }, '_id number receiptDate status').lean();
}

async function createInvoice(data) {
  const invoice = new Invoice(data);
  return invoice.save();
}

async function deleteInvoice(id) {
  return Invoice.findOneAndDelete({ _id: id, status: 'pending' }).lean();
}

async function updateInvoice(id, data) {
  return Invoice.findOneAndUpdate(
    { _id: id, status: 'pending' },
    data,
    { new: true, runValidators: true }
  ).lean();
}

async function setInvoiceStatus(id, status) {
  return Invoice.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean();
}

/**
 * Flatten an invoice's line items into engine lines, expanding any composite
 * (bundle) product into its component product lines. A composite line's total
 * is divided across components in proportion to their reference priceP (via
 * largest-remainder, so it reconciles to the line total exactly); each
 * component line's qty is component.qty × the bundle line qty. Non-composite
 * lines pass through unchanged.
 *
 * @returns {Promise<{ productId: string, name: string, totalP: number, qty: number }[]>}
 */
async function expandLines(invoice) {
  const raw = [];
  for (const day of invoice.deliveryDays) {
    for (const item of day.lineItems) {
      raw.push({ productId: String(item.product._id), name: item.product.name || String(item.product._id), totalP: item.totalP, qty: item.qty });
    }
  }

  const lineProductIds = [...new Set(raw.map(l => l.productId))];
  const products = await Product.find({ _id: { $in: lineProductIds } })
    .populate('components.product', 'name pintsPerBottle')
    .lean();
  const compositeMap = new Map(
    products.filter(p => p.components && p.components.length > 0).map(p => [String(p._id), p.components])
  );

  const lines = [];
  for (const line of raw) {
    const components = compositeMap.get(line.productId);
    const shares = components ? splitBundleTotal(line.totalP, components) : null;

    // Plain product, or a bundle with no reference prices to split by → as-is.
    if (!shares) {
      lines.push({ productId: line.productId, name: line.name, totalP: line.totalP, qty: line.qty });
      continue;
    }

    components.forEach((c, i) => {
      const cp = c.product;
      lines.push({
        productId: String(cp._id || cp),
        name:      cp.name || String(cp),
        totalP:    shares[i],
        qty:       (c.qty || 1) * line.qty,
      });
    });
  }

  return lines;
}

/**
 * Split a bundle line's total across its components in proportion to each
 * component's reference priceP. PURE. Returns pence per component (index-aligned
 * with `components`), summing to lineTotalP exactly via largest-remainder.
 * Returns null when there are no positive reference prices to split by.
 *
 * @param {number} lineTotalP
 * @param {{ priceP?: number }[]} components
 * @returns {number[] | null}
 */
function splitBundleTotal(lineTotalP, components) {
  const totalWeight = components.reduce((s, c) => s + (c.priceP || 0), 0);
  if (totalWeight <= 0) return null;
  const split = SplitEngine.largestRemainder(
    lineTotalP,
    components.map((c, i) => ({ id: String(i), weight: (c.priceP || 0) / totalWeight }))
  );
  return components.map((_, i) => split.get(String(i)));
}

/**
 * Build the engine-ready inputs for splitting an invoice from a populated
 * invoice doc + the active member list. Shared by `computeSettlement` (the
 * authoritative path) and `getInvoiceBreakdown` (the read-only explainer) so
 * both operate on identical inputs.
 *
 * Steps:
 *  1. Build memberList for the engine.
 *  2. Expand line items (bundles → component lines).
 *  3. Load AllocationRules → ruleMap (productId → { type, assignments }).
 *  4. Resolve each CommunalEvent's buyer + cost_per_pint from the expanded lines.
 *  5. Map invoice-level adjustments to engine shape.
 *
 * @returns {{ memberList, lines, ruleMap, communalEventsForEngine, adjustments, charges, productNameMap }}
 */
async function buildSplitContext(invoice, members) {
  const memberList = members.map(m => ({ id: String(m._id), isBuyer: m.isBuyer || false }));

  // Expand line items, splitting any composite (bundle) product into its
  // component product lines so rules and communal events attach to real
  // components, never to the bundle itself.
  const lines = await expandLines(invoice);

  const productNameMap = new Map(lines.map(l => [l.productId, l.name]));
  const productIds = [...new Set(lines.map(l => l.productId))];

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
      fixedQty: rule.fixedQty,
    });
  }

  // Ensure every product (component or standalone) has a rule.
  for (const pid of productIds) {
    if (!ruleMap.has(pid)) {
      const name = productNameMap.get(pid) || pid;
      throw new UnknownProductError(`No allocation rule for product "${name}" — add one at /milkman/rules`);
    }
  }

  // Resolve communal events: buyer from WHOLE/FIXED rule + cost_per_pint.
  // productId is carried through for breakdown labelling (engine ignores it).
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

      // qty/totalP come from the expanded lines so a bundle component is costed
      // on its own sub-price, not the whole bundle price.
      const compLine = lines.find(l => l.productId === pid);
      if (!compLine) {
        throw new UnknownProductError(
          `CommunalEvent product ${evt.product.name || pid} not found in any line`
        );
      }

      const costPerPint = Math.floor(compLine.totalP / (compLine.qty * evt.product.pintsPerBottle));

      communalEventsForEngine.push({
        productId:      pid,
        units:          evt.units,
        costPerPint,
        buyerId,
        participantIds: evt.participants.map(p => String(p._id || p)),
      });
    }
  }

  const adjustments = (invoice.adjustments || []).map(a => ({
    memberId:    String(a.member._id || a.member),
    amountPence: a.amountP,
    description: a.description || '',
    date:        a.date,
  }));

  const charges = invoice.charges || [];

  return { memberList, lines, ruleMap, communalEventsForEngine, adjustments, charges, productNameMap };
}

/**
 * Compute the per-member split for an invoice and persist a Settlement.
 *
 * Loads the invoice + active members, builds engine inputs via
 * `buildSplitContext`, runs the SplitEngine pipeline (allocate → communal →
 * adjustments → charges), reconciles against the invoice total, persists a
 * Settlement (upserted so re-splitting overwrites), and marks the invoice
 * 'computed'.
 *
 * @param {string} invoiceId
 * @returns {{ settlement: import('../models/Settlement'), created: boolean }}
 */
async function computeSettlement(invoiceId) {
  const invoice = await Invoice.findById(invoiceId)
    .populate('deliveryDays.lineItems.product')
    .populate('deliveryDays.communalEvents.product')
    .populate('deliveryDays.communalEvents.participants')
    .populate('adjustments.member')
    .lean();

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const members = await Member.find({ active: true }).lean();
  const { memberList, lines, ruleMap, communalEventsForEngine, adjustments, charges } =
    await buildSplitContext(invoice, members);

  // 1. Allocate lines.
  let shares = SplitEngine.allocateLines(lines, ruleMap, memberList);

  // 2. Apply communal events.
  if (communalEventsForEngine.length > 0) {
    shares = SplitEngine.applyCommunalEvents(shares, communalEventsForEngine);
  }

  // 3. Apply invoice-level member adjustments (backdated credits etc.).
  if (adjustments.length > 0) {
    shares = SplitEngine.applyAdjustments(shares, adjustments);
  }

  // 4. Apply invoice-level charges (fees, discounts, membership, balance).
  if (charges.length > 0) {
    shares = SplitEngine.applyCharges(shares, charges, memberList);
  }

  // 5. Reconcile — throws if totals don't match.
  SplitEngine.reconcile(shares, invoice.totalP);

  // 5. Persist Settlement (upsert so re-splitting overwrites the previous result).
  const balances = [...shares.entries()].map(([memberId, owedP]) => ({ member: memberId, owedP }));

  const raw = await Settlement.findOneAndUpdate(
    { invoiceIds: invoice._id },
    {
      cadence:     'ad-hoc',
      windowStart: invoice.receiptDate,
      windowEnd:   invoice.receiptDate,
      invoiceIds:  [invoice._id],
      balances,
    },
    { new: true, upsert: true, rawResult: true }
  );

  const created = !raw.lastErrorObject?.updatedExisting;

  await Invoice.findByIdAndUpdate(invoiceId, { status: 'computed' });

  return { settlement: raw.value, created };
}

/**
 * Produce a read-only, per-member itemised breakdown of how an invoice splits —
 * which line items, communal events, adjustments and charges make up each
 * member's total, and how each was apportioned. Re-derives the split from the
 * current rules via `SplitEngine.explainSplit`; never mutates anything.
 *
 * Returns `null` if the invoice doesn't exist or can't currently be explained
 * (e.g. a product is missing an allocation rule) — callers should treat a null
 * breakdown as "not available" and fall back to the persisted totals.
 *
 * @param {string} invoiceId
 * @returns {Promise<null | { memberId, memberName, totalP, entries: object[] }[]>}
 */
async function getInvoiceBreakdown(invoiceId) {
  const invoice = await Invoice.findById(invoiceId)
    .populate('deliveryDays.lineItems.product')
    .populate('deliveryDays.communalEvents.product')
    .populate('deliveryDays.communalEvents.participants')
    .populate('adjustments.member')
    .lean();

  if (!invoice) return null;

  const members = await Member.find({ active: true }).lean();
  const memberNameMap = new Map(members.map(m => [String(m._id), m.name]));

  let ctx, ledger;
  try {
    ctx = await buildSplitContext(invoice, members);
    ledger = SplitEngine.explainSplit(ctx.lines, ctx.ruleMap, ctx.memberList, {
      communalEvents: ctx.communalEventsForEngine,
      adjustments:    ctx.adjustments,
      charges:        ctx.charges,
    });
  } catch {
    // Rules missing/invalid or quantities no longer reconcile (e.g. edited after
    // computing) — can't explain right now; let the caller fall back to totals.
    return null;
  }

  const fractionPct = f => `${+(f * 100).toFixed(1)}%`;

  return ctx.memberList.map(m => {
    const entries = (ledger.get(m.id) || []).map(e => {
      if (e.source === 'line') {
        const name = ctx.productNameMap.get(e.productId) || e.productId;
        let basis = 'whole';
        if (e.ruleType === 'FRACTION') {
          basis = e.fraction != null ? fractionPct(e.fraction) : 'fraction';
        } else if (e.ruleType === 'FIXED' && e.fixedQty != null && e.lineQty != null) {
          basis = `${e.fixedQty} of ${e.lineQty} units`;
        }
        return { label: name, basis, amountP: e.amountP };
      }
      if (e.source === 'communal') {
        const name = ctx.productNameMap.get(e.productId) || e.productId;
        const basis = e.role === 'buyer'
          ? `bought ${e.units}, communal net`
          : `${e.units}-unit communal share`;
        return { label: `${name} (communal)`, basis, amountP: e.amountP };
      }
      if (e.source === 'adjustment') {
        const adj = ctx.adjustments[e.index];
        return { label: adj?.description || 'Adjustment', basis: e.amountP < 0 ? 'credit' : 'surcharge', amountP: e.amountP };
      }
      // charge
      const charge = ctx.charges[e.index];
      return { label: charge?.label || 'Charge', basis: charge?.splitType || 'charge', amountP: e.amountP };
    });

    const totalP = entries.reduce((s, e) => s + e.amountP, 0);
    return { memberId: m.id, memberName: memberNameMap.get(m.id) || m.id, totalP, entries };
  });
}

module.exports = { getAllInvoices, getInvoiceById, getInvoiceRaw, getPendingCount, getInvoicesForMember, getRecentInvoices, findByNumber, createInvoice, deleteInvoice, updateInvoice, setInvoiceStatus, computeSettlement, getInvoiceBreakdown, splitBundleTotal };
