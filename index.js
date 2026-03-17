const { Telegraf } = require('telegraf');
const { createCanvas, registerFont } = require('canvas');
require('dotenv').config();

// システムにインストールされたフォントパスを指定（Dockerfileでインストール済み）
registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', { family: 'Noto Sans CJK' });

const bot = new Telegraf(process.env.BOT_TOKEN);

// テキストから名刺情報を抽出し、名刺画像を生成する関数
async function createBusinessCard(text) {
  const canvas = createCanvas(1000, 600); // 名刺の一般的な比率（横1000px × 縦600px）
  const ctx = canvas.getContext('2d');

  // 背景を少し温かみのあるオフホワイトに
  ctx.fillStyle = '#F8F8F5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 下部のデザイン帯（細めのネイビー）
  ctx.fillStyle = '#1A2942'; // 濃いネイビー
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  // 1. テキストから各項目を抽出する（正規表現を使用）
  let companyName = "";
  let address = "";
  let tel = "";
  let mobile = "";
  let email = "";
  let name = "";
  let corpNumber = "";
  let otherInfo = [];

  const lines = text.split('\n');

  for (let line of lines) {
      let part = line.trim();
      if (!part) continue;

      if (/^[0-9]{13}$/.test(part)) { 
          corpNumber = part;
      } else if (/(法人|会社|合同会社|株式会社|有限会社)/.test(part)) { 
          companyName = part;
      } else if (part.includes('〒') || part.match(/[都道府県市区町村]/) || part.match(/[0-9０-９]+[丁目番地号-]/) || /^[0-9]{3}-[0-9]{4}$/.test(part)) { 
          address += part + " ";
      } else if (/^0\d{1,4}-\d{1,4}-\d{4}$/.test(part)) { 
          if (part.startsWith('080') || part.startsWith('090') || part.startsWith('070')) {
              mobile = part;
          } else {
              tel = part;
          }
      } else if (part.includes('@')) { 
          email = part;
      } else if (/^[ぁ-んァ-ヶ一-龥々\s　]+$/.test(part) && part.length >= 2 && part.length <= 15 && !companyName.includes(part)) {
          name = part;
      } else {
          otherInfo.push(part);
      }
  }
  
  address = address.trim();

  // --- 2. 抽出した情報をキャンバスに描画 ---
  const leftX = 100;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';

  // 法人名 (左上、余白を適切に)
  if (companyName) {
      ctx.font = 'bold 36px "Noto Sans CJK"';
      ctx.fillText(companyName, leftX, 120);
  }

  // 氏名 (中央より上)
  if (name) {
      ctx.font = 'bold 70px "Noto Sans CJK"';
      ctx.fillText(name, leftX, 260);
  }

  // 区切り線
  ctx.fillStyle = '#000000';
  ctx.fillRect(leftX, 310, 60, 2);

  // 連絡先情報 (左下)
  ctx.font = '24px "Noto Sans CJK"';
  let currentY = 370;
  const lineSpacing = 36;
  
  // 住所から郵便番号を分離
  let postalCode = address.match(/(〒?\d{3}-\d{4})/);
  let addressText = address.replace(/(〒?\d{3}-\d{4})/, '').trim();

  if (postalCode) {
      const zip = postalCode[1].startsWith('〒') ? postalCode[1] : '〒' + postalCode[1];
      ctx.fillText(zip, leftX, currentY);
      currentY += lineSpacing;
  }
  if (addressText) {
      ctx.fillText(addressText, leftX, currentY);
      currentY += lineSpacing;
  } else if (!postalCode && address) {
      ctx.fillText(address, leftX, currentY);
      currentY += lineSpacing;
  }

  // 連絡先の整列表示（コロンの位置を固定）
  const labelX = leftX;
  const colonX = leftX + 110;
  const valueX = leftX + 140;

  if (email) {
      ctx.fillText('MAIL', labelX, currentY);
      ctx.fillText(':', colonX, currentY);
      ctx.fillText(email, valueX, currentY);
      currentY += lineSpacing;
  }
  if (mobile) {
      ctx.fillText('MOBILE', labelX, currentY);
      ctx.fillText(':', colonX, currentY);
      ctx.fillText(mobile, valueX, currentY);
      currentY += lineSpacing;
  }
  if (tel) {
      ctx.fillText('TEL', labelX, currentY);
      ctx.fillText(':', colonX, currentY);
      ctx.fillText(tel, valueX, currentY);
  }

  return canvas.toBuffer('image/png');
}

// /start コマンドの処理
bot.start((ctx) => {
    ctx.reply('こんにちは！このグループで名刺を作ります。\n\n【使い方】\n`/card 法人番号 法人名 住所 電話 メール 名前...` のように一発で送信してください。自動で情報を読み取って名刺にします！', { parse_mode: 'Markdown' });
});

// /help コマンドや「メニュー」という言葉への反応
bot.help((ctx) => {
    ctx.reply('【名刺作成Botの使い方】\n\n名刺にしたい情報（法人名、住所、電話番号、名前など）を含んだテキストを、このチャットにそのまま送信してください。\n\n自動的に読み取って名刺画像を作成します！\n\n（※短い挨拶などには反応しません）');
});

bot.hears(/メニュー|ヘルプ|使い方/, (ctx) => {
    ctx.reply('【名刺作成Botの使い方】\n\n名刺にしたい情報（法人名、住所、電話番号、名前など）を含んだテキストを、このチャットにそのまま送信してください。\n\n自動的に読み取って名刺画像を作成します！\n\n（※短い挨拶などには反応しません）');
});

// テキストを受け取った時の処理（コマンド不要）
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // 短すぎるメッセージや挨拶などは無視する（誤爆防止）
    if (text.length < 15 && !text.includes('\n')) {
        return;
    }

    try {
        const loadingMessage = await ctx.reply('名刺画像を生成中です...', { reply_to_message_id: ctx.message.message_id });

        const imageBuffer = await createBusinessCard(text);

        await ctx.replyWithPhoto({ source: imageBuffer }, { 
            reply_to_message_id: ctx.message.message_id 
        });

        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

    } catch (error) {
        console.error('画像生成エラー:', error);
    }
});

bot.launch().then(async () => {
  // Telegram側にメニューとして登録
  await bot.telegram.setMyCommands([
    { command: 'start', description: '初期設定と使い方' },
    { command: 'card', description: 'テキストから名刺を作成' }
  ]);
  console.log('Business Card Bot is running...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
