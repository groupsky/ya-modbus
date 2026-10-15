# Image of the published @ya-modbus/mqtt-bridge package with the device drivers.
#
# Build (the build context is this directory; nothing is copied from it):
#   docker build --build-arg BRIDGE_VERSION=<version> -t ya-modbus-bridge packages/mqtt-bridge/docker
#
# Node 24 on Debian (glibc), so the serialport prebuilt binaries work without build tools.
# The Node version must stay inside "engines" of @ya-modbus/mqtt-bridge (below 26.4.0).
FROM node:24.22.0-bookworm-slim

ARG BRIDGE_VERSION
# Device drivers, space separated. The bridge loads a driver by package name from node_modules.
ARG DRIVERS="@ya-modbus/driver-dds024mr @ya-modbus/driver-ex9em @ya-modbus/driver-or-we-516 @ya-modbus/driver-sdm630 @ya-modbus/driver-xymd1"

RUN test -n "$BRIDGE_VERSION" || (echo "Set --build-arg BRIDGE_VERSION=<version>" >&2; exit 1)

WORKDIR /app
RUN chown node:node /app
USER node

# Drivers and bridge go into one node_modules, so the bridge finds the drivers
RUN npm install --omit=dev --no-audit --no-fund --no-package-lock \
      "@ya-modbus/mqtt-bridge@${BRIDGE_VERSION}" ${DRIVERS} \
    && npm cache clean --force

ENV PATH="/app/node_modules/.bin:${PATH}"

ENTRYPOINT ["ya-modbus-bridge"]
CMD ["run", "--config", "/config/config.json"]
