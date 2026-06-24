'use strict';

const MemberService     = require('../services/MemberService');
const SettlementService = require('../services/SettlementService');
const InvoiceService    = require('../services/InvoiceService');
const { formatMoney }   = require('./dto');

async function list(req, res, next) {
  try {
    const members = await MemberService.getAllMembers();
    res.render('milkman/members/index', {
      title:       'Members',
      description: 'Milk-round members.',
      members,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, isBuyer } = req.body;
    if (name) await MemberService.createMember({ name: name.trim(), isBuyer: isBuyer === 'on' });
    res.redirect('/milkman/members');
  } catch (err) { next(err); }
}

async function show(req, res, next) {
  try {
    const member = await MemberService.getMemberById(req.params.id);
    if (!member) return res.redirect('/milkman/members');

    const memberId = String(member._id);
    const [rawSettlements, outstandingBalances, rawInvoices] = await Promise.all([
      SettlementService.getSettlementsForMember(memberId),
      SettlementService.getOutstandingBalances(),
      InvoiceService.getInvoicesForMember(memberId),
    ]);

    const outstandingP = outstandingBalances.find(b => b.memberId === memberId)?.owedP || 0;

    const settlements = rawSettlements.map(s => {
      const balance = s.balances.find(b => String(b.member) === memberId);
      return {
        id:                   String(s._id),
        cadence:              s.cadence,
        windowStartFormatted: new Date(s.windowStart).toLocaleDateString('en-GB'),
        windowEndFormatted:   new Date(s.windowEnd).toLocaleDateString('en-GB'),
        owed:                 formatMoney(balance?.owedP || 0),
        invoiceCount:         (s.invoiceIds || []).length,
      };
    });

    const involvement = rawInvoices.map(inv => {
      const adjustments = (inv.adjustments || [])
        .filter(a => String(a.member) === memberId)
        .map(a => ({
          amount:        formatMoney(Math.abs(a.amountP)),
          isCredit:      a.amountP < 0,
          description:   a.description || '',
          dateFormatted: new Date(a.date).toLocaleDateString('en-GB'),
        }));

      const communalEvents = [];
      for (const day of inv.deliveryDays || []) {
        for (const evt of day.communalEvents || []) {
          if ((evt.participants || []).some(p => String(p) === memberId)) {
            communalEvents.push({
              productName:   evt.product?.name || String(evt.product),
              units:         evt.units,
              dateFormatted: new Date(day.date).toLocaleDateString('en-GB'),
            });
          }
        }
      }

      return {
        id:                   String(inv._id),
        number:               inv.number,
        status:               inv.status,
        receiptDateFormatted: new Date(inv.receiptDate).toLocaleDateString('en-GB'),
        adjustments,
        communalEvents,
      };
    });

    res.render('milkman/members/show', {
      title:       member.name,
      description: `Member ${member.name}.`,
      member: {
        ...member,
        id:          memberId,
        memberSince: member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-GB') : null,
      },
      outstanding:  formatMoney(outstandingP),
      outstandingP,
      settlements,
      involvement,
    });
  } catch (err) { next(err); }
}

async function editForm(req, res, next) {
  try {
    const member = await MemberService.getMemberById(req.params.id);
    if (!member) return res.redirect('/milkman/members');
    res.render('milkman/members/edit', {
      title:       `Edit ${member.name}`,
      description: `Edit member ${member.name}.`,
      member,
    });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, isBuyer, active } = req.body;
    await MemberService.updateMember(req.params.id, {
      name:    name?.trim(),
      isBuyer: isBuyer === 'on',
      active:  active  === 'on',
    });
    res.redirect('/milkman/members');
  } catch (err) { next(err); }
}

module.exports = { list, create, show, editForm, update };
