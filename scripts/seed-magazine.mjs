// Seed magazine articles — creates 7 days of content for all 5 widget kinds.
// Usage: node scripts/seed-magazine.mjs
// Idempotent: skips articles whose slug already exists.

import "dotenv/config";
import { PrismaClient } from "../packages/database/generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const KINDS = [
  "magazine_vocab",
  "magazine_weather",
  "magazine_horoscope",
  "magazine_loto",
  "magazine_bjt_phrase"
];

// ─── Sample content per widget kind ──────────────────────────────────────────

const SAMPLE_CONTENT = {
  magazine_vocab: {
    titleJp: "梅雨の季節の言葉",
    titleVi: "Từ vựng mùa mưa",
    summaryJp: "梅雨の時期に使う日本語の表現を学びましょう。",
    summaryVi: "Học các từ vựng tiếng Nhật thường dùng trong mùa mưa.",
    contentJson: {
      theme: "rainy_season",
      introduction:
        "6月から7月にかけて、日本は梅雨の季節を迎えます。この時期によく使う言葉を覚えましょう。",
      introductionVi:
        "Từ tháng 6 đến tháng 7, Nhật Bản bước vào mùa mưa. Hãy cùng học các từ hay dùng trong thời kỳ này."
    },
    jlptLevel: "N4",
    vocabItems: [
      {
        wordJp: "梅雨",
        reading: "つゆ",
        meaningVi: "Mùa mưa (đặc trưng tháng 6-7 ở Nhật)",
        pos: "noun",
        jlptLevel: "N3",
        sentenceJp: "今年の梅雨は長引きそうです。",
        sentenceVi: "Mùa mưa năm nay có vẻ sẽ kéo dài.",
        displayOrder: 0
      },
      {
        wordJp: "傘",
        reading: "かさ",
        meaningVi: "Cái ô, cái dù",
        pos: "noun",
        jlptLevel: "N5",
        sentenceJp: "折りたたみ傘を持っていった方がいいですよ。",
        sentenceVi: "Bạn nên mang theo ô gấp thì tốt hơn.",
        displayOrder: 1
      },
      {
        wordJp: "蒸し暑い",
        reading: "むしあつい",
        meaningVi: "Oi bức, nóng ẩm",
        pos: "i-adjective",
        jlptLevel: "N3",
        sentenceJp: "梅雨の時期は蒸し暑い日が続きます。",
        sentenceVi: "Trong mùa mưa, những ngày oi bức cứ kéo dài liên tục.",
        displayOrder: 2
      }
    ],
    quizzes: [
      {
        questionJp: "「梅雨」の読み方はどれですか？",
        questionVi: "Cách đọc của「梅雨」là gì?",
        quizType: "multiple_choice",
        options: ["つゆ", "ばいう", "うめあめ", "かいう"],
        correctAnswer: "つゆ",
        explanationJp:
          "「梅雨」は一般的に「つゆ」と読みます。「ばいう」という読み方もありますが、日常会話では「つゆ」が一般的です。",
        explanationVi:
          "「梅雨」thường được đọc là「つゆ」. Cách đọc「ばいう」cũng có nhưng trong hội thoại hàng ngày,「つゆ」phổ biến hơn.",
        displayOrder: 0
      }
    ]
  },

  magazine_weather: {
    titleJp: "東京の天気予報",
    titleVi: "Dự báo thời tiết Tokyo",
    summaryJp: "今日の東京の天気と気温をチェックしましょう。",
    summaryVi: "Hãy kiểm tra thời tiết và nhiệt độ Tokyo hôm nay.",
    contentJson: {
      city: "東京",
      weatherIcon: "cloudy_rain",
      highTemp: 28,
      lowTemp: 22,
      humidity: 85,
      description: "曇り時々雨",
      descriptionVi: "Nhiều mây, thỉnh thoảng có mưa",
      uvIndex: 3,
      recommendation: "傘を持って出かけましょう。蒸し暑いので、水分補給も忘れずに。",
      recommendationVi: "Hãy mang ô khi ra ngoài. Trời oi bức nên đừng quên bổ sung nước nhé."
    },
    jlptLevel: "N4",
    vocabItems: [
      {
        wordJp: "天気予報",
        reading: "てんきよほう",
        meaningVi: "Dự báo thời tiết",
        pos: "noun",
        jlptLevel: "N4",
        sentenceJp: "毎朝、天気予報を確認してから出かけます。",
        sentenceVi: "Mỗi sáng tôi kiểm tra dự báo thời tiết rồi mới ra ngoài.",
        displayOrder: 0
      },
      {
        wordJp: "最高気温",
        reading: "さいこうきおん",
        meaningVi: "Nhiệt độ cao nhất",
        pos: "noun",
        jlptLevel: "N3",
        sentenceJp: "明日の最高気温は35度の予想です。",
        sentenceVi: "Nhiệt độ cao nhất ngày mai dự kiến là 35 độ.",
        displayOrder: 1
      },
      {
        wordJp: "湿度",
        reading: "しつど",
        meaningVi: "Độ ẩm",
        pos: "noun",
        jlptLevel: "N2",
        sentenceJp: "湿度が高い日は体が疲れやすくなります。",
        sentenceVi: "Những ngày độ ẩm cao, cơ thể dễ mệt mỏi hơn.",
        displayOrder: 2
      }
    ],
    quizzes: [
      {
        questionJp: "「最高気温」の「最高」はどういう意味ですか？",
        questionVi: "「最高」trong「最高気温」có nghĩa gì?",
        quizType: "multiple_choice",
        options: ["Cao nhất", "Thấp nhất", "Trung bình", "Hiện tại"],
        correctAnswer: "Cao nhất",
        explanationJp: "「最高」は「もっとも高い」という意味です。反対は「最低」（さいてい）です。",
        explanationVi:
          '「最高」có nghĩa là "cao nhất". Từ trái nghĩa là「最低」(さいてい - thấp nhất).',
        displayOrder: 0
      }
    ]
  },

  magazine_horoscope: {
    titleJp: "今日の星占い",
    titleVi: "Tử vi hôm nay",
    summaryJp: "今日の運勢をチェックして、良い一日を過ごしましょう。",
    summaryVi: "Hãy xem vận mệnh hôm nay và có một ngày tốt lành.",
    contentJson: {
      zodiacFortunes: [
        {
          sign: "牡羊座",
          signReading: "おひつじざ",
          signVi: "Bạch Dương",
          fortune: "大吉",
          fortuneVi: "Đại cát",
          message: "新しいことに挑戦するのに最適な日です。積極的に行動しましょう。",
          messageVi: "Đây là ngày tuyệt vời để thử thách điều mới. Hãy hành động tích cực.",
          luckyColor: "赤（あか）",
          luckyNumber: 7
        },
        {
          sign: "牡牛座",
          signReading: "おうしざ",
          signVi: "Kim Ngưu",
          fortune: "中吉",
          fortuneVi: "Trung cát",
          message: "コツコツと努力を続ければ、良い結果が出るでしょう。焦らないでください。",
          messageVi: "Nếu kiên trì nỗ lực từng chút, kết quả tốt sẽ đến. Đừng nóng vội.",
          luckyColor: "緑（みどり）",
          luckyNumber: 3
        }
      ]
    },
    jlptLevel: "N3",
    vocabItems: [
      {
        wordJp: "運勢",
        reading: "うんせい",
        meaningVi: "Vận mệnh, vận may",
        pos: "noun",
        jlptLevel: "N2",
        sentenceJp: "今月の運勢はとても良いみたいです。",
        sentenceVi: "Vận mệnh tháng này có vẻ rất tốt.",
        displayOrder: 0
      },
      {
        wordJp: "挑戦",
        reading: "ちょうせん",
        meaningVi: "Thử thách, thách thức",
        pos: "noun",
        jlptLevel: "N3",
        sentenceJp: "新しいことに挑戦するのは大切です。",
        sentenceVi: "Việc thử thách điều mới là rất quan trọng.",
        displayOrder: 1
      },
      {
        wordJp: "積極的",
        reading: "せっきょくてき",
        meaningVi: "Tích cực, chủ động",
        pos: "na-adjective",
        jlptLevel: "N2",
        sentenceJp: "日本語の勉強には積極的な姿勢が必要です。",
        sentenceVi: "Việc học tiếng Nhật cần thái độ tích cực, chủ động.",
        displayOrder: 2
      }
    ],
    quizzes: [
      {
        questionJp: "「挑戦する」の意味に一番近いのはどれですか？",
        questionVi: "Nghĩa gần nhất với「挑戦する」là gì?",
        quizType: "multiple_choice",
        options: ["Thử thách, cố gắng làm", "Từ bỏ, bỏ cuộc", "Nghỉ ngơi", "Phàn nàn"],
        correctAnswer: "Thử thách, cố gắng làm",
        explanationJp: "「挑戦する」は「難しいことに取り組む」「チャレンジする」という意味です。",
        explanationVi: '「挑戦する」có nghĩa là "đối mặt với việc khó", "challenge / thử thách".',
        displayOrder: 0
      }
    ]
  },

  magazine_loto: {
    titleJp: "今週のラッキーナンバー",
    titleVi: "Số may mắn tuần này",
    summaryJp: "数字にまつわる日本語も一緒に学びましょう。",
    summaryVi: "Cùng học tiếng Nhật liên quan đến con số nhé.",
    contentJson: {
      luckyNumbers: [7, 14, 23, 31, 42],
      luckyKanji: "福",
      luckyKanjiReading: "ふく",
      luckyKanjiMeaning: "Phúc, may mắn",
      explanation:
        "「福」は幸運や幸せを表す漢字です。「福袋」（ふくぶくろ）や「祝福」（しゅくふく）などの言葉に使われます。",
      explanationVi:
        "「福」là chữ Hán biểu thị sự may mắn, hạnh phúc. Được dùng trong các từ như「福袋」(túi may mắn) hay「祝福」(chúc phúc).",
      drawDay: "木曜日",
      drawDayVi: "Thứ Năm"
    },
    jlptLevel: "N4",
    vocabItems: [
      {
        wordJp: "数字",
        reading: "すうじ",
        meaningVi: "Chữ số, con số",
        pos: "noun",
        jlptLevel: "N4",
        sentenceJp: "日本語の数字の数え方は少し複雑です。",
        sentenceVi: "Cách đếm số trong tiếng Nhật hơi phức tạp.",
        displayOrder: 0
      },
      {
        wordJp: "縁起がいい",
        reading: "えんぎがいい",
        meaningVi: "May mắn, mang điềm tốt",
        pos: "expression",
        jlptLevel: "N2",
        sentenceJp: "日本では「8」は縁起がいい数字とされています。",
        sentenceVi: "Ở Nhật, số「8」được coi là con số mang điềm tốt.",
        displayOrder: 1
      },
      {
        wordJp: "当たる",
        reading: "あたる",
        meaningVi: "Trúng (xổ số), đúng",
        pos: "verb",
        jlptLevel: "N3",
        sentenceJp: "宝くじが当たったら、何をしますか？",
        sentenceVi: "Nếu trúng xổ số, bạn sẽ làm gì?",
        displayOrder: 2
      }
    ],
    quizzes: [
      {
        questionJp: "「縁起がいい」はどういう意味ですか？",
        questionVi: "「縁起がいい」có nghĩa là gì?",
        quizType: "multiple_choice",
        options: ["Mang điềm tốt, may mắn", "Mang điềm xấu", "Rất đắt", "Rất khó"],
        correctAnswer: "Mang điềm tốt, may mắn",
        explanationJp:
          "「縁起がいい」は「良いことが起こりそう」「幸運を呼ぶ」という意味です。反対は「縁起が悪い」です。",
        explanationVi:
          '「縁起がいい」nghĩa là "có vẻ sẽ có chuyện tốt xảy ra", "mang lại may mắn". Trái nghĩa là「縁起が悪い」.',
        displayOrder: 0
      }
    ]
  },

  magazine_bjt_phrase: {
    titleJp: "ビジネス日本語：お疲れ様です",
    titleVi: "Tiếng Nhật thương mại: お疲れ様です",
    summaryJp: "職場でよく使う「お疲れ様です」の使い方を学びましょう。",
    summaryVi: "Học cách sử dụng「お疲れ様です」— câu thường dùng nơi công sở.",
    contentJson: {
      phrase: "お疲れ様です",
      phraseReading: "おつかれさまです",
      literalMeaning: "Bạn đã vất vả rồi (nghĩa gốc)",
      usageNote:
        "同僚や上司に対して使う万能な挨拶表現。出会い、別れ、メールの冒頭など様々な場面で使えます。",
      usageNoteVi:
        "Biểu hiện chào hỏi đa năng dùng với đồng nghiệp và cấp trên. Có thể dùng khi gặp mặt, chia tay, đầu email, v.v.",
      formality: "polite",
      situations: [
        "職場で同僚とすれ違う時",
        "会議の終わりに",
        "退社する時",
        "ビジネスメールの冒頭"
      ],
      situationsVi: [
        "Khi đi ngang đồng nghiệp ở công ty",
        "Cuối buổi họp",
        "Khi tan làm",
        "Đầu email công việc"
      ],
      dialogue: [
        {
          speaker: "田中",
          text: "お疲れ様です。今日の会議の資料、もう準備できましたか？",
          textVi:
            "Chào anh/chị (otsukaresama desu). Tài liệu cho cuộc họp hôm nay đã chuẩn bị xong chưa?"
        },
        {
          speaker: "山田",
          text: "お疲れ様です。はい、先ほどメールで送りました。",
          textVi: "Chào anh/chị. Vâng, tôi vừa gửi qua email lúc nãy rồi ạ."
        }
      ]
    },
    jlptLevel: "N3",
    vocabItems: [
      {
        wordJp: "会議",
        reading: "かいぎ",
        meaningVi: "Cuộc họp, hội nghị",
        pos: "noun",
        jlptLevel: "N4",
        sentenceJp: "午後3時から会議があります。",
        sentenceVi: "Có cuộc họp từ 3 giờ chiều.",
        displayOrder: 0
      },
      {
        wordJp: "資料",
        reading: "しりょう",
        meaningVi: "Tài liệu, tư liệu",
        pos: "noun",
        jlptLevel: "N3",
        sentenceJp: "会議の前に資料に目を通しておいてください。",
        sentenceVi: "Xin hãy đọc qua tài liệu trước cuộc họp.",
        displayOrder: 1
      },
      {
        wordJp: "準備",
        reading: "じゅんび",
        meaningVi: "Chuẩn bị",
        pos: "noun",
        jlptLevel: "N4",
        sentenceJp: "プレゼンの準備に3日かかりました。",
        sentenceVi: "Tôi mất 3 ngày để chuẩn bị bài thuyết trình.",
        displayOrder: 2
      }
    ],
    quizzes: [
      {
        questionJp: "「お疲れ様です」はどんな場面で使いますか？正しくないものを選んでください。",
        questionVi: "「お疲れ様です」dùng trong tình huống nào? Chọn đáp án SAI.",
        quizType: "multiple_choice",
        options: [
          "Khách hàng mới gặp lần đầu",
          "Khi đi ngang đồng nghiệp",
          "Cuối buổi họp",
          "Đầu email gửi đồng nghiệp"
        ],
        correctAnswer: "Khách hàng mới gặp lần đầu",
        explanationJp:
          "「お疲れ様です」は社内の人に使う表現です。初めて会うお客様には「初めまして」や「お世話になっております」を使います。",
        explanationVi:
          "「お疲れ様です」là cách nói dùng với người trong công ty. Với khách hàng gặp lần đầu, dùng「初めまして」hoặc「お世話になっております」.",
        displayOrder: 0
      }
    ]
  }
};

