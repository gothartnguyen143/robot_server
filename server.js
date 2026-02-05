const app = require('./src/app');
const http = require('http');
const socketIo = require('socket.io');
const imageSocketHandler = require('./src/sockets/imageSocket');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.WS_CORS_ORIGINS || "*", // Allow configured origins
    methods: ["GET", "POST"]
  },
  path: process.env.WS_PATH || "/socket.io"
});

// Initialize socket handlers
imageSocketHandler(io);

// Set socket handler for controller
const imageController = require('./src/controllers/imageController');
imageController.setSocketHandler(imageSocketHandler);

server.listen(PORT, HOST, () => {
  const host = process.env.PUBLIC_HOST || process.env.HOST || 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  console.log(`🚀 Robot Server running on ${host}:${PORT}`);
  console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || './uploads'}`);
  console.log(`📚 API Documentation: ${protocol}://${host}:${PORT}/api-docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket enabled on path: ${process.env.WS_PATH || '/socket.io'}`);
});