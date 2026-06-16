'use strict';

const InvoiceService    = require('../services/InvoiceService');
const SettlementService = require('../services/SettlementService');
const ProductService    = require('../services/ProductService');
const MemberService     = require('../services/MemberService');
const { formatMoney }   = require('./dto');

function formatInvoice(invoice) {
  return {
    ...invoice,
    id:                   String(invoice._id),
    total:                formatMoney(invoice.totalP),
    receiptDateFormatted: new Date(invoice.receiptDate).toLocaleDateString('en-GB'),
    deliveryDays: (invoice.deliveryDays || []).map(day => ({
      ...day,
      dateFormatted: new Date(day.date).toLocaleDateString('en-GB'),
      lineItems: (day.lineItems || []).map(item => ({
        ...item,
        productName: item.product?.name || String(item.product),
        total:       formatMoney(item.totalP),
      })),
      communalEvents: (day.communalEvents || []).map(evt => ({
        ...evt,
        productName:      evt.product?.name || String(evt.product),
        participantNames: (evt.participants || []).map(p => p.name || String(p)),
      })),
    })),
    charges: (invoice.charges || []).map(charge => ({
      ...charge,
      amount:   formatMoney(Math.abs(charge.amountP)),
      isCredit: charge.amountP < 0,
    })),
    adjustments: (invoice.adjustments || []).map(adj => ({
      ...adj,
      memberName: adj.member?.name || String(adj.member),
      amount:     formatMoney(Math.abs(adj.amountP)),
      isCredit:   adj.amountP < 0,
    })),
  };
}

/**
 * GET /milkman/invoices/:id
 */
async function show(req, res, next) {
  try {
    const [raw, products, members] = await Promise.all([
      InvoiceService.getInvoiceById(req.params.id),
      ProductService.getActiveProducts(),
      MemberService.getActiveMembers(),
    ]);
    if (!raw) return res.status(404).render('error', { title: '404', message: 'Invoice not found' });

    const invoice = formatInvoice(raw);

    let settlement = null;
    if (invoice.status === 'computed' || invoice.status === 'settled') {
      const raw2 = await SettlementService.getSettlementForInvoice(raw._id);
      if (raw2) {
        settlement = {
          id: String(raw2._id),
          balances: (raw2.balances || []).map(b => ({
            memberName: b.member?.name || String(b.member),
            owed:       formatMoney(b.owedP),
            owedP:      b.owedP,
          })),
        };
      }
    }

    res.render('milkman/invoice', {
      title:       `Invoice [${raw.number}]`,
      description: `Milkman invoice ${raw.number} — ${formatMoney(raw.totalP)}`,
      invoice,
      settlement,
      products,
      members,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /milkman/invoices/:id/split
 */
async function split(req, res, next) {
  try {
    await InvoiceService.computeSettlement(req.params.id);
    res.redirect(`/milkman/invoices/${req.params.id}`);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /milkman/invoices/:id/settle
 */
async function settle(req, res, next) {
  try {
    await InvoiceService.setInvoiceStatus(req.params.id, 'settled');
    res.redirect(`/milkman/invoices/${req.params.id}`);
  } catch (err) {
    next(err);
  }
}

module.exports = { show, split, settle };
