'use strict';

const InvoiceService = require('../services/InvoiceService');
const ProductService = require('../services/ProductService');
const MemberService  = require('../services/MemberService');
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

module.exports = {
  list, newForm, create,
  addDay, removeDay,
  addLineItem, removeLineItem,
  addCommunalEvent, removeCommunalEvent,
  addAdjustment, removeAdjustment,
};
