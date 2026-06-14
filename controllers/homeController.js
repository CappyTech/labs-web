'use strict';

const moduleService = require('../services/moduleService');

/**
 * GET /
 */
function index(req, res) {
  res.render('index', {
    title: 'Cappy Labs',
    description: 'Cappy Labs — a home for small experiments and self-hosted projects.',
    modules: moduleService.getModules(),
  });
}

module.exports = { index };
