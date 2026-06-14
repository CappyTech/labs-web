'use strict';

const ProductService = require('../services/ProductService');
const { toDTO, err } = require('./dto');

async function list(req, res, next) {
  try {
    const products = await ProductService.getAllProducts();
    res.json(products.map(toDTO));
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name, priceP, pintsPerBottle, category } = req.body;
    if (!name || priceP == null) return err(res, 400, 'VALIDATION', 'name and priceP are required');
    if (typeof priceP !== 'number' || priceP < 0) return err(res, 400, 'VALIDATION', 'priceP must be a non-negative integer');
    const product = await ProductService.createProduct({ name, priceP, pintsPerBottle, category });
    res.status(201).json(toDTO(product.toObject()));
  } catch (e) { next(e); }
}

async function get(req, res, next) {
  try {
    const product = await ProductService.getProductById(req.params.id);
    if (!product) return err(res, 404, 'NOT_FOUND', 'Product not found');
    res.json(toDTO(product));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const product = await ProductService.updateProduct(req.params.id, req.body);
    if (!product) return err(res, 404, 'NOT_FOUND', 'Product not found');
    res.json(toDTO(product));
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const product = await ProductService.updateProduct(req.params.id, { active: false });
    if (!product) return err(res, 404, 'NOT_FOUND', 'Product not found');
    res.status(204).end();
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update, remove };
