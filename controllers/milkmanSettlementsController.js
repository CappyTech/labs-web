'use strict';

const SettlementService = require('../services/SettlementService');
const { formatMoney }   = require('./dto');

async function list(req, res, next) {
  try {
    const raw = await SettlementService.getAllSettlements();
    const settlements = raw.map(s => ({
      ...s,
      id:                  String(s._id),
      windowStartFormatted: new Date(s.windowStart).toLocaleDateString('en-GB'),
      windowEndFormatted:   new Date(s.windowEnd).toLocaleDateString('en-GB'),
      balances: (s.balances || []).map(b => ({
        memberName: b.member?.name || String(b.member),
        owed:       formatMoney(b.owedP),
        owedP:      b.owedP,
      })),
    }));
    res.render('milkman/settlements/index', {
      title:       'Settlements',
      description: 'Milk-round settlement windows.',
      settlements,
    });
  } catch (err) { next(err); }
}

module.exports = { list };
