import { run } from './geInfoACRCloud.js';
import { downloadHLSSegment, extractAudio } from './getInfoService.js';
import { cleanup, getTempPath } from './utils.js'; 

async function main() {
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
    console.error('❗️ CRITICAL ERROR:', error.message);
  } finally {
    // Удаляем файлы, даже если произошла ошибка
    await cleanup(filesToCleanup);
  }
}

setInterval(main, 40000);
main();