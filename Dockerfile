# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json ./
RUN npm run build

# ---- Production stage ----
FROM node:20-slim

WORKDIR /app

RUN addgroup --system --gid 1001 mcp && \
    adduser --system --uid 1001 --ingroup mcp mcp

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist/ dist/

LABEL org.opencontainers.image.source="https://github.com/chattstate/teamdynamix-mcp-server"
LABEL org.opencontainers.image.description="MCP server for TeamDynamix Web API"
LABEL org.opencontainers.image.licenses="MIT"

USER mcp

ENV TDX_MCP_TRANSPORT=stdio

ENTRYPOINT ["node", "dist/index.js"]
