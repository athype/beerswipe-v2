# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Accept build arguments for environment variables
ARG VITE_API_URL
ARG VITE_API_PORT

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_PORT=$VITE_API_PORT

# Build the application
RUN pnpm build

# Production stage
FROM nginx:alpine

# Default target for /api proxy when no runtime value is provided
ENV API_UPSTREAM=http://backend:6969

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template (rendered by nginx entrypoint with envsubst)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
