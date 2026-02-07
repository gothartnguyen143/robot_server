const crypto = require('crypto');
const fs = require('fs').promises;
const fsExtra = require('fs-extra');
const path = require('path');
const ResponseHelper = require('../utils/responseHelper');

// File-based storage
const DATA_PATH = path.join(__dirname, '../../data/images.json');
async function readImageData() {
  try {
    await fsExtra.ensureDir(path.dirname(DATA_PATH));
    const data = await fsExtra.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}
async function writeImageData(data) {
  await fsExtra.ensureDir(path.dirname(DATA_PATH));
  await fsExtra.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

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
        result: null,
        btn_1: null,
        btn_2: null
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
      const imageData = await readImageData();
      const hashes = Object.keys(imageData);
      res.json(ResponseHelper.success({ hashes, count: hashes.length }, "Hashes retrieved successfully"));
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
      const { result, btn_1, btn_2 } = req.body;

      if (!imageMap.has(hash)) {
        return res.status(404).json(ResponseHelper.notFound("Hash"));
      }

      // Update result, btn_1, btn_2
      const imageData = imageMap.get(hash);
      if (result !== undefined) imageData.result = result;
      if (btn_1 !== undefined) imageData.btn_1 = btn_1;
      if (btn_2 !== undefined) imageData.btn_2 = btn_2;

      res.json(ResponseHelper.success(null, "Result set successfully"));
    } catch (error) {
      console.error('Set result error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to set result"));
    }
  },

  // V) Get result and remove hash from map and file (only if result, btn_1, btn_2 are not null)
  getResult: async (req, res) => {
    try {
      const { hash } = req.params;

      // Check in file first
      const imageDataFile = await readImageData();
      if (!imageDataFile[hash]) {
        return res.status(404).json(ResponseHelper.notFound("Hash"));
      }

      const { result, btn_1, btn_2, src_path_img } = imageDataFile[hash];

      // Check if result, btn_1, btn_2 are all not null
      const shouldDelete = result !== null && btn_1 !== null && btn_2 !== null;

      if (shouldDelete) {
        // Remove from file
        delete imageDataFile[hash];
        await writeImageData(imageDataFile);

        // Delete temp image file
        if (src_path_img) {
          fsExtra.remove(src_path_img).catch((err) => {
            console.error('Failed to delete temp image:', err);
          });
        }

        // Also remove from map if exists
        if (imageMap.has(hash)) {
          imageMap.delete(hash);
        }

        res.json(ResponseHelper.success({ hash, result, btn_1, btn_2 }, "Result retrieved and data deleted successfully"));
      } else {
        // Do not delete, just return the data
        res.json(ResponseHelper.success({ hash, result, btn_1, btn_2 }, "Result retrieved successfully (data not deleted - incomplete processing)"));
      }
    } catch (error) {
      console.error('Get result error:', error);
      res.status(500).json(ResponseHelper.internalError("Failed to get result"));
    }
  }
};

module.exports = imageController;
module.exports.setSocketHandler = setSocketHandler;