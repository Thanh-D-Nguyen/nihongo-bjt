import { Injectable, Logger } from '@nestjs/common';

export type GeneratedArticle = {
  titleJp: string;
  titleVi: string;
  summaryJp: string;
  summaryVi: string;
  contentJson: Record<string, unknown>;
  vocabItems: Array<{
    wordJp: string;
    reading: string;
    meaningVi: string;
    pos?: string;
    jlptLevel?: string;
    sentenceJp?: string;
    sentenceVi?: string;
    displayOrder: number;
  }>;
  quizzes: Array<{
    questionJp: string;
    questionVi: string;
    quizType: string;
    options: string[];
    correctAnswer: string;
    explanationJp: string;
    explanationVi: string;
    displayOrder: number;
  }>;
  jlptLevel: string;
  tokensUsed: number;
};

export type GenerationContext = {
  widgetKind: string;
  date: Date;
  locale: string;
  targetJlptLevel?: string;
  realData?: Record<string, unknown>;
};

const SYSTEM_PROMPT = `You are a Japanese language education content generator for Vietnamese learners.
You MUST respond ONLY with valid JSON matching the requested schema.
Generate content appropriate for the specified JLPT level.
All Japanese text must be linguistically correct with proper grammar and natural phrasing.
All Vietnamese translations must be natural and accurate.
Include furigana readings for kanji words.`;

const WIDGET_PROMPTS: Record<string, (ctx: GenerationContext) => string> = {
  magazine_vocab: (ctx) =>
    `Generate a vocabulary article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Topic: daily life vocabulary for ${ctx.date.toISOString().slice(0, 10)}.
Include 5 vocabulary items with example sentences and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: {}, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_weather: (ctx) =>
    `Generate a weather-themed Japanese learning article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Use this real weather data: ${JSON.stringify(ctx.realData ?? {})}.
Teach weather-related vocabulary and expressions.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { weatherSummary }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_horoscope: (ctx) =>
    `Generate a horoscope-themed Japanese learning article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Date: ${ctx.date.toISOString().slice(0, 10)}.
Include fortune-telling vocabulary and expressions used in Japanese daily life.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { horoscope }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_loto: (ctx) =>
    `Generate a lottery/numbers-themed Japanese learning article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Use this statistical data: ${JSON.stringify(ctx.realData ?? {})}.
Teach number expressions, probability vocabulary, and luck-related phrases.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { prediction }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_loto6: (ctx) =>
    `Generate a Loto6-themed Japanese learning article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Use this statistical and admin-generated set data: ${JSON.stringify(ctx.realData ?? {})}.
Do not claim winning certainty. Present generated number sets as study/entertainment combinations.
Teach number expressions, probability vocabulary, and luck-related phrases.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { prediction, generatedSets, japaneseSentence }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_loto7: (ctx) =>
    `Generate a Loto7-themed Japanese learning article for JLPT ${ctx.targetJlptLevel ?? 'N3'} learners.
Use this statistical and admin-generated set data: ${JSON.stringify(ctx.realData ?? {})}.
Do not claim winning certainty. Present generated number sets as study/entertainment combinations.
Teach number expressions, probability vocabulary, and luck-related phrases.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { prediction, generatedSets, japaneseSentence }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,

  magazine_bjt_phrase: (ctx) =>
    `Generate a BJT business Japanese phrase article for JLPT ${ctx.targetJlptLevel ?? 'N2'} learners.
Date: ${ctx.date.toISOString().slice(0, 10)}.
Focus on one key business expression with usage context, politeness levels, and common mistakes.
Include 4 vocabulary items and 2 quiz questions.
Schema: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { phraseContext, politenessLevel }, vocabItems: [{wordJp, reading, meaningVi, pos, jlptLevel, sentenceJp, sentenceVi, displayOrder}], quizzes: [{questionJp, questionVi, quizType, options, correctAnswer, explanationJp, explanationVi, displayOrder}], jlptLevel }`,
};

