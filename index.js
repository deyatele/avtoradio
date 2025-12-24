import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { Parser } from 'm3u8-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
const STREAM_URL = 'https://hls-01-gpm.hostingradio.ru/avtoradio495/playlist.m3u8';
const AUDD_API_KEY = process.env.AUDD_API_KEY;
const TEMP_DIR = './temp';
const BITRATE_PATH = '128';

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const httpClient = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});

async function downloadHLSSegment() {
  try {
    const masterResponse = await httpClient.get(STREAM_URL);
    if (masterResponse.status !== 200) {
      throw new Error(`HTTP ${masterResponse.status} when downloading master playlist`);
    }

    const hlssidMatch = masterResponse.data.match(/[?&]hlssid=([^&"]+)/);
    const hlssid = hlssidMatch ? hlssidMatch[1] : null;
    if (!hlssid) {
      throw new Error('hlssid not found in master playlist');
    }

    const subPlaylistUrl = new URL(`${BITRATE_PATH}/playlist.m3u8?hlssid=${hlssid}`, STREAM_URL).href;

    const subResponse = await httpClient.get(subPlaylistUrl);
    if (subResponse.status !== 200) {
      throw new Error(`HTTP ${subResponse.status} when downloading sub-playlist`);
    }

    const subPlaylistContent = subResponse.data;

    const parser = new Parser();
    parser.push(subPlaylistContent);
    parser.end();

    const segments = parser.manifest.segments;
    if (!segments || segments.length === 0) {
      throw new Error('No segments in sub-playlist');
    }

    const lastSegment = segments[segments.length - 1];
    const segmentUri = lastSegment.uri;

    const baseUrl = new URL(subPlaylistUrl).origin + new URL(subPlaylistUrl).pathname.replace(/\/[^\/]+$/, '/');
    const lastSegmentUrl = new URL(segmentUri, baseUrl).href;

    const segmentResponse = await httpClient.get(lastSegmentUrl, { responseType: 'arraybuffer' });

    const segmentPath = path.join(TEMP_DIR, 'segment.ts');
    fs.writeFileSync(segmentPath, segmentResponse.data);

    return segmentPath;
  } catch (error) {
    console.error('❌ Segment loading error:', error.message);
    return null;
  }
}

function extractAudio(inputPath) {
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
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Conversion error:', err.message);
        reject(err);
      });
  });
}

async function recognizeSong(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      console.log('❌ Audio file not found:', audioPath);
      return;
    }

    const formData = new (await import('form-data')).default();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('api_token', AUDD_API_KEY);

    const response = await axios.post('https://api.audd.io/', formData, { headers: formData.getHeaders() });
    const result = response.data.result;
    if (response?.data?.result) {
      console.log('\n🎧 NOW PLAYING:');
      console.log('Artist: ', result.artist);
      console.log('Track:   ', result.title);
    }
  } catch {}
}

async function cleanup() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach((file) => {
      const filePath = path.join(TEMP_DIR, file);
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error('❌ Error while cleaning:', err.message);
  }
}

async function main() {
  try {
    const segmentPath = await downloadHLSSegment();
    if (!segmentPath) {
      console.log('❌ Failed to load segment. Skipping processing.');
      return;
    }

    const audioPath = await extractAudio(segmentPath);
    if (!audioPath) {
      console.log('❌ Failed to extract audio.');
      return;
    }

    await recognizeSong(audioPath);

    await cleanup();
  } catch (error) {
    console.error('❗️ CRITICAL ERROR:', error.message);
  }
}

// Запускаем каждые 30 секунд
setInterval(main, 30000);
main(); // Первый запуск сразу
