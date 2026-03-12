const { Telegraf } = require('telegraf');
const { createCanvas, registerFont } = require('canvas');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// テキストから名刺画像を生成する関数
async function createBusinessCard(text) {
  const canvas = createCanvas(800, 450); // 名刺の一般的な比率（横800px × 縦450px）
  const ctx = canvas.getContext('2d');

  // 背景を白で塗りつぶす
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // フォントと文字色の設定（デフォルトのゴシック系フォント）
  ctx.fillStyle = '#000000';
  ctx.font = '24px sans-serif';

  // 送られてきたテキストを行で分割して、適度に改行しながら描画
  const lines = text.split('\n');
  const startY = 50; // 上からの余白
  const lineHeight = 35; // 行の高さ

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].trim();
    // もし法人名（1行目など）なら少し文字を大きくする（簡易的）
    if (i === 1) {
        ctx.font = 'bold 36px sans-serif';
    } else if (i === 6) { // 氏名
        ctx.font = 'bold 40px sans-serif';
    } else {
        ctx.font = '24px sans-serif';
    }
    
    // Y座標（縦の位置）を計算して描画
    ctx.fillText(lineText, 50, startY + (i * lineHeight));
  }

  // 生成した画像をバッファ（メモリ上のデータ）として返す
  return canvas.toBuffer('image/png');
}

// /start コマンドの処理
bot.start((ctx) => {
    ctx.reply('こんにちは！このグループで名刺を作ります。\n\n【使い方】\n`/card` の後に、改行して情報を入力してください。', { parse_mode: 'Markdown' });
});

// /card コマンドの処理
bot.command('card', async (ctx) => {
    // 送られてきたメッセージから "/card " の部分を取り除く
    const text = ctx.message.text.replace('/card', '').trim();

    if (!text) {
        return ctx.reply('エラー: 名刺にする情報が入力されていません。\n例:\n/card\n9020005012245\n一般社団法人きんもくせい\n...', { reply_to_message_id: ctx.message.message_id });
    }

    try {
        // 処理中であることを知らせる（Telegramは画像生成に少し時間がかかるとエラーになるため）
        const loadingMessage = await ctx.reply('名刺画像を生成中です...', { reply_to_message_id: ctx.message.message_id });

        // 画像生成関数を呼び出し
        const imageBuffer = await createBusinessCard(text);

        // 生成した画像をグループに送信
        await ctx.replyWithPhoto({ source: imageBuffer }, { 
            caption: '名刺が完成しました！',
            reply_to_message_id: ctx.message.message_id 
        });

        // 処理中のメッセージを削除
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

    } catch (error) {
        console.error('画像生成エラー:', error);
        ctx.reply('申し訳ありません、名刺画像の生成中にエラーが発生しました。');
    }
});

bot.launch().then(() => {
  console.log('Business Card Bot is running...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
