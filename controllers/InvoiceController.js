'use strict';

const InvoiceService = require('../services/InvoiceService');
const { toDTO, formatMoney, err } = require('./dto');

function toInvoiceDTO(invoice) {
  const dto = toDTO(invoice);
  dto.total = formatMoney(invoice.totalP);
  return dto;
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
    if (typeof totalP !== 'number' || totalP < 0) {
      return err(res, 400, 'VALIDATION', 'totalP must be a non-negative integer');
    }
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

module.exports = { list, create, get };
