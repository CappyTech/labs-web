'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  largestRemainder,
  splitFraction,
  allocateLines,
  applyAdjustments,
  applyCommunalEvents,
  applyCharges,
  explainSplit,
  reconcile,
} = require('../services/SplitEngine');

const {
  FractionsDoNotSumError,
  UnknownProductError,
  ReconciliationError,
  UnknownMemberError,
  FixedQtyMismatchError,
} = require('../services/errors');

// ── largestRemainder ────────────────────────────────────────────────────────

describe('largestRemainder', () => {
  test('distributes exact pence with no remainder', () => {
    const parts = [
      { id: 'a', weight: 0.5 },
      { id: 'b', weight: 0.5 },
    ];
    const result = largestRemainder(200, parts);
    assert.equal(result.get('a'), 100);
    assert.equal(result.get('b'), 100);
  });

  test('distributes a penny to the largest fractional remainder', () => {
    // 10p split three ways: 3.33, 3.33, 3.34 → two get 3, one gets 4
    const parts = [
      { id: 'a', weight: 1 / 3 },
      { id: 'b', weight: 1 / 3 },
      { id: 'c', weight: 1 / 3 },
    ];
    const result = largestRemainder(10, parts);
    const values = [...result.values()];
    assert.equal(values.reduce((s, v) => s + v, 0), 10);
    assert.ok(values.every(v => v === 3 || v === 4));
  });

  test('result always sums to totalPence exactly', () => {
    // Arbitrary split that exercises remainder logic
    const parts = [
      { id: 'x', weight: 0.3 },
      { id: 'y', weight: 0.3 },
      { id: 'z', weight: 0.4 },
    ];
    const result = largestRemainder(101, parts);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    assert.equal(sum, 101);
  });
});

// ── splitFraction ───────────────────────────────────────────────────────────

describe('splitFraction', () => {
  test('splits a line by declared fractions', () => {
    const fracs = [
      { memberId: 'a', fraction: 0.75 },
      { memberId: 'b', fraction: 0.25 },
    ];
    const result = splitFraction(100, fracs);
    assert.equal(result.get('a'), 75);
    assert.equal(result.get('b'), 25);
  });

  test('throws FractionsDoNotSumError when fractions do not sum to 1', () => {
    const fracs = [
      { memberId: 'a', fraction: 0.4 },
      { memberId: 'b', fraction: 0.4 },
    ];
    assert.throws(() => splitFraction(100, fracs), FractionsDoNotSumError);
  });

  test('result sums to lineTotalPence exactly', () => {
    const fracs = [
      { memberId: 'a', fraction: 1 / 3 },
      { memberId: 'b', fraction: 1 / 3 },
      { memberId: 'c', fraction: 1 / 3 },
    ];
    const result = splitFraction(100, fracs);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    assert.equal(sum, 100);
  });
});

// ── allocateLines ───────────────────────────────────────────────────────────

