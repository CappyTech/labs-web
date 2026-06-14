'use strict';

const RuleService = require('../services/RuleService');
const { toDTO, err } = require('./dto');

async function list(req, res, next) {
  try {
    const rules = await RuleService.getAllRules();
    res.json(rules.map(toDTO));
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { product, member, type, fraction, fixedQty } = req.body;
    if (!product || !member || !type) {
      return err(res, 400, 'VALIDATION', 'product, member and type are required');
    }
    if (!['WHOLE', 'FRACTION', 'FIXED'].includes(type)) {
      return err(res, 400, 'VALIDATION', 'type must be WHOLE, FRACTION or FIXED');
    }
    if (type === 'FRACTION' && (fraction == null || fraction <= 0 || fraction > 1)) {
      return err(res, 400, 'VALIDATION', 'fraction must be 0 < fraction <= 1 for FRACTION rules');
    }
    const rule = await RuleService.createRule({ product, member, type, fraction, fixedQty });
    res.status(201).json(toDTO(rule.toObject()));
  } catch (e) {
    if (e.code === 11000) return err(res, 409, 'CONFLICT', 'An allocation rule for this product/member pair already exists');
    next(e);
  }
}

async function get(req, res, next) {
  try {
    const rule = await RuleService.getRuleById(req.params.id);
    if (!rule) return err(res, 404, 'NOT_FOUND', 'Allocation rule not found');
    res.json(toDTO(rule));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const rule = await RuleService.updateRule(req.params.id, req.body);
    if (!rule) return err(res, 404, 'NOT_FOUND', 'Allocation rule not found');
    res.json(toDTO(rule));
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const rule = await RuleService.deleteRule(req.params.id);
    if (!rule) return err(res, 404, 'NOT_FOUND', 'Allocation rule not found');
    res.status(204).end();
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update, remove };
