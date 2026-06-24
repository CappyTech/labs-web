'use strict';

const RuleService    = require('../services/RuleService');
const ProductService = require('../services/ProductService');
const MemberService  = require('../services/MemberService');

async function list(req, res, next) {
  try {
    const [rules, products, members] = await Promise.all([
      RuleService.getAllRules(),
      ProductService.getActiveProducts(),
      MemberService.getActiveMembers(),
    ]);

    // Group rules by product for display.
    const grouped = new Map();
    for (const rule of rules) {
      const key = String(rule.product._id);
      if (!grouped.has(key)) grouped.set(key, { name: rule.product.name, rules: [] });
      grouped.get(key).rules.push(rule);
    }

    // Attach per-product coverage so incomplete/over-allocated rules surface
    // here rather than only failing at split time.
    const groupedRules = [...grouped.values()].map(g => ({ ...g, coverage: RuleService.computeCoverage(g.rules) }));
    const coverageIssues = groupedRules.filter(g => g.coverage.status !== 'ok').length;

    res.render('milkman/rules/index', {
      title:            'Allocation Rules',
      description:      'Per-member product allocation rules.',
      groupedRules,
      coverageIssues,
      productsWithRules: new Set(grouped.keys()),
      products,
      members,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { productId, memberId, type, fraction, fixedQty } = req.body;
    if (productId && memberId && type) {
      const data = { product: productId, member: memberId, type };
      if (type === 'FRACTION') data.fraction = parseFloat(fraction);
      if (type === 'FIXED')    data.fixedQty  = parseFloat(fixedQty);
      await RuleService.createRule(data);
    }
    res.redirect('/milkman/rules');
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await RuleService.deleteRule(req.params.id);
    res.redirect('/milkman/rules');
  } catch (err) { next(err); }
}

module.exports = { list, create, remove };
