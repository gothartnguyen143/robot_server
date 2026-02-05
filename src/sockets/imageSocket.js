const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// In-memory storage for image processing state
// In production, this should be stored in a database
let imageStates = {}; // hash -> { status: 'pending'|'processing'|'completed', result: string, assignedTo: socketId, nextedBy: socketId }
let userAssignments = {}; // socketId -> currentHash
let userHistory = {}; // socketId -> array of hashes processed by this user (in order)
let userQueues = {}; // socketId -> array of hashes queued for this user
let pendingImages = []; // Queue of hashes waiting to be processed

// Load existing images from uploads directory
function loadExistingImages() {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext)) {
        const hash = path.parse(file).name;
        if (!imageStates[hash]) {
          imageStates[hash] = { status: 'pending', result: null, assignedTo: null, nextedBy: null };
          pendingImages.push(hash);
        }
      }
    });
  }
  console.log(`Loaded ${pendingImages.length} pending images`);
}

// Function to encode image to base64
function encodeImageToBase64(hash) {
  try {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Try different extensions
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    let imagePath = null;
    let mimeType = 'image/png';

    for (const ext of extensions) {
      const testPath = path.join(uploadDir, `${hash}${ext}`);
      if (fs.existsSync(testPath)) {
        imagePath = testPath;
        // Set appropriate mime type
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.bmp') mimeType = 'image/bmp';
        else mimeType = 'image/png';
        break;
      }
    }

    if (!imagePath) {
      console.error(`Image file not found for hash ${hash}. Searched in: ${uploadDir}`);
      console.error(`Available files in directory:`, fs.readdirSync(uploadDir).filter(f => f.startsWith(hash)));
      return null;
    }

    console.log(`Found image file: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error encoding image ${hash}:`, error);
    return null;
  }
}

// Function to delete image file
function deleteImageFile(hash) {
  try {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Try different extensions
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];

    for (const ext of extensions) {
      const filePath = path.join(uploadDir, `${hash}${ext}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted image file: ${filePath}`);
        return true;
      }
    }

    console.log(`Image file not found for deletion: ${hash}`);
    return false;
  } catch (error) {
    console.error(`Error deleting image ${hash}:`, error);
    return false;
  }
}

