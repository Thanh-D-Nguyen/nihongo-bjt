// Seed magazine articles — 3 months of production-quality daily content.
// Usage: node scripts/seed-magazine-3months.mjs
// Idempotent: skips articles whose slug already exists.
// Content: Linguistically accurate Japanese, natural Vietnamese translations.

import "dotenv/config";
import { PrismaClient } from "../packages/database/generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// VOCABULARY THEMES — 12 weeks of unique daily vocab topics
// ═══════════════════════════════════════════════════════════════════════════════

const VOCAB_THEMES = [
  // Week 1: Office life
  {
    titleJp: "オフィスで使う言葉",
    titleVi: "Từ vựng dùng trong văn phòng",
    summaryJp: "毎日の仕事で使うオフィス用語を覚えましょう。",
    summaryVi: "Học các thuật ngữ văn phòng dùng hàng ngày trong công việc.",
    contentJson: { theme: "office", introduction: "日本の会社で働くなら、オフィス用語は必須です。基本的な言葉から覚えましょう。", introductionVi: "Nếu làm việc ở công ty Nhật, thuật ngữ văn phòng là bắt buộc. Hãy bắt đầu từ những từ cơ bản." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "出勤", reading: "しゅっきん", meaningVi: "Đi làm, đến công ty", pos: "noun", jlptLevel: "N3", sentenceJp: "毎朝8時に出勤しています。", sentenceVi: "Tôi đi làm lúc 8 giờ mỗi sáng.", displayOrder: 0 },
      { wordJp: "退勤", reading: "たいきん", meaningVi: "Tan làm, rời công ty", pos: "noun", jlptLevel: "N3", sentenceJp: "今日は定時で退勤できそうです。", sentenceVi: "Hôm nay có vẻ tôi có thể tan làm đúng giờ.", displayOrder: 1 },
      { wordJp: "残業", reading: "ざんぎょう", meaningVi: "Làm thêm giờ (overtime)", pos: "noun", jlptLevel: "N3", sentenceJp: "今月は残業が多くて疲れました。", sentenceVi: "Tháng này làm thêm nhiều nên mệt quá.", displayOrder: 2 },
      { wordJp: "有給休暇", reading: "ゆうきゅうきゅうか", meaningVi: "Nghỉ phép có lương", pos: "noun", jlptLevel: "N2", sentenceJp: "来週、有給休暇を取る予定です。", sentenceVi: "Tuần sau tôi dự định lấy phép có lương.", displayOrder: 3 },
      { wordJp: "上司", reading: "じょうし", meaningVi: "Cấp trên, sếp", pos: "noun", jlptLevel: "N3", sentenceJp: "上司に報告書を提出しました。", sentenceVi: "Tôi đã nộp báo cáo cho sếp.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "会社を出て家に帰ることを何と言いますか？", questionVi: "Rời công ty về nhà gọi là gì?", quizType: "multiple_choice", options: ["退勤", "出勤", "残業", "出張"], correctAnswer: "退勤", explanationJp: "「退勤」は仕事を終えて会社を出ることです。「出勤」は反対の意味で、会社に来ることです。", explanationVi: "「退勤」là kết thúc công việc và rời công ty. 「出勤」có nghĩa ngược lại, là đến công ty.", displayOrder: 0 },
      { questionJp: "「有給休暇」の「有給」はどういう意味ですか？", questionVi: "「有給」trong「有給休暇」nghĩa là gì?", quizType: "multiple_choice", options: ["Có trả lương", "Không trả lương", "Dài hạn", "Ngắn hạn"], correctAnswer: "Có trả lương", explanationJp: "「有給」は「給料がある」＝「お金がもらえる」という意味です。有給休暇は休んでも給料がもらえる制度です。", explanationVi: "「有給」nghĩa là \"có lương\" = \"được nhận tiền\". Nghỉ phép có lương là chế độ nghỉ mà vẫn nhận lương.", displayOrder: 1 },
      { questionJp: "「残業」の「残」はどんなイメージですか？", questionVi: "「残」trong「残業」gợi hình ảnh gì?", quizType: "multiple_choice", options: ["Ở lại, còn lại", "Vui vẻ", "Nhanh chóng", "Mới mẻ"], correctAnswer: "Ở lại, còn lại", explanationJp: "「残」には「残る」（のこる）という意味があり、定時後も会社に「残って」仕事をすることが「残業」です。", explanationVi: "「残」có nghĩa là \"ở lại\" (のこる). \"Ở lại\" công ty sau giờ làm để tiếp tục công việc gọi là「残業」.", displayOrder: 2 },
    ],
  },
  // Week 2: Commuting
  {
    titleJp: "通勤の日本語",
    titleVi: "Tiếng Nhật khi đi lại",
    summaryJp: "電車やバスで通勤する時に使う表現を学びましょう。",
    summaryVi: "Học các biểu hiện dùng khi đi tàu, xe buýt đi làm.",
    contentJson: { theme: "commuting", introduction: "日本で働く人の多くは電車で通勤しています。通勤に関する言葉を覚えましょう。", introductionVi: "Phần lớn người đi làm ở Nhật dùng tàu điện. Hãy học các từ liên quan đến việc đi lại." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "通勤", reading: "つうきん", meaningVi: "Đi làm (hàng ngày)", pos: "noun", jlptLevel: "N3", sentenceJp: "通勤時間は片道1時間くらいです。", sentenceVi: "Thời gian đi làm một chiều khoảng 1 tiếng.", displayOrder: 0 },
      { wordJp: "乗り換え", reading: "のりかえ", meaningVi: "Chuyển tàu/xe", pos: "noun", jlptLevel: "N4", sentenceJp: "新宿駅で乗り換えてください。", sentenceVi: "Hãy chuyển tàu ở ga Shinjuku.", displayOrder: 1 },
      { wordJp: "満員電車", reading: "まんいんでんしゃ", meaningVi: "Tàu chật cứng người", pos: "noun", jlptLevel: "N3", sentenceJp: "朝の満員電車はとても辛いです。", sentenceVi: "Tàu chật cứng buổi sáng rất khổ sở.", displayOrder: 2 },
      { wordJp: "定期券", reading: "ていきけん", meaningVi: "Vé tháng (đi tàu)", pos: "noun", jlptLevel: "N3", sentenceJp: "定期券を買うと毎日の交通費が安くなります。", sentenceVi: "Nếu mua vé tháng, chi phí đi lại hàng ngày sẽ rẻ hơn.", displayOrder: 3 },
      { wordJp: "遅延", reading: "ちえん", meaningVi: "Trễ, chậm trễ (tàu)", pos: "noun", jlptLevel: "N2", sentenceJp: "電車が遅延して、会議に遅刻しそうです。", sentenceVi: "Tàu bị trễ nên có vẻ tôi sẽ muộn họp.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "電車がいつもより遅く来ることを何と言いますか？", questionVi: "Tàu đến muộn hơn bình thường gọi là gì?", quizType: "multiple_choice", options: ["遅延", "乗り換え", "通勤", "運賃"], correctAnswer: "遅延", explanationJp: "「遅延」は予定より遅れることです。電車の遅延は日本でもよくあることです。", explanationVi: "「遅延」là trễ hơn dự kiến. Tàu bị trễ cũng hay xảy ra ở Nhật.", displayOrder: 0 },
      { questionJp: "「満員電車」の「満員」とは？", questionVi: "「満員」trong「満員電車」nghĩa là?", quizType: "multiple_choice", options: ["Đầy người, hết chỗ", "Trống, ít người", "Mới đến", "Sạch sẽ"], correctAnswer: "Đầy người, hết chỗ", explanationJp: "「満員」は「人がいっぱいで、もう入れない状態」のことです。映画館が満員ということもあります。", explanationVi: "「満員」là \"đầy người, không thể vào thêm\". Rạp chiếu phim cũng có thể 満員.", displayOrder: 1 },
    ],
  },
  // Week 3: Eating out
  {
    titleJp: "外食の言葉",
    titleVi: "Từ vựng ăn ngoài",
    summaryJp: "レストランや食堂で使える日本語を学びましょう。",
    summaryVi: "Học tiếng Nhật dùng được ở nhà hàng, quán ăn.",
    contentJson: { theme: "eating_out", introduction: "日本のレストランで注文する時に役立つ表現を覚えましょう。", introductionVi: "Hãy học các biểu hiện hữu ích khi gọi món ở nhà hàng Nhật." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "注文", reading: "ちゅうもん", meaningVi: "Gọi món, đặt hàng", pos: "noun", jlptLevel: "N4", sentenceJp: "すみません、注文をお願いします。", sentenceVi: "Xin lỗi, cho tôi gọi món.", displayOrder: 0 },
      { wordJp: "お会計", reading: "おかいけい", meaningVi: "Thanh toán, tính tiền", pos: "noun", jlptLevel: "N4", sentenceJp: "お会計をお願いします。", sentenceVi: "Cho tôi tính tiền.", displayOrder: 1 },
      { wordJp: "定食", reading: "ていしょく", meaningVi: "Set cơm (bao gồm cơm, canh, món chính)", pos: "noun", jlptLevel: "N4", sentenceJp: "今日のランチは焼き魚定食にします。", sentenceVi: "Bữa trưa hôm nay tôi chọn set cá nướng.", displayOrder: 2 },
      { wordJp: "おかわり", reading: "おかわり", meaningVi: "Thêm (cơm, nước...)", pos: "noun", jlptLevel: "N4", sentenceJp: "ご飯のおかわりは無料ですか？", sentenceVi: "Thêm cơm có miễn phí không?", displayOrder: 3 },
      { wordJp: "持ち帰り", reading: "もちかえり", meaningVi: "Mang về (take out)", pos: "noun", jlptLevel: "N3", sentenceJp: "こちらでお召し上がりですか、お持ち帰りですか？", sentenceVi: "Quý khách dùng tại đây hay mang về ạ?", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "レストランで食事の後、お金を払いたい時に何と言いますか？", questionVi: "Sau khi ăn xong ở nhà hàng, muốn trả tiền nói gì?", quizType: "multiple_choice", options: ["お会計をお願いします", "注文をお願いします", "おかわりください", "いただきます"], correctAnswer: "お会計をお願いします", explanationJp: "「お会計」は食事代を払うことです。「注文」はまだ食べ物を選ぶ時に使います。", explanationVi: "「お会計」là thanh toán tiền ăn. 「注文」dùng khi còn đang chọn đồ ăn.", displayOrder: 0 },
      { questionJp: "「定食」には普通、何が含まれていますか？", questionVi: "「定食」thường bao gồm gì?", quizType: "multiple_choice", options: ["Cơm + canh + món chính", "Chỉ mỗi cơm trắng", "Chỉ mỗi salad", "Bánh ngọt + nước"], correctAnswer: "Cơm + canh + món chính", explanationJp: "「定食」はメインのおかず、ご飯、味噌汁がセットになった食事です。日本の食堂の基本メニューです。", explanationVi: "「定食」là bữa ăn set gồm món chính, cơm, canh miso. Đây là menu cơ bản ở quán ăn Nhật.", displayOrder: 1 },
      { questionJp: "「おかわり」を使う正しい場面は？", questionVi: "Dùng「おかわり」đúng trong trường hợp nào?", quizType: "multiple_choice", options: ["Muốn thêm cơm/nước", "Muốn trả tiền", "Muốn đổi món", "Muốn đặt bàn"], correctAnswer: "Muốn thêm cơm/nước", explanationJp: "「おかわり」は同じものをもう一杯/一つもらうことです。「ご飯おかわりください」のように使います。", explanationVi: "「おかわり」là xin thêm một phần giống nhau. Dùng như「ご飯おかわりください」(cho thêm cơm).", displayOrder: 2 },
    ],
  },
  // Week 4: Weather & Seasons
  {
    titleJp: "四季と天気の表現",
    titleVi: "Biểu hiện bốn mùa và thời tiết",
    summaryJp: "日本の四季に関する美しい表現を学びましょう。",
    summaryVi: "Học các biểu hiện đẹp về bốn mùa Nhật Bản.",
    contentJson: { theme: "seasons", introduction: "日本には美しい四季があります。季節ごとの表現を覚えると、日本語がもっと豊かになります。", introductionVi: "Nhật Bản có bốn mùa đẹp. Học biểu hiện theo mùa sẽ giúp tiếng Nhật phong phú hơn." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "桜前線", reading: "さくらぜんせん", meaningVi: "Front hoa anh đào (dự báo hoa nở)", pos: "noun", jlptLevel: "N2", sentenceJp: "今年の桜前線は例年より早く北上しています。", sentenceVi: "Năm nay front hoa anh đào di chuyển lên phía bắc sớm hơn mọi năm.", displayOrder: 0 },
      { wordJp: "紅葉", reading: "こうよう", meaningVi: "Lá đỏ mùa thu", pos: "noun", jlptLevel: "N3", sentenceJp: "京都の紅葉は11月が見頃です。", sentenceVi: "Lá đỏ ở Kyoto đẹp nhất vào tháng 11.", displayOrder: 1 },
      { wordJp: "猛暑", reading: "もうしょ", meaningVi: "Nắng nóng khắc nghiệt", pos: "noun", jlptLevel: "N2", sentenceJp: "今年の夏は猛暑が続いています。", sentenceVi: "Mùa hè năm nay nắng nóng khắc nghiệt liên tục.", displayOrder: 2 },
      { wordJp: "初雪", reading: "はつゆき", meaningVi: "Tuyết đầu mùa", pos: "noun", jlptLevel: "N3", sentenceJp: "東京で初雪が観測されました。", sentenceVi: "Tuyết đầu mùa đã được quan sát ở Tokyo.", displayOrder: 3 },
      { wordJp: "衣替え", reading: "ころもがえ", meaningVi: "Thay đồ theo mùa", pos: "noun", jlptLevel: "N2", sentenceJp: "6月1日は衣替えの日です。", sentenceVi: "Ngày 1 tháng 6 là ngày thay đồ theo mùa.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "「桜前線」とは何ですか？", questionVi: "「桜前線」là gì?", quizType: "multiple_choice", options: ["Dự báo hoa anh đào nở từ nam ra bắc", "Một loại tàu điện", "Tên một bài hát", "Một loại bánh"], correctAnswer: "Dự báo hoa anh đào nở từ nam ra bắc", explanationJp: "「桜前線」は桜の開花予想を示す線で、南から北へ移動します。毎年3月〜5月にニュースで話題になります。", explanationVi: "「桜前線」là đường dự báo hoa anh đào nở, di chuyển từ nam ra bắc. Mỗi năm từ tháng 3-5 là chủ đề nóng trên tin tức.", displayOrder: 0 },
      { questionJp: "「猛暑」の「猛」にはどんな意味がありますか？", questionVi: "「猛」trong「猛暑」mang ý nghĩa gì?", quizType: "multiple_choice", options: ["Dữ dội, mãnh liệt", "Nhẹ nhàng", "Mát mẻ", "Ngắn ngủi"], correctAnswer: "Dữ dội, mãnh liệt", explanationJp: "「猛」は「激しい、強い」という意味です。「猛暑」は非常に暑い（35℃以上の）日のことです。", explanationVi: "「猛」có nghĩa \"dữ dội, mạnh mẽ\". 「猛暑」chỉ những ngày nóng cực kỳ (trên 35°C).", displayOrder: 1 },
    ],
  },
  // Week 5: Shopping
  {
    titleJp: "買い物の日本語",
    titleVi: "Tiếng Nhật khi mua sắm",
    summaryJp: "日本のお店で買い物する時に使える表現を覚えましょう。",
    summaryVi: "Học biểu hiện dùng được khi mua sắm ở cửa hàng Nhật.",
    contentJson: { theme: "shopping", introduction: "コンビニやスーパー、デパートでの買い物で使える日本語を学びましょう。", introductionVi: "Học tiếng Nhật dùng được khi mua sắm ở cửa hàng tiện lợi, siêu thị, trung tâm thương mại." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "レジ", reading: "れじ", meaningVi: "Quầy tính tiền (cash register)", pos: "noun", jlptLevel: "N4", sentenceJp: "レジが混んでいるので、少し待ちましょう。", sentenceVi: "Quầy tính tiền đang đông nên chờ một chút nhé.", displayOrder: 0 },
      { wordJp: "割引", reading: "わりびき", meaningVi: "Giảm giá", pos: "noun", jlptLevel: "N3", sentenceJp: "この商品は20%割引になっています。", sentenceVi: "Sản phẩm này đang giảm giá 20%.", displayOrder: 1 },
      { wordJp: "試着", reading: "しちゃく", meaningVi: "Thử đồ (quần áo)", pos: "noun", jlptLevel: "N3", sentenceJp: "この服を試着してもいいですか？", sentenceVi: "Tôi có thể thử bộ này không?", displayOrder: 2 },
      { wordJp: "袋", reading: "ふくろ", meaningVi: "Túi (đựng hàng)", pos: "noun", jlptLevel: "N4", sentenceJp: "レジ袋は有料になります。", sentenceVi: "Túi nilon tính phí.", displayOrder: 3 },
      { wordJp: "取り寄せ", reading: "とりよせ", meaningVi: "Đặt hàng (từ chi nhánh khác)", pos: "noun", jlptLevel: "N2", sentenceJp: "在庫がないので、取り寄せになります。", sentenceVi: "Hết hàng rồi nên sẽ phải đặt từ chỗ khác.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "服を買う前に着てみることを何と言いますか？", questionVi: "Mặc thử trước khi mua quần áo gọi là gì?", quizType: "multiple_choice", options: ["試着", "割引", "注文", "返品"], correctAnswer: "試着", explanationJp: "「試着」は「試しに着る」という意味で、試着室で服を着てみることです。", explanationVi: "「試着」nghĩa là \"mặc thử\", là việc thử đồ trong phòng thay đồ.", displayOrder: 0 },
      { questionJp: "「レジ袋は有料になります」はどういう意味ですか？", questionVi: "「レジ袋は有料になります」nghĩa là gì?", quizType: "multiple_choice", options: ["Túi nilon phải trả tiền", "Túi nilon miễn phí", "Không có túi", "Túi rất đẹp"], correctAnswer: "Túi nilon phải trả tiền", explanationJp: "「有料」は「お金がかかる」という意味です。2020年から日本ではレジ袋が有料化されました。", explanationVi: "「有料」nghĩa là \"tốn tiền\". Từ năm 2020, Nhật Bản bắt buộc tính phí túi nilon.", displayOrder: 1 },
    ],
  },
  // Week 6: Health & Body
  {
    titleJp: "体調の言い方",
    titleVi: "Cách nói về sức khỏe",
    summaryJp: "病院や薬局で使える体調に関する表現を学びましょう。",
    summaryVi: "Học biểu hiện về sức khỏe dùng được ở bệnh viện, nhà thuốc.",
    contentJson: { theme: "health", introduction: "体の具合が悪い時、日本語で症状を伝えられるようになりましょう。", introductionVi: "Khi không khỏe, hãy học cách truyền đạt triệu chứng bằng tiếng Nhật." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "頭痛", reading: "ずつう", meaningVi: "Đau đầu", pos: "noun", jlptLevel: "N3", sentenceJp: "朝から頭痛がひどくて、薬を飲みました。", sentenceVi: "Từ sáng đau đầu dữ nên đã uống thuốc.", displayOrder: 0 },
      { wordJp: "熱がある", reading: "ねつがある", meaningVi: "Bị sốt", pos: "expression", jlptLevel: "N4", sentenceJp: "38度の熱があるので、今日は会社を休みます。", sentenceVi: "Bị sốt 38 độ nên hôm nay tôi nghỉ làm.", displayOrder: 1 },
      { wordJp: "処方箋", reading: "しょほうせん", meaningVi: "Đơn thuốc", pos: "noun", jlptLevel: "N2", sentenceJp: "医者に処方箋をもらって、薬局に行きました。", sentenceVi: "Nhận đơn thuốc từ bác sĩ rồi đến nhà thuốc.", displayOrder: 2 },
      { wordJp: "風邪を引く", reading: "かぜをひく", meaningVi: "Bị cảm", pos: "expression", jlptLevel: "N4", sentenceJp: "季節の変わり目は風邪を引きやすいです。", sentenceVi: "Giao mùa dễ bị cảm lắm.", displayOrder: 3 },
      { wordJp: "花粉症", reading: "かふんしょう", meaningVi: "Dị ứng phấn hoa", pos: "noun", jlptLevel: "N3", sentenceJp: "春になると花粉症で目がかゆくなります。", sentenceVi: "Đến mùa xuân, dị ứng phấn hoa làm ngứa mắt.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "病院でもらう薬のリストを何と言いますか？", questionVi: "Danh sách thuốc nhận từ bệnh viện gọi là gì?", quizType: "multiple_choice", options: ["処方箋", "領収書", "診察券", "保険証"], correctAnswer: "処方箋", explanationJp: "「処方箋」は医師が書く薬の指示書です。これを薬局に持っていくと薬がもらえます。", explanationVi: "「処方箋」là giấy chỉ dẫn thuốc do bác sĩ viết. Mang tới nhà thuốc sẽ được nhận thuốc.", displayOrder: 0 },
      { questionJp: "春に目がかゆくなる原因で多いのは？", questionVi: "Nguyên nhân phổ biến gây ngứa mắt vào mùa xuân?", quizType: "multiple_choice", options: ["花粉症", "頭痛", "風邪", "猛暑"], correctAnswer: "花粉症", explanationJp: "「花粉症」は花の花粉に対するアレルギーです。日本では春にスギ花粉が飛び、多くの人が苦しみます。", explanationVi: "「花粉症」là dị ứng với phấn hoa. Ở Nhật, mùa xuân phấn hoa tuyết tùng bay nhiều, khiến nhiều người khổ sở.", displayOrder: 1 },
      { questionJp: "「風邪を引く」の正しい使い方は？", questionVi: "Cách dùng đúng của「風邪を引く」?", quizType: "multiple_choice", options: ["昨日風邪を引いてしまいました", "風邪を引いて食べました", "風邪を引いて買いました", "風邪を引いて遊びました"], correctAnswer: "昨日風邪を引いてしまいました", explanationJp: "「風邪を引く」は病気になるという意味です。「〜てしまいました」で残念な気持ちを表します。", explanationVi: "「風邪を引く」nghĩa là bị bệnh cảm. 「〜てしまいました」diễn tả cảm giác đáng tiếc.", displayOrder: 2 },
    ],
  },
  // Week 7: Housing & Apartment
  {
    titleJp: "部屋探しの言葉",
    titleVi: "Từ vựng tìm phòng trọ",
    summaryJp: "日本でアパートを探す時に知っておくべき言葉を学びましょう。",
    summaryVi: "Học từ cần biết khi tìm căn hộ ở Nhật.",
    contentJson: { theme: "housing", introduction: "日本で部屋を借りる時には独特の用語があります。賃貸情報を読めるようになりましょう。", introductionVi: "Khi thuê phòng ở Nhật có nhiều thuật ngữ đặc biệt. Hãy học để đọc được thông tin cho thuê." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "家賃", reading: "やちん", meaningVi: "Tiền thuê nhà (hàng tháng)", pos: "noun", jlptLevel: "N3", sentenceJp: "東京の家賃は地方に比べてとても高いです。", sentenceVi: "Tiền thuê nhà ở Tokyo rất cao so với địa phương.", displayOrder: 0 },
      { wordJp: "敷金", reading: "しききん", meaningVi: "Tiền đặt cọc (trả khi thuê)", pos: "noun", jlptLevel: "N2", sentenceJp: "敷金は退去時に一部返金されることがあります。", sentenceVi: "Tiền đặt cọc có thể được hoàn lại một phần khi dọn đi.", displayOrder: 1 },
      { wordJp: "礼金", reading: "れいきん", meaningVi: "Tiền cảm ơn (trả cho chủ nhà, không hoàn)", pos: "noun", jlptLevel: "N2", sentenceJp: "最近は礼金なしの物件も増えています。", sentenceVi: "Gần đây những căn hộ không yêu cầu 礼金 cũng tăng lên.", displayOrder: 2 },
      { wordJp: "間取り", reading: "まどり", meaningVi: "Sơ đồ phòng, bố cục phòng", pos: "noun", jlptLevel: "N2", sentenceJp: "1LDKの間取りで探しています。", sentenceVi: "Tôi đang tìm phòng bố cục 1LDK.", displayOrder: 3 },
      { wordJp: "更新", reading: "こうしん", meaningVi: "Gia hạn hợp đồng", pos: "noun", jlptLevel: "N3", sentenceJp: "契約の更新は2年ごとです。", sentenceVi: "Gia hạn hợp đồng 2 năm một lần.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "「敷金」と「礼金」の違いは何ですか？", questionVi: "Sự khác biệt giữa「敷金」và「礼金」?", quizType: "multiple_choice", options: ["敷金は返金可能、礼金は返金不可", "敷金は毎月払う、礼金は1回だけ", "敷金が高い、礼金が安い", "どちらも同じ"], correctAnswer: "敷金は返金可能、礼金は返金不可", explanationJp: "「敷金」は保証金で退去時に返還される可能性があります。「礼金」は大家さんへのお礼で返金されません。", explanationVi: "「敷金」là tiền bảo đảm, có thể hoàn khi dọn đi. 「礼金」là tiền cảm ơn chủ nhà, không được hoàn.", displayOrder: 0 },
      { questionJp: "「1LDK」の「L」は何の略ですか？", questionVi: "「L」trong「1LDK」viết tắt của gì?", quizType: "multiple_choice", options: ["Living (phòng khách)", "Laundry (giặt)", "Library (thư viện)", "Lobby (sảnh)"], correctAnswer: "Living (phòng khách)", explanationJp: "LDKはLiving（居間）、Dining（食事スペース）、Kitchen（台所）の略です。1LDKは寝室1つ＋リビングダイニングキッチンです。", explanationVi: "LDK viết tắt của Living (phòng khách), Dining (phòng ăn), Kitchen (bếp). 1LDK = 1 phòng ngủ + phòng khách-ăn-bếp.", displayOrder: 1 },
    ],
  },
  // Week 8: Money & Banking
  {
    titleJp: "お金と銀行の日本語",
    titleVi: "Tiếng Nhật về tiền và ngân hàng",
    summaryJp: "銀行や ATM で使える日本語を学びましょう。",
    summaryVi: "Học tiếng Nhật dùng được ở ngân hàng và ATM.",
    contentJson: { theme: "banking", introduction: "日本の銀行で口座を開設したり、ATMを使ったりする時の表現を覚えましょう。", introductionVi: "Hãy học biểu hiện khi mở tài khoản ngân hàng hay dùng ATM ở Nhật." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "口座", reading: "こうざ", meaningVi: "Tài khoản ngân hàng", pos: "noun", jlptLevel: "N3", sentenceJp: "給料は銀行口座に振り込まれます。", sentenceVi: "Lương được chuyển vào tài khoản ngân hàng.", displayOrder: 0 },
      { wordJp: "振込", reading: "ふりこみ", meaningVi: "Chuyển khoản", pos: "noun", jlptLevel: "N3", sentenceJp: "家賃は毎月25日までに振込でお願いします。", sentenceVi: "Tiền thuê nhà xin chuyển khoản trước ngày 25 hàng tháng.", displayOrder: 1 },
      { wordJp: "暗証番号", reading: "あんしょうばんごう", meaningVi: "Mã PIN", pos: "noun", jlptLevel: "N3", sentenceJp: "暗証番号は4桁の数字です。", sentenceVi: "Mã PIN là 4 chữ số.", displayOrder: 2 },
      { wordJp: "残高", reading: "ざんだか", meaningVi: "Số dư tài khoản", pos: "noun", jlptLevel: "N2", sentenceJp: "ATMで残高照会ができます。", sentenceVi: "Có thể kiểm tra số dư ở ATM.", displayOrder: 3 },
      { wordJp: "手数料", reading: "てすうりょう", meaningVi: "Phí giao dịch, phí dịch vụ", pos: "noun", jlptLevel: "N3", sentenceJp: "時間外の引き出しは手数料がかかります。", sentenceVi: "Rút tiền ngoài giờ sẽ mất phí dịch vụ.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "ATMに入力する4桁の数字を何と言いますか？", questionVi: "4 chữ số nhập vào ATM gọi là gì?", quizType: "multiple_choice", options: ["暗証番号", "電話番号", "口座番号", "番地"], correctAnswer: "暗証番号", explanationJp: "「暗証番号」はATMやカードで本人確認に使う秘密の番号です。「暗証」は「秘密の証」という意味です。", explanationVi: "「暗証番号」là số bí mật dùng để xác nhận danh tính ở ATM/thẻ. 「暗証」nghĩa là \"mật mã\".", displayOrder: 0 },
      { questionJp: "「手数料」はいつかかりますか？", questionVi: "Khi nào phải trả「手数料」?", quizType: "multiple_choice", options: ["Khi dùng dịch vụ ngân hàng/ATM", "Khi ăn cơm", "Khi đi tàu", "Khi mua sách"], correctAnswer: "Khi dùng dịch vụ ngân hàng/ATM", explanationJp: "「手数料」は銀行のサービスを利用する時にかかる費用です。振込や時間外利用などで発生します。", explanationVi: "「手数料」là chi phí khi sử dụng dịch vụ ngân hàng. Phát sinh khi chuyển khoản hoặc dùng ngoài giờ.", displayOrder: 1 },
      { questionJp: "銀行にあるお金の量を確認することを何と言いますか？", questionVi: "Kiểm tra số tiền trong ngân hàng gọi là gì?", quizType: "multiple_choice", options: ["残高照会", "振込確認", "口座開設", "通帳記入"], correctAnswer: "残高照会", explanationJp: "「残高照会」は口座にいくらお金があるか確認することです。ATMの画面で選べます。", explanationVi: "「残高照会」là kiểm tra xem tài khoản có bao nhiêu tiền. Có thể chọn trên màn hình ATM.", displayOrder: 2 },
    ],
  },
  // Week 9: Meetings & Presentations
  {
    titleJp: "会議とプレゼンの言葉",
    titleVi: "Từ vựng họp và thuyết trình",
    summaryJp: "ビジネス会議で使えるフレーズを学びましょう。",
    summaryVi: "Học các cụm từ dùng được trong cuộc họp công việc.",
    contentJson: { theme: "meetings", introduction: "日本の会社での会議には特有の表現があります。スムーズに参加できるよう準備しましょう。", introductionVi: "Các cuộc họp ở công ty Nhật có những biểu hiện đặc trưng. Hãy chuẩn bị để tham gia suôn sẻ." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "議題", reading: "ぎだい", meaningVi: "Chủ đề thảo luận (agenda)", pos: "noun", jlptLevel: "N2", sentenceJp: "今日の議題は3つあります。", sentenceVi: "Hôm nay có 3 chủ đề thảo luận.", displayOrder: 0 },
      { wordJp: "発言", reading: "はつげん", meaningVi: "Phát biểu, nêu ý kiến", pos: "noun", jlptLevel: "N2", sentenceJp: "何か発言がある方はいますか？", sentenceVi: "Có ai muốn phát biểu không?", displayOrder: 1 },
      { wordJp: "議事録", reading: "ぎじろく", meaningVi: "Biên bản cuộc họp", pos: "noun", jlptLevel: "N1", sentenceJp: "議事録は明日までに共有してください。", sentenceVi: "Xin hãy chia sẻ biên bản cuộc họp trước ngày mai.", displayOrder: 2 },
      { wordJp: "検討する", reading: "けんとうする", meaningVi: "Xem xét, nghiên cứu", pos: "verb", jlptLevel: "N3", sentenceJp: "その件は社内で検討させていただきます。", sentenceVi: "Vấn đề đó cho phép chúng tôi xem xét nội bộ.", displayOrder: 3 },
      { wordJp: "ご質問", reading: "ごしつもん", meaningVi: "Câu hỏi (kính ngữ)", pos: "noun", jlptLevel: "N3", sentenceJp: "ご質問がございましたら、お気軽にどうぞ。", sentenceVi: "Nếu có câu hỏi gì, xin cứ thoải mái hỏi.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "会議の内容をまとめた文書を何と言いますか？", questionVi: "Văn bản tổng hợp nội dung cuộc họp gọi là gì?", quizType: "multiple_choice", options: ["議事録", "議題", "報告書", "企画書"], correctAnswer: "議事録", explanationJp: "「議事録」は会議で話し合った内容を記録した文書です。「議事」は会議の内容、「録」は記録です。", explanationVi: "「議事録」là văn bản ghi lại nội dung thảo luận trong cuộc họp. 「議事」= nội dung họp, 「録」= ghi chép.", displayOrder: 0 },
      { questionJp: "「検討させていただきます」は何を意味しますか？", questionVi: "「検討させていただきます」có ý nghĩa gì?", quizType: "multiple_choice", options: ["Cho phép tôi xem xét (từ chối nhẹ nhàng)", "Tôi đồng ý ngay", "Tôi từ chối hoàn toàn", "Tôi không hiểu"], correctAnswer: "Cho phép tôi xem xét (từ chối nhẹ nhàng)", explanationJp: "日本のビジネスでは「検討します」は直接的な「No」を避ける表現です。実際には断りの意味を含むことが多いです。", explanationVi: "Trong kinh doanh Nhật,「検討します」là cách tránh nói \"No\" trực tiếp. Thực tế thường mang ý từ chối.", displayOrder: 1 },
    ],
  },
  // Week 10: Japanese Manners
  {
    titleJp: "日本のマナーと礼儀",
    titleVi: "Phép lịch sự và quy tắc Nhật",
    summaryJp: "日本社会で大切にされているマナーを学びましょう。",
    summaryVi: "Học các phép lịch sự được coi trọng trong xã hội Nhật.",
    contentJson: { theme: "manners", introduction: "日本にはたくさんのマナーがあります。知らないと恥ずかしい思いをすることも。基本的なマナーを覚えましょう。", introductionVi: "Nhật Bản có rất nhiều quy tắc ứng xử. Nếu không biết có thể sẽ ngại. Hãy học những phép lịch sự cơ bản." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "お辞儀", reading: "おじぎ", meaningVi: "Cúi chào", pos: "noun", jlptLevel: "N3", sentenceJp: "日本ではお辞儀が基本的な挨拶です。", sentenceVi: "Ở Nhật, cúi chào là cách chào hỏi cơ bản.", displayOrder: 0 },
      { wordJp: "敬語", reading: "けいご", meaningVi: "Kính ngữ", pos: "noun", jlptLevel: "N3", sentenceJp: "上司には敬語を使うのが礼儀です。", sentenceVi: "Sử dụng kính ngữ với cấp trên là phép lịch sự.", displayOrder: 1 },
      { wordJp: "迷惑", reading: "めいわく", meaningVi: "Gây phiền, gây khó chịu", pos: "noun", jlptLevel: "N3", sentenceJp: "電車の中で大きな声で話すと迷惑になります。", sentenceVi: "Nói to trên tàu sẽ gây phiền cho người khác.", displayOrder: 2 },
      { wordJp: "時間厳守", reading: "じかんげんしゅ", meaningVi: "Giữ đúng giờ, đúng hẹn", pos: "noun", jlptLevel: "N2", sentenceJp: "日本では時間厳守が非常に大切です。", sentenceVi: "Ở Nhật, giữ đúng giờ cực kỳ quan trọng.", displayOrder: 3 },
      { wordJp: "名刺交換", reading: "めいしこうかん", meaningVi: "Trao đổi danh thiếp", pos: "noun", jlptLevel: "N2", sentenceJp: "初対面のビジネスパーソンとは名刺交換をします。", sentenceVi: "Khi gặp đối tác lần đầu, sẽ trao đổi danh thiếp.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "電車の中でしてはいけないことは？", questionVi: "Điều không nên làm trên tàu?", quizType: "multiple_choice", options: ["大きな声で電話する", "本を読む", "音楽をイヤホンで聴く", "寝る"], correctAnswer: "大きな声で電話する", explanationJp: "日本の電車内では通話はマナー違反です。他の乗客に「迷惑」をかけないよう静かにするのが基本です。", explanationVi: "Trên tàu Nhật, gọi điện thoại là vi phạm phép lịch sự. Giữ yên lặng để không gây「迷惑」cho hành khách khác.", displayOrder: 0 },
      { questionJp: "日本のビジネスで最初にすることは？", questionVi: "Điều làm đầu tiên trong kinh doanh Nhật?", quizType: "multiple_choice", options: ["名刺交換", "握手", "ハグ", "自己紹介だけ"], correctAnswer: "名刺交換", explanationJp: "日本のビジネスでは初対面の時にまず名刺交換をします。両手で渡し、受け取る時も両手で受けるのがマナーです。", explanationVi: "Trong kinh doanh Nhật, gặp lần đầu sẽ trao đổi danh thiếp. Phép lịch sự là đưa bằng hai tay và nhận cũng bằng hai tay.", displayOrder: 1 },
      { questionJp: "「時間厳守」の人はどんな人ですか？", questionVi: "Người「時間厳守」là người thế nào?", quizType: "multiple_choice", options: ["Luôn đúng giờ", "Hay đến muộn", "Làm việc nhanh", "Nói nhiều"], correctAnswer: "Luôn đúng giờ", explanationJp: "「時間厳守」は約束の時間をきちんと守ることです。日本社会では5分前行動が理想とされています。", explanationVi: "「時間厳守」là giữ đúng giờ hẹn. Xã hội Nhật coi đến sớm 5 phút là lý tưởng.", displayOrder: 2 },
    ],
  },
  // Week 11: Technology & Internet
  {
    titleJp: "IT・ネットの日本語",
    titleVi: "Tiếng Nhật IT & Internet",
    summaryJp: "テクノロジーに関する日本語の語彙を増やしましょう。",
    summaryVi: "Mở rộng vốn từ tiếng Nhật về công nghệ.",
    contentJson: { theme: "technology", introduction: "日本のIT業界で使われるカタカナ語や技術用語を覚えましょう。和製英語にも注意が必要です。", introductionVi: "Hãy học các từ katakana và thuật ngữ kỹ thuật dùng trong ngành IT Nhật. Cần chú ý cả những từ tiếng Anh kiểu Nhật." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "添付ファイル", reading: "てんぷふぁいる", meaningVi: "File đính kèm", pos: "noun", jlptLevel: "N3", sentenceJp: "メールに添付ファイルをつけて送りました。", sentenceVi: "Tôi đã gửi email kèm file đính kèm.", displayOrder: 0 },
      { wordJp: "ログイン", reading: "ろぐいん", meaningVi: "Đăng nhập", pos: "noun", jlptLevel: "N4", sentenceJp: "パスワードを入力してログインしてください。", sentenceVi: "Hãy nhập mật khẩu và đăng nhập.", displayOrder: 1 },
      { wordJp: "不具合", reading: "ふぐあい", meaningVi: "Lỗi, trục trặc (bug)", pos: "noun", jlptLevel: "N2", sentenceJp: "システムに不具合が見つかりました。", sentenceVi: "Đã phát hiện lỗi trong hệ thống.", displayOrder: 2 },
      { wordJp: "更新する", reading: "こうしんする", meaningVi: "Cập nhật (update)", pos: "verb", jlptLevel: "N3", sentenceJp: "アプリを最新版に更新してください。", sentenceVi: "Hãy cập nhật app lên phiên bản mới nhất.", displayOrder: 3 },
      { wordJp: "バックアップ", reading: "ばっくあっぷ", meaningVi: "Sao lưu (backup)", pos: "noun", jlptLevel: "N3", sentenceJp: "大切なデータはバックアップを取っておきましょう。", sentenceVi: "Hãy sao lưu những dữ liệu quan trọng.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "コンピューターの問題を日本語で何と言いますか？", questionVi: "Vấn đề/lỗi máy tính tiếng Nhật gọi là gì?", quizType: "multiple_choice", options: ["不具合", "具合がいい", "お見舞い", "景気"], correctAnswer: "不具合", explanationJp: "「不具合」はシステムやソフトウェアの問題・バグのことです。「具合が悪い」（状態が良くない）と関連しています。", explanationVi: "「不具合」là lỗi/bug của hệ thống hoặc phần mềm. Liên quan đến「具合が悪い」(tình trạng không tốt).", displayOrder: 0 },
      { questionJp: "メールで書類を一緒に送ることを何と言いますか？", questionVi: "Gửi tài liệu cùng email gọi là gì?", quizType: "multiple_choice", options: ["添付する", "転送する", "返信する", "削除する"], correctAnswer: "添付する", explanationJp: "「添付」は「添えて付ける」＝一緒につけて送ることです。「ファイルを添付しました」とよくメールで書きます。", explanationVi: "「添付」là \"đính kèm\" = gửi kèm theo. Trong email thường viết「ファイルを添付しました」(đã đính kèm file).", displayOrder: 1 },
    ],
  },
  // Week 12: Japanese Culture & Events
  {
    titleJp: "日本の行事と文化",
    titleVi: "Sự kiện và văn hóa Nhật Bản",
    summaryJp: "日本の伝統行事に関する言葉を学びましょう。",
    summaryVi: "Học từ vựng về các sự kiện truyền thống Nhật Bản.",
    contentJson: { theme: "culture_events", introduction: "日本には一年を通じて様々な行事があります。文化を理解することで日本語の理解も深まります。", introductionVi: "Nhật Bản có nhiều sự kiện quanh năm. Hiểu văn hóa sẽ giúp hiểu tiếng Nhật sâu hơn." },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "お花見", reading: "おはなみ", meaningVi: "Ngắm hoa (anh đào)", pos: "noun", jlptLevel: "N4", sentenceJp: "来週、会社のメンバーでお花見をする予定です。", sentenceVi: "Tuần sau dự định đi ngắm hoa cùng đồng nghiệp.", displayOrder: 0 },
      { wordJp: "盆踊り", reading: "ぼんおどり", meaningVi: "Vũ điệu lễ Obon", pos: "noun", jlptLevel: "N3", sentenceJp: "夏祭りで盆踊りを踊りました。", sentenceVi: "Đã nhảy Bon Odori ở lễ hội mùa hè.", displayOrder: 1 },
      { wordJp: "年賀状", reading: "ねんがじょう", meaningVi: "Thiệp chúc mừng năm mới", pos: "noun", jlptLevel: "N3", sentenceJp: "12月中に年賀状を出さないと元旦に届きません。", sentenceVi: "Nếu không gửi thiệp năm mới trong tháng 12 sẽ không đến kịp ngày mùng 1.", displayOrder: 2 },
      { wordJp: "初詣", reading: "はつもうで", meaningVi: "Đi lễ chùa/đền đầu năm", pos: "noun", jlptLevel: "N3", sentenceJp: "元旦に家族で初詣に行きました。", sentenceVi: "Ngày mùng 1 cả gia đình đi lễ đầu năm.", displayOrder: 3 },
      { wordJp: "七夕", reading: "たなばた", meaningVi: "Lễ Tanabata (7/7)", pos: "noun", jlptLevel: "N3", sentenceJp: "七夕には短冊に願い事を書きます。", sentenceVi: "Vào Tanabata, viết điều ước lên giấy tanzaku.", displayOrder: 4 },
    ],
    quizzes: [
      { questionJp: "日本でお正月に神社に行くことを何と言いますか？", questionVi: "Đi đền/chùa đầu năm mới ở Nhật gọi là gì?", quizType: "multiple_choice", options: ["初詣", "お花見", "盆踊り", "七夕"], correctAnswer: "初詣", explanationJp: "「初詣」は年が明けて最初に神社やお寺にお参りすることです。「初」は最初、「詣」は参拝の意味です。", explanationVi: "「初詣」là lần đầu tiên đi lễ đền/chùa sau khi bước sang năm mới. 「初」= đầu tiên, 「詣」= tham bái.", displayOrder: 0 },
      { questionJp: "「七夕」はいつですか？", questionVi: "「七夕」là ngày nào?", quizType: "multiple_choice", options: ["7月7日", "1月1日", "3月3日", "5月5日"], correctAnswer: "7月7日", explanationJp: "「七夕」は7月7日のお祭りです。漢字の「七」と「夕」から日付が読み取れます。", explanationVi: "「七夕」là lễ hội ngày 7/7. Có thể đoán ngày từ chữ Hán「七」(bảy) và「夕」(chiều tối).", displayOrder: 1 },
      { questionJp: "春に桜の木の下で食事をすることは？", questionVi: "Ăn uống dưới gốc hoa anh đào mùa xuân gọi là?", quizType: "multiple_choice", options: ["お花見", "初詣", "紅葉狩り", "花火大会"], correctAnswer: "お花見", explanationJp: "「お花見」は桜の木の下でお弁当を食べたり、お酒を飲んだりして楽しむ春のイベントです。", explanationVi: "「お花見」là sự kiện mùa xuân — ăn bento, uống rượu vui vẻ dưới gốc anh đào.", displayOrder: 2 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BJT PHRASE THEMES — Business Japanese phrases (12 weeks)
// ═══════════════════════════════════════════════════════════════════════════════

const BJT_PHRASES = [
  {
    titleJp: "ビジネス日本語：お世話になっております",
    titleVi: "Tiếng Nhật thương mại: お世話になっております",
    summaryJp: "ビジネスメールの定番フレーズを学びましょう。",
    summaryVi: "Học cụm từ kinh điển trong email công việc.",
    contentJson: { phrase: "お世話になっております", phraseReading: "おせわになっております", literalMeaning: "Đang được quý vị chăm sóc (nghĩa gốc)", usageNote: "ビジネスメールの冒頭で使う定番表現。社外の人に対して使います。", usageNoteVi: "Biểu hiện mở đầu email kinh doanh. Dùng với người ngoài công ty.", formality: "formal", situations: ["ビジネスメールの最初の一文", "電話で社外の人と話す時", "取引先との会話の冒頭"], situationsVi: ["Câu đầu tiên trong email công việc", "Khi nói chuyện điện thoại với người ngoài công ty", "Đầu cuộc hội thoại với đối tác"], dialogue: [{ speaker: "メール", text: "株式会社ABC　田中様\n\nいつもお世話になっております。\n株式会社XYZの山田です。", textVi: "Anh/chị Tanaka, công ty ABC\n\nCảm ơn anh/chị luôn quan tâm.\nTôi là Yamada từ công ty XYZ." }] },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "取引先", reading: "とりひきさき", meaningVi: "Đối tác kinh doanh", pos: "noun", jlptLevel: "N2", sentenceJp: "取引先との打ち合わせが午後にあります。", sentenceVi: "Buổi chiều có buổi họp với đối tác.", displayOrder: 0 },
      { wordJp: "ご連絡", reading: "ごれんらく", meaningVi: "Liên lạc (kính ngữ)", pos: "noun", jlptLevel: "N3", sentenceJp: "ご連絡いただきありがとうございます。", sentenceVi: "Cảm ơn đã liên lạc.", displayOrder: 1 },
      { wordJp: "ご確認", reading: "ごかくにん", meaningVi: "Xác nhận (kính ngữ)", pos: "noun", jlptLevel: "N3", sentenceJp: "添付資料をご確認ください。", sentenceVi: "Xin hãy xác nhận tài liệu đính kèm.", displayOrder: 2 },
      { wordJp: "ご検討", reading: "ごけんとう", meaningVi: "Xem xét (kính ngữ)", pos: "noun", jlptLevel: "N2", sentenceJp: "ご検討のほど、よろしくお願いいたします。", sentenceVi: "Mong được quý vị xem xét.", displayOrder: 3 },
    ],
    quizzes: [
      { questionJp: "ビジネスメールの最初に社外の人に書く定番の一文は？", questionVi: "Câu mở đầu kinh điển trong email gửi người ngoài công ty?", quizType: "multiple_choice", options: ["お世話になっております", "お疲れ様です", "おはようございます", "こんにちは"], correctAnswer: "お世話になっております", explanationJp: "「お世話になっております」は社外の人へのビジネスメール冒頭の定番です。社内の人には「お疲れ様です」を使います。", explanationVi: "「お世話になっております」là mở đầu email kinh doanh gửi người ngoài công ty. Với người trong công ty dùng「お疲れ様です」.", displayOrder: 0 },
      { questionJp: "「ご確認ください」の「ご」はなぜ付いていますか？", questionVi: "Tại sao「ご確認ください」có chữ「ご」?", quizType: "multiple_choice", options: ["Kính ngữ, thể hiện sự tôn trọng", "Nhấn mạnh ý nghĩa", "Phủ định", "Số nhiều"], correctAnswer: "Kính ngữ, thể hiện sự tôn trọng", explanationJp: "「ご」は尊敬を表す接頭語です。相手の動作に付けて丁寧にします。漢語には「ご」、和語には「お」を使います。", explanationVi: "「ご」là tiền tố kính ngữ. Gắn vào hành động của đối phương để lịch sự hơn. Từ Hán dùng「ご」, từ thuần Nhật dùng「お」.", displayOrder: 1 },
    ],
  },
  {
    titleJp: "ビジネス日本語：承知いたしました",
    titleVi: "Tiếng Nhật thương mại: 承知いたしました",
    summaryJp: "「わかりました」のビジネス版を学びましょう。",
    summaryVi: "Học phiên bản lịch sự của \"tôi hiểu rồi\" trong kinh doanh.",
    contentJson: { phrase: "承知いたしました", phraseReading: "しょうちいたしました", literalMeaning: "Tôi đã nhận biết / hiểu rồi (cực kính ngữ)", usageNote: "上司やクライアントからの依頼を受ける時に使う。「了解しました」より丁寧。", usageNoteVi: "Dùng khi nhận yêu cầu từ cấp trên hoặc khách hàng. Lịch sự hơn「了解しました」.", formality: "very_formal", situations: ["上司からの指示を受けた時", "クライアントからのリクエストに応える時", "メールで依頼を受諾する時"], situationsVi: ["Khi nhận chỉ thị từ cấp trên", "Khi đáp ứng yêu cầu từ khách hàng", "Khi chấp nhận yêu cầu trong email"], dialogue: [{ speaker: "上司", text: "この報告書、明日の朝までに仕上げてくれる？", textVi: "Bản báo cáo này, hoàn thành trước sáng mai được không?" }, { speaker: "部下", text: "承知いたしました。明日の9時までにお送りします。", textVi: "Vâng, tôi hiểu rồi. Tôi sẽ gửi trước 9 giờ sáng mai." }] },
    jlptLevel: "N2",
    vocabItems: [
      { wordJp: "承知", reading: "しょうち", meaningVi: "Nhận biết, hiểu, chấp nhận", pos: "noun", jlptLevel: "N2", sentenceJp: "ご要望を承知いたしました。", sentenceVi: "Tôi đã hiểu yêu cầu của quý khách.", displayOrder: 0 },
      { wordJp: "了解", reading: "りょうかい", meaningVi: "Hiểu, rõ (thông thường hơn)", pos: "noun", jlptLevel: "N3", sentenceJp: "了解です。すぐに対応します。", sentenceVi: "Tôi hiểu rồi. Sẽ xử lý ngay.", displayOrder: 1 },
      { wordJp: "かしこまりました", reading: "かしこまりました", meaningVi: "Vâng, tôi hiểu (cực kính — dùng trong dịch vụ)", pos: "expression", jlptLevel: "N2", sentenceJp: "かしこまりました。すぐにお持ちします。", sentenceVi: "Vâng ạ. Tôi sẽ mang đến ngay.", displayOrder: 2 },
      { wordJp: "依頼", reading: "いらい", meaningVi: "Yêu cầu, nhờ cậy", pos: "noun", jlptLevel: "N2", sentenceJp: "翻訳の依頼を受けました。", sentenceVi: "Tôi nhận được yêu cầu dịch thuật.", displayOrder: 3 },
    ],
    quizzes: [
      { questionJp: "丁寧さの順番で正しいのはどれですか？", questionVi: "Thứ tự từ lịch sự nhất đến ít lịch sự nhất?", quizType: "multiple_choice", options: ["かしこまりました > 承知いたしました > 了解しました > わかった", "わかった > 了解しました > 承知いたしました > かしこまりました", "了解しました > 承知いたしました > わかった > かしこまりました", "全部同じ"], correctAnswer: "かしこまりました > 承知いたしました > 了解しました > わかった", explanationJp: "「かしこまりました」が最も丁寧で接客で使います。「わかった」は友達同士のカジュアルな表現です。", explanationVi: "「かしこまりました」lịch sự nhất, dùng trong phục vụ khách. 「わかった」là biểu hiện thân mật giữa bạn bè.", displayOrder: 0 },
      { questionJp: "上司に「明日までにやって」と言われたら、何と答えますか？", questionVi: "Sếp nói \"làm xong trước ngày mai\", bạn trả lời gì?", quizType: "multiple_choice", options: ["承知いたしました", "了解", "うん、わかった", "OK〜"], correctAnswer: "承知いたしました", explanationJp: "上司に対しては「承知いたしました」が適切です。「了解」だけだと少し失礼に感じる上司もいます。", explanationVi: "Với cấp trên,「承知いたしました」là phù hợp. Chỉ nói「了解」có thể bị coi là thiếu lịch sự.", displayOrder: 1 },
    ],
  },
  {
    titleJp: "ビジネス日本語：申し訳ございません",
    titleVi: "Tiếng Nhật thương mại: 申し訳ございません",
    summaryJp: "ビジネスでの謝罪表現を学びましょう。",
    summaryVi: "Học biểu hiện xin lỗi trong kinh doanh.",
    contentJson: { phrase: "申し訳ございません", phraseReading: "もうしわけございません", literalMeaning: "Không có lời nào để biện minh (nghĩa gốc)", usageNote: "「すみません」よりずっと丁寧な謝罪表現。ビジネスシーンでミスをした時に使います。", usageNoteVi: "Biểu hiện xin lỗi lịch sự hơn nhiều so với「すみません」. Dùng khi mắc lỗi trong công việc.", formality: "very_formal", situations: ["仕事でミスをした時", "納期に遅れた時", "お客様にご迷惑をおかけした時"], situationsVi: ["Khi mắc lỗi trong công việc", "Khi trễ deadline", "Khi gây phiền cho khách hàng"], dialogue: [{ speaker: "社員", text: "申し訳ございません。確認不足でミスが発生しました。すぐに修正いたします。", textVi: "Tôi vô cùng xin lỗi. Do thiếu kiểm tra nên đã xảy ra lỗi. Tôi sẽ sửa ngay." }, { speaker: "上司", text: "次から気をつけてね。", textVi: "Lần sau chú ý hơn nhé." }] },
    jlptLevel: "N2",
    vocabItems: [
      { wordJp: "不手際", reading: "ふてぎわ", meaningVi: "Sai sót, xử lý kém", pos: "noun", jlptLevel: "N1", sentenceJp: "私の不手際でご迷惑をおかけしました。", sentenceVi: "Do sai sót của tôi đã gây phiền cho quý khách.", displayOrder: 0 },
      { wordJp: "お詫び", reading: "おわび", meaningVi: "Lời xin lỗi (kính ngữ)", pos: "noun", jlptLevel: "N2", sentenceJp: "心よりお詫び申し上げます。", sentenceVi: "Tôi thành tâm xin lỗi.", displayOrder: 1 },
      { wordJp: "改善", reading: "かいぜん", meaningVi: "Cải thiện, khắc phục", pos: "noun", jlptLevel: "N2", sentenceJp: "再発防止のため、改善策を講じます。", sentenceVi: "Để phòng ngừa tái phát, chúng tôi sẽ thực hiện biện pháp cải thiện.", displayOrder: 2 },
      { wordJp: "再発防止", reading: "さいはつぼうし", meaningVi: "Phòng ngừa tái phát", pos: "noun", jlptLevel: "N1", sentenceJp: "再発防止に努めてまいります。", sentenceVi: "Chúng tôi sẽ nỗ lực phòng ngừa tái phát.", displayOrder: 3 },
    ],
    quizzes: [
      { questionJp: "ビジネスで一番丁寧な謝り方は？", questionVi: "Cách xin lỗi lịch sự nhất trong kinh doanh?", quizType: "multiple_choice", options: ["申し訳ございません", "すみません", "ごめんなさい", "悪い！"], correctAnswer: "申し訳ございません", explanationJp: "「申し訳ございません」はビジネスで最も丁寧な謝罪です。「ごめんなさい」は親しい人向け、「悪い」は友達同士です。", explanationVi: "「申し訳ございません」là lời xin lỗi lịch sự nhất trong kinh doanh. 「ごめんなさい」dùng với người thân, 「悪い」giữa bạn bè.", displayOrder: 0 },
      { questionJp: "謝罪メールで「もう同じミスをしない」と伝えたい時は？", questionVi: "Trong email xin lỗi, muốn nói \"sẽ không lặp lại lỗi\" thì dùng gì?", quizType: "multiple_choice", options: ["再発防止に努めます", "気にしないでください", "忘れてください", "仕方がないです"], correctAnswer: "再発防止に努めます", explanationJp: "「再発防止に努めます」は「同じ問題が起こらないように頑張ります」という意味で、謝罪後の定番表現です。", explanationVi: "「再発防止に努めます」nghĩa là \"sẽ cố gắng không để vấn đề tương tự xảy ra\", là biểu hiện kinh điển sau lời xin lỗi.", displayOrder: 1 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER CONTENT — Diverse weather scenarios (12 variations)
// ═══════════════════════════════════════════════════════════════════════════════

const WEATHER_VARIATIONS = [
  { titleJp: "梅雨入り宣言", titleVi: "Tuyên bố vào mùa mưa", summaryJp: "梅雨の始まりに関する天気用語を学びましょう。", summaryVi: "Học thuật ngữ thời tiết về đầu mùa mưa.", contentJson: { city: "東京", weatherIcon: "rain", highTemp: 26, lowTemp: 20, humidity: 90, description: "梅雨入り・終日雨", descriptionVi: "Bắt đầu mùa mưa - mưa cả ngày", uvIndex: 2, recommendation: "折りたたみ傘は必須。洗濯物は室内干しにしましょう。", recommendationVi: "Ô gấp là bắt buộc. Hãy phơi đồ trong nhà." }, jlptLevel: "N4", vocabItems: [{ wordJp: "梅雨入り", reading: "つゆいり", meaningVi: "Bắt đầu mùa mưa", pos: "noun", jlptLevel: "N3", sentenceJp: "関東地方が梅雨入りしました。", sentenceVi: "Vùng Kanto đã chính thức vào mùa mưa.", displayOrder: 0 }, { wordJp: "湿気", reading: "しっけ", meaningVi: "Độ ẩm, hơi ẩm", pos: "noun", jlptLevel: "N3", sentenceJp: "湿気が多くてカビが生えやすいです。", sentenceVi: "Độ ẩm cao nên dễ bị mốc.", displayOrder: 1 }, { wordJp: "除湿", reading: "じょしつ", meaningVi: "Hút ẩm", pos: "noun", jlptLevel: "N2", sentenceJp: "エアコンを除湿モードにしました。", sentenceVi: "Đã bật chế độ hút ẩm trên điều hòa.", displayOrder: 2 }, { wordJp: "カビ", reading: "かび", meaningVi: "Nấm mốc", pos: "noun", jlptLevel: "N3", sentenceJp: "浴室にカビが生えないよう換気しましょう。", sentenceVi: "Hãy thông gió phòng tắm để không bị mốc.", displayOrder: 3 }], quizzes: [{ questionJp: "梅雨の時期に家で気をつけるべきことは？", questionVi: "Trong mùa mưa nên chú ý gì ở nhà?", quizType: "multiple_choice", options: ["カビが生えないよう換気する", "エアコンを暖房にする", "窓を全部開ける", "水を止める"], correctAnswer: "カビが生えないよう換気する", explanationJp: "梅雨は湿度が高いのでカビが発生しやすくなります。換気と除湿が大切です。", explanationVi: "Mùa mưa độ ẩm cao nên dễ phát sinh nấm mốc. Thông gió và hút ẩm là quan trọng.", displayOrder: 0 }, { questionJp: "「除湿」の「除」はどんな意味ですか？", questionVi: "「除」trong「除湿」nghĩa là gì?", quizType: "multiple_choice", options: ["Loại bỏ, trừ đi", "Thêm vào", "Giữ lại", "Đo lường"], correctAnswer: "Loại bỏ, trừ đi", explanationJp: "「除」は「取り除く」という意味です。「除湿」は湿気を取り除くこと、「除菌」は菌を取り除くことです。", explanationVi: "「除」nghĩa là \"loại bỏ\". 「除湿」là loại bỏ ẩm, 「除菌」là loại bỏ vi khuẩn.", displayOrder: 1 }] },
  { titleJp: "真夏日の猛暑対策", titleVi: "Đối phó ngày nóng cực điểm", summaryJp: "暑い日に使える天気・健康の言葉を学びましょう。", summaryVi: "Học từ thời tiết và sức khỏe cho ngày nóng.", contentJson: { city: "東京", weatherIcon: "sunny_hot", highTemp: 36, lowTemp: 27, humidity: 65, description: "猛暑日・熱中症に注意", descriptionVi: "Ngày nóng cực điểm - cảnh báo say nắng", uvIndex: 9, recommendation: "外出は控えめに。水分と塩分をこまめに補給してください。", recommendationVi: "Hạn chế ra ngoài. Bổ sung nước và muối khoáng thường xuyên." }, jlptLevel: "N3", vocabItems: [{ wordJp: "熱中症", reading: "ねっちゅうしょう", meaningVi: "Say nắng, say nóng", pos: "noun", jlptLevel: "N2", sentenceJp: "真夏は熱中症に気をつけてください。", sentenceVi: "Giữa mùa hè hãy cẩn thận say nắng.", displayOrder: 0 }, { wordJp: "水分補給", reading: "すいぶんほきゅう", meaningVi: "Bổ sung nước", pos: "noun", jlptLevel: "N2", sentenceJp: "のどが渇く前に水分補給をしましょう。", sentenceVi: "Hãy uống nước trước khi khát.", displayOrder: 1 }, { wordJp: "日焼け", reading: "ひやけ", meaningVi: "Cháy nắng", pos: "noun", jlptLevel: "N3", sentenceJp: "日焼け止めを塗ってから外出しましょう。", sentenceVi: "Hãy thoa kem chống nắng trước khi ra ngoài.", displayOrder: 2 }, { wordJp: "冷房", reading: "れいぼう", meaningVi: "Điều hòa mát (cooling)", pos: "noun", jlptLevel: "N3", sentenceJp: "冷房を28度に設定しています。", sentenceVi: "Tôi đặt điều hòa ở 28 độ.", displayOrder: 3 }], quizzes: [{ questionJp: "暑い日に体調が悪くなる症状を何と言いますか？", questionVi: "Triệu chứng khó chịu vì nóng gọi là gì?", quizType: "multiple_choice", options: ["熱中症", "花粉症", "風邪", "腰痛"], correctAnswer: "熱中症", explanationJp: "「熱中症」は暑さで体温調節ができなくなる病気です。めまい、頭痛、吐き気などの症状が出ます。", explanationVi: "「熱中症」là bệnh khi cơ thể không điều hòa được thân nhiệt do nóng. Triệu chứng: chóng mặt, đau đầu, buồn nôn.", displayOrder: 0 }, { questionJp: "「日焼け止め」は何のために使いますか？", questionVi: "「日焼け止め」dùng để làm gì?", quizType: "multiple_choice", options: ["Ngăn da bị cháy nắng", "Trị đau đầu", "Giữ ấm", "Rửa mặt"], correctAnswer: "Ngăn da bị cháy nắng", explanationJp: "「日焼け止め」は紫外線から肌を守るクリームです。「日焼け」は太陽で肌が焼けること、「止め」は防ぐことです。", explanationVi: "「日焼け止め」là kem bảo vệ da khỏi tia UV. 「日焼け」= da bị cháy nắng, 「止め」= ngăn chặn.", displayOrder: 1 }] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Try to create an article. Returns true if created, false if it already exists. */
async function tryCreate(data) {
  try {
    await prisma.magazineArticle.create({ data });
    return true;
  } catch (e) {
    if (e.code === "P2002") return false; // unique constraint violation → already exists
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log("🌱 Seeding 3 months of magazine articles...\n");

  let created = 0;
  let skipped = 0;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90); // Start 90 days ago

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0];
    const weekIndex = Math.floor(dayOffset / 7) % 12; // Cycle through 12 weeks
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

    // 1. VOCAB article (daily)
    {
      const slug = `${dateStr}-vocab-vi`;
      const theme = VOCAB_THEMES[weekIndex];
      const dayLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
      const ok = await tryCreate({
        slug,
        widgetKind: "magazine_vocab",
        contentDate: date,
        locale: "vi",
        titleJp: `${dayLabel}の${theme.titleJp}`,
        titleVi: theme.titleVi,
        summaryJp: theme.summaryJp,
        summaryVi: theme.summaryVi,
        contentJson: theme.contentJson,
        jlptLevel: theme.jlptLevel,
        status: "published",
        publishedAt: date,
        vocabItems: { createMany: { data: theme.vocabItems } },
        quizzes: { createMany: { data: theme.quizzes } },
      });
      if (ok) { created++; if (created % 20 === 0) console.log(`  📝 ${created} articles created...`); }
      else { skipped++; }
    }

    // 2. WEATHER article (daily)
    {
      const slug = `${dateStr}-weather-vi`;
      const weather = WEATHER_VARIATIONS[dayOffset % WEATHER_VARIATIONS.length];
      const ok = await tryCreate({
        slug,
        widgetKind: "magazine_weather",
        contentDate: date,
        locale: "vi",
        titleJp: weather.titleJp,
        titleVi: weather.titleVi,
        summaryJp: weather.summaryJp,
        summaryVi: weather.summaryVi,
        contentJson: weather.contentJson,
        jlptLevel: weather.jlptLevel,
        status: "published",
        publishedAt: date,
        vocabItems: { createMany: { data: weather.vocabItems } },
        quizzes: { createMany: { data: weather.quizzes } },
      });
      if (ok) created++; else skipped++;
    }

    // 3. BJT PHRASE (weekdays only — Mon-Fri)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const slug = `${dateStr}-bjt-phrase-vi`;
      const phrase = BJT_PHRASES[weekIndex % BJT_PHRASES.length];
      const ok = await tryCreate({
        slug,
        widgetKind: "magazine_bjt_phrase",
        contentDate: date,
        locale: "vi",
        titleJp: phrase.titleJp,
        titleVi: phrase.titleVi,
        summaryJp: phrase.summaryJp,
        summaryVi: phrase.summaryVi,
        contentJson: phrase.contentJson,
        jlptLevel: phrase.jlptLevel,
        status: "published",
        publishedAt: date,
        vocabItems: { createMany: { data: phrase.vocabItems } },
        quizzes: { createMany: { data: phrase.quizzes } },
      });
      if (ok) created++; else skipped++;
    }

    // 4. HOROSCOPE (weekends — Sat, Sun)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const slug = `${dateStr}-horoscope-vi`;
      const horoscope = {
        titleJp: "今週の星占い",
        titleVi: "Tử vi tuần này",
        summaryJp: "今週の運勢をチェックして、良い一週間を過ごしましょう。",
        summaryVi: "Xem vận mệnh tuần này và có một tuần tốt lành.",
        contentJson: {
          zodiacFortunes: [
            { sign: "牡羊座 (おひつじざ)", fortuneJp: "仕事運が好調。新しいプロジェクトに挑戦するチャンスです。", fortuneVi: "Vận công việc tốt. Đây là cơ hội thử sức dự án mới." },
            { sign: "牡牛座 (おうしざ)", fortuneJp: "金運アップ。無駄遣いは控えて貯金を始めましょう。", fortuneVi: "Vận tài chính lên. Hạn chế tiêu hoang và bắt đầu tiết kiệm." },
            { sign: "双子座 (ふたござ)", fortuneJp: "人間関係が良好。コミュニケーションを大切にしましょう。", fortuneVi: "Quan hệ xã hội tốt. Hãy trân trọng giao tiếp." },
            { sign: "蟹座 (かにざ)", fortuneJp: "健康に注意。規則正しい生活を心がけてください。", fortuneVi: "Chú ý sức khỏe. Hãy cố gắng sống điều độ." },
          ],
        },
        jlptLevel: "N3",
      };
      const ok = await tryCreate({
        slug,
        widgetKind: "magazine_horoscope",
        contentDate: date,
        locale: "vi",
        titleJp: horoscope.titleJp,
        titleVi: horoscope.titleVi,
        summaryJp: horoscope.summaryJp,
        summaryVi: horoscope.summaryVi,
        contentJson: horoscope.contentJson,
        jlptLevel: horoscope.jlptLevel,
        status: "published",
        publishedAt: date,
        vocabItems: { createMany: { data: [
          { wordJp: "好調", reading: "こうちょう", meaningVi: "Thuận lợi, suôn sẻ", pos: "na-adjective", jlptLevel: "N2", sentenceJp: "最近ビジネスが好調です。", sentenceVi: "Gần đây kinh doanh thuận lợi.", displayOrder: 0 },
          { wordJp: "無駄遣い", reading: "むだづかい", meaningVi: "Tiêu hoang, lãng phí", pos: "noun", jlptLevel: "N3", sentenceJp: "コンビニでの無駄遣いをやめたいです。", sentenceVi: "Tôi muốn bỏ thói tiêu hoang ở cửa hàng tiện lợi.", displayOrder: 1 },
          { wordJp: "規則正しい", reading: "きそくただしい", meaningVi: "Điều độ, đúng giờ giấc", pos: "i-adjective", jlptLevel: "N3", sentenceJp: "規則正しい生活が健康の基本です。", sentenceVi: "Cuộc sống điều độ là nền tảng sức khỏe.", displayOrder: 2 },
        ] } },
        quizzes: { createMany: { data: [
          { questionJp: "「無駄遣い」の「無駄」はどんな意味ですか？", questionVi: "「無駄」trong「無駄遣い」nghĩa là gì?", quizType: "multiple_choice", options: ["Vô ích, lãng phí", "Nhiều", "Ít", "Đẹp"], correctAnswer: "Vô ích, lãng phí", explanationJp: "「無駄」は「役に立たない、もったいない」という意味です。「無駄遣い」は必要のないものにお金を使うことです。", explanationVi: "「無駄」nghĩa là \"vô ích, phí phạm\". 「無駄遣い」là tiêu tiền vào thứ không cần thiết.", displayOrder: 0 },
          { questionJp: "「規則正しい生活」に含まれないのは？", questionVi: "Điều nào KHÔNG thuộc「規則正しい生活」?", quizType: "multiple_choice", options: ["Thức khuya xem phim mỗi đêm", "Ngủ dậy cùng giờ mỗi ngày", "Ăn 3 bữa đúng giờ", "Tập thể dục đều đặn"], correctAnswer: "Thức khuya xem phim mỗi đêm", explanationJp: "「規則正しい」は「決まった時間に決まったことをする」ことです。夜更かしは不規則な生活です。", explanationVi: "「規則正しい」là \"làm đúng việc vào đúng giờ\". Thức khuya là cuộc sống bất quy tắc.", displayOrder: 1 },
        ] } },
      });
      if (ok) created++; else skipped++;
    }

    // 5. LOTO (Monday & Thursday only)
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      const slug = `${dateStr}-loto-vi`;
      const dateSeed = date.getTime();
      const nums = Array.from({ length: 5 }, (_, i) => ((dateSeed / (i + 1)) % 43) + 1).map(Math.floor);
      const ok = await tryCreate({
        slug,
        widgetKind: "magazine_loto",
        contentDate: date,
        locale: "vi",
        titleJp: "今週のラッキーナンバー",
        titleVi: "Số may mắn tuần này",
        summaryJp: "数字と運にまつわる日本語を学びましょう。",
        summaryVi: "Học tiếng Nhật liên quan đến con số và vận may.",
        contentJson: {
          luckyNumbers: nums,
          luckyKanji: "運",
          luckyKanjiReading: "うん",
          luckyKanjiMeaning: "Vận, vận may",
          explanation: "「運」は運命や幸運を表す漢字です。「運がいい」（うんがいい）は「lucky」という意味です。",
          explanationVi: "「運」là chữ Hán biểu thị vận mệnh, may mắn. 「運がいい」nghĩa là \"lucky\".",
        },
        jlptLevel: "N4",
        status: "published",
        publishedAt: date,
        vocabItems: { createMany: { data: [
          { wordJp: "運", reading: "うん", meaningVi: "Vận, vận may", pos: "noun", jlptLevel: "N3", sentenceJp: "今日は運がいい日です。", sentenceVi: "Hôm nay là ngày may mắn.", displayOrder: 0 },
          { wordJp: "宝くじ", reading: "たからくじ", meaningVi: "Xổ số", pos: "noun", jlptLevel: "N3", sentenceJp: "年末ジャンボ宝くじを買いました。", sentenceVi: "Tôi đã mua vé xổ số Jumbo cuối năm.", displayOrder: 1 },
          { wordJp: "当選", reading: "とうせん", meaningVi: "Trúng giải", pos: "noun", jlptLevel: "N2", sentenceJp: "1等に当選したら海外旅行に行きたいです。", sentenceVi: "Nếu trúng giải nhất, tôi muốn đi du lịch nước ngoài.", displayOrder: 2 },
        ] } },
        quizzes: { createMany: { data: [
          { questionJp: "「宝くじ」の「宝」はどんな意味ですか？", questionVi: "「宝」trong「宝くじ」nghĩa là gì?", quizType: "multiple_choice", options: ["Kho báu, quý giá", "Giấy", "Số", "Tiền"], correctAnswer: "Kho báu, quý giá", explanationJp: "「宝」は「大切なもの、価値のあるもの」です。「宝くじ」は宝が当たるくじ（抽選券）という意味です。", explanationVi: "「宝」là \"thứ quý giá\". 「宝くじ」nghĩa là \"vé rút thưởng trúng kho báu\".", displayOrder: 0 },
          { questionJp: "「当選」の反対の言葉は？", questionVi: "Từ trái nghĩa của「当選」?", quizType: "multiple_choice", options: ["落選", "当然", "選手", "投票"], correctAnswer: "落選", explanationJp: "「当選」は選ばれること（trúng）、「落選」は選ばれないこと（trượt）です。選挙やくじで使います。", explanationVi: "「当選」là được chọn (trúng), 「落選」là không được chọn (trượt). Dùng trong bầu cử và xổ số.", displayOrder: 1 },
        ] } },
      });
      if (ok) created++; else skipped++;
    }
  }

  console.log(`\n🎉 Magazine 3-month seed complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Coverage: ~90 days × 2-4 articles/day`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
