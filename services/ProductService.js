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
  const products = await Product.find().lean();
  const groups = new Map();
  for (const p of products) {
    const key = `${p.name.toLowerCase().trim()}|${p.priceP}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupes = [...groups.values()].filter(g => g.length > 1);
  if (dupes.length === 0) {
    console.log('[milkman] product check OK — no duplicates');
    return;
  }
  console.warn(`[milkman] ⚠ ${dupes.length} duplicate product group(s):`);
  for (const group of dupes) {
    const { name, priceP } = group[0];
    const ids = group.map(p => String(p._id)).join(', ');
    console.warn(`  "${name}" £${(priceP / 100).toFixed(2)} — ${group.length} copies [${ids}]`);
  }
}

module.exports = { getActiveProducts, getAllProducts, getProductById, findByNameAndPrice, createProduct, updateProduct, checkDuplicates };
