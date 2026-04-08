FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx typescript @types/node @types/express

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Expose port
EXPOSE 3001

# Run with tsx (no build step needed)
CMD ["npx", "tsx", "src/index.ts"]
