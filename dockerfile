FROM node:20-alpine

RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production

ENV AUDD_API_KEY='' \
    ACRCLOUD_HOST='' \
    ACRCLOUD_ACCESS_KEY='' \
    ACRCLOUD_ACCESS_SECRET='' \
    TELEGRAM_TOKEN='' \
    CHAT_ID=''

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY . .

CMD [ "node", "--env-file=.env", "index.js" ]