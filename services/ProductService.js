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

async function createProduct(data) {
  const product = new Product(data);
  return product.save();
}

async function updateProduct(id, data) {
  return Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

module.exports = { getActiveProducts, getAllProducts, getProductById, createProduct, updateProduct };
