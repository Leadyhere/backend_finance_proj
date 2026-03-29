FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node

EXPOSE 5001

CMD ["node", "src/server.js"]
