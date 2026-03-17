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
  // ただし、名前が「苗字 スペース 名前」の形式だった場合、分断されてしまうのを防ぐため、
  // まずは改行で配列（行）にしてから、行単位で情報を抽出します。
  const lines = text.split('\n');

  for (let line of lines) {
      let part = line.trim();
      if (!part) continue;

      if (/^[0-9]{13}$/.test(part)) { // 13桁の数字なら法人番号
          corpNumber = part;
      } else if (/(法人|会社|合同会社|株式会社|有限会社)/.test(part)) { // 法人名
          companyName = part;
      } else if (part.includes('〒') || part.includes('県') || part.includes('都') || part.includes('府') || part.includes('道') || part.includes('市') || part.includes('区') || /^[0-9]{3}-[0-9]{4}$/.test(part) || /^[0-9０-９]+丁目/.test(part)) { 
          // 住所（複数行に分かれている場合もあるため、結合する）
          address += part + " ";
      } else if (/^0\d{1,4}-\d{1,4}-\d{4}$/.test(part)) { // 電話番号
          if (part.startsWith('080') || part.startsWith('090') || part.startsWith('070')) {
              mobile = part;
          } else {
              tel = part;
          }
      } else if (part.includes('@')) { // メールアドレス
          email = part;
      } else if (/^[ぁ-んァ-ヶ一-龥々\s　]+$/.test(part) && part.length >= 2 && part.length <= 15 && !companyName.includes(part)) {
          // 漢字・ひらがな・カタカナ・スペースのみで構成された行（2〜15文字）なら「氏名（フルネーム）」として扱う
          name = part;
      } else {
          // それ以外は備考
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
      ctx.font = 'bold 48px "Noto Sans CJK"';
      ctx.fillText(companyName, 80, 100);
  }

  // 氏名 (中央あたりに非常に大きく)
  if (name) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 72px "Noto Sans CJK"';
      ctx.fillText(name, 80, 300);
  }

  // 連絡先情報 (右下にまとめて配置)
  ctx.fillStyle = '#333333';
  ctx.font = '28px "Noto Sans CJK"';
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

  // 生成した画像を返す
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
