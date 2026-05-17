import cron from 'node-cron';

import { run } from './geInfoACRCloud.js';
import { downloadHLSSegment, extractAudio } from './getInfoService.js';
import { bot } from './telegram.js';
import { cleanup, getTempPath } from './utils.js';

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
  } catch {
    isRunning = false;
    await cleanup(filesToCleanup);
  } finally {
    isRunning = false;
    await cleanup(filesToCleanup);
  }
}

cron.schedule('*/40 * * * * *', () => {
  main();
});

main()
