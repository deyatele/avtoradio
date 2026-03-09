import cron from 'node-cron';
import { downloadHLSSegment, extractAudio } from './getInfoService.js';
import { run } from './geInfoACRCloud.js';
import { cleanup, getTempPath } from './utils.js';
import { bot } from './telegram.js';

const chatId = process.env.ADM_CHAT_ID;
let isRunning = false;
console.log(`Бот запущен ${new Date()}`);
bot.sendMessage(chatId, `Бот запущен ${new Date()}`);
async function main() {
  if (isRunning) return;
  isRunning = true;

  const currentSegmentPath = getTempPath('segment', 'ts');
  const currentAudioPath = getTempPath('audio', 'mp3');

  const filesToCleanup = [];

  try {
    const segmentPath = await downloadHLSSegment(5, currentSegmentPath);
    if (!segmentPath) return;
    filesToCleanup.push(segmentPath);

    const audioPath = await extractAudio(segmentPath, currentAudioPath);
    if (!audioPath) return;
    filesToCleanup.push(audioPath);
    await run(audioPath);
  } catch (error) {
    isRunning = false;
    await cleanup(filesToCleanup);
  } finally {
    isRunning = false;
    await cleanup(filesToCleanup);
  }
}

cron.schedule('*/40 * 4-18 * * *', () => {
  main();
});

const currentHour = new Date().getHours();
if (currentHour >= 4 && currentHour <= 18) {
  main();
}
