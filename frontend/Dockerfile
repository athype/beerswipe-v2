# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests and package manifests
COPY pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY package.json /workspace/package.json
COPY frontend/package.json /workspace/frontend/package.json
COPY types/package.json /workspace/types/package.json

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN cd /workspace; pnpm install --frozen-lockfile --filter beer-system-frontend...

# Copy package sources
COPY frontend /workspace/frontend
COPY types /workspace/types

# Build shared types before frontend build
RUN cd /workspace; pnpm --filter @beerswipe/types build

# Accept build arguments for environment variables
ARG VITE_API_URL
ARG VITE_API_PORT

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_PORT=$VITE_API_PORT

# Build the application
RUN cd /workspace; pnpm --filter beer-system-frontend build

# Production stage
FROM nginx:alpine

# Default target for /api proxy when no runtime value is provided
ENV API_UPSTREAM=http://backend:8080

# Copy built files to nginx
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

# Copy nginx template (rendered by nginx entrypoint with envsubst)
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
