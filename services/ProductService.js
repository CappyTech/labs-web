'use strict';

const Product = require('../models/Product');

async function getActiveProducts() {
  return Product.find({ active: true }).sort({ name: 1 }).lean();
}

async function getAllProducts() {
  return Product.find().sort({ name: 1 }).lean();
}

async function getProductById(id) {
  return Product.findById(id).lean();
}

async function findByNameAndPrice(name, priceP) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Product.findOne({ name: { $regex: `^${escaped}$`, $options: 'i' }, priceP }).lean();
}

async function createProduct(data) {
  const product = new Product(data);
  return product.save();
}

async function updateProduct(id, data) {
  return Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

async function checkDuplicates() {
  const AllocationRule = require('../models/AllocationRule');
  const Invoice        = require('../models/Invoice');

  const products = await Product.find().lean();
  const groups = new Map();
  for (const p of products) {
    const key = `${p.name.toLowerCase().trim()}|${p.priceP}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupeGroups = [...groups.values()].filter(g => g.length > 1);
  if (dupeGroups.length === 0) {
    console.log('[milkman] product check OK — no duplicates');
    return;
  }

  console.warn(`[milkman] ⚠ ${dupeGroups.length} duplicate product group(s) — auto-fixing...`);

  for (const group of dupeGroups) {
    group.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    const [canonical, ...dupes] = group;
    const dupeIds = dupes.map(p => p._id);

    console.warn(`  "${canonical.name}" £${(canonical.priceP / 100).toFixed(2)} — keeping ${canonical._id}, removing ${dupeIds.join(', ')}`);

    await Invoice.updateMany(
      { 'deliveryDays.lineItems.product': { $in: dupeIds } },
      { $set: { 'deliveryDays.$[].lineItems.$[item].product': canonical._id } },
      { arrayFilters: [{ 'item.product': { $in: dupeIds } }] }
    );

    await Invoice.updateMany(
      { 'deliveryDays.communalEvents.product': { $in: dupeIds } },
      { $set: { 'deliveryDays.$[].communalEvents.$[evt].product': canonical._id } },
      { arrayFilters: [{ 'evt.product': { $in: dupeIds } }] }
    );

    await AllocationRule.updateMany(
      { product: { $in: dupeIds } },
      { $set: { product: canonical._id } }
    );

    await Product.deleteMany({ _id: { $in: dupeIds } });
  }

  console.log('[milkman] product dedup complete');
}

module.exports = { getActiveProducts, getAllProducts, getProductById, findByNameAndPrice, createProduct, updateProduct, checkDuplicates };
