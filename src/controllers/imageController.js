const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const ResponseHelper = require('../utils/responseHelper');

// Import socket handler to notify new images
let imageSocketHandler = null;

function setSocketHandler(handler) {
  imageSocketHandler = handler;
}

// In-memory Map to store hash -> {result}
const imageMap = new Map();

const imageController = {
  // I) Upload image and return unique hash
  uploadImage: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json(ResponseHelper.badRequest("No file uploaded"));
      }

      // Generate unique hash
      const hash = crypto.randomBytes(16).toString('hex');

      // Get original file extension
      const originalExt = path.extname(req.file.originalname).toLowerCase();
      const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
      const fileExt = allowedExts.includes(originalExt) ? originalExt : '.png';

      // Move file to uploads directory with hash as filename
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const originalPath = req.file.path;
      const newPath = path.join(uploadDir, `${hash}${fileExt}`);

      console.log(`Uploading file: ${req.file.originalname} -> ${newPath}`);

      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });

      // Move and rename file
      await fs.rename(originalPath, newPath);

      console.log(`File moved successfully to: ${newPath}`);

      // Store in map
      imageMap.set(hash, {
        result: null
      });

      // Notify WebSocket clients about new image
      if (imageSocketHandler && imageSocketHandler.addNewImage) {
        imageSocketHandler.addNewImage(hash);
        console.log(`Notified WebSocket clients about new image: ${hash}`);
      }

      console.log(`Image upload completed successfully: ${hash}`);
      res.json(ResponseHelper.success({ hash }, "Image uploaded successfully"));
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json(ResponseHelper.internalError("Upload failed"));
    }
  },

  // II) Get all hashes
  listHashImages: async (req, res) => {
    try {
      const hashes = Array.from(imageMap.keys());
      res.json(ResponseHelper.success({ hashes }, "Hashes retrieved successfully"));
    } catch (error) {
      console.error('List hashes error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to get hashes"));
    }
  },

  // III) Get image by hash
  processImage: async (req, res) => {
    try {
      const { hash } = req.params;

      if (!imageMap.has(hash)) {
        return res.status(404).json(ResponseHelper.notFound("Hash"));
      }

      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = path.join(uploadDir, `${hash}.png`);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json(ResponseHelper.notFound("Image file"));
      }

      // Send file
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Process image error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to process image"));
    }
  },

  // IV) Set result (for WebSocket processing)
  setResult: async (req, res) => {
    try {
      const { hash } = req.params;
      const { result } = req.body;

      if (!imageMap.has(hash)) {
        return res.status(404).json(ResponseHelper.notFound("Hash"));
      }

      // Update result
      imageMap.get(hash).result = result;

      res.json(ResponseHelper.success(null, "Result set successfully"));
    } catch (error) {
      console.error('Set result error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to set result"));
    }
  },

  // V) Get result and remove hash from map
  getResult: async (req, res) => {
    try {
      const { hash } = req.params;

      if (!imageMap.has(hash)) {
        return res.status(404).json(ResponseHelper.notFound("Hash"));
      }

      const imageData = imageMap.get(hash);
      const result = imageData.result;

      // Remove from map
      imageMap.delete(hash);

      res.json(ResponseHelper.success({ result }, "Result retrieved successfully"));
    } catch (error) {
      console.error('Get result error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to get result"));
    }
  }
};

module.exports = imageController;
module.exports.setSocketHandler = setSocketHandler;