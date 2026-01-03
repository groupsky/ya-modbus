# syntax=docker/dockerfile:1

# Build argument to control which variant to build
# Possible values: "base" (mqtt-bridge only) or "complete" (with all drivers)
ARG VARIANT=complete

# ============================================================================
# Stage 1: Dependencies
# Install all dependencies needed for building
# ============================================================================
FROM node:24-alpine AS deps

WORKDIR /build

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/mqtt-bridge/package*.json ./packages/mqtt-bridge/
COPY packages/transport/package*.json ./packages/transport/
COPY packages/driver-loader/package*.json ./packages/driver-loader/
COPY packages/driver-types/package*.json ./packages/driver-types/
COPY packages/driver-sdk/package*.json ./packages/driver-sdk/
COPY packages/ya-modbus-driver-xymd1/package*.json ./packages/ya-modbus-driver-xymd1/
COPY packages/ya-modbus-driver-ex9em/package*.json ./packages/ya-modbus-driver-ex9em/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# ============================================================================
# Stage 2: Build
# Compile TypeScript to JavaScript
# ============================================================================
FROM deps AS builder

# Copy source code
COPY tsconfig*.json ./
COPY packages ./packages

# Build all packages
RUN npm run build

# ============================================================================
# Stage 3: Base Runtime (mqtt-bridge only)
# Contains only the core bridge without drivers
# ============================================================================
FROM node:24-alpine AS runtime-base

WORKDIR /app

# Install runtime tools
RUN apk add --no-cache \
    tini \
    su-exec

# Copy package files for production dependency installation
COPY package*.json ./
COPY packages/mqtt-bridge/package*.json ./packages/mqtt-bridge/
COPY packages/transport/package*.json ./packages/transport/
COPY packages/driver-loader/package*.json ./packages/driver-loader/
COPY packages/driver-types/package*.json ./packages/driver-types/
COPY packages/driver-sdk/package*.json ./packages/driver-sdk/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /build/packages/mqtt-bridge/dist ./packages/mqtt-bridge/dist
COPY --from=builder /build/packages/transport/dist ./packages/transport/dist
COPY --from=builder /build/packages/driver-loader/dist ./packages/driver-loader/dist
COPY --from=builder /build/packages/driver-types/dist ./packages/driver-types/dist
COPY --from=builder /build/packages/driver-sdk/dist ./packages/driver-sdk/dist

# Create non-root user
RUN addgroup -g 1000 modbus && \
    adduser -D -u 1000 -G modbus modbus

# Create directories for data and config
RUN mkdir -p /data /config && \
    chown -R modbus:modbus /data /config

# Set up environment
ENV NODE_ENV=production \
    STATE_DIR=/data

# Volume for persistent state
VOLUME ["/data", "/config"]

# Switch to non-root user
USER modbus

# Use tini as init system (handles signals properly)
ENTRYPOINT ["/sbin/tini", "--"]

# Default command runs the bridge
CMD ["node", "/app/packages/mqtt-bridge/dist/bin/ya-modbus-bridge.js", "run", "--state-dir", "/data", "--config", "/config/config.json"]

# ============================================================================
# Stage 4: Complete Runtime (with all drivers)
# Extends base with pre-installed drivers
# ============================================================================
FROM runtime-base AS runtime-complete

# Switch back to root to install drivers
USER root

# Copy driver package files
COPY packages/ya-modbus-driver-xymd1/package*.json ./packages/ya-modbus-driver-xymd1/
COPY packages/ya-modbus-driver-ex9em/package*.json ./packages/ya-modbus-driver-ex9em/

# Install driver dependencies
WORKDIR /app/packages/ya-modbus-driver-xymd1
RUN npm ci --omit=dev

WORKDIR /app/packages/ya-modbus-driver-ex9em
RUN npm ci --omit=dev

WORKDIR /app

# Copy built driver artifacts
COPY --from=builder /build/packages/ya-modbus-driver-xymd1/dist ./packages/ya-modbus-driver-xymd1/dist
COPY --from=builder /build/packages/ya-modbus-driver-ex9em/dist ./packages/ya-modbus-driver-ex9em/dist

# Switch back to non-root user
USER modbus

# ============================================================================
# Final Stage: Select variant based on build arg
# ============================================================================
FROM runtime-${VARIANT} AS final

# Metadata
LABEL org.opencontainers.image.title="ya-modbus" \
      org.opencontainers.image.description="Production-ready Modbus to MQTT bridge" \
      org.opencontainers.image.vendor="ya-modbus" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.source="https://github.com/groupsky/ya-modbus"

# Health check (checks if bridge process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f "ya-modbus-bridge" > /dev/null || exit 1
