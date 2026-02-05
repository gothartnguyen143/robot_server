# Use Node.js 18 Alpine for smaller image size
FROM --platform=linux/amd64 node:18-alpine
# FROM node:18-alpine 
# Set working directory
WORKDIR /app

# Install system dependencies for image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy source code
COPY --chown=nodejs:nodejs . .

# Create uploads and logs directories and set permissions
RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs && \
    chmod -R 755 uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 7968

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7968

# Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#     CMD node -e "require('http').get('http://localhost:7968/health', (res) => { \
#         process.exit(res.statusCode === 200 ? 0 : 1) \
#     }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]