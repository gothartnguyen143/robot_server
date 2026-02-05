const ResponseHelper = require('../utils/responseHelper');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(ResponseHelper.badRequest('File too large. Maximum size is 100MB.'));
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(ResponseHelper.badRequest('Too many files uploaded.'));
  }

  // Default error response
  res.status(500).json(ResponseHelper.internalError(
    process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  ));
};

const notFound = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
};

module.exports = {
  errorHandler,
  notFound
};