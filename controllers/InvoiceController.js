'use strict';

const InvoiceService = require('../services/InvoiceService');
const { toDTO, formatMoney, err } = require('./dto');

function toInvoiceDTO(invoice) {
  const dto = toDTO(invoice);
  dto.total = formatMoney(invoice.totalP);
  return dto;
}

function validateTotalP(totalP, res) {
  if (totalP == null) return false;
  if (typeof totalP !== 'number' || !Number.isInteger(totalP) || totalP < 0) {
    err(res, 400, 'VALIDATION', 'totalP must be a non-negative integer (pence)');
    return true;
  }
  return false;
}

async function list(req, res, next) {
  try {
    const invoices = await InvoiceService.getRecentInvoices(20);
    res.json(invoices.map(toInvoiceDTO));
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { number, receiptDate, transactionId, totalP, deliveryDays, adjustments } = req.body;
    if (!number || !receiptDate || totalP == null) {
      return err(res, 400, 'VALIDATION', 'number, receiptDate and totalP are required');
    }
    if (validateTotalP(totalP, res)) return;
    const invoice = await InvoiceService.createInvoice({
      number, receiptDate, transactionId, totalP,
      deliveryDays: deliveryDays || [],
      adjustments:  adjustments  || [],
    });
    res.status(201).json(toInvoiceDTO(invoice.toObject()));
  } catch (e) { next(e); }
}

async function get(req, res, next) {
  try {
    const invoice = await InvoiceService.getInvoiceById(req.params.id);
    if (!invoice) return err(res, 404, 'NOT_FOUND', 'Invoice not found');
    res.json(toInvoiceDTO(invoice));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { number, receiptDate, transactionId, totalP, deliveryDays, adjustments } = req.body;
    if (totalP != null && validateTotalP(totalP, res)) return;
    const patch = {};
    if (number        != null) patch.number        = number;
    if (receiptDate   != null) patch.receiptDate   = receiptDate;
    if (transactionId != null) patch.transactionId = transactionId;
    if (totalP        != null) patch.totalP        = totalP;
    if (deliveryDays  != null) patch.deliveryDays  = deliveryDays;
    if (adjustments   != null) patch.adjustments   = adjustments;
    const invoice = await InvoiceService.updateInvoice(req.params.id, patch);
    if (!invoice) return err(res, 404, 'NOT_FOUND', 'Invoice not found or not in pending status');
    res.json(toInvoiceDTO(invoice));
  } catch (e) { next(e); }
}

async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['pending', 'computed', 'settled'].includes(status)) {
      return err(res, 400, 'VALIDATION', 'status must be pending, computed or settled');
    }
    const invoice = await InvoiceService.setInvoiceStatus(req.params.id, status);
    if (!invoice) return err(res, 404, 'NOT_FOUND', 'Invoice not found');
    res.json(toInvoiceDTO(invoice));
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update, setStatus };
