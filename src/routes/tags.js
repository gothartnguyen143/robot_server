const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tagsController');

/**
 * @swagger
 * /api/tags-name/{room_hash}:
 *   get:
 *     summary: Get all tags for a room
 *     description: Retrieve all tags and their serials for a specific room hash
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: room_hash
 *         required: true
 *         schema:
 *           type: string
 *         description: The room hash identifier
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   example: {"tag_name1": [1,2,3], "tag_name2": [2,3,4]}
 *                 message:
 *                   type: string
 *       500:
 *         description: Failed to retrieve tags
 */
router.get('/:room_hash', tagsController.getTags);

/**
 * @swagger
 * /api/tags-name/{room_hash}:
 *   post:
 *     summary: Add a new tag to a room
 *     description: Create a new tag with serials for a specific room hash
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: room_hash
 *         required: true
 *         schema:
 *           type: string
 *         description: The room hash identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag_name:
 *                 type: string
 *                 description: Name of the tag
 *                 example: "tag_name1"
 *               serials:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of serial IDs
 *                 example: [1,2,3]
 *     responses:
 *       200:
 *         description: Tag added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       409:
 *         description: Tag name already exists
 *       500:
 *         description: Failed to add tag
 */
router.post('/:room_hash', tagsController.addTag);

/**
 * @swagger
 * /api/tags-name/{room_hash}/{tag_name}:
 *   put:
 *     summary: Update a tag in a room
 *     description: Update the serials for an existing tag in a specific room hash
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: room_hash
 *         required: true
 *         schema:
 *           type: string
 *         description: The room hash identifier
 *       - in: path
 *         name: tag_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the tag to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serials:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Updated array of serial IDs
 *                 example: [4,5,6]
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Tag not found
 *       500:
 *         description: Failed to update tag
 */
router.put('/:room_hash/:tag_name', tagsController.updateTag);

/**
 * @swagger
 * /api/tags-name/{room_hash}/{tag_name}:
 *   delete:
 *     summary: Delete a tag from a room
 *     description: Remove a tag from a specific room hash
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: room_hash
 *         required: true
 *         schema:
 *           type: string
 *         description: The room hash identifier
 *       - in: path
 *         name: tag_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the tag to delete
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       404:
 *         description: Tag not found
 *       500:
 *         description: Failed to delete tag
 */
router.delete('/:room_hash/:tag_name', tagsController.deleteTag);

module.exports = router;