function imageSocketHandler(io) {
  loadExistingImages();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current assignment or assign new image
    socket.on('join-processing', () => {
      console.log(`User ${socket.id} joined processing`);

      // Check if user already has an assignment
      if (userAssignments[socket.id]) {
        const currentHash = userAssignments[socket.id];
        if (imageStates[currentHash] && imageStates[currentHash].status === 'processing') {
          // Send current image
          socket.emit('image-assigned', {
            hash: currentHash,
            imageUrl: `http://localhost:3000/static/${currentHash}.png`,
            result: imageStates[currentHash].result || ''
          });
          return;
        }
      }

      // Assign new image
      assignNextImage(socket);
    });

    // Handle result submission
    socket.on('submit-result', (data) => {
      const { hash, result } = data;
      console.log(`User ${socket.id} submitted result for ${hash}: ${result}`);

      if (imageStates[hash] && imageStates[hash].assignedTo === socket.id) {
        // Update image state
        imageStates[hash].status = 'completed';
        imageStates[hash].result = result;

        // Remove from user assignment
        delete userAssignments[socket.id];

        // Delete the image file from disk
        deleteImageFile(hash);

        // Remove from pending images if it exists
        const pendingIndex = pendingImages.indexOf(hash);
        if (pendingIndex > -1) {
          pendingImages.splice(pendingIndex, 1);
        }

        // Notify all clients that this image is completed
        io.emit('image-completed', { hash });

        // Assign next image to this user (check queue first)
        if (!checkAndAssignFromQueue(socket)) {
          assignNextImage(socket);
        }

        // Note: Không gửi cho user khác vì ảnh đã được submit
      }
    });

    // Handle request for next image
    socket.on('request-next', () => {
      console.log(`User ${socket.id} requested next image`);

      // Kiểm tra xem user hiện tại có image chưa submit không
      const currentHash = userAssignments[socket.id];
      if (currentHash && imageStates[currentHash] && imageStates[currentHash].status === 'processing') {
        // Image chưa được submit, đánh dấu đã nexted và gửi cho user khác
        console.log(`User ${socket.id} has unsubmitted image ${currentHash}, assigning to another user`);
        imageStates[currentHash].nextedBy = socket.id; // Đánh dấu user đã next image này
        assignSpecificImageToOtherUser(currentHash, socket.id);

        // Remove assignment from current user
        delete userAssignments[socket.id];
        imageStates[currentHash].assignedTo = null;
      }

      // Assign next image to this user (check queue first)
      if (!checkAndAssignFromQueue(socket)) {
        assignNextImage(socket);
      }
    });

    // Handle request for previous image
    socket.on('request-prev', () => {
      console.log(`User ${socket.id} requested previous image`);

      // Get user history
      const history = userHistory[socket.id] || [];
      if (history.length === 0) {
        socket.emit('no-images-available');
        return;
      }

      // Find the last image that can be shown (not nexted by this user)
      let prevImageHash = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const hash = history[i];
        const imageState = imageStates[hash];
        if (imageState && imageState.nextedBy !== socket.id) {
          // Image chưa được nexted bởi user này, có thể hiển thị lại
          prevImageHash = hash;
          break;
        }
      }

      if (prevImageHash) {
        // Check if image is still available (not assigned to someone else)
        if (imageStates[prevImageHash].assignedTo === null || imageStates[prevImageHash].assignedTo === socket.id) {
          // Assign this image to the user
          imageStates[prevImageHash].status = 'processing';
          imageStates[prevImageHash].assignedTo = socket.id;
          userAssignments[socket.id] = prevImageHash;

          const imageData = encodeImageToBase64(prevImageHash);
          if (!imageData) {
            console.error(`Failed to encode image ${prevImageHash}`);
            socket.emit('image-error', { hash: prevImageHash, error: 'Failed to load image' });
            return;
          }

          console.log(`Showing previous image ${prevImageHash} to user ${socket.id}`);

          socket.emit('image-assigned', {
            hash: prevImageHash,
            imageData: imageData,
            result: imageStates[prevImageHash].result || ''
          });
        } else {
          // Image is assigned to someone else, try next in history
          socket.emit('no-images-available');
        }
      } else {
        socket.emit('no-images-available');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);

      // If user had an assignment and it's still pending, mark it as pending again
      const assignedHash = userAssignments[socket.id];
      if (assignedHash && imageStates[assignedHash]) {
        if (imageStates[assignedHash].status === 'processing') {
          // Only mark as pending if not completed
          imageStates[assignedHash].status = 'pending';
          imageStates[assignedHash].assignedTo = null;
          pendingImages.unshift(assignedHash); // Add to front of queue
        }
      }

      delete userAssignments[socket.id];

      // Clear user history
      delete userHistory[socket.id];

      // Clear user queue
      delete userQueues[socket.id];
    });
  });

  function checkAndAssignFromQueue(socket) {
    const queue = userQueues[socket.id];
    if (queue && queue.length > 0) {
      const nextHash = queue.shift();
      console.log(`Assigning queued image ${nextHash} to user ${socket.id}`);

      // Assign the queued image
      imageStates[nextHash].status = 'processing';
      imageStates[nextHash].assignedTo = socket.id;
      userAssignments[socket.id] = nextHash;

      // Add to user history
      if (!userHistory[socket.id]) {
        userHistory[socket.id] = [];
      }
      userHistory[socket.id].push(nextHash);

      // Send to client
      const imageData = encodeImageToBase64(nextHash);
      if (!imageData) {
        console.error(`Failed to encode queued image ${nextHash}`);
        socket.emit('image-error', { hash: nextHash, error: 'Failed to load image' });
        return;
      }

      socket.emit('image-assigned', {
        hash: nextHash,
        imageData: imageData,
        result: imageStates[nextHash].result || ''
      });

      return true;
    }
    return false;
  }

  function assignSpecificImageToOtherUser(imageHash, excludeSocketId) {
    // Find all connected users except the one who triggered this
    const connectedSockets = Array.from(io.sockets.sockets.values());
    const availableUsers = connectedSockets.filter(s => s.id !== excludeSocketId);

    if (availableUsers.length > 0 && imageStates[imageHash]) {
      // Try to find a user without current assignment first
      let targetSocket = availableUsers.find(s => !userAssignments[s.id]);

      if (!targetSocket) {
        // All users have assignments, pick the first one and add to their queue
        targetSocket = availableUsers[0];
        console.log(`All users busy, adding image ${imageHash} to queue of user ${targetSocket.id}`);
      }

      if (!userAssignments[targetSocket.id]) {
        // User doesn't have current assignment, assign immediately
        imageStates[imageHash].status = 'processing';
        imageStates[imageHash].assignedTo = targetSocket.id;
        userAssignments[targetSocket.id] = imageHash;

        // Send to client with base64 encoded binary data
        const imageData = encodeImageToBase64(imageHash);
        if (!imageData) {
          console.error(`Failed to encode image ${imageHash}`);
          targetSocket.emit('image-error', { hash: imageHash, error: 'Failed to load image' });
          return false;
        }

        console.log(`Assigning specific image ${imageHash} to user ${targetSocket.id} (from ${excludeSocketId})`);

        targetSocket.emit('image-assigned', {
          hash: imageHash,
          imageData: imageData,
          result: imageStates[imageHash].result || ''
        });
      } else {
        // User has current assignment, add to their queue
        if (!userQueues[targetSocket.id]) {
          userQueues[targetSocket.id] = [];
        }
        userQueues[targetSocket.id].push(imageHash);
        console.log(`Added image ${imageHash} to queue of user ${targetSocket.id} (queue length: ${userQueues[targetSocket.id].length})`);
      }

      return true;
    }

    console.log(`No available users to assign specific image ${imageHash} (from ${excludeSocketId})`);
    return false;
  }

  function assignImageToOtherUser(excludeSocketId) {
    // Find another connected user who doesn't have an assignment
    const connectedSockets = Array.from(io.sockets.sockets.values());
    const availableUsers = connectedSockets.filter(s =>
      s.id !== excludeSocketId && !userAssignments[s.id]
    );

    if (availableUsers.length > 0 && pendingImages.length > 0) {
      // Pick the first available user
      const targetSocket = availableUsers[0];
      console.log(`Assigning image to another user ${targetSocket.id} (triggered by ${excludeSocketId})`);
      assignNextImage(targetSocket);
      return true;
    }

    console.log(`No available users or images to assign to other users (triggered by ${excludeSocketId})`);
    return false;
  }

  function assignNextImage(socket) {
    // Find next available image
    let nextHash = null;

    // First, check if there are pending images
    if (pendingImages.length > 0) {
      nextHash = pendingImages.shift();
    }

    if (nextHash) {
      // Mark as processing
      imageStates[nextHash].status = 'processing';
      imageStates[nextHash].assignedTo = socket.id;

      // Assign to user
      userAssignments[socket.id] = nextHash;

      // Add to user history
      if (!userHistory[socket.id]) {
        userHistory[socket.id] = [];
      }
      userHistory[socket.id].push(nextHash);

      // Send to client with base64 encoded binary data
      const imageData = encodeImageToBase64(nextHash);
      if (!imageData) {
        console.error(`Failed to encode image ${nextHash}`);
        socket.emit('image-error', { hash: nextHash, error: 'Failed to load image' });
        return;
      }

      console.log(`Sending image ${nextHash} with base64 data length: ${imageData.length}`);

      socket.emit('image-assigned', {
        hash: nextHash,
        imageData: imageData, // Send base64 string representing binary data
        result: imageStates[nextHash].result || ''
      });

      console.log(`Assigned image ${nextHash} to user ${socket.id}`);
    } else {
      // No images available
      socket.emit('no-images-available');
      console.log(`No images available for user ${socket.id}`);
    }
  }

  // Function to add new image (called from upload API)
  function addNewImage(hash) {
    if (!imageStates[hash]) {
      imageStates[hash] = { status: 'pending', result: null, assignedTo: null, nextedBy: null };
      pendingImages.push(hash);

      // Notify all connected clients that new image is available
      io.emit('new-image-available');

      console.log(`New image added: ${hash}`);
    }
  }

  // Export function to add new images
  imageSocketHandler.addNewImage = addNewImage;
}

module.exports = imageSocketHandler;