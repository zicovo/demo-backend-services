FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js .

EXPOSE 3004

CMD ["npm", "start"]