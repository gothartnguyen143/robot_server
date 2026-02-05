// Placeholder for configuration
// Add database config, external services, etc.

module.exports = {
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFilesPerUpload: parseInt(process.env.MAX_FILES_PER_UPLOAD) || 20,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '24h'
};