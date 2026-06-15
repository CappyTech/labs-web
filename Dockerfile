FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (layer-cache friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
