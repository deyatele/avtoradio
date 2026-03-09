import axios from 'axios';
import https from 'https';
import http from 'http';
import ffmpeg from 'fluent-ffmpeg';
import { Parser } from 'm3u8-parser';
import fs from 'fs';

if (process.env.NODE_ENV !== 'production') {
  ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
}
const STREAM_URL =
  process.env.RADIO_STREAM_URL || 'https://hls-01-gpm.hostingradio.ru/avtoradio8162/playlist.m3u8';
const BITRATE_PATH = process.env.BITRATE_PATH || '128';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Иногда требуется для стриминговых серверов
});

// Хранилище для cookie
let sessionCookie = '';

const httpClient = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  // Отключаем автоматические редиректы, чтобы обрабатывать их вручную
  maxBodyLength: Infinity,
  // Отключаем прокси - он может неправильно обрабатывать HTTPS
  proxy: false,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'ru,en;q=0.9',
    Referer: 'https://www.avtoradioshow.ru/',
    Origin: 'https://www.avtoradioshow.ru',
  },
  // Явно указываем агенты для обоих протоколов
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: httpsAgent,
  // Разрешаем редиректы, включая с http на https
  validateStatus: (status) => status >= 200 && status < 400,
  // Принудительно используем HTTPS при редиректах
  beforeRedirect: (options, { headers }) => {
    // Если редирект на HTTP, меняем на HTTPS
    if (options.protocol === 'http:') {
      options.protocol = 'https:';
      options.port = 443;
    }
  },
});

/**
 * Скачивает поток до достижения нужной длительности
 * @param {number} targetDuration - желаемая длина в секундах
 * @param {string} segmentPath - путь, куда сохранить файл
 */
export async function downloadHLSSegment(targetDuration = 20, segmentPath) {
  try {
    if (!segmentPath) throw new Error('segmentPath is required');

    if (fs.existsSync(segmentPath)) fs.unlinkSync(segmentPath);

    let currentTotalDuration = 0;
    let lastDownloadedUri = '';

    while (currentTotalDuration < targetDuration) {
      const masterResponse = await httpClient.get(STREAM_URL);

      // Сохраняем Cookie из ответа для последующих запросов
      const setCookie = masterResponse.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) {
        sessionCookie = setCookie[0].split(';')[0];
      }

      const hlssidMatch = masterResponse.data.match(/[?&]hlssid=([^&"\n]+)/);
      const hlssid = hlssidMatch ? hlssidMatch[1] : null;

      if (!hlssid) {
        throw new Error('hlssid not found');
      }

      let subPlaylistUrl;
      try {
        const base = new URL(STREAM_URL);
        subPlaylistUrl = new URL(`${BITRATE_PATH}/playlist.m3u8?hlssid=${hlssid}`, base).href;
        // Принудительно используем HTTPS
        subPlaylistUrl = subPlaylistUrl.replace('http://', 'https://');
      } catch (urlError) {
        throw new Error(`Invalid URL construction: ${urlError.message}`);
      }

      const subResponse = await httpClient.get(subPlaylistUrl, {
        headers: {
          Referer: 'https://www.avtoradioshow.ru/',
          Origin: 'https://www.avtoradioshow.ru',
          Cookie: sessionCookie || '',
        },
      });

      const parser = new Parser();
      parser.push(subResponse.data);
      parser.end();

      const segments = parser.manifest.segments;
      if (!segments || segments.length === 0) throw new Error('No segments found');

      const lastSegment = segments[segments.length - 1];

      if (lastSegment.uri !== lastDownloadedUri) {
        const baseUrl =
          new URL(subPlaylistUrl).origin + new URL(subPlaylistUrl).pathname.replace(/\/[^\/]+$/, '/');
        let lastSegmentUrl;
        try {
          lastSegmentUrl = new URL(lastSegment.uri, baseUrl).href;
          // Принудительно используем HTTPS
          lastSegmentUrl = lastSegmentUrl.replace('http://', 'https://');
        } catch (urlError) {
          throw new Error(`Invalid segment URL construction: ${urlError.message}`);
        }

        const segmentResponse = await httpClient.get(lastSegmentUrl, {
          responseType: 'arraybuffer',
          headers: {
            Referer: subPlaylistUrl,
            Origin: 'https://www.avtoradioshow.ru',
          },
        });

        // Используем синхронную запись для надежности в цикле
        fs.appendFileSync(segmentPath, Buffer.from(segmentResponse.data));

        lastDownloadedUri = lastSegment.uri;
        currentTotalDuration += lastSegment.duration;
      }

      if (currentTotalDuration < targetDuration) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    return segmentPath;
  } catch (error) {
    console.log(error);
  }
}

/**
 * Извлекает аудио из TS сегмента
 * @param {string} inputPath - путь к исходному TS файлу
 * @param {string} outputPath - путь, куда сохранить MP3
 */
export function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !fs.existsSync(inputPath)) {
      return reject(new Error('Input file not found'));
    }

    ffmpeg(inputPath)
      .outputOptions('-vn')
      .audioCodec('libmp3lame')
      .toFormat('mp3')
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .save(outputPath);
  });
}