@Injectable()
export class AiContentProvider {
  private readonly logger = new Logger(AiContentProvider.name);
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = process.env.MAGAZINE_AI_MODEL ?? 'gpt-4o-mini';

  async generate(ctx: GenerationContext): Promise<GeneratedArticle> {
    if (!this.apiKey) {
      this.logger.warn('No OPENAI_API_KEY configured, using mock generation');
      return this.generateMock(ctx);
    }

    const promptBuilder = WIDGET_PROMPTS[ctx.widgetKind];
    if (!promptBuilder) {
      this.logger.warn(`No prompt template for widget kind: ${ctx.widgetKind}, falling back to mock`);
      return this.generateMock(ctx);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: promptBuilder(ctx) },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenAI API error ${response.status}: ${errorText}`);
        return this.generateMock(ctx);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };

      const content = data.choices[0]?.message?.content;
      if (!content) {
        this.logger.error('Empty response from OpenAI');
        return this.generateMock(ctx);
      }

      const parsed = JSON.parse(content) as Omit<GeneratedArticle, 'tokensUsed'>;
      return {
        ...parsed,
        jlptLevel: parsed.jlptLevel ?? ctx.targetJlptLevel ?? 'N3',
        tokensUsed: data.usage?.total_tokens ?? 0,
      };
    } catch (error) {
      this.logger.error(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return this.generateMock(ctx);
    }
  }

  private generateMock(ctx: GenerationContext): GeneratedArticle {
    const level = ctx.targetJlptLevel ?? 'N3';

    const mocksByKind: Record<string, GeneratedArticle> = {
      magazine_vocab: {
        titleJp: '今日の単語：日常生活',
        titleVi: 'Từ vựng hôm nay: Cuộc sống hàng ngày',
        summaryJp: '毎日使える便利な日本語の単語を学びましょう。',
        summaryVi: 'Hãy học những từ tiếng Nhật hữu ích có thể dùng hàng ngày.',
        contentJson: { theme: '日常生活', date: ctx.date.toISOString().slice(0, 10) },
        vocabItems: [
          { wordJp: '挨拶', reading: 'あいさつ', meaningVi: 'Lời chào', pos: '名詞', jlptLevel: 'N3', sentenceJp: '朝の挨拶は大切です。', sentenceVi: 'Lời chào buổi sáng rất quan trọng.', displayOrder: 1 },
          { wordJp: '習慣', reading: 'しゅうかん', meaningVi: 'Thói quen', pos: '名詞', jlptLevel: 'N3', sentenceJp: '早起きの習慣をつけたい。', sentenceVi: 'Tôi muốn tạo thói quen dậy sớm.', displayOrder: 2 },
          { wordJp: '届ける', reading: 'とどける', meaningVi: 'Giao, chuyển đến', pos: '動詞', jlptLevel: 'N3', sentenceJp: '荷物を届けてください。', sentenceVi: 'Xin hãy giao hàng cho tôi.', displayOrder: 3 },
          { wordJp: '丁寧', reading: 'ていねい', meaningVi: 'Lịch sự, cẩn thận', pos: 'な形容詞', jlptLevel: 'N3', sentenceJp: '丁寧な言葉遣いを心がけましょう。', sentenceVi: 'Hãy cố gắng sử dụng cách nói lịch sự.', displayOrder: 4 },
          { wordJp: '片付ける', reading: 'かたづける', meaningVi: 'Dọn dẹp, sắp xếp', pos: '動詞', jlptLevel: 'N3', sentenceJp: '部屋を片付けてから出かけます。', sentenceVi: 'Tôi sẽ dọn phòng xong rồi mới ra ngoài.', displayOrder: 5 },
        ],
        quizzes: [
          { questionJp: '「挨拶」の読み方は？', questionVi: 'Cách đọc của「挨拶」là gì?', quizType: 'reading', options: ['あいさつ', 'あいさく', 'あいざつ', 'あいしゃつ'], correctAnswer: 'あいさつ', explanationJp: '挨拶（あいさつ）は毎日使う大切な言葉です。', explanationVi: '挨拶 (aisatsu) là từ quan trọng được dùng hàng ngày.', displayOrder: 1 },
          { questionJp: '「丁寧」の意味は？', questionVi: 'Ý nghĩa của「丁寧」là gì?', quizType: 'meaning', options: ['Lịch sự', 'Nhanh chóng', 'Khó khăn', 'Vui vẻ'], correctAnswer: 'Lịch sự', explanationJp: '丁寧（ていねい）は「礼儀正しい」という意味です。', explanationVi: '丁寧 (teinei) có nghĩa là "lịch sự, cẩn thận".', displayOrder: 2 },
        ],
        jlptLevel: level,
        tokensUsed: 0,
      },
      magazine_weather: {
        titleJp: '今日の天気と天気の表現',
        titleVi: 'Thời tiết hôm nay và cách diễn đạt về thời tiết',
        summaryJp: '天気に関する日本語の表現を学びましょう。',
        summaryVi: 'Hãy học cách diễn đạt tiếng Nhật về thời tiết.',
        contentJson: { weatherSummary: '晴れ時々曇り' },
        vocabItems: [
          { wordJp: '天気予報', reading: 'てんきよほう', meaningVi: 'Dự báo thời tiết', pos: '名詞', jlptLevel: 'N3', sentenceJp: '天気予報によると明日は雨です。', sentenceVi: 'Theo dự báo thời tiết thì ngày mai trời mưa.', displayOrder: 1 },
          { wordJp: '蒸し暑い', reading: 'むしあつい', meaningVi: 'Nóng ẩm, oi bức', pos: 'い形容詞', jlptLevel: 'N3', sentenceJp: '今日はとても蒸し暑いですね。', sentenceVi: 'Hôm nay trời nóng ẩm quá nhỉ.', displayOrder: 2 },
          { wordJp: '梅雨', reading: 'つゆ', meaningVi: 'Mùa mưa (tháng 6-7)', pos: '名詞', jlptLevel: 'N3', sentenceJp: '梅雨の時期は洗濯物が乾きにくい。', sentenceVi: 'Mùa mưa thì quần áo khó khô.', displayOrder: 3 },
          { wordJp: '涼しい', reading: 'すずしい', meaningVi: 'Mát mẻ', pos: 'い形容詞', jlptLevel: 'N4', sentenceJp: '秋になると涼しくなります。', sentenceVi: 'Khi vào thu thì trời trở nên mát mẻ.', displayOrder: 4 },
        ],
        quizzes: [
          { questionJp: '「梅雨」の読み方は？', questionVi: 'Cách đọc của「梅雨」là gì?', quizType: 'reading', options: ['つゆ', 'ばいう', 'うめあめ', 'めう'], correctAnswer: 'つゆ', explanationJp: '梅雨（つゆ）は6月〜7月の雨の季節です。「ばいう」とも読みます。', explanationVi: '梅雨 (tsuyu) là mùa mưa tháng 6-7. Cũng đọc là "baiu".', displayOrder: 1 },
          { questionJp: '「蒸し暑い」はどんな天気？', questionVi: '「蒸し暑い」mô tả thời tiết như thế nào?', quizType: 'meaning', options: ['Nóng ẩm', 'Lạnh buốt', 'Mát mẻ', 'Khô ráo'], correctAnswer: 'Nóng ẩm', explanationJp: '蒸し暑い（むしあつい）は湿度が高くて暑いという意味です。', explanationVi: '蒸し暑い (mushiatsui) nghĩa là nóng và độ ẩm cao.', displayOrder: 2 },
        ],
        jlptLevel: level,
        tokensUsed: 0,
      },
    };

    return mocksByKind[ctx.widgetKind] ?? mocksByKind['magazine_vocab']!;
  }
}