describe('allocateLines', () => {
  const members = [{ id: 'alice' }, { id: 'bob' }];

  test('WHOLE rule assigns full line to one member', () => {
    const lines = [{ productId: 'p1', totalP: 150 }];
    const rules = new Map([
      ['p1', { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 150);
    assert.equal(shares.get('bob'), 0);
  });

  test('FRACTION rule splits line across members', () => {
    const lines = [{ productId: 'p1', totalP: 200 }];
    const rules = new Map([
      ['p1', {
        type: 'FRACTION',
        assignments: [
          { memberId: 'alice', fraction: 0.5 },
          { memberId: 'bob',   fraction: 0.5 },
        ],
      }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 100);
    assert.equal(shares.get('bob'), 100);
  });

  test('throws UnknownProductError for a product with no rule', () => {
    const lines = [{ productId: 'unknown', totalP: 100 }];
    assert.throws(
      () => allocateLines(lines, new Map(), members),
      UnknownProductError
    );
  });

  test('initialises zero shares for all members even with no lines', () => {
    const shares = allocateLines([], new Map(), members);
    assert.equal(shares.get('alice'), 0);
    assert.equal(shares.get('bob'), 0);
  });

  test('single FIXED rule assigns the whole line (backward compatible)', () => {
    const lines = [{ productId: 'bundle', totalP: 400, qty: 4 }];
    const rules = new Map([
      ['bundle', { type: 'FIXED', assignments: [{ memberId: 'alice', fixedQty: 4 }] }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 400);
    assert.equal(shares.get('bob'), 0);
  });

  test('multi-member FIXED splits a line by unit count and reconciles', () => {
    // 6-egg line of 300p: alice 4, bob 2 → 200p / 100p.
    const members3 = [{ id: 'alice' }, { id: 'bob' }];
    const lines = [{ productId: 'eggs', totalP: 300, qty: 6 }];
    const rules = new Map([
      ['eggs', { type: 'FIXED', assignments: [
        { memberId: 'alice', fixedQty: 4 },
        { memberId: 'bob',   fixedQty: 2 },
      ] }],
    ]);
    const shares = allocateLines(lines, rules, members3);
    assert.equal(shares.get('alice'), 200);
    assert.equal(shares.get('bob'), 100);
    assert.equal(shares.get('alice') + shares.get('bob'), 300);
  });

  test('multi-member FIXED distributes odd pennies via largest-remainder', () => {
    const lines = [{ productId: 'eggs', totalP: 100, qty: 3 }];
    const rules = new Map([
      ['eggs', { type: 'FIXED', assignments: [
        { memberId: 'alice', fixedQty: 2 },
        { memberId: 'bob',   fixedQty: 1 },
      ] }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice') + shares.get('bob'), 100);
  });

  test('multi-member FIXED throws when quantities do not match the line qty', () => {
    const lines = [{ productId: 'eggs', totalP: 300, qty: 5 }];
    const rules = new Map([
      ['eggs', { type: 'FIXED', assignments: [
        { memberId: 'alice', fixedQty: 4 },
        { memberId: 'bob',   fixedQty: 2 },
      ] }],
    ]);
    assert.throws(() => allocateLines(lines, rules, members), FixedQtyMismatchError);
  });

  test('multi-member FIXED with no line qty apportions without validating', () => {
    const lines = [{ productId: 'eggs', totalP: 300 }];
    const rules = new Map([
      ['eggs', { type: 'FIXED', assignments: [
        { memberId: 'alice', fixedQty: 4 },
        { memberId: 'bob',   fixedQty: 2 },
      ] }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 200);
    assert.equal(shares.get('bob'), 100);
  });

  test('accumulates multiple lines correctly', () => {
    const lines = [
      { productId: 'p1', totalP: 100 },
      { productId: 'p2', totalP: 60 },
    ];
    const rules = new Map([
      ['p1', { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }],
      ['p2', { type: 'WHOLE', assignments: [{ memberId: 'bob' }] }],
    ]);
    const shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 100);
    assert.equal(shares.get('bob'), 60);
  });
});

// ── applyAdjustments ────────────────────────────────────────────────────────

describe('applyAdjustments', () => {
  test('applies a credit (negative amountPence) correctly', () => {
    const shares = new Map([['alice', 500], ['bob', 300]]);
    const result = applyAdjustments(shares, [{ memberId: 'alice', amountPence: -50 }]);
    assert.equal(result.get('alice'), 450);
    assert.equal(result.get('bob'), 300);
  });

  test('applies a surcharge (positive amountPence) correctly', () => {
    const shares = new Map([['alice', 100], ['bob', 100]]);
    const result = applyAdjustments(shares, [{ memberId: 'bob', amountPence: 20 }]);
    assert.equal(result.get('bob'), 120);
  });

  test('does not mutate the input map', () => {
    const shares = new Map([['alice', 100]]);
    applyAdjustments(shares, [{ memberId: 'alice', amountPence: -10 }]);
    assert.equal(shares.get('alice'), 100);
  });

  test('throws UnknownMemberError for a member not in shares', () => {
    const shares = new Map([['alice', 100]]);
    assert.throws(
      () => applyAdjustments(shares, [{ memberId: 'ghost', amountPence: -10 }]),
      UnknownMemberError
    );
  });
});

// ── applyCommunalEvents ─────────────────────────────────────────────────────

describe('applyCommunalEvents', () => {
  test('credits the buyer and re-charges participants equally', () => {
    // alice holds 200p (bought 2 bottles). 100p-worth used communally.
    // alice and bob share the communal portion → each owes 50p.
    // alice net: 200 - 100 + 50 = 150; bob: 0 + 50 = 50.
    const shares = new Map([['alice', 200], ['bob', 0]]);
    const events = [{
      units:             1,
      communalCostPence: 100,
      buyerId:           'alice',
      participantIds:    ['alice', 'bob'],
    }];
    const result = applyCommunalEvents(shares, events);
    assert.equal(result.get('alice'), 150);
    assert.equal(result.get('bob'), 50);
  });

  test('communal total equals original communal cost', () => {
    const shares = new Map([['alice', 300], ['bob', 0], ['carol', 0]]);
    const events = [{
      units:             3,
      communalCostPence: 300,
      buyerId:           'alice',
      participantIds:    ['alice', 'bob', 'carol'],
    }];
    const result = applyCommunalEvents(shares, events);
    const communalTotal = [...result.values()].reduce((s, v) => s + v, 0);
    // Grand total is unchanged: alice started with 300, communal doesn't change the sum.
    assert.equal(communalTotal, 300);
  });
});

// ── reconcile ───────────────────────────────────────────────────────────────

describe('reconcile', () => {
  test('passes when shares sum equals grandTotal', () => {
    const shares = new Map([['a', 60], ['b', 40]]);
    assert.doesNotThrow(() => reconcile(shares, 100));
  });

  test('throws ReconciliationError when shares do not sum to grandTotal', () => {
    const shares = new Map([['a', 60], ['b', 39]]);
    assert.throws(() => reconcile(shares, 100), ReconciliationError);
  });
});

// ── explainSplit ─────────────────────────────────────────────────────────────

describe('explainSplit', () => {
  // Runs the normal pipeline and the explainer over identical inputs, then
  // asserts each member's ledger sums to their pipeline total — the explainer
  // must attribute, never alter, the maths.
  function runPipeline(lines, rules, members, { communalEvents = [], adjustments = [], charges = [] } = {}) {
    let shares = allocateLines(lines, rules, members);
    if (communalEvents.length) shares = applyCommunalEvents(shares, communalEvents);
    if (adjustments.length)    shares = applyAdjustments(shares, adjustments);
    if (charges.length)        shares = applyCharges(shares, charges, members);
    return shares;
  }

  function assertLedgerMatches(lines, rules, members, opts = {}) {
    const shares = runPipeline(lines, rules, members, opts);
    const ledger = explainSplit(lines, rules, members, opts);
    for (const m of members) {
      const sum = (ledger.get(m.id) || []).reduce((s, e) => s + e.amountP, 0);
      assert.equal(sum, shares.get(m.id), `ledger for ${m.id} should equal pipeline share`);
    }
  }

  test('line ledger attributes WHOLE and FRACTION lines per member', () => {
    const members = [{ id: 'alice' }, { id: 'bob' }];
    const lines = [
      { productId: 'milk',  totalP: 300 },
      { productId: 'cream', totalP: 250 },
    ];
    const rules = new Map([
      ['milk',  { type: 'FRACTION', assignments: [
        { memberId: 'alice', fraction: 0.6 },
        { memberId: 'bob',   fraction: 0.4 },
      ] }],
      ['cream', { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }],
    ]);

    const ledger = explainSplit(lines, rules, members);
    const alice = ledger.get('alice');
    assert.equal(alice.length, 2);
    assert.equal(alice.find(e => e.productId === 'cream').ruleType, 'WHOLE');
    assert.equal(alice.find(e => e.productId === 'milk').fraction, 0.6);

    assertLedgerMatches(lines, rules, members);
  });

  test('ledger reconciles with FRACTION + communal + adjustment + charge', () => {
    const members = [{ id: 'alice', isBuyer: true }, { id: 'bob' }, { id: 'carol' }];
    const lines = [{ productId: 'milk', totalP: 1200 }];
    const rules = new Map([
      ['milk', { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }],
    ]);
    const opts = {
      communalEvents: [{ productId: 'milk', units: 2, communalCostPence: 200, buyerId: 'alice', participantIds: ['alice', 'bob', 'carol'] }],
      adjustments:    [{ memberId: 'bob', amountPence: -150 }],
      charges:        [{ amountP: 90, splitType: 'equal' }],
    };
    assertLedgerMatches(lines, rules, members, opts);

    // Buyer's communal entry is tagged as a buyer role.
    const ledger = explainSplit(lines, rules, members, opts);
    const aliceCommunal = ledger.get('alice').find(e => e.source === 'communal');
    assert.equal(aliceCommunal.role, 'buyer');
  });
});

// ── end-to-end integration ──────────────────────────────────────────────────

describe('full split pipeline', () => {
  test('WHOLE + adjustment + reconcile produces correct balances', () => {
    const members = [{ id: 'alice' }, { id: 'bob' }];
    const lines = [
      { productId: 'milk',  totalP: 800 },
      { productId: 'cream', totalP: 200 },
    ];
    const rules = new Map([
      ['milk',  { type: 'WHOLE', assignments: [{ memberId: 'alice' }] }],
      ['cream', { type: 'WHOLE', assignments: [{ memberId: 'bob' }] }],
    ]);

    let shares = allocateLines(lines, rules, members);
    assert.equal(shares.get('alice'), 800);
    assert.equal(shares.get('bob'), 200);

    // Alice gets a 50p credit (she overpaid last week).
    shares = applyAdjustments(shares, [{ memberId: 'alice', amountPence: -50 }]);
    assert.equal(shares.get('alice'), 750);
    assert.equal(shares.get('bob'), 200);

    // Total is still 950p.
    assert.doesNotThrow(() => reconcile(shares, 950));
  });

  test('FRACTION + communal event + reconcile produces correct balances', () => {
    // 1 bottle of milk (4 pints), totalP = 120p, split 50/50.
    // Alice and bob each owe 60p initially.
    // 2 of the 4 pints used communally by both → communal value =
    //   round(120 × 2 / 4) = 60p.
    // Alice (buyer) gets -60p credit then +30p re-charge → net 60 - 60 + 30 = 30.
    // Bob gets 60 + 30 = 90.
    // Total = 120.
    const members = [{ id: 'alice' }, { id: 'bob' }];
    const lines = [{ productId: 'milk', totalP: 120 }];
    const rules = new Map([
      ['milk', {
        type: 'FRACTION',
        assignments: [
          { memberId: 'alice', fraction: 0.5 },
          { memberId: 'bob',   fraction: 0.5 },
        ],
      }],
    ]);

    let shares = allocateLines(lines, rules, members);

    const communalEvents = [{
      units:             2,
      communalCostPence: 60,
      buyerId:           'alice',
      participantIds:    ['alice', 'bob'],
    }];
    shares = applyCommunalEvents(shares, communalEvents);

    assert.equal(shares.get('alice'), 30);
    assert.equal(shares.get('bob'),   90);
    assert.doesNotThrow(() => reconcile(shares, 120));
  });
});
