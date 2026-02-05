const ResponseHelper = require('../utils/responseHelper');

const notFound = (req, res) => {
  res.status(404).json(ResponseHelper.error('Endpoint not found', 404, {
    path: req.path,
    method: req.method
  }));
};

module.exports = notFound;