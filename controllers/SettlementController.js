'use strict';

const SettlementService = require('../services/SettlementService');
const { toDTO, formatMoney, err } = require('./dto');

function toSettlementDTO(s) {
  const dto = toDTO(s);
  dto.balances = (s.balances || []).map(b => ({
    member: b.member && b.member.name ? { id: String(b.member._id), name: b.member.name } : String(b.member),
    owed:   formatMoney(b.owedP),
    owedP:  b.owedP,
  }));
  return dto;
}

/**
 * GET /settlements
 * Optional query params: ?from=ISO&to=ISO  — filter by overlapping window.
 */
async function list(req, res, next) {
  try {
    const { from, to } = req.query;
    const settlements = (from && to)
      ? await SettlementService.getSettlementsInWindow(new Date(from), new Date(to))
      : await SettlementService.getAllSettlements();
    res.json(settlements.map(toSettlementDTO));
  } catch (e) { next(e); }
}

/**
 * POST /settlements
 * Body: { cadence, windowStart, windowEnd }
 */
async function create(req, res, next) {
  try {
    const { cadence, windowStart, windowEnd } = req.body;
    if (!cadence || !windowStart || !windowEnd) {
      return err(res, 400, 'VALIDATION', 'cadence, windowStart and windowEnd are required');
    }
    if (!['weekly', 'monthly', 'ad-hoc'].includes(cadence)) {
      return err(res, 400, 'VALIDATION', 'cadence must be weekly, monthly or ad-hoc');
    }
    const settlement = await SettlementService.createWindowSettlement({
      cadence,
      windowStart: new Date(windowStart),
      windowEnd:   new Date(windowEnd),
    });
    res.status(201).json(toSettlementDTO(settlement.toObject()));
  } catch (e) { next(e); }
}

/**
 * GET /settlements/:id
 */
async function get(req, res, next) {
  try {
    const settlement = await SettlementService.getSettlementById(req.params.id);
    if (!settlement) return err(res, 404, 'NOT_FOUND', 'Settlement not found');
    res.json(toSettlementDTO(settlement));
  } catch (e) { next(e); }
}

module.exports = { list, create, get };
