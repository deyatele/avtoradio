import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { bot } from './telegram.js';

const chatIds = process.env.CHAT_ID ? process.env.CHAT_ID.split(',').map((id) => id.trim()) : [];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId);
  }
  bot.sendMessage(chatId, `Бот запущен id ${chatId}`, {
    reply_markup: {
      remove_keyboard: true,
    },
  });
});

let latestSong = '';

const defaultOptions = {
  host: process.env.ACRCLOUD_HOST,
  endpoint: '/v1/identify',
  signature_version: '1',
  data_type: 'audio',
  secure: true,
  access_key: process.env.ACRCLOUD_ACCESS_KEY,
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

export async function identify(data, options) {
  const timestamp = Date.now() / 1000;
  const stringToSign = buildStringToSign(
    'POST',
    options.endpoint,
    options.access_key,
    options.data_type,
    options.signature_version,
    timestamp,
  );
  const signature = sign(stringToSign, options.access_secret);

  const form = new FormData();
  form.append('sample', data, { filename: 'sample.mp3' });
  form.append('access_key', options.access_key);
  form.append('data_type', options.data_type);
  form.append('signature_version', options.signature_version);
  form.append('signature', signature);
  form.append('timestamp', timestamp);

  return await axios.post(`https://${options.host}${options.endpoint}`, form, {
    headers: form.getHeaders(),
  });
}

export const run = async (audioPath) => {
  try {
    const data = fs.readFileSync(audioPath);
    const response = await identify(data, defaultOptions);
    if (response?.data?.metadata?.music) {
      const meta = response.data.metadata.music[0];
      const newSong = `Артист: ${meta.artists.reduce(
        (acc, art) => (acc += art.name + ', '),
        '',
      )}\nНазвание песни: ${meta.title}`;
      if (newSong.toLowerCase() !== latestSong.toLowerCase()) {
        chatIds.forEach(async (chatId) => {
          const message = await bot.sendMessage(
            chatId,
            `${newSong}\n[время: ${new Date().toLocaleTimeString('ru-RU', {
              timeZone: 'Europe/Moscow',
            })}]`,
            { parse_mode: 'HTML' },
          );
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
