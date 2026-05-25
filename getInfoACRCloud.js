import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { bot } from './telegram.js';
import { writeBase } from './utils.js';

const chatIds = process.env.CHAT_ID ? process.env.CHAT_ID.split(',').map((id) => id.trim()) : [];
let checkKey;
const ADM_CHAT_ID = process.env.ADM_CHAT_ID;
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
  try {
    return await axios.post(`https://${options.host}${options.endpoint}`, form, {
      headers: form.getHeaders(),
      proxy: false,
    });
  } catch (error) {
    throw error;
  }
}

export const run = async (audioPath) => {
  try {
    const data = fs.readFileSync(audioPath);
    const response = await identify(data, defaultOptions);

    if (checkKey === 40) {
      //checkKey = 0;
      await bot.sendMessage(
        ADM_CHAT_ID,
        `Возможно закончился срок ключа, проверить ключ\n[время: ${new Date().toLocaleTimeString('ru-RU', {
          timeZone: 'Europe/Moscow',
        })}]`,
        { parse_mode: 'HTML' },
      );
    }
    if (checkKey > 70) {
      await bot.sendMessage(
        ADM_CHAT_ID,
        `Сто пудово закончился срок ключа. Меняй ключ\n[время: ${new Date().toLocaleTimeString('ru-RU', {
          timeZone: 'Europe/Moscow',
        })}]`,
        { parse_mode: 'HTML' },
      );
      checkKey = 0;
    }

    if (response?.data?.status.code === 0) {
      checkKey = 0;
    } else checkKey += 1;

    if (response?.data?.metadata?.music) {
      const meta = response.data.metadata.music[0];
      let artistsStr = '';
      meta.artists.forEach((artist) => {
        artistsStr += artist.name + ', ';
      });

      const newSong = `Артист: ${artistsStr}\nНазвание песни: ${meta.title}`;
      const latestSongString = `Артист: ${latestSong.artist}\nНазвание песни: ${latestSong.title}`;
      // Если та же песня
      if (newSong.toLowerCase() === latestSongString.toLowerCase()) return;

      // Если в названии есть совпадения
      const newSongTitleArr = meta.title?.split(' ');
      const latestSongArr = latestSong.title?.split(' ');
      if (newSongTitleArr?.length && latestSongArr?.length) {
        for (const newSongTitleItem of newSongTitleArr) {
          if (newSongTitleItem.length < 3) continue;
          if (latestSongArr.includes(newSongTitleItem)) {
            const message = await bot.sendMessage(
              ADM_CHAT_ID,
              `ТЕСТ ПОВТОР\nНовая песня:${newSong}\nСтарая песня:${latestSong.title}`,
              {
                parse_mode: 'HTML',
              },
            );
            setTimeout(() => {
              try {
                bot.deleteMessage(ADM_CHAT_ID, message.message_id);
              } catch {}
            }, 1200000);
            return;
          }
        }
      }

      const currentHour = new Date().getHours();

      const timeNow = new Date().toLocaleTimeString('ru-RU', {
        timeZone: 'Europe/Moscow',
      });

      // Если время по Москве с 7 до 22
      if (currentHour >= 4 && currentHour <= 18) {
        chatIds.forEach(async (chatId) => {
          const message = await bot.sendMessage(chatId, `${newSong}\n[время: ${timeNow}]`, {
            parse_mode: 'HTML',
          });
          setTimeout(() => {
            try {
              bot.deleteMessage(chatId, message.message_id);
            } catch {}
          }, 1200000);
        });
      }

      const songNew = { artist: artistsStr, title: meta.title, time: timeNow };

      writeBase(songNew);

      latestSong = songNew;
    }
  } catch {}
};
