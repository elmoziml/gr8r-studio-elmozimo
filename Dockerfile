# Build stage: install all deps (Argon2 may need build tools) and bundle the UI.
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime stage: only production deps, the server, migrations, and the build output.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/database ./database
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/core ./src/core
COPY --from=build /app/src/data ./src/data

RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node

ENV HOST=0.0.0.0 \
    DATA_DIR=/data
EXPOSE 8080

CMD ["node", "server/index.js"]
