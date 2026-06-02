// 訪問看護ステーションHP - バックエンドサーバー
require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Anthropicクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// チャットボットのシステムプロンプト（ステーション情報を設定）
const SYSTEM_PROMPT = `
あなたは訪問看護ステーションのホームページに設置されたAIアシスタントです。
以下の自社情報をもとに、利用者・ご家族からの質問に丁寧にお答えください。

【サービス名】
訪問看護ステーション

【対応エリア】
京都市西京区

【サービス内容】
看護師・保健師・理学療法士・作業療法士・言語聴覚士などの専門スタッフが、医師の指示のもとご自宅へ訪問し、以下のサービスを提供します。
・病状観察・健康管理（血圧・体温・脈拍チェックなど）
・医療処置（点滴、注射、褥瘡処置、カテーテル管理など）
・服薬管理・指導
・身体清拭・入浴介助・洗髪
・リハビリテーション（機能回復・維持訓練）
・在宅酸素・人工呼吸器・人工肛門（ストーマ）の管理
・ターミナルケア（終末期ケア）
・家族へのケア指導・相談

【料金（介護保険・2024年6月改定後の公定料金）】
※訪問看護ステーションの場合の基本単位数（1単位≒10〜11円）
・20分未満：314単位
・30分未満：471単位
・30分以上1時間未満：823単位
・1時間以上1時間30分未満：1,128単位
・1時間30分以上：1,428単位
・理学療法士・作業療法士・言語聴覚士の場合：294単位／回

【自己負担額の目安】
介護保険の場合、利用者の所得により1〜3割負担。
例）1割負担・30分未満の場合：約471〜500円程度／回

【主な加算】
・緊急時訪問看護加算（Ⅰ）：月600単位
・特別管理加算（Ⅰ）：月500単位、（Ⅱ）：月250単位
・夜間・早朝加算：基本単位数の25%加算
・深夜加算：基本単位数の50%加算
・ターミナルケア加算：2,500単位（死亡日前14日以内に2日以上ケアを実施した場合）

【営業時間・連絡先】
営業時間：月曜〜土曜 9:00〜18:00
※24時間対応の緊急連絡体制を整えています

【よくある質問と回答】
Q: 訪問看護はどんな人が利用できますか？
A: 子どもから高齢者まで年齢を問わず、病気や障害をお持ちで在宅療養されている方が対象です。主治医の「訪問看護指示書」があれば利用できます。

Q: どうすれば訪問看護を利用できますか？
A: まずはかかりつけ医・ケアマネジャー・地域包括支援センター、または当ステーションへご相談ください。主治医から訪問看護指示書を発行していただくことで利用が開始できます。

Q: 介護保険と医療保険、どちらが適用されますか？
A: 原則として、65歳以上で要介護・要支援認定を受けている方は介護保険が優先適用されます。40〜64歳の方や特定疾病の方などは医療保険が適用になる場合があります。

Q: 訪問の頻度や時間はどのくらいですか？
A: 介護保険の場合、支給限度額の範囲内で週1〜2回程度が一般的です。医療保険の場合は原則週3回以内（特定の疾病や状態の方は週4回以上も可）です。1回の訪問時間は20分〜1時間30分以上まで、お体の状態に合わせて設定します。

Q: 夜間や休日でも対応してもらえますか？
A: 24時間対応の緊急連絡体制を整えています。急な体調変化があった場合もご連絡いただければ緊急訪問が可能です。

Q: 入院したら訪問看護はどうなりますか？
A: 入院中は訪問看護が一時停止となります。退院後は速やかに再開できるよう、病院と連携して調整いたします。

Q: 交通費はかかりますか？
A: 保険の種類や状況によって異なります。詳しくは当ステーションへお問い合わせください。

Q: 訪問時に準備するものはありますか？
A: 基本的にご自宅にあるものでサービスを提供します。処置内容によっては必要な物品をご相談させていただく場合があります。

【回答の際の注意事項】
・利用者・ご家族が不安を感じないよう、温かく丁寧なトーンでお答えください。
・専門用語はできるだけわかりやすく言い換えてください。
・料金の具体的な金額はあくまで目安であり、詳細はステーションへの問い合わせを案内してください。
・対応エリア（京都市西京区）外のご相談には、お近くのステーションへの相談をご案内ください。
・答えられない内容は無理に回答せず、ステーションへの直接お問い合わせを促してください。
・返答は日本語で行う。
`.trim();

// ===================================
// チャットAPIエンドポイント（SSEストリーミング）
// ===================================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // バリデーション
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'メッセージが不正です。' });
    }

    // SSEヘッダーの設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Claude APIにストリーミングリクエストを送信
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    // テキストチャンクを逐次クライアントへ送信
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // ストリーム終了シグナルを送信
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('チャットAPIエラー:', error.message);
    res.write(
      `data: ${JSON.stringify({ error: 'エラーが発生しました。もう一度お試しください。' })}\n\n`
    );
    res.end();
  }
});

// ===================================
// お問い合わせフォーム受付エンドポイント
// ===================================
app.post('/api/contact', (req, res) => {
  try {
    const { name, phone, email, message } = req.body;

    // 必須項目のバリデーション
    if (!name || !message) {
      return res
        .status(400)
        .json({ success: false, message: 'お名前とお問い合わせ内容は必須です。' });
    }

    // 実運用ではメール送信やDB保存を行う
    console.log('【お問い合わせ受信】', { name, phone, email, message });

    res.json({ success: true, message: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。' });
  } catch (error) {
    console.error('お問い合わせエラー:', error.message);
    res.status(500).json({ success: false, message: 'エラーが発生しました。お電話でお問い合わせください。' });
  }
});

// SPAフォールバック
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏥 ほほえみ訪問看護ステーション HP`);
  console.log(`🚀 サーバー起動中: http://localhost:${PORT}\n`);
});
