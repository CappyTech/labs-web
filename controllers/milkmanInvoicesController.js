'use strict';

const InvoiceService  = require('../services/InvoiceService');
const ProductService  = require('../services/ProductService');
const MemberService   = require('../services/MemberService');
const InvoiceParser   = require('../services/invoiceParser');
const AllocationRule  = require('../models/AllocationRule');
const { formatMoney } = require('./dto');

// ── Helpers ────────────────────────────────────────────────────────────────

function safeIdx(invoice, key, rawIdx) {
  const idx = parseInt(rawIdx, 10);
  return (!isNaN(idx) && invoice[key][idx] !== undefined) ? idx : null;
}

// ── Invoice list & creation ────────────────────────────────────────────────

async function list(req, res, next) {
  try {
    const raw = await InvoiceService.getAllInvoices();
    const invoices = raw.map(inv => ({
      ...inv,
      id:                   String(inv._id),
      total:                formatMoney(inv.totalP),
      receiptDateFormatted: new Date(inv.receiptDate).toLocaleDateString('en-GB'),
    }));
    res.render('milkman/invoices/index', {
      title:       'Invoices',
      description: 'All milk-round invoices.',
      invoices,
    });
  } catch (err) { next(err); }
}

async function newForm(req, res, next) {
  try {
    res.render('milkman/invoices/new', {
      title:       'New invoice',
      description: 'Create a new milk-round invoice.',
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { number, receiptDate, transactionId, totalP } = req.body;
    const invoice = await InvoiceService.createInvoice({
      number:        number?.trim(),
      receiptDate:   new Date(receiptDate),
      transactionId: transactionId?.trim() || undefined,
      totalP:        parseInt(totalP, 10),
    });
    res.redirect(`/milkman/invoices/${invoice._id}`);
  } catch (err) { next(err); }
}

// ── Delivery day mutations ─────────────────────────────────────────────────

async function addDay(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    invoice.deliveryDays.push({ date: new Date(req.body.date), lineItems: [], communalEvents: [] });
    await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

async function removeDay(req, res, next) {
  try {
    const { id, dayIndex } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const idx = safeIdx(invoice, 'deliveryDays', dayIndex);
    if (idx !== null) {
      invoice.deliveryDays.splice(idx, 1);
      await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

// ── Line item mutations ────────────────────────────────────────────────────

async function addLineItem(req, res, next) {
  try {
    const { id, dayIndex } = req.params;
    const { productId, qty, totalP } = req.body;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const idx = safeIdx(invoice, 'deliveryDays', dayIndex);
    if (idx !== null) {
      invoice.deliveryDays[idx].lineItems.push({
        product: productId,
        qty:     parseFloat(qty),
        totalP:  parseInt(totalP, 10),
      });
      await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

async function removeLineItem(req, res, next) {
  try {
    const { id, dayIndex, itemIndex } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const dayIdx  = safeIdx(invoice, 'deliveryDays', dayIndex);
    if (dayIdx !== null) {
      const itemIdx = parseInt(itemIndex, 10);
      if (!isNaN(itemIdx)) {
        invoice.deliveryDays[dayIdx].lineItems.splice(itemIdx, 1);
        await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
      }
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

// ── Communal event mutations ───────────────────────────────────────────────

async function addCommunalEvent(req, res, next) {
  try {
    const { id, dayIndex } = req.params;
    const { productId, units, participants } = req.body;
    const participantIds = participants ? [].concat(participants) : [];
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const idx = safeIdx(invoice, 'deliveryDays', dayIndex);
    if (idx !== null) {
      invoice.deliveryDays[idx].communalEvents.push({
        product:      productId,
        units:        parseInt(units, 10),
        participants: participantIds,
      });
      await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

async function removeCommunalEvent(req, res, next) {
  try {
    const { id, dayIndex, eventIndex } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const dayIdx = safeIdx(invoice, 'deliveryDays', dayIndex);
    if (dayIdx !== null) {
      const evtIdx = parseInt(eventIndex, 10);
      if (!isNaN(evtIdx)) {
        invoice.deliveryDays[dayIdx].communalEvents.splice(evtIdx, 1);
        await InvoiceService.updateInvoice(id, { deliveryDays: invoice.deliveryDays });
      }
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

// ── Adjustment mutations ───────────────────────────────────────────────────

async function addAdjustment(req, res, next) {
  try {
    const { id } = req.params;
    const { memberId, amountP, description, date } = req.body;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    invoice.adjustments.push({
      member:      memberId,
      amountP:     parseInt(amountP, 10),
      description: description?.trim() || undefined,
      date:        new Date(date),
    });
    await InvoiceService.updateInvoice(id, { adjustments: invoice.adjustments });
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

async function removeAdjustment(req, res, next) {
  try {
    const { id, adjIndex } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const idx = parseInt(adjIndex, 10);
    if (!isNaN(idx)) {
      invoice.adjustments.splice(idx, 1);
      await InvoiceService.updateInvoice(id, { adjustments: invoice.adjustments });
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

// ── Invoice paste-and-parse ────────────────────────────────────────────────

async function parseForm(req, res, next) {
  try {
    res.render('milkman/invoices/parse', {
      title:       'Paste invoice',
      description: 'Paste a milkman invoice to import it.',
    });
  } catch (err) { next(err); }
}

async function parsePreview(req, res, next) {
  try {
    const rawText = req.body.rawText || '';
    const parsed  = InvoiceParser.parse(rawText);

    const [products, members] = await Promise.all([
      ProductService.getAllProducts(),
      MemberService.getActiveMembers(),
    ]);

    // Match each line item to a known product by case-insensitive name.
    const productsByLower = new Map(
      products.map(p => [p.name.toLowerCase().trim(), String(p._id)])
    );

    const previewDays = parsed.deliveryDays.map(day => ({
      dateInput: day.date ? day.date.toISOString().slice(0, 10) : '',
      lineItems: day.lineItems.map(item => ({
        ...item,
        matchedId: productsByLower.get(item.baseName.toLowerCase().trim()) || null,
      })),
    }));

    // Pre-select members from existing WHOLE/FIXED rules for matched products.
    const matchedProductIds = [
      ...new Set(previewDays.flatMap(d => d.lineItems.map(i => i.matchedId).filter(Boolean))),
    ];
    const existingRules = matchedProductIds.length > 0
      ? await AllocationRule.find({
          product: { $in: matchedProductIds },
          type:    { $in: ['WHOLE', 'FIXED'] },
        }).lean()
      : [];
    const ruleByProduct = new Map(existingRules.map(r => [String(r.product), String(r.member)]));

    // Attach pre-matched member ID to each line item.
    for (const day of previewDays) {
      for (const item of day.lineItems) {
        item.preMatchedMemberId = item.matchedId ? (ruleByProduct.get(item.matchedId) || null) : null;
      }
    }

    res.render('milkman/invoices/preview', {
      title:       'Review parsed invoice',
      description: 'Confirm the parsed invoice before creating it.',
      parsed,
      receiptDateInput: parsed.receiptDate ? parsed.receiptDate.toISOString().slice(0, 10) : '',
      previewDays,
      products,
      members,
      rawText,
    });
  } catch (err) { next(err); }
}

async function confirmParse(req, res, next) {
  try {
    const body     = req.body;
    const dayCount = parseInt(body.dayCount, 10) || 0;

    const deliveryDays = [];
    const productMemberMap = new Map();
    // Cache parsedName (lowercase) → productId for this run to avoid creating
    // the same product twice when it appears on multiple delivery days.
    const productNameCache = new Map();

    for (let d = 0; d < dayCount; d++) {
      const itemCount = parseInt(body[`day_${d}_itemCount`], 10) || 0;
      const lineItems = [];
      for (let i = 0; i < itemCount; i++) {
        if (body[`day_${d}_item_${i}_skip`] === 'on') continue;

        let productId = body[`day_${d}_item_${i}_productId`];
        const qty    = parseFloat(body[`day_${d}_item_${i}_qty`]);
        const totalP = parseInt(body[`day_${d}_item_${i}_totalP`], 10);

        if (!productId) {
          const parsedName = (body[`day_${d}_item_${i}_parsedName`] || '').trim();
          if (parsedName && !isNaN(qty) && qty > 0 && !isNaN(totalP)) {
            const computedPriceP = Math.round(totalP / qty);
            // Key on name+price so a 1-pint and a 3-pint bundle of the same
            // product are treated as distinct SKUs.
            const cacheKey = `${parsedName.toLowerCase()}|${computedPriceP}`;
            if (productNameCache.has(cacheKey)) {
              productId = productNameCache.get(cacheKey);
            } else {
              const existing = await ProductService.findByNameAndPrice(parsedName, computedPriceP);
              if (existing) {
                productId = String(existing._id);
              } else {
                const created = await ProductService.createProduct({
                  name:   parsedName,
                  priceP: computedPriceP,
                  active: true,
                });
                productId = String(created._id);
              }
              productNameCache.set(cacheKey, productId);
            }
          } else {
            continue;
          }
        }

        const memberId = body[`day_${d}_item_${i}_memberId`];
        lineItems.push({ product: productId, qty, totalP });
        if (memberId && !productMemberMap.has(productId)) {
          productMemberMap.set(productId, memberId);
        }
      }
      deliveryDays.push({
        date:           new Date(body[`day_${d}_date`]),
        lineItems,
        communalEvents: [],
      });
    }

    // Collect invoice-level charges from the preview form.
    const chargeCount = parseInt(body.chargeCount, 10) || 0;
    const charges = [];
    for (let c = 0; c < chargeCount; c++) {
      const type      = body[`charge_${c}_type`];
      const label     = (body[`charge_${c}_label`] || '').trim();
      const amountP   = parseInt(body[`charge_${c}_amountP`], 10);
      const splitType = body[`charge_${c}_splitType`] || 'equal';
      if (label && !isNaN(amountP)) charges.push({ type, label, amountP, splitType });
    }

    const invoice = await InvoiceService.createInvoice({
      number:        body.number?.trim(),
      receiptDate:   new Date(body.receiptDate),
      transactionId: body.transactionId?.trim() || undefined,
      totalP:        parseInt(body.totalP, 10),
      deliveryDays,
      charges,
      adjustments:   [],
    });

    // Create WHOLE AllocationRules for any product that has no rule yet.
    if (productMemberMap.size > 0) {
      const productIds  = [...productMemberMap.keys()];
      const existing    = await AllocationRule.find({ product: { $in: productIds } }).lean();
      const hasRule     = new Set(existing.map(r => String(r.product)));
      for (const [productId, memberId] of productMemberMap) {
        if (!hasRule.has(productId)) {
          await AllocationRule.create({ product: productId, member: memberId, type: 'WHOLE' });
        }
      }
    }

    res.redirect(`/milkman/invoices/${invoice._id}`);
  } catch (err) { next(err); }
}

// ── Charge mutations ───────────────────────────────────────────────────────

async function addCharge(req, res, next) {
  try {
    const { id } = req.params;
    const { type, label, amountP, splitType } = req.body;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    invoice.charges.push({
      type:      type || 'other',
      label:     label?.trim(),
      amountP:   parseInt(amountP, 10),
      splitType: splitType || 'equal',
    });
    await InvoiceService.updateInvoice(id, { charges: invoice.charges });
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

async function removeCharge(req, res, next) {
  try {
    const { id, chargeIndex } = req.params;
    const invoice = await InvoiceService.getInvoiceRaw(id);
    if (!invoice || invoice.status !== 'pending') return res.redirect(`/milkman/invoices/${id}`);
    const idx = parseInt(chargeIndex, 10);
    if (!isNaN(idx)) {
      invoice.charges.splice(idx, 1);
      await InvoiceService.updateInvoice(id, { charges: invoice.charges });
    }
    res.redirect(`/milkman/invoices/${id}`);
  } catch (err) { next(err); }
}

module.exports = {
  list, newForm, create,
  parseForm, parsePreview, confirmParse,
  addDay, removeDay,
  addLineItem, removeLineItem,
  addCommunalEvent, removeCommunalEvent,
  addAdjustment, removeAdjustment,
  addCharge, removeCharge,
};
