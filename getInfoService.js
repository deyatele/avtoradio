import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { Parser } from 'm3u8-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import https from 'https';
import { TEMP_DIR } from './utils.js';

dotenv.config();

const node_env = process.env.NODE_ENV;
console.log(node_env);
if (!node_env) {
  ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
}
const STREAM_URL = 'https://hls-01-gpm.hostingradio.ru/avtoradio495/playlist.m3u8';
const AUDD_API_KEY = process.env.AUDD_API_KEY;
const BITRATE_PATH = '128';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const httpClient = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  httpsAgent: httpsAgent,
});

/**
 * Скачивает поток до достижения нужной длительности
 * @param {number} targetDuration - желаемая длина видео в секундах (например, 20)
 */
export async function downloadHLSSegment(targetDuration = 20) {
  try {
    const segmentPath = path.join(TEMP_DIR, 'segment.ts');

    // Очищаем старый файл перед началом записи
    if (fs.existsSync(segmentPath)) fs.unlinkSync(segmentPath);

    let currentTotalDuration = 0;
    let lastDownloadedUri = '';

    console.log(`⏳ Начинаю сбор потока (${targetDuration} сек.)...`);

    while (currentTotalDuration < targetDuration) {
      const masterResponse = await httpClient.get(STREAM_URL);
      const hlssidMatch = masterResponse.data.match(/[?&]hlssid=([^&"]+)/);
      const hlssid = hlssidMatch ? hlssidMatch[1] : null;

      if (!hlssid) throw new Error('hlssid not found');

      const subPlaylistUrl = new URL(`${BITRATE_PATH}/playlist.m3u8?hlssid=${hlssid}`, STREAM_URL).href;
      const subResponse = await httpClient.get(subPlaylistUrl);

      const parser = new Parser();
      parser.push(subResponse.data);
      parser.end();

      const segments = parser.manifest.segments;
      if (!segments || segments.length === 0) throw new Error('No segments found');

      const lastSegment = segments[segments.length - 1];

      // Если это новый сегмент, которого мы еще не качали
      if (lastSegment.uri !== lastDownloadedUri) {
        const baseUrl =
          new URL(subPlaylistUrl).origin + new URL(subPlaylistUrl).pathname.replace(/\/[^\/]+$/, '/');
        const lastSegmentUrl = new URL(lastSegment.uri, baseUrl).href;

        const segmentResponse = await httpClient.get(lastSegmentUrl, { responseType: 'arraybuffer' });

        // ДОПИСЫВАЕМ в файл (append)
        fs.appendFileSync(segmentPath, Buffer.from(segmentResponse.data));

        lastDownloadedUri = lastSegment.uri;
        currentTotalDuration += lastSegment.duration;

        console.log(`✅ Загружено: ${currentTotalDuration.toFixed(1)} / ${targetDuration} сек.`);
      }

      // Ждем 3 секунды, чтобы плейлист успел обновиться на сервере
      if (currentTotalDuration < targetDuration) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    return segmentPath;
  } catch (error) {
    console.error('❌ Segment loading error:', error.message);
    return null;
  }
}

export function extractAudio(inputPath) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !fs.existsSync(inputPath)) {
      reject(new Error('File not found or path empty'));
      return;
    }

    const outputPath = path.join(TEMP_DIR, 'audio.mp3');

    ffmpeg(inputPath)
      .outputOptions('-vn')
      .audioCodec('libmp3lame')
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('❌ Conversion error:', err.message);
        reject(err);
      });
  });
}

export async function recognizeSong(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      console.log('❌ Audio file not found:', audioPath);
      return;
    }

    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('api_token', AUDD_API_KEY);

    const response = await axios.post('https://api.audd.io/', formData, {
      headers: formData.getHeaders(),
    });

    const result = response.data.result;
    if (result) {
      console.log('\n🎧 NOW PLAYING:');
      console.log('Artist: ', result.artist);
      console.log('Track:  ', result.title);
      return result;
    } else {
      console.log('🤷 Совпадений не найдено');
    }
  } catch (error) {
    console.error('❌ Recognition error:', error.message);
  }
}
