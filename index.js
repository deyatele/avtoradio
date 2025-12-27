import { run } from './geInfoACRCloud.js';
import { downloadHLSSegment, extractAudio } from './getInfoService.js';
import { bot } from './telegram.js';
import { cleanup, getTempPath } from './utils.js';
import cron from 'node-cron';

const chatId = process.env.ADM_CHAT_ID;

async function main() {
  bot.sendMessage(chatId, `[${new Date().toLocaleTimeString()}] Starting scheduled scan...`);
  // Генерируем уникальные пути для ТЕКУЩЕГО запуска
  const currentSegmentPath = getTempPath('segment', 'ts');
  const currentAudioPath = getTempPath('audio', 'mp3');

  const filesToCleanup = [];

  try {
    // Передаем путь в функцию
    const segmentPath = await downloadHLSSegment(5, currentSegmentPath);
    if (!segmentPath) return;
    filesToCleanup.push(segmentPath);

    // Передаем входной и выходной пути
    const audioPath = await extractAudio(segmentPath, currentAudioPath);
    if (!audioPath) return;
    filesToCleanup.push(audioPath);

    await run(audioPath);
  } catch (error) {
    bot.sendMessage(chatId, `❗️ CRITICAL ERROR: ${JSON.stringify(error)}`);
    console.error('❗️ CRITICAL ERROR:', error.message);
  } finally {
    // Удаляем файлы, даже если произошла ошибка
    await cleanup(filesToCleanup);
  }
}

cron.schedule('*/40 * 7-21 * * *', () => {
  main();
});

const currentHour = new Date().getHours();
if (currentHour >= 7 && currentHour <= 22) {
  main();
}
