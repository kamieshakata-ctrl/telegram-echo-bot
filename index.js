const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Hello! I am a bot hosted on Railway.'));
bot.help((ctx) => ctx.reply('Send me a message and I will echo it back!'));

bot.on('text', (ctx) => {
  ctx.reply(`Echo: ${ctx.message.text}`);
});

bot.launch().then(() => {
  console.log('Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
