const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Import routes
const imageRoutes = require('./routes/images');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

console.log('Initializing Express app...');

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Robot Server API',
      version: '1.0.0',
      description: 'API for image processing with hash-based storage',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
      {
        url: `https://robot.b6-team.site`,
        description: 'Production server',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:9999',
      'https://robot.b6-team.site',
      'https://b6-team.site',
      'http://160.25.81.154:9000',
      'http://160.25.81.154:9999'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/static', express.static(path.join(__dirname, '../uploads')));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: false,
    url: process.env.NODE_ENV === 'production'
      ? 'https://robot.b6-team.site/api-docs.json'
      : `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}/api-docs.json`,
    tryItOutEnabled: false
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .auth-wrapper { display: none }
    .swagger-ui .scheme-container { display: none }
  `,
  customSiteTitle: "Robot Server API Documentation"
}));

// Simple API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json(swaggerSpec);
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'Server is healthy',
    data: { status: 'healthy', timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', imageRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

console.log('App configured successfully');

module.exports = app;