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
const tagsRoutes = require('./routes/tags');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const DEFAULT_PROD_ORIGINS = [
  'https://robot.b6-team.site',
  'http://robot.b6-team.site',
  'https://b6-team.site',
  'http://b6-team.site',
  'https://b6-team.site:9999',
  'http://b6-team.site:9999',
  'http://160.25.81.154:7968',
  'http://160.25.81.154:9000',
  'http://160.25.81.154:9999'
];

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:7968',
  'http://localhost:9999',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:7968',
  'http://127.0.0.1:9999',
  'http://192.168.65.1:3000',
  'http://192.168.65.1:5173',
  'http://192.168.65.1:9999',
  'http://160.25.81.154:9000',
  'http://160.25.81.154:9999'
];

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowAllOrigins = (process.env.CORS_ORIGINS || '').trim() === '*';
const resolvedOrigins = !allowAllOrigins && process.env.CORS_ORIGINS
  ? parseOrigins(process.env.CORS_ORIGINS)
  : (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_ORIGINS : DEFAULT_DEV_ORIGINS);

const isLocalhostOrigin = (origin = '') =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const isAllowedOrigin = (origin) => {
  if (!origin || allowAllOrigins) {
    return true;
  }

  if (isLocalhostOrigin(origin) || origin.includes('b6-team.site')) {
    return true;
  }

  return resolvedOrigins.includes(origin);
};

const app = express();

console.log('Initializing Express app...');

// Swagger configuration
const getSwaggerOptions = (req) => {
  const host = req?.headers?.host || process.env.HOST || 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const port = process.env.PORT || 3000;
  
  // Determine the current server URL
  let currentServerUrl;
  if (process.env.NODE_ENV === 'production') {
    currentServerUrl = `https://${host}`;
  } else {
    currentServerUrl = `${protocol}://${host}${host.includes(':') ? '' : `:${port}`}`;
  }

  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Robot Server API',
        version: '1.0.0',
        description: 'API for image processing with hash-based storage',
      },
      servers: [
        {
          url: currentServerUrl,
          description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
        },
      ],
    },
    apis: ['./src/routes/*.js'], // Path to the API docs
  };
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS
const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/static', cors(corsOptions), express.static(path.join(__dirname, '../uploads')));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  const swaggerOptions = getSwaggerOptions(req);
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      url: process.env.NODE_ENV === 'production'
        ? `https://${req.headers.host}/api-docs.json`
        : `http://${req.headers.host || 'localhost'}:${process.env.PORT || 3000}/api-docs.json`,
      tryItOutEnabled: true
    },
    customSiteTitle: "Robot Server API Documentation"
  })(req, res, next);
});

// Simple API documentation endpoint
app.get('/api-docs', (req, res) => {
  const swaggerOptions = getSwaggerOptions(req);
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
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
app.use('/api/tags-name', tagsRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

console.log('App configured successfully');

module.exports = app;