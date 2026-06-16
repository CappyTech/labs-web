'use strict';

const MemberService     = require('../services/MemberService');
const InvoiceService    = require('../services/InvoiceService');
const SettlementService = require('../services/SettlementService');
const { formatMoney }   = require('./dto');

/**
 * GET /milkman
 */
async function index(req, res, next) {
  try {
    const [members, rawInvoices, rawBalances] = await Promise.all([
      MemberService.getActiveMembers(),
      InvoiceService.getRecentInvoices(5),
      SettlementService.getOutstandingBalances(),
    ]);

    const recentInvoices = rawInvoices.map(inv => ({
      ...inv,
      id:                   String(inv._id),
      total:                formatMoney(inv.totalP),
      receiptDateFormatted: new Date(inv.receiptDate).toLocaleDateString('en-GB'),
    }));

    const outstandingBalances = rawBalances.map(b => ({
      ...b,
      owed: formatMoney(b.owedP),
    }));

    const balanceByMember = new Map(rawBalances.map(b => [b.memberId, b.owedP]));
    const membersWithBalance = members.map(m => ({
      ...m,
      owedP: balanceByMember.get(String(m._id)) || 0,
      owed:  formatMoney(balanceByMember.get(String(m._id)) || 0),
    }));

    res.render('milkman/index', {
      title: 'Milkman',
      description: 'Milk-round bill splitter.',
      members: membersWithBalance,
      recentInvoices,
      outstandingBalances,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index };
