'use strict';

const ProductService = require('../services/ProductService');

async function list(req, res, next) {
  try {
    const products = await ProductService.getAllProducts();
    res.render('milkman/products/index', {
      title:       'Products',
      description: 'Milk-round products.',
      products,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, priceP, pintsPerBottle, category } = req.body;
    if (name && priceP != null) {
      await ProductService.createProduct({
        name:           name.trim(),
        priceP:         parseInt(priceP, 10),
        pintsPerBottle: pintsPerBottle ? parseFloat(pintsPerBottle) : null,
        category:       category?.trim() || '',
      });
    }
    res.redirect('/milkman/products');
  } catch (err) { next(err); }
}

async function editForm(req, res, next) {
  try {
    const product = await ProductService.getProductById(req.params.id);
    if (!product) return res.redirect('/milkman/products');
    res.render('milkman/products/edit', {
      title:       `Edit ${product.name}`,
      description: `Edit product ${product.name}.`,
      product,
    });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, priceP, pintsPerBottle, category, active } = req.body;
    await ProductService.updateProduct(req.params.id, {
      name:           name?.trim(),
      priceP:         parseInt(priceP, 10),
      pintsPerBottle: pintsPerBottle ? parseFloat(pintsPerBottle) : null,
      category:       category?.trim() || '',
      active:         active === 'on',
    });
    res.redirect('/milkman/products');
  } catch (err) { next(err); }
}

module.exports = { list, create, editForm, update };
