import axios from 'axios';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const TEMP_DIR = os.tmpdir();

export function getTempPath(prefix, ext) {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  return path.join(TEMP_DIR, `${prefix}_${uniqueId}.${ext}`);
}

export async function cleanup(files = []) {
  for (const filePath of files) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        await fsPromises.unlink(filePath);
      }
    } catch {
      // Ошибка может быть, если файл занят другим процессом (например, ffmpeg еще не закрылся)
    }
  }
}

export function writeBase(song) {
  createSongInBase(song);

  /* if (!fs.existsSync('./base.json')) {
    fs.writeFileSync('./base.json', JSON.stringify([song]));
    return;
  }
  const raw = fs.readFileSync('./base.json', 'utf-8');
  const base = raw ? JSON.parse(raw) : [];
  base.push(song);

  if (base.length > 10) base.shift();
  fs.writeFileSync('./base.json', JSON.stringify(base)); */
}

async function createSongInBase(song) {
  if (!song?.title || !song?.artist || !song?.time) return;
  try {
    await axios.post(`${process.env.BASE_URL}/song`, JSON.stringify(song), {
      headers: {
        'Content-Type': 'application/json',
        'x-api-token-bot': process.env.BOT_TOKEN_BASE,
      },
      proxy: false,
    });
  } catch {}
}
