'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { splitBundleTotal } = require('../services/InvoiceService');

describe('splitBundleTotal', () => {
  test('splits a bundle by component reference prices and reconciles', () => {
    // £4.10 bundle = 2 Pints Whole Milk (ref £2.46) + 6 Eggs (ref £1.64).
    const shares = splitBundleTotal(410, [{ priceP: 246 }, { priceP: 164 }]);
    assert.deepEqual(shares, [246, 164]);
    assert.equal(shares[0] + shares[1], 410);
  });

  test('scales to the actual line total, not the reference total', () => {
    // Same 60/40 weights, but the line arrived at £5.00.
    const shares = splitBundleTotal(500, [{ priceP: 246 }, { priceP: 164 }]);
    assert.equal(shares[0] + shares[1], 500);
    assert.equal(shares[0], 300); // 246/410 × 500
    assert.equal(shares[1], 200); // 164/410 × 500
  });

  test('distributes odd pennies so it always reconciles', () => {
    const shares = splitBundleTotal(101, [{ priceP: 1 }, { priceP: 1 }, { priceP: 1 }]);
    assert.equal(shares.reduce((s, v) => s + v, 0), 101);
    assert.ok(shares.every(v => v === 33 || v === 34));
  });

  test('returns null when there are no reference prices to split by', () => {
    assert.equal(splitBundleTotal(410, [{ priceP: 0 }, { priceP: 0 }]), null);
  });
});
