# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json .npmrc ./
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) && \
    echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc && \
    npm install && \
    rm -f .npmrc

COPY src/ src/
COPY scripts/ scripts/
COPY tsconfig.json ./
RUN npm run build

# ---- Production stage ----
FROM node:20-slim

WORKDIR /app

RUN addgroup --system --gid 1001 mcp && \
    adduser --system --uid 1001 --ingroup mcp mcp

COPY --from=builder /app/package.json ./
COPY .npmrc ./
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) && \
    echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc && \
    npm install --omit=dev && \
    rm -f .npmrc

COPY --from=builder /app/dist/ dist/

LABEL org.opencontainers.image.source="https://github.com/chatt-state/teamdynamix-mcp-server"
LABEL org.opencontainers.image.description="MCP server for TeamDynamix Web API"
LABEL org.opencontainers.image.licenses="MIT"
LABEL io.docker.server.metadata="{\
  \"name\": \"teamdynamix-mcp-server\",\
  \"description\": \"MCP server for the TeamDynamix Web API — search tickets, KB articles, people, and assets via Claude.\",\
  \"command\": [\"node\", \"dist/index.js\"],\
  \"env\": {\
    \"TDX_BASE_URL\": {\"description\": \"TeamDynamix instance URL\", \"required\": true},\
    \"TDX_BEID\": {\"description\": \"API BEID (GUID)\", \"required\": true, \"secret\": true},\
    \"TDX_WEB_SERVICES_KEY\": {\"description\": \"API Web Services Key (GUID)\", \"required\": true, \"secret\": true},\
    \"TDX_TICKETING_APP_ID\": {\"description\": \"Ticketing app ID (optional)\"},\
    \"TDX_ASSETS_APP_ID\": {\"description\": \"Assets app ID (optional)\"},\
    \"TDX_KB_APP_ID\": {\"description\": \"Knowledge Base app ID (optional)\"}\
  }\
}"

USER mcp

ENV TDX_MCP_TRANSPORT=stdio

ENTRYPOINT ["node", "dist/index.js"]
