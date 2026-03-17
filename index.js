const { Telegraf, Markup } = require('telegraf');
const { createCanvas, registerFont, loadImage } = require('canvas');
const fs = require('fs');
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

  // 全ての改行や全角スペースを半角スペースに統一して平坦化
  let remaining = text.replace(/[\s　]+/g, ' ').trim();

  // メールアドレスの抽出
  const emailMatch = remaining.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) { 
      email = emailMatch[0]; 
      remaining = remaining.replace(emailMatch[0], ''); 
  }

  // 電話番号の抽出
  const phoneMatches = remaining.match(/0\d{1,4}-\d{1,4}-\d{4}/g);
  if (phoneMatches) {
      for (let p of phoneMatches) {
          if (p.startsWith('080') || p.startsWith('090') || p.startsWith('070')) mobile = p;
          else tel = p;
          remaining = remaining.replace(p, '');
      }
  }

  // 法人番号の抽出
  const corpMatch = remaining.match(/\b\d{13}\b/);
  if (corpMatch) { 
      corpNumber = corpMatch[0]; 
      remaining = remaining.replace(corpMatch[0], ''); 
  }

  // 法人名の抽出
  const companyMatch = remaining.match(/[^\s]*(?:法人|会社|合同会社|株式会社|有限会社)[^\s]*/);
  if (companyMatch) { 
      companyName = companyMatch[0]; 
      remaining = remaining.replace(companyMatch[0], ''); 
  }

  // 残った文字列（住所＋氏名など）を整理
  remaining = remaining.replace(/[\s]+/g, ' ').trim();
  const parts = remaining.split(' ');
  let addressParts = [];
  let nameParts = [];
  let foundAddress = false;

  // 後ろから順にチェックし、数字や住所特有の漢字がない部分を「氏名」とする
  for (let i = parts.length - 1; i >= 0; i--) {
      let part = parts[i];
      if (!part) continue;
      
      // 数字が含まれない かつ 住所の末尾特有の漢字(都,道,府,県,市,区,町,村)で終わらない場合は「名前（または役職）」
      if (!foundAddress && !/[0-9０-９]/.test(part) && !/(都|道|府|県|市|区|町|村)$/.test(part)) {
          nameParts.unshift(part); // 配列の先頭に追加
      } else {
          foundAddress = true; // 一度でも住所らしい単語にぶつかったら、それより前はすべて住所とする
          addressParts.unshift(part);
      }
  }
  
  address = addressParts.join(' ').trim();
  name = nameParts.join(' ');

  // --- 2. 抽出した情報をキャンバスに描画 ---
  const leftX = 140; // ロゴの分だけ全体を少し右にズラす
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';

  // ロゴを描画 (左上、法人名の横)
  try {
      const logoBuffer = fs.readFileSync('./logo.svg');
      const logoImage = await loadImage(logoBuffer);
      ctx.drawImage(logoImage, 50, 80, 70, 70); // x=50, y=80 に 70x70 で描画
  } catch(e) {
      console.log('ロゴの読み込みをスキップしました');
  }

  // 法人名 (左上、ロゴの右側)
  if (companyName) {
      ctx.fillStyle = '#1A2942'; // 法人名だけネイビーで少し高級感を出す
      ctx.font = 'bold 40px "Noto Sans CJK"';
      ctx.fillText(companyName, leftX, 125);
  }

  // 氏名 (中央より上)
  if (name) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 64px "Noto Sans CJK"'; // 74px から 64px に少し縮小
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

// メニュー用のキーボード定義
const mainMenu = Markup.inlineKeyboard([
    [Markup.button.callback('📦 ロッカー預け入れ', 'locker_deposit')],
    [Markup.button.callback('🪪 名刺作成の使い方', 'help_card')]
]);

// /start コマンドの処理
bot.start((ctx) => {
    ctx.reply('こんにちは！契約代行アシスタントです。\nメニューから操作を選んでください。', mainMenu);
});

// /help コマンドや「メニュー」という言葉への反応
bot.help((ctx) => {
    ctx.reply('メニューから操作を選んでください。', mainMenu);
});

bot.hears(/メニュー|ヘルプ|使い方/, (ctx) => {
    ctx.reply('メニューから操作を選んでください。', mainMenu);
});

// 名刺作成の使い方ボタン
bot.action('help_card', (ctx) => {
    ctx.reply('【名刺作成の使い方】\n\n名刺にしたい情報（法人名、住所、電話番号、名前など）を含んだテキストを、そのまま送信してください。\n自動的に読み取って名刺画像を作成します！\n\n（※短い挨拶などには反応しません）');
    ctx.answerCbQuery();
});

// ロッカー預け入れボタン
bot.action('locker_deposit', (ctx) => {
    const areaMenu = Markup.inlineKeyboard([
        [Markup.button.callback('📍 上野', 'area_ueno')],
        [Markup.button.callback('📍 浅草', 'area_asakusa')],
        [Markup.button.callback('📍 新宿', 'area_shinjuku')]
    ]);
    ctx.reply('【リスト】 預け入れロッカーを選択\n\nエリアを選択してください：', areaMenu);
    ctx.answerCbQuery();
});

// エリア選択ボタン
bot.action(/^area_(.+)$/, (ctx) => {
    const areaMap = {
        'ueno': '上野',
        'asakusa': '浅草',
        'shinjuku': '新宿'
    };
    const selected = areaMap[ctx.match[1]];
    
    if (ctx.match[1] === 'ueno') {
        // 上野を選択した場合のカードタイプメッセージ（インラインキーボード付き）
        const lockerMenu = Markup.inlineKeyboard([
            [Markup.button.callback('1番ロッカーに預ける', 'locker_deposit_ueno_1')],
            [Markup.button.callback('2番ロッカーに預ける', 'locker_deposit_ueno_2')],
            [Markup.button.callback('戻る', 'locker_deposit')]
        ]);
        
        ctx.editMessageText(`📍 【上野エリア】\n\n上野駅周辺のロッカーを選択してください：\n\n・ 空き状況: 〇\n・ 料金: 300円/回`, lockerMenu);
    } else {
        // 上野以外はとりあえず仮のメッセージ
        ctx.editMessageText(`${selected}エリアが選択されました。\n（※現在準備中です）`, Markup.inlineKeyboard([[Markup.button.callback('戻る', 'locker_deposit')]]));
    }
    
    ctx.answerCbQuery();
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
