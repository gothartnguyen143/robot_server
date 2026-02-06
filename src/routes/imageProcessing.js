const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { addNewImage } = require('../sockets/imageSocket');

const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../data/images.json');
async function readImageData() {
  try {
    await fs.ensureDir(path.dirname(DATA_PATH));
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}
async function writeImageData(data) {
  await fs.ensureDir(path.dirname(DATA_PATH));
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

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
    console.log('---UPLOAD DEBUG---');
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No image file provided' });
    }
    console.log('File info:', req.file);


    // Đọc dữ liệu hiện tại
    const imageData = await readImageData();

    // Generate unique hash
    let hash;
    do {
      hash = generateUniqueHash();
    } while (imageData[hash]); // Ensure uniqueness
    console.log('Generated hash:', hash);

    // Rename file with hash
    const oldPath = req.file.path;
    const fileExt = getFileExtension(req.file.originalname);
    const newFilename = `${hash}${fileExt}`;
    const newPath = path.join(path.dirname(oldPath), newFilename);
    console.log('Old path:', oldPath);
    console.log('New path:', newPath);

    await fs.move(oldPath, newPath);
    console.log('File moved successfully');

    // Store in file
    imageData[hash] = {
      src_path_img: newPath,
      result: null,
      btn_1: null,
      btn_2: null
    };
    await writeImageData(imageData);
    console.log('ImageData updated:', imageData[hash]);

    // Add to socket handler
    addNewImage(hash);

    res.json({
      success: true,
      hash: hash,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
});

// II) API lấy tất cả hash: /api/list-hash-images
router.get('/list-hash-images', (req, res) => {
  readImageData().then(imageData => {
    const hashes = Object.keys(imageData);
    res.json({
      success: true,
      hashes: hashes,
      count: hashes.length
    });
  }).catch(error => {
    console.error('List hashes error:', error);
    res.status(500).json({ error: 'Failed to retrieve hash list' });
  });
});

// III) API hiển thị ảnh: /api/process/:hash
router.get('/process/:hash', (req, res) => {
  const { hash } = req.params;
  readImageData().then(imageData => {
    if (!imageData[hash]) {
      return res.status(404).json({ error: 'Hash not found' });
    }
    const img = imageData[hash];
    res.sendFile(img.src_path_img, (err) => {
      if (err) {
        console.error('Send file error:', err);
        res.status(500).json({ error: 'Failed to send image' });
      }
    });
  }).catch(error => {
    console.error('Process image error:', error);
    res.status(500).json({ error: 'Failed to process image request' });
  });
});

// IV) API đẩy kết quả và xóa ảnh tạm: /api/process/:hash/result
router.post('/process/:hash/result', express.json(), async (req, res) => {
  try {
    const { hash } = req.params;
    const { result, btn_1, btn_2 } = req.body;
    const imageData = await readImageData();
    if (!imageData[hash]) {
      return res.status(404).json({ error: 'Hash not found' });
    }
    if (result !== undefined) imageData[hash].result = result;
    if (btn_1 !== undefined) imageData[hash].btn_1 = btn_1;
    if (btn_2 !== undefined) imageData[hash].btn_2 = btn_2;
    await writeImageData(imageData);
    res.json({
      success: true,
      message: 'Result stored successfully'
    });
  } catch (error) {
    console.error('Store result error:', error);
    res.status(500).json({ error: 'Failed to store result' });
  }
});

// V) API lấy result và xóa hash: /api/get/:hash
router.get('/get/:hash', (req, res) => {
  (async () => {
    try {
      const { hash } = req.params;
      const imageData = await readImageData();
      if (!imageData[hash]) {
        return res.status(404).json({ error: 'Hash not found' });
      }
      const { result, btn_1, btn_2, src_path_img } = imageData[hash];
      // Xóa hash khỏi file
      delete imageData[hash];
      await writeImageData(imageData);
      // Xóa file ảnh tạm nếu có
      if (src_path_img) {
        fs.remove(src_path_img).catch((err) => {
          console.error('Failed to delete temp image:', err);
        });
      }
      res.json({
        success: true,
        hash: hash,
        result: result,
        btn_1: btn_1,
        btn_2: btn_2,
        message: 'Result retrieved and data deleted successfully'
      });
    } catch (error) {
      console.error('Get result error:', error);
      res.status(500).json({ error: 'Failed to get result' });
    }
  })();
});

module.exports = {
  router,
  imageMap
};