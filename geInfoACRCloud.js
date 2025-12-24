import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { bot } from './telegram.js';
import dotenv from 'dotenv';
dotenv.config();

const chatIdsString = process.env.CHAT_ID;
const chatIds = chatIdsString.split(', ');

bot.onText(/\/start/, (msg) => {
  if (!chatIds.includes(msg.chat.id)) {
    chatIds.push(msg.chat.id);
  }
  bot.sendMessage(msg.chat.id, `Бот запущен id ${msg.chat.id}`);
});

let latestSong = '';

const defaultOptions = {
  host: process.env.ACRCLOUD_HOST,
  endpoint: '/v1/identify',
  signature_version: '1',
  data_type: 'audio',
  secure: true,
  access_key: process.env.ACRCLOUD_ACCES_KEY,
  access_secret: process.env.ACRCLOUD_ACCES_SECRET,
};

function buildStringToSign(method, uri, accessKey, dataType, signatureVersion, timestamp) {
  return [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
}

function sign(signString, accessSecret) {
  return crypto
    .createHmac('sha1', accessSecret)
    .update(Buffer.from(signString, 'utf-8'))
    .digest()
    .toString('base64');
}

export async function identify(data, options, cb) {
  const current_data = new Date();
  const timestamp = current_data.getTime() / 1000;

  const stringToSign = buildStringToSign(
    'POST',
    options.endpoint,
    options.access_key,
    options.data_type,
    options.signature_version,
    timestamp,
  );

  const signature = sign(stringToSign, options.access_secret);

  const blobData = new Blob([data], { type: 'application/octet-stream' });
  const form = new FormData();
  form.append('sample', blobData, { filename: 'sample.bin', contentType: 'application/octet-stream' });
  form.append('sample_bytes', data.length);
  form.append('access_key', options.access_key);
  form.append('data_type', options.data_type);
  form.append('signature_version', options.signature_version);
  form.append('signature', signature);
  form.append('timestamp', timestamp);

  return await axios.post('http://' + options.host + options.endpoint, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export const run = async (audioPath) => {
  try {
    const data = fs.readFileSync(audioPath);
    const response = await identify(data, defaultOptions);
    console.log(response.data.metadata);
    if (response?.data?.metadata?.music) {
      const meta = response.data.metadata.music[0];
      console.log(response.data.metadata.music);
      console.log(`Артист: ${meta.artists.reduce((acc, art) => (acc += art.name + ', '), '')}`);
      console.log(`Название песни: ${meta.title}`);
      const newSong = `Артист: ${meta.artists.reduce(
        (acc, art) => (acc += art.name + ', '),
        '',
      )}\nНазвание песни: ${meta.title}`;
      if (newSong !== latestSong) {
        chatIds.forEach(async (chatId) => {
          const message = await bot.sendMessage(chatId, newSong, { parse_mode: 'HTML' });
          setTimeout(() => {
            bot.deleteMessage(chatId, message.message_id);
          }, 1200000);
        });
        latestSong = newSong;
      }
    }
  } catch (error) {
    console.log('identify', error);
  }
};
