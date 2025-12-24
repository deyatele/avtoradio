FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

ENV AUDD_API_KEY='' \
    ACRCLOUD_HOST='' \
    ACRCLOUD_ACCESS_KEY='' \
    ACRCLOUD_ACCESS_SECRET='' \
    TELEGRAM_TOKEN='' \
    CHAT_ID=''

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

CMD [ "npm", "start" ]