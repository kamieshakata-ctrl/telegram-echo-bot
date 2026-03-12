const { Telegraf } = require('telegraf');
const { createCanvas, registerFont } = require('canvas');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// テキストから名刺情報を抽出し、名刺画像を生成する関数
async function createBusinessCard(text) {
  const canvas = createCanvas(1000, 600); // 名刺の一般的な比率（横1000px × 縦600px）
  const ctx = canvas.getContext('2d');

  // 背景を白で塗りつぶす
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. テキストから各項目を抽出する（正規表現を使用）
  let companyName = "";
  let address = "";
  let tel = "";
  let mobile = "";
  let email = "";
  let name = "";
  let corpNumber = "";
  let otherInfo = [];

  // スペース（全角・半角）や改行で単語ごとに分割
  const parts = text.split(/[\s　\n]+/);

  for (let part of parts) {
      if (!part) continue;

      if (/^[0-9]{13}$/.test(part)) { // 13桁の数字なら法人番号
          corpNumber = part;
      } else if (/(法人|会社|合同会社|株式会社|有限会社)/.test(part)) { // 法人名
          companyName = part;
      } else if (part.includes('〒') || part.includes('県') || part.includes('都') || part.includes('府') || part.includes('道') || part.includes('市') || part.includes('区')) { // 住所（簡易的）
          address += part + " ";
      } else if (/^0\d{1,4}-\d{1,4}-\d{4}$/.test(part)) { // 電話番号（固定か携帯か）
          if (part.startsWith('080') || part.startsWith('090') || part.startsWith('070')) {
              mobile = part;
          } else {
              tel = part;
          }
      } else if (part.includes('@')) { // メールアドレス
          email = part;
      } else if (/^[ぁ-んァ-ヶ一-龥々]+$/.test(part) && part.length >= 2 && part.length <= 10 && !companyName.includes(part)) {
          // 漢字ひらがなカタカナのみで2文字〜10文字なら名前の可能性（法人名以外）
          name = part;
      } else {
          // それ以外は備考やその他の情報
          otherInfo.push(part);
      }
  }
  
  // 住所の余分なスペースを消す
  address = address.trim();

  // --- 2. 抽出した情報をキャンバスに描画 ---

  // フォントと文字色の基本設定
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'left';

  // 法人名 (大きく、左上)
  if (companyName) {
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText(companyName, 80, 100);
  }

  // 法人番号 (小さく、法人名の下)
  if (corpNumber) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(`法人番号: ${corpNumber}`, 80, 140);
  }

  // 氏名 (中央あたりに非常に大きく)
  if (name) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText(name, 80, 300);
  }

  // 連絡先情報 (右下にまとめて配置)
  ctx.fillStyle = '#333333';
  ctx.font = '28px sans-serif';
  let bottomY = 400;
  
  if (address) {
      ctx.fillText(`住所: ${address}`, 80, bottomY);
      bottomY += 40;
  }
  if (tel) {
      ctx.fillText(`TEL: ${tel}`, 80, bottomY);
      bottomY += 40;
  }
  if (mobile) {
      ctx.fillText(`携帯: ${mobile}`, 80, bottomY);
      bottomY += 40;
  }
  if (email) {
      ctx.fillText(`Email: ${email}`, 80, bottomY);
  }

  // 備考 (その他の情報があれば一番下に小さく)
  if (otherInfo.length > 0) {
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#999999';
      ctx.fillText(otherInfo.join(' '), 80, 560);
  }

  // 生成した画像を返す
  return canvas.toBuffer('image/png');
}

// /start コマンドの処理
bot.start((ctx) => {
    ctx.reply('こんにちは！このグループで名刺を作ります。\n\n【使い方】\n`/card 法人番号 法人名 住所 電話 メール 名前...` のように一発で送信してください。自動で情報を読み取って名刺にします！', { parse_mode: 'Markdown' });
});

// /card コマンドの処理
bot.command('card', async (ctx) => {
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
