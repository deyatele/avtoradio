import path from 'path';
import fs from 'fs';

export const TEMP_DIR = './temp';
export async function cleanup() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

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
