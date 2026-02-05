// Placeholder for middleware
// Authentication, validation, etc.

// const jwt = require('jsonwebtoken');
// const config = require('../config');

const authenticate = (req, res, next) => {
  // Disabled - no authentication required
  next();
};

const validateFilename = (req, res, next) => {
  // Basic filename validation to prevent path traversal
  const filename = req.params.filename;
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({
      status_code: 400,
      detail: 'Invalid filename',
      path: req.path,
      method: req.method
    });
  }
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status_code: 500,
    detail: 'Internal server error',
    path: req.path,
    method: req.method
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    status_code: 404,
    detail: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
};

module.exports = {
  authenticate,
  validateFilename,
  errorHandler,
  notFound
};