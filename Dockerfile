FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
ENV NODE_ENV=production
RUN bun run build

# Run
ENV AUTH_TRUST_HOST=true
EXPOSE 8000
CMD ["bun", "server.ts"]
