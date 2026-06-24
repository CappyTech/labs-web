'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { computeCoverage } = require('../services/RuleService');

describe('computeCoverage', () => {
  test('no rules → status none', () => {
    const c = computeCoverage([]);
    assert.equal(c.status, 'none');
    assert.equal(c.coveragePct, 0);
  });

  test('single WHOLE rule covers the whole line', () => {
    const c = computeCoverage([{ type: 'WHOLE', member: { name: 'Jack' } }]);
    assert.equal(c.status, 'ok');
    assert.equal(c.coveragePct, 100);
    assert.match(c.message, /Jack/);
  });

  test('two WHOLE rules conflict', () => {
    const c = computeCoverage([
      { type: 'WHOLE', member: { name: 'Jack' } },
      { type: 'WHOLE', member: { name: 'Luke' } },
    ]);
    assert.equal(c.status, 'conflict');
  });

  test('FRACTION rules summing to 1 are ok', () => {
    const c = computeCoverage([
      { type: 'FRACTION', fraction: 2 / 3, member: { name: 'Luke' } },
      { type: 'FRACTION', fraction: 1 / 3, member: { name: 'Ben' } },
    ]);
    assert.equal(c.status, 'ok');
    assert.equal(c.coveragePct, 100);
  });

  test('FRACTION rules under 1 are flagged with the gap', () => {
    const c = computeCoverage([
      { type: 'FRACTION', fraction: 0.33, member: { name: 'Luke' } },
      { type: 'FRACTION', fraction: 0.33, member: { name: 'Ben' } },
    ]);
    assert.equal(c.status, 'under');
    assert.equal(c.coveragePct, 66);
    assert.match(c.message, /34% uncovered/);
  });

  test('FRACTION rules over 1 are flagged as over-allocated', () => {
    const c = computeCoverage([
      { type: 'FRACTION', fraction: 0.6, member: { name: 'Luke' } },
      { type: 'FRACTION', fraction: 0.6, member: { name: 'Ben' } },
    ]);
    assert.equal(c.status, 'over');
    assert.equal(c.coveragePct, 120);
  });

  test('a missing fraction counts as 0 (under-covered)', () => {
    const c = computeCoverage([
      { type: 'FRACTION', fraction: 0.5, member: { name: 'Luke' } },
      { type: 'FRACTION', fraction: null, member: { name: 'Ben' } },
    ]);
    assert.equal(c.status, 'under');
    assert.equal(c.coveragePct, 50);
  });

  test('single FIXED rule takes the whole line', () => {
    const c = computeCoverage([{ type: 'FIXED', fixedQty: 4, member: { name: 'Candice' } }]);
    assert.equal(c.status, 'ok');
    assert.match(c.message, /Candice/);
  });

  test('multi-member FIXED reports the declared unit total', () => {
    const c = computeCoverage([
      { type: 'FIXED', fixedQty: 4, member: { name: 'Jack' } },
      { type: 'FIXED', fixedQty: 2, member: { name: 'Luke' } },
    ]);
    assert.equal(c.status, 'ok');
    assert.match(c.message, /6 units across 2 members/);
  });

  test('multi-member FIXED flags a missing quantity', () => {
    const c = computeCoverage([
      { type: 'FIXED', fixedQty: 4, member: { name: 'Jack' } },
      { type: 'FIXED', fixedQty: null, member: { name: 'Luke' } },
    ]);
    assert.equal(c.status, 'under');
  });

  test('mixed rule types conflict', () => {
    const c = computeCoverage([
      { type: 'WHOLE', member: { name: 'Jack' } },
      { type: 'FRACTION', fraction: 0.5, member: { name: 'Luke' } },
    ]);
    assert.equal(c.status, 'conflict');
    assert.equal(c.type, 'MIXED');
  });
});
