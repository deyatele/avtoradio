
import { run } from './geInfoACRCloud.js';
import { downloadHLSSegment, extractAudio } from './getInfoService.js';
import { cleanup } from './utils.js';

async function main() {

  try {
    const segmentPath = await downloadHLSSegment(5);
    if (!segmentPath) {
      console.log('❌ Failed to load segment. Skipping processing.');
      return;
    }
    const audioPath = await extractAudio(segmentPath);
    if (!audioPath) {
      console.log('❌ Failed to extract audio.');
      return;
    }
    await run(audioPath);
    await cleanup();
  } catch (error) {
    console.error('❗️ CRITICAL ERROR:', error.message);
  }
}

setInterval(main, 40000);
main();
