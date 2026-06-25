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
    // Candidate component products: everything else that isn't itself a bundle
    // (no nested bundles) — used to populate the add-component dropdown.
    const allProducts = await ProductService.getAllProducts();
    const componentChoices = allProducts.filter(p =>
      String(p._id) !== String(product._id) && !(p.components && p.components.length > 0)
    );
    const componentTotalP = (product.components || []).reduce((s, c) => s + (c.priceP || 0), 0);
    res.render('milkman/products/edit', {
      title:       `Edit ${product.name}`,
      description: `Edit product ${product.name}.`,
      product,
      componentChoices,
      componentTotalP,
    });
  } catch (err) { next(err); }
}

async function addComponent(req, res, next) {
  try {
    const { productId, qty, priceP } = req.body;
    if (productId && priceP != null) {
      await ProductService.addComponent(req.params.id, {
        product: productId,
        qty:     qty ? parseFloat(qty) : 1,
        priceP:  parseInt(priceP, 10),
      });
    }
    res.redirect(`/milkman/products/${req.params.id}/edit`);
  } catch (err) { next(err); }
}

async function removeComponent(req, res, next) {
  try {
    await ProductService.removeComponent(req.params.id, parseInt(req.params.index, 10));
    res.redirect(`/milkman/products/${req.params.id}/edit`);
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

module.exports = { list, create, editForm, update, addComponent, removeComponent };
