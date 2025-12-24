import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import crypto from 'crypto';

// На Windows это будет путь в AppData\Local\Temp
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
    } catch (err) {
      // Ошибка может быть, если файл занят другим процессом (например, ffmpeg еще не закрылся)
    }
  }
}