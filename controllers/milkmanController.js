'use strict';

const MemberService  = require('../services/MemberService');
const InvoiceService = require('../services/InvoiceService');
const { formatMoney } = require('./dto');

/**
 * GET /milkman
 */
async function index(req, res, next) {
  try {
    const [members, rawInvoices] = await Promise.all([
      MemberService.getActiveMembers(),
      InvoiceService.getRecentInvoices(5),
    ]);

    // Format money and date at the controller edge before passing to the view.
    const recentInvoices = rawInvoices.map(inv => ({
      ...inv,
      id:                  String(inv._id),
      total:               formatMoney(inv.totalP),
      receiptDateFormatted: new Date(inv.receiptDate).toLocaleDateString('en-GB'),
    }));

    res.render('milkman/index', {
      title: 'Milkman',
      description: 'Milk-round bill splitter.',
      members,
      recentInvoices,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index };
