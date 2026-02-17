FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
