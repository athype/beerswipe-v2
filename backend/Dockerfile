# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create uploads directory (if needed for future file uploads)
RUN mkdir -p uploads

# Expose port (default 8080, can be overridden by environment)
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]
