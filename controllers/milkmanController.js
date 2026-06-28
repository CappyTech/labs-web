'use strict';

const MemberService     = require('../services/MemberService');
const InvoiceService    = require('../services/InvoiceService');
const SettlementService = require('../services/SettlementService');
const SplitEngine       = require('../services/SplitEngine');
const { formatMoney }   = require('./dto');

/**
 * GET /milkman
 */
async function index(req, res, next) {
  try {
    const [members, rawInvoices, rawBalances, pendingCount] = await Promise.all([
      MemberService.getActiveMembers(),
      InvoiceService.getRecentInvoices(5),
      SettlementService.getOutstandingBalances(),
      InvoiceService.getPendingCount(),
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

    const totalOwedP = rawBalances.reduce((s, b) => s + b.owedP, 0);

    res.render('milkman/index', {
      title: 'Milkman',
      description: 'Milk-round bill splitter.',
      members: membersWithBalance,
      recentInvoices,
      outstandingBalances,
      pendingCount,
      totalOwed: formatMoney(totalOwedP),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /milkman/maths
 */
function maths(req, res, next) {
  try {
    const fm = formatMoney;

    const memberDefs = [
      { id: 'alice', name: 'Alice', isBuyer: true  },
      { id: 'bob',   name: 'Bob',   isBuyer: false },
    ];
    const nameOf   = id  => memberDefs.find(m => m.id === id)?.name ?? id;
    const mapToRows = map => [...map.entries()].map(([id, pence]) => ({ name: nameOf(id), pence }));

    // ── 1. Largest remainder: split £10.01 equally ────────────────────
    const lrTotal  = 1001;
    const lrWeight = 1 / memberDefs.length;
    const lrWorking = memberDefs.map(m => {
      const exact = lrWeight * lrTotal;
      return { name: m.name, weight: lrWeight, exact, floor: Math.floor(exact), remainder: exact % 1 };
    });
    const lrFloorSum = lrWorking.reduce((s, p) => s + p.floor, 0);
    const lrResult   = mapToRows(SplitEngine.largestRemainder(lrTotal, memberDefs.map(m => ({ id: m.id, weight: lrWeight }))));

    // ── 2. WHOLE: Double Cream £3.50 → all to Alice ───────────────────
    const wholeResult = mapToRows(SplitEngine.allocateLines(
      [{ productId: 'cream', totalP: 350 }],
      new Map([['cream', { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }]]),
      memberDefs
    ));

    // ── 3. FRACTION: Whole Milk £12.73 → Alice 60%, Bob 40% ──────────
    const fracTotal       = 1273;
    const fracAssignments = [{ memberId: 'alice', fraction: 0.6 }, { memberId: 'bob', fraction: 0.4 }];
    const fracWorking     = fracAssignments.map(a => {
      const exact = a.fraction * fracTotal;
      return { name: nameOf(a.memberId), fraction: a.fraction, exact, floor: Math.floor(exact), remainder: exact % 1 };
    });
    const fracFloorSum = fracWorking.reduce((s, p) => s + p.floor, 0);
    const fracResult   = mapToRows(SplitEngine.allocateLines(
      [{ productId: 'milk', totalP: fracTotal }],
      new Map([['milk', { type: 'FRACTION', assignments: fracAssignments }]]),
      memberDefs
    ));

    // ── 4. Communal event: 4 bottles £12.73, 2 pints/bottle, 3 pints consumed ──
    const commLineQty    = 4;
    const commLineTotalP = 1273;
    const commPPB        = 2;
    const commUnits      = 3;
    const commCPP        = Math.floor(commLineTotalP / (commLineQty * commPPB));
    const commCost       = commUnits * commCPP;
    const commStart      = new Map([['alice', commLineTotalP], ['bob', 0]]);
    const commResult     = mapToRows(SplitEngine.applyCommunalEvents(commStart, [{
      units: commUnits, costPerPint: commCPP, buyerId: 'alice', participantIds: ['alice', 'bob'],
    }]));

    // ── 5. Adjustments: Bob gets −£2.00 credit ───────────────────────
    const adjStart  = new Map([['alice', 760], ['bob', 513]]);
    const adjResult = mapToRows(SplitEngine.applyAdjustments(adjStart, [{ memberId: 'bob', amountPence: -200 }]));

    // ── 6. Charges: £2.00 fee — three strategies ──────────────────────
    const chargeStart   = new Map([['alice', 760], ['bob', 513]]);
    const chargeAmountP = 200;
    const posTotal      = [...chargeStart.values()].reduce((s, v) => s + v, 0);
    const propWeights   = memberDefs.map(m => ({ name: m.name, pct: (chargeStart.get(m.id) / posTotal * 100).toFixed(1) }));
    const chargeEqualR  = mapToRows(SplitEngine.applyCharges(chargeStart, [{ amountP: chargeAmountP, splitType: 'equal' }],          memberDefs));
    const chargePropR   = mapToRows(SplitEngine.applyCharges(chargeStart, [{ amountP: chargeAmountP, splitType: 'proportional' }],   memberDefs));
    const chargeAHR     = mapToRows(SplitEngine.applyCharges(chargeStart, [{ amountP: chargeAmountP, splitType: 'account-holder' }], memberDefs));

    // ── 7. Reconciliation ─────────────────────────────────────────────
    const recGrandTotal = fracTotal; // 1273
    const recGoodShares = new Map([['alice', fracResult[0].pence], ['bob', fracResult[1].pence]]); // 764 + 509 = 1273
    const recBadShares  = new Map([['alice', 700], ['bob', fracResult[1].pence]]);                 // 700 + 509 = 1209
    let recBadError = null;
    try { SplitEngine.reconcile(recBadShares, recGrandTotal); } catch (e) { recBadError = e.message; }

    res.render('milkman/maths', {
      title:       'Maths',
      description: 'How the invoice split is calculated.',
      fm,
      memberDefs,
      lr: {
        total:    lrTotal,
        working:  lrWorking,
        floorSum: lrFloorSum,
        leftover: lrTotal - lrFloorSum,
        result:   lrResult,
      },
      whole: { totalP: 350, result: wholeResult },
      fraction: {
        totalP:   fracTotal,
        working:  fracWorking,
        floorSum: fracFloorSum,
        leftover: fracTotal - fracFloorSum,
        result:   fracResult,
      },
      communal: {
        lineQty:     commLineQty,
        lineTotalP:  commLineTotalP,
        ppb:         commPPB,
        units:       commUnits,
        costPerPint: commCPP,
        communalCost: commCost,
        startRows:   mapToRows(commStart),
        result:      commResult,
      },
      adjustments: {
        before: mapToRows(adjStart),
        result: adjResult,
      },
      charges: {
        startRows:    mapToRows(chargeStart),
        amountP:      chargeAmountP,
        propWeights,
        equalResult:  chargeEqualR,
        propResult:   chargePropR,
        ahResult:     chargeAHR,
      },
      reconcile: {
        grandTotal:  recGrandTotal,
        goodShares:  mapToRows(recGoodShares),
        goodSum:     [...recGoodShares.values()].reduce((s, v) => s + v, 0),
        badShares:   mapToRows(recBadShares),
        badSum:      [...recBadShares.values()].reduce((s, v) => s + v, 0),
        badError:    recBadError,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, maths };
