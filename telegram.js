import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_TOKEN;
const TelegramBotApi = () => {
  const bot = new TelegramBot(token, { polling: true });
  bot.on('polling_error', (err) => console.log(err));
  
  return bot;
};

export const bot = TelegramBotApi();