// ─── Main seed function ──────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding magazine articles for past 7 days...\n");

  let created = 0;
  let skipped = 0;

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0];

    for (const kind of KINDS) {
      // Skip loto on non Monday/Thursday
      const dayOfWeek = date.getDay();
      if (kind === "magazine_loto" && dayOfWeek !== 1 && dayOfWeek !== 4) {
        continue;
      }

      const slug = `${dateStr}-${kind.replace("magazine_", "")}-vi`;

      // Idempotent: skip if slug already exists
      const existing = await prisma.magazineArticle.findUnique({
        where: { slug }
      });
      if (existing) {
        console.log(`  ⏭ ${slug} already exists`);
        skipped++;
        continue;
      }

      const sample = SAMPLE_CONTENT[kind];

      await prisma.magazineArticle.create({
        data: {
          slug,
          widgetKind: kind,
          contentDate: date,
          locale: "vi",
          titleJp: sample.titleJp,
          titleVi: sample.titleVi,
          summaryJp: sample.summaryJp,
          summaryVi: sample.summaryVi,
          contentJson: sample.contentJson,
          jlptLevel: sample.jlptLevel,
          status: "published",
          publishedAt: date,
          vocabItems: {
            createMany: { data: sample.vocabItems }
          },
          quizzes: {
            createMany: { data: sample.quizzes }
          }
        }
      });

      console.log(`  ✅ ${slug}`);
      created++;
    }
  }

  console.log(`\n🎉 Magazine seed complete! Created: ${created}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
