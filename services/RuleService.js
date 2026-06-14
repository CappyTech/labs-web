'use strict';

const AllocationRule = require('../models/AllocationRule');

/** Return all rules, populated with product and member names. */
async function getAllRules() {
  return AllocationRule.find()
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

/** Return all rules for a specific product. */
async function getRulesForProduct(productId) {
  return AllocationRule.find({ product: productId })
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

/** Return a single rule by its own _id. */
async function getRuleById(id) {
  return AllocationRule.findById(id)
    .populate('product', 'name')
    .populate('member', 'name')
    .lean();
}

async function createRule(data) {
  const rule = new AllocationRule(data);
  return rule.save();
}

async function updateRule(id, data) {
  return AllocationRule.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

async function deleteRule(id) {
  return AllocationRule.findByIdAndDelete(id);
}

module.exports = { getAllRules, getRulesForProduct, getRuleById, createRule, updateRule, deleteRule };
