# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy workspace manifests and package manifests
COPY pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY package.json /workspace/package.json
COPY backend/package.json /workspace/backend/package.json
COPY types/package.json /workspace/types/package.json

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN cd /workspace; pnpm install --frozen-lockfile --filter beer-system-backend...

# Copy package sources required at runtime
COPY backend /workspace/backend
COPY types /workspace/types

# Ensure compiled shared types are available
RUN cd /workspace; pnpm --filter @beerswipe/types build

# Set runtime working directory to backend package
WORKDIR /workspace/backend

# Create uploads directory (if needed for future file uploads)
RUN mkdir -p uploads

# Expose port (default 8080, can be overridden by environment)
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]
