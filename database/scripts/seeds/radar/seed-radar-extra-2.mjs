/**
 * Radar Seed: 2 extra cards to hit 300+
 * Run: node scripts/seed-radar-extra-2.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const cards = [
  {
    slug: "pet-friendly-life-japan",
    moduleConfigId: MODULES.life_hack,
    titleVi: "ペット生活 — Nuôi thú cưng ở Nhật",
    titleJa: "日本でのペットとの暮らし",
    descriptionVi: "Nuôi chó/mèo ở Nhật — quy định, chi phí, manner.",
    recommendationReasonVi: "Pets = life partner. Biết rule = nuôi hạnh phúc + không bị phạt.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 158,
    metadata: {
      seed: true,
      skills: ["pets", "daily_life", "rules"],
      contentGoal: "Biết quy định nuôi pet ở Nhật.",
      usageNote: "Quy định: 登録 (đăng ký chó), 狂犬病予防注射 (tiêm dại: bắt buộc), ペット可物件 (nhà cho nuôi: +1-2万/月). Chi phí: 犬 月1-3万, 猫 月1万. Manner: リード (dây xích), フン処理, 鳴き声 (tiếng ồn: complaint #1).",
      japaneseExpressions: [
        { word: "ペット可", reading: "ペットか", meaning: "Cho phép nuôi thú cưng (pet-allowed property)", jlptLevel: "N4", example: "ペット可の物件は家賃が高めです。", exampleReading: "ペットかのぶっけんはやちんがたかめです。", exampleMeaning: "Nhà cho nuôi pet tiền thuê hơi cao.", usageNote: "suumo: ペット可 filter. 敷金+1ヶ月 (deposit thêm). 犬OK猫NG, 小型犬のみ: đọc kỹ." },
        { word: "動物病院", reading: "どうぶつびょういん", meaning: "Bệnh viện thú y (animal hospital/vet)", jlptLevel: "N4", example: "猫が具合悪そうなので動物病院に連れて行きます。", exampleReading: "ねこがぐあいわるそうなのでどうぶつびょういんにつれていきます。", exampleMeaning: "Mèo có vẻ ốm nên đưa đi bác sĩ thú y.", usageNote: "保険なし: 診察 3000-5000¥, 手術 10万~. ペット保険: 月2000-5000¥ (70%補償). 夜間救急: 都市に 1-2件." },
        { word: "散歩", reading: "さんぽ", meaning: "Đi dạo (walk — dog walking)", jlptLevel: "N5", example: "毎朝6時に犬の散歩をしています。", exampleReading: "まいあさろくじにいぬのさんぽをしています。", exampleMeaning: "Dắt chó đi dạo 6h mỗi sáng.", usageNote: "犬: 1日1-2回, 30分~. リード必須 (ノーリード=法律違反). マナー: フン持ち帰り (túi dọn phân), おしっこ 水で流す. 犬友 (dog friends) = giao lưu." }
      ]
    }
  },
  {
    slug: "vending-machines-jihanki",
    moduleConfigId: MODULES.life_hack,
    titleVi: "自動販売機 — Máy bán tự động",
    titleJa: "日本の自動販売機の使い方",
    descriptionVi: "Máy bán hàng Nhật — loại, mẹo, đặc biệt.",
    recommendationReasonVi: "500万台 = mọi góc phố. Biết = tiện lợi 24h bất kỳ đâu.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 2,
    priority: 150,
    metadata: {
      seed: true,
      skills: ["vending_machine", "daily_life", "convenience"],
      contentGoal: "Biết dùng máy bán hàng tự động.",
      usageNote: "500万台 toàn Nhật (23人に1台). Loại: 飲み物 (phổ biến nhất), 食品 (ラーメン, 餃子, パン), タバコ (taspo card), お酒, アイス, お土産. Thanh toán: 現金, IC card (Suica tap), QR (一部). あったか~い (nóng) / つめた~い (lạnh). Đặc biệt: おでん缶, だし自販機, 花, 昆虫.",
      japaneseExpressions: [
        { word: "自動販売機", reading: "じどうはんばいき", meaning: "Máy bán hàng tự động (vending machine)", jlptLevel: "N4", example: "駅前に自動販売機がたくさんあります。", exampleReading: "えきまえにじどうはんばいきがたくさんあります。", exampleMeaning: "Trước ga có rất nhiều máy bán hàng.", usageNote: "略: 自販機 (じはんき). 24h. 設置場所: 駅, コンビニ前, マンション, 道路脇, 山の上 (値段↑). 故障: つり銭切れ (hết tiền thối) → 他の機械." },
        { word: "温かい", reading: "あたたかい", meaning: "Ấm/nóng (warm — for hot drinks)", jlptLevel: "N5", example: "冬は温かい缶コーヒーが嬉しいです。", exampleReading: "ふゆはあたたかいかんコーヒーがうれしいです。", exampleMeaning: "Đông uống cà phê lon nóng sướng.", usageNote: "自販機: 赤ランプ = あったか~い, 青 = つめた~い. 切替: 9-10月 (秋→冬 mode). 缶: holding = hand warmer. 夏: 冷 only." },
        { word: "つり銭", reading: "つりせん", meaning: "Tiền thối (change — from vending machine)", jlptLevel: "N4", example: "つり銭を取り忘れないでください。", exampleReading: "つりせんをとりわすれないでください。", exampleMeaning: "Đừng quên lấy tiền thối.", usageNote: "取り出し口: 下の方. 忘れ物 #1. 1000¥札 OK (大体). 5000¥/10000¥: 多くの機械 NG. 小銭: 1¥/5¥ 使えない (10¥~)." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🎯 Extra 2 to hit 300+...");
  await runBatch(client, cards, "Extra-2");
  const r = await client.query("SELECT COUNT(*) as total FROM daily.daily_radar_card");
  console.log("📊 TOTAL:", r.rows[0].total);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
