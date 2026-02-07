const fsExtra = require('fs-extra');
const path = require('path');
const ResponseHelper = require('../utils/responseHelper');

// File-based storage for tags
const TAGS_DATA_PATH = path.join(__dirname, '../../data/tags_name.json');

async function readTagsData() {
  try {
    await fsExtra.ensureDir(path.dirname(TAGS_DATA_PATH));
    const data = await fsExtra.readFile(TAGS_DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

async function writeTagsData(data) {
  await fsExtra.ensureDir(path.dirname(TAGS_DATA_PATH));
  await fsExtra.writeFile(TAGS_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const tagsController = {
  // GET /api/tags-name/:room_hash - Get all tags for a room_hash
  getTags: async (req, res) => {
    try {
      const { room_hash } = req.params;
      const tagsData = await readTagsData();
      const roomTags = tagsData[room_hash] || {};
      res.json({
        success: true,
        data: roomTags,
        message: `Tags for room ${room_hash} retrieved successfully`
      });
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json(ResponseHelper.serverError('Failed to retrieve tags'));
    }
  },

  // POST /api/tags-name/:room_hash - Add a new tag
  addTag: async (req, res) => {
    try {
      const { room_hash } = req.params;
      const { tag_name, serials } = req.body;

      if (!tag_name || !Array.isArray(serials)) {
        return res.status(400).json(ResponseHelper.badRequest('tag_name and serials array are required'));
      }

      const tagsData = await readTagsData();
      if (!tagsData[room_hash]) {
        tagsData[room_hash] = {};
      }

      if (tagsData[room_hash][tag_name]) {
        return res.status(409).json(ResponseHelper.conflict('Tag name already exists'));
      }

      tagsData[room_hash][tag_name] = serials;
      await writeTagsData(tagsData);

      res.json({
        success: true,
        message: `Tag ${tag_name} added successfully for room ${room_hash}`
      });
    } catch (error) {
      console.error('Add tag error:', error);
      res.status(500).json(ResponseHelper.serverError('Failed to add tag'));
    }
  },

  // PUT /api/tags-name/:room_hash/:tag_name - Update a tag
  updateTag: async (req, res) => {
    try {
      const { room_hash, tag_name } = req.params;
      const { serials } = req.body;

      if (!Array.isArray(serials)) {
        return res.status(400).json(ResponseHelper.badRequest('serials array is required'));
      }

      const tagsData = await readTagsData();
      if (!tagsData[room_hash] || !tagsData[room_hash][tag_name]) {
        return res.status(404).json(ResponseHelper.notFound('Tag not found'));
      }

      tagsData[room_hash][tag_name] = serials;
      await writeTagsData(tagsData);

      res.json({
        success: true,
        message: `Tag ${tag_name} updated successfully for room ${room_hash}`
      });
    } catch (error) {
      console.error('Update tag error:', error);
      res.status(500).json(ResponseHelper.serverError('Failed to update tag'));
    }
  },

  // DELETE /api/tags-name/:room_hash/:tag_name - Delete a tag
  deleteTag: async (req, res) => {
    try {
      const { room_hash, tag_name } = req.params;

      const tagsData = await readTagsData();
      if (!tagsData[room_hash] || !tagsData[room_hash][tag_name]) {
        return res.status(404).json(ResponseHelper.notFound('Tag not found'));
      }

      delete tagsData[room_hash][tag_name];
      await writeTagsData(tagsData);

      res.json({
        success: true,
        message: `Tag ${tag_name} deleted successfully from room ${room_hash}`
      });
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json(ResponseHelper.serverError('Failed to delete tag'));
    }
  }
};

module.exports = tagsController;