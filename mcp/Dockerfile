FROM node:24-bookworm-slim

ARG PLAYWRIGHT_MCP_VERSION=0.0.78

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN npm install --global "@playwright/mcp@${PLAYWRIGHT_MCP_VERSION}" \
    && npm cache clean --force \
    && mkdir -p /data/output \
    && chown -R node:node /data

USER node

EXPOSE 8931
