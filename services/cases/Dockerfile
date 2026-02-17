FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

CMD ["npm", "start"]
