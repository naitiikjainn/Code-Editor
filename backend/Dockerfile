# Use official Node.js image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application source
COPY . .

# Expose port
EXPOSE 5000

# Environment variables should be passed at runtime, but we can set defaults
ENV PORT=5000
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
