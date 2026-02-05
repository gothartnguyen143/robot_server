const express = require('express');
const router = express.Router();
const multer = require('multer');
const imageController = require('../controllers/imageController');

// Configure multer for file uploads
const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads/temp',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1 // Only 1 file per upload for this task
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: integer
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *     HashResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 hash:
 *                   type: string
 *                   description: Unique hash identifier for the uploaded image
 *     HashListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 hashes:
 *                   type: array
 *                   items:
 *                     type: string
 *     ResultResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   nullable: true
 *                   description: Processing result or null if not processed
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload an image and get a unique hash
 *     description: Upload an image file and receive a unique hash identifier for later retrieval
 *     tags: [Images]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HashResponse'
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/upload', upload.single('file'), imageController.uploadImage);

/**
 * @swagger
 * /api/list-hash-images:
 *   get:
 *     summary: Get all image hashes
 *     description: Retrieve a list of all image hashes currently stored on the server
 *     tags: [Images]
 *     responses:
 *       200:
 *         description: List of hashes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HashListResponse'
 *       500:
 *         description: Failed to get hashes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/list-hash-images', imageController.listHashImages);

/**
 * @swagger
 * /api/process/{hash}:
 *   get:
 *     summary: Get image by hash
 *     description: Retrieve and display the image associated with the given hash
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique hash identifier of the image
 *     responses:
 *       200:
 *         description: Image file
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Hash not found or image file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Failed to process image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/process/:hash', imageController.processImage);

/**
 * @swagger
 * /api/process/{hash}/result:
 *   post:
 *     summary: Set processing result and delete image
 *     description: Set the processing result for the image and delete the image file from temporary storage
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique hash identifier of the image
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               result:
 *                 type: string
 *                 description: Processing result to store
 *     responses:
 *       200:
 *         description: Result set and image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Hash not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Failed to set result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/process/:hash/result', imageController.setResult);

/**
 * @swagger
 * /api/get/{hash}:
 *   get:
 *     summary: Get result and remove hash
 *     description: Retrieve the processing result for the hash and remove the hash from storage
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique hash identifier
 *     responses:
 *       200:
 *         description: Result retrieved and hash removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResultResponse'
 *       404:
 *         description: Hash not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Failed to get result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/get/:hash', imageController.getResult);

module.exports = router;