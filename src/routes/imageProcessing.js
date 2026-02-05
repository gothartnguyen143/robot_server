const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const router = express.Router();

// In-memory storage for hash mappings
// Map structure: { hash: { src_path_img: string, result: any } }
const imageMap = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename for now, will be renamed with hash later
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper function to generate unique hash
function generateUniqueHash() {
  return crypto.randomBytes(16).toString('hex');
}

// Helper function to get file extension
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// I) API upload ảnh: /api/upload
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate unique hash
    let hash;
    do {
      hash = generateUniqueHash();
    } while (imageMap.has(hash)); // Ensure uniqueness

    // Rename file with hash
    const oldPath = req.file.path;
    const fileExt = getFileExtension(req.file.originalname);
    const newFilename = `${hash}${fileExt}`;
    const newPath = path.join(path.dirname(oldPath), newFilename);

    await fs.move(oldPath, newPath);

    // Store in map
    imageMap.set(hash, {
      src_path_img: newPath,
      result: null
    });

    res.json({
      success: true,
      hash: hash,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// II) API lấy tất cả hash: /api/list-hash-images
router.get('/list-hash-images', (req, res) => {
  try {
    const hashes = Array.from(imageMap.keys());
    res.json({
      success: true,
      hashes: hashes,
      count: hashes.length
    });
  } catch (error) {
    console.error('List hashes error:', error);
    res.status(500).json({ error: 'Failed to retrieve hash list' });
  }
});

// III) API hiển thị ảnh: /api/process/:hash
router.get('/process/:hash', (req, res) => {
  try {
    const { hash } = req.params;

    if (!imageMap.has(hash)) {
      return res.status(404).json({ error: 'Hash not found' });
    }

    const imageData = imageMap.get(hash);

    // Send image file
    res.sendFile(imageData.src_path_img, (err) => {
      if (err) {
        console.error('Send file error:', err);
        res.status(500).json({ error: 'Failed to send image' });
      }
    });

  } catch (error) {
    console.error('Process image error:', error);
    res.status(500).json({ error: 'Failed to process image request' });
  }
});

// IV) API đẩy kết quả và xóa ảnh tạm: /api/process/:hash/result
router.post('/process/:hash/result', express.json(), async (req, res) => {
  try {
    const { hash } = req.params;
    const { result } = req.body;

    if (!imageMap.has(hash)) {
      return res.status(404).json({ error: 'Hash not found' });
    }

    // Update result in map
    const imageData = imageMap.get(hash);
    imageData.result = result;

    // Delete temporary image file
    try {
      await fs.remove(imageData.src_path_img);
    } catch (deleteError) {
      console.error('Failed to delete temp image:', deleteError);
      // Continue even if delete fails
    }

    res.json({
      success: true,
      message: 'Result stored and temporary image deleted'
    });

  } catch (error) {
    console.error('Store result error:', error);
    res.status(500).json({ error: 'Failed to store result' });
  }
});

// V) API lấy result và xóa hash: /api/get/:hash
router.get('/get/:hash', (req, res) => {
  try {
    const { hash } = req.params;

    if (!imageMap.has(hash)) {
      return res.status(404).json({ error: 'Hash not found' });
    }

    const imageData = imageMap.get(hash);
    const result = imageData.result;

    // Delete hash from map
    imageMap.delete(hash);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ error: 'Failed to get result' });
  }
});

module.exports = router;