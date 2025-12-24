import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { Parser } from 'm3u8-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
// Настройки
const STREAM_URL = 'https://hls-01-gpm.hostingradio.ru/avtoradio495/playlist.m3u8';
const AUDD_API_KEY = process.env.AUDD_API_KEY;
const TEMP_DIR = './temp';
const BITRATE_PATH = '128';
// 128 кбит/с

// Создаём временную папку
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Настройка HTTP‑клиента
const httpClient = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});

// 1. Загрузка сегмента HLS
async function downloadHLSSegment() {
  try {
    // 1. Загружаем мастер‑плейлист
    const masterResponse = await httpClient.get(STREAM_URL);
    if (masterResponse.status !== 200) {
      throw new Error(`HTTP ${masterResponse.status} при загрузке мастер‑плейлиста`);
    }

    // 2. Извлекаем hlssid
    const hlssidMatch = masterResponse.data.match(/[?&]hlssid=([^&"]+)/);
    const hlssid = hlssidMatch ? hlssidMatch[1] : null;
    if (!hlssid) {
      throw new Error('Не найден hlssid в мастер‑плейлисте');
    }

    // 3. Формируем URL под‑плейлиста
    const subPlaylistUrl = new URL(`${BITRATE_PATH}/playlist.m3u8?hlssid=${hlssid}`, STREAM_URL).href;

    const subResponse = await httpClient.get(subPlaylistUrl);
    if (subResponse.status !== 200) {
      throw new Error(`HTTP ${subResponse.status} при загрузке под‑плейлиста`);
    }

    const subPlaylistContent = subResponse.data;

    // 4. Парсим под‑плейлист
    const parser = new Parser();
    parser.push(subPlaylistContent);
    parser.end();

    const segments = parser.manifest.segments;
    if (!segments || segments.length === 0) {
      throw new Error('В под‑плейлисте нет сегментов');
    }

    // 5. Берём последний сегмент
    const lastSegment = segments[segments.length - 1];
    const segmentUri = lastSegment.uri;

    // 6. Формируем полный URL сегмента
    // Важный момент: baseUrl должен быть из под‑плейлиста, а не из мастер‑плейлиста!
    const baseUrl = new URL(subPlaylistUrl).origin + new URL(subPlaylistUrl).pathname.replace(/\/[^\/]+$/, '/');
    const lastSegmentUrl = new URL(segmentUri, baseUrl).href;

    const segmentResponse = await httpClient.get(lastSegmentUrl, { responseType: 'arraybuffer' });

    const segmentPath = path.join(TEMP_DIR, 'segment.ts');
    fs.writeFileSync(segmentPath, segmentResponse.data);

    return segmentPath;
  } catch (error) {
    console.error('❌ Ошибка загрузки сегмента:', error.message);
    return null;
  }
}

// 2. Извлечение аудио из .ts
function extractAudio(inputPath) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !fs.existsSync(inputPath)) {
      reject(new Error('Файл не найден или путь пуст'));
      return;
    }

    const outputPath = path.join(TEMP_DIR, 'audio.mp3');

    ffmpeg(inputPath)
      .outputOptions('-vn')
      .audioCodec('libmp3lame')
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Ошибка конвертации:', err.message);
        reject(err);
      });
  });
}

// 3. Распознавание трека через AudD API
async function recognizeSong(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      console.log('❌ Аудиофайл не найден:', audioPath);
      return;
    }

    const formData = new (await import('form-data')).default();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('api_token', AUDD_API_KEY);

    const response = await axios.post('https://api.audd.io/', formData, { headers: formData.getHeaders() });
    const result = response.data.result;
    if (response?.data?.result) {
      console.log('\n🎧 СЕЙЧАС ИГРАЕТ:');
      console.log('Артист: ', result.artist);
      console.log('Трек:   ', result.title);
      console.log('Альбом:  ', result.album || 'Не указан');
    }
  } catch {}
}

// 4. Очистка временных файлов
async function cleanup() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach((file) => {
      const filePath = path.join(TEMP_DIR, file);
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error('❌ Ошибка при очистке:', err.message);
  }
}

// Основная функция
async function main() {
  try {
    // 1. Скачиваем сегмент
    const segmentPath = await downloadHLSSegment();
    if (!segmentPath) {
      console.log('❌ Не удалось загрузить сегмент. Пропускаем обработку.');
      return;
    }

    // 2. Извлекаем аудио
    const audioPath = await extractAudio(segmentPath);
    if (!audioPath) {
      console.log('❌ Не удалось извлечь аудио.');
      return;
    }

    // 3. Распознаём трек
    await recognizeSong(audioPath);

    // 4. Очищаем временные файлы
    await cleanup();
  } catch (error) {
    console.error('❗️ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
  }
}

// Запускаем каждые 30 секунд
setInterval(main, 30000);
main(); // Первый запуск сразу
