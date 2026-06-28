'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { communalValueP } = require('../services/InvoiceService');
const { applyCommunalEvents, reconcile } = require('../services/SplitEngine');

describe('communalValueP', () => {
  test('values the communal portion as a rounded share of the line', () => {
    // 4 bottles × 2 pints = 8 pints for 1273p; 3 pints communal.
    // round(1273 × 3 / 8) = round(477.375) = 477.
    assert.equal(communalValueP(1273, 3, 8), 477);
  });

  test('whole line communal reimburses the buyer the full line total', () => {
    // 3 pints for 290p (96.6̇p/pint), all communal. A floored per-pint rate
    // would give 96 × 3 = 288 and short the buyer by 2p; valuing directly gives
    // the full 290 back.
    assert.equal(communalValueP(290, 3, 3), 290);
  });

  test('rounds to nearest (not floor) at the half-penny boundary', () => {
    // round(100 × 1 / 8) = round(12.5) = 13, where floor would give 12.
    assert.equal(communalValueP(100, 1, 8), 13);
  });
});

describe('communal split has no buyer bias (regression)', () => {
  test('290p / 3 pints, whole line communal between buyer + 1 → fair 145/145', () => {
    const lineTotalP = 290;
    const value = communalValueP(lineTotalP, 3, 3); // 290
    // Buyer A holds the whole line (WHOLE rule); both share all 3 pints.
    let shares = new Map([['A', lineTotalP], ['B', 0]]);
    shares = applyCommunalEvents(shares, [{
      units:             3,
      communalCostPence: value,
      buyerId:           'A',
      participantIds:    ['A', 'B'],
    }]);
    assert.equal(shares.get('A'), 145); // not 146 as the old floor produced
    assert.equal(shares.get('B'), 145);
    assert.doesNotThrow(() => reconcile(shares, lineTotalP));
  });
});
