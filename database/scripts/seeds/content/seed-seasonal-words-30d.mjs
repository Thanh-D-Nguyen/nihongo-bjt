/**
 * Seed 30 days of production-quality seasonal words (từ theo mùa).
 *
 * Each entry includes:
 * - A headline seasonal word/expression
 * - Rich bodyMd with 4-6 related vocabulary + example sentences
 * - Proper readings and explanations in Vietnamese
 *
 * Run:  node database/scripts/seeds/content/seed-seasonal-words-30d.mjs
 *
 * Idempotent: skips existing dates.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

// Generate 30 days starting from today
function generateDates(count = 30) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ─── Production-quality seasonal word entries ───
// Each has: title, japaneseText, readingText, explanationText, bodyMd (with vocabulary)

const seasonalWords = [
  {
    title: "Từ theo mùa — Gió thơm đầu hè",
    japaneseText: "薫風",
    readingText: "くんぷう",
    explanationText:
      "Gió nhẹ đầu hè mang hương lá non. Từ văn chương thường dùng trong thư từ trang trọng và thơ truyền thống tháng 5–6.",
    bodyMd: `## 薫風 (くんぷう) — Gió thơm

Gió mát lành mùa hạ mang theo hương cây cỏ. Đây là 季語 (quý ngữ) dùng trong thơ haiku mùa hè.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 薫風 | くんぷう | Gió thơm đầu hè | N1 |
| 新緑 | しんりょく | Lá non xanh mướt | N2 |
| 若葉 | わかば | Lá non | N3 |
| 初夏 | しょか | Đầu hè | N2 |
| 爽やか | さわやか | Mát mẻ, dễ chịu | N3 |
| 木漏れ日 | こもれび | Ánh nắng xuyên qua lá cây | N1 |

---

### 💬 Câu ví dụ

**1.** 薫風が心地よい季節になりました。
> くんぷうがここちよいきせつになりました。
> Đã đến mùa gió thơm dễ chịu rồi.

**2.** 新緑の中を散歩するのは最高ですね。
> しんりょくのなかをさんぽするのはさいこうですね。
> Đi dạo giữa lá non xanh mướt thật tuyệt nhỉ.

**3.** 初夏の爽やかな風が気持ちいい。
> しょかのさわやかなかぜがきもちいい。
> Gió mát mẻ đầu hè thật dễ chịu.

---

### 🏢 Dùng trong email business

「薫風の候、ますますご清栄のこととお喜び申し上げます」
> Nhân mùa gió thơm, kính chúc quý công ty ngày càng thịnh vượng.`,
  },
  {
    title: "Từ theo mùa — Mùa mưa Nhật Bản",
    japaneseText: "梅雨",
    readingText: "つゆ",
    explanationText:
      "Mùa mưa kéo dài từ giữa tháng 6 đến giữa tháng 7. Đây là chủ đề small talk phổ biến nhất ở công sở Nhật trong giai đoạn này.",
    bodyMd: `## 梅雨 (つゆ) — Mùa mưa

Mùa mưa ở Nhật bắt đầu từ giữa tháng 6, là thời điểm trời ẩm ướt và mưa liên tục. Biết dùng đúng từ giúp bạn hoà nhập tự nhiên khi nói chuyện với đồng nghiệp.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 梅雨 | つゆ | Mùa mưa (tháng 6–7) | N3 |
| 湿気 | しっけ | Độ ẩm, hơi ẩm | N3 |
| 蒸し暑い | むしあつい | Nóng oi, oi bức | N3 |
| じめじめする | じめじめする | Ẩm ướt khó chịu | N3 |
| 梅雨入り | つゆいり | Bắt đầu mùa mưa | N2 |
| 梅雨明け | つゆあけ | Kết thúc mùa mưa | N2 |

---

### 💬 Câu ví dụ

**1.** 今年の梅雨は長いですね。
> ことしのつゆはながいですね。
> Năm nay mùa mưa dài nhỉ.

**2.** 湿気がすごくて、髪がまとまらない。
> しっけがすごくて、かみがまとまらない。
> Độ ẩm cao quá, tóc không vào nếp được.

**3.** 梅雨明けが待ち遠しいですね。
> つゆあけがまちどおしいですね。
> Mong mùa mưa kết thúc quá nhỉ.

---

### 🏢 Small talk ở công ty

「今日もじめじめしますね」→ Hôm nay cũng ẩm ướt nhỉ.
「傘を持っていったほうがいいですよ」→ Nên mang ô đi đó.`,
  },
  {
    title: "Từ theo mùa — Mùa hoa cẩm tú cầu",
    japaneseText: "紫陽花",
    readingText: "あじさい",
    explanationText:
      "Hoa cẩm tú cầu nở rộ vào mùa mưa (tháng 6). Là biểu tượng của mùa mưa Nhật Bản, thường thấy ở đền chùa và công viên.",
    bodyMd: `## 紫陽花 (あじさい) — Hoa cẩm tú cầu

Hoa đặc trưng của mùa mưa, nở từ tháng 6 đến tháng 7. Màu sắc thay đổi theo độ pH của đất (xanh/tím/hồng).

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 紫陽花 | あじさい | Hoa cẩm tú cầu | N2 |
| 花見 | はなみ | Ngắm hoa | N4 |
| 見頃 | みごろ | Thời điểm đẹp nhất để ngắm | N2 |
| 咲く | さく | Nở (hoa) | N4 |
| 雨上がり | あめあがり | Sau cơn mưa | N2 |
| 風情 | ふぜい | Phong vị, nét đẹp tinh tế | N1 |

---

### 💬 Câu ví dụ

**1.** 紫陽花がきれいに咲いていますね。
> あじさいがきれいにさいていますね。
> Hoa cẩm tú cầu nở đẹp quá nhỉ.

**2.** 雨上がりの紫陽花は風情がありますね。
> あめあがりのあじさいはふぜいがありますね。
> Hoa cẩm tú cầu sau mưa thật có phong vị.

**3.** 来週、鎌倉に紫陽花を見に行きませんか。
> らいしゅう、かまくらにあじさいをみにいきませんか。
> Tuần sau đi Kamakura ngắm hoa cẩm tú cầu không?

---

### 🌸 Văn hoá

Kamakura (鎌倉) và Hakone (箱根) là những nơi nổi tiếng nhất để ngắm hoa cẩm tú cầu mùa mưa.`,
  },
  {
    title: "Từ theo mùa — Đom đóm mùa hè",
    japaneseText: "蛍",
    readingText: "ほたる",
    explanationText:
      "Đom đóm là biểu tượng của đêm hè Nhật Bản. Thường xuất hiện ven suối vào tháng 6–7. Là chủ đề phổ biến trong văn hoá và thơ ca.",
    bodyMd: `## 蛍 (ほたる) — Đom đóm

Đom đóm bay lượn bên bờ suối vào đêm hè — một trong những cảnh đẹp nhất của mùa hè Nhật Bản.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 蛍 | ほたる | Đom đóm | N2 |
| 蛍狩り | ほたるがり | Đi ngắm đom đóm | N1 |
| 夏の夜 | なつのよる | Đêm hè | N4 |
| 小川 | おがわ | Suối nhỏ | N3 |
| 風物詩 | ふうぶつし | Cảnh vật đặc trưng theo mùa | N1 |
| 幻想的 | げんそうてき | Huyền ảo, mộng mơ | N2 |

---

### 💬 Câu ví dụ

**1.** 蛍を見に行きましょう。
> ほたるをみにいきましょう。
> Đi ngắm đom đóm đi.

**2.** 蛍の光は幻想的ですね。
> ほたるのひかりはげんそうてきですね。
> Ánh sáng đom đóm thật huyền ảo nhỉ.

**3.** この時期は蛍狩りのシーズンです。
> このじきはほたるがりのシーズンです。
> Thời điểm này là mùa ngắm đom đóm.

---

### 🎌 Văn hoá

蛍狩り (hotaru-gari) — tục lệ đi ngắm đom đóm — là hoạt động mùa hè truyền thống từ thời Heian.`,
  },
  {
    title: "Từ theo mùa — Pháo hoa mùa hè",
    japaneseText: "花火",
    readingText: "はなび",
    explanationText:
      "Pháo hoa là biểu tượng mùa hè Nhật Bản. Các lễ hội pháo hoa (花火大会) diễn ra từ tháng 7 đến tháng 8 trên khắp nước Nhật.",
    bodyMd: `## 花火 (はなび) — Pháo hoa

Mùa hè ở Nhật không thể thiếu pháo hoa. Từ 花火 (hana + bi) nghĩa đen là "hoa lửa" — thật đẹp.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 花火 | はなび | Pháo hoa | N4 |
| 花火大会 | はなびたいかい | Lễ hội pháo hoa | N3 |
| 浴衣 | ゆかた | Yukata (kimono mùa hè) | N3 |
| 夜空 | よぞら | Bầu trời đêm | N3 |
| 打ち上げ花火 | うちあげはなび | Pháo hoa bắn lên trời | N2 |
| 屋台 | やたい | Quầy hàng lễ hội | N3 |

---

### 💬 Câu ví dụ

**1.** 今週末、花火大会がありますよ。
> こんしゅうまつ、はなびたいかいがありますよ。
> Cuối tuần này có lễ hội pháo hoa đó.

**2.** 浴衣を着て花火を見に行きたい。
> ゆかたをきてはなびをみにいきたい。
> Muốn mặc yukata đi xem pháo hoa.

**3.** 夜空にきれいな花火が上がりました。
> よぞらにきれいなはなびがあがりました。
> Pháo hoa đẹp bắn lên bầu trời đêm.

---

### 🏮 Lễ hội nổi tiếng

隅田川花火大会 (Sumida-gawa) — lễ hội pháo hoa lớn nhất Tokyo, từ năm 1733.`,
  },
  {
    title: "Từ theo mùa — Nắng nóng mùa hè",
    japaneseText: "猛暑",
    readingText: "もうしょ",
    explanationText:
      "Nắng nóng dữ dội (trên 35°C). Mùa hè Nhật ngày càng nóng, 猛暑 là từ hay gặp trên TV và báo từ tháng 7 đến tháng 9.",
    bodyMd: `## 猛暑 (もうしょ) — Nắng nóng dữ dội

Khi nhiệt độ vượt 35°C, NHK và đài truyền hình dùng từ 猛暑日 (もうしょび). Biết từ vựng thời tiết nóng giúp bạn giao tiếp tốt hơn ở công ty.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 猛暑 | もうしょ | Nóng dữ dội (>35°C) | N2 |
| 熱中症 | ねっちゅうしょう | Say nắng, say nóng | N2 |
| 水分補給 | すいぶんほきゅう | Bổ sung nước | N2 |
| 日差し | ひざし | Ánh nắng (trực tiếp) | N3 |
| エアコン | エアコン | Máy điều hoà | N4 |
| 真夏日 | まなつび | Ngày nóng (>30°C) | N2 |

---

### 💬 Câu ví dụ

**1.** 今日は猛暑日ですから、水分補給を忘れずに。
> きょうはもうしょびですから、すいぶんほきゅうをわすれずに。
> Hôm nay nắng nóng dữ dội nên đừng quên uống nước nhé.

**2.** 熱中症に気をつけてください。
> ねっちゅうしょうにきをつけてください。
> Hãy cẩn thận say nắng nhé.

**3.** この猛暑はいつまで続くんでしょうか。
> このもうしょはいつまでつづくんでしょうか。
> Nắng nóng này kéo dài đến bao giờ nhỉ.

---

### 🏢 Small talk ở công ty

「今日も暑いですね。熱中症に気をつけましょう」→ Hôm nay cũng nóng nhỉ. Hãy cẩn thận say nắng.`,
  },
  {
    title: "Từ theo mùa — Gió mùa thu",
    japaneseText: "秋風",
    readingText: "あきかぜ",
    explanationText:
      "Gió mùa thu — cơn gió mát đầu tiên báo hiệu hè qua, thu đến. Từ hay gặp trong thơ và thư từ tháng 9 trở đi.",
    bodyMd: `## 秋風 (あきかぜ) — Gió mùa thu

Khi gió mát đầu tiên thổi qua, người Nhật biết mùa thu đã đến. 秋風 mang cảm giác vừa dễ chịu vừa hơi buồn.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 秋風 | あきかぜ | Gió mùa thu | N2 |
| 涼しい | すずしい | Mát mẻ | N4 |
| 紅葉 | こうよう/もみじ | Lá đỏ mùa thu | N3 |
| 食欲の秋 | しょくよくのあき | Mùa thu ẩm thực | N3 |
| 読書の秋 | どくしょのあき | Mùa thu đọc sách | N3 |
| 秋晴れ | あきばれ | Trời thu trong xanh | N2 |

---

### 💬 Câu ví dụ

**1.** 秋風が気持ちいい季節になりましたね。
> あきかぜがきもちいいきせつになりましたね。
> Đã đến mùa gió thu dễ chịu rồi nhỉ.

**2.** 紅葉を見に行きませんか。
> こうようをみにいきませんか。
> Đi ngắm lá đỏ không?

**3.** 秋は食欲の秋とも言いますよね。
> あきはしょくよくのあきともいいますよね。
> Mùa thu còn gọi là mùa thu ẩm thực nhỉ.

---

### 🍁 Văn hoá

Người Nhật gọi thu là mùa của 3 thứ: 食欲の秋 (ăn), 読書の秋 (đọc), スポーツの秋 (thể thao).`,
  },
  {
    title: "Từ theo mùa — Lá đỏ mùa thu",
    japaneseText: "紅葉",
    readingText: "もみじ / こうよう",
    explanationText:
      "Lá cây chuyển đỏ/vàng vào mùa thu. もみじ (cây phong) và こうよう (hiện tượng lá đổi màu). Ngắm lá đỏ (紅葉狩り) là truyền thống thu từ thời Heian.",
    bodyMd: `## 紅葉 (もみじ/こうよう) — Lá đỏ mùa thu

Một trong những cảnh đẹp nhất Nhật Bản. Mùa lá đỏ kéo dài từ tháng 10 (Hokkaido) đến tháng 12 (Kyushu).

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 紅葉 | もみじ/こうよう | Lá đỏ / lá phong | N3 |
| 紅葉狩り | もみじがり | Đi ngắm lá đỏ | N2 |
| 色づく | いろづく | (Lá) đổi màu | N2 |
| 落ち葉 | おちば | Lá rụng | N3 |
| 銀杏 | いちょう | Cây bạch quả (lá vàng) | N2 |
| 見頃 | みごろ | Thời điểm đẹp nhất | N2 |

---

### 💬 Câu ví dụ

**1.** 今年の紅葉は見頃を迎えています。
> ことしのこうようはみごろをむかえています。
> Năm nay lá đỏ đang vào thời điểm đẹp nhất.

**2.** 京都は紅葉の名所が多いですね。
> きょうとはこうようのめいしょがおおいですね。
> Kyoto nhiều danh thắng ngắm lá đỏ nhỉ.

**3.** 公園の木が色づいてきましたね。
> こうえんのきがいろづいてきましたね。
> Cây trong công viên bắt đầu đổi màu rồi nhỉ.

---

### 🍁 Địa điểm nổi tiếng

嵐山 (Arashiyama), 東福寺 (Tōfuku-ji), 高尾山 (Mt. Takao) — ngắm lá đỏ từ giữa tháng 11.`,
  },
  {
    title: "Từ theo mùa — Mùa thu ẩm thực",
    japaneseText: "食欲の秋",
    readingText: "しょくよくのあき",
    explanationText:
      "Mùa thu được gọi là 'mùa thu ẩm thực' vì có nhiều nông sản ngon: hạt dẻ, khoai lang, nấm matsutake, cá sanma...",
    bodyMd: `## 食欲の秋 (しょくよくのあき) — Mùa thu ẩm thực

Người Nhật nói「天高く馬肥ゆる秋」(Trời cao ngựa béo mùa thu) — ý nói thu là mùa ăn ngon.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 食欲の秋 | しょくよくのあき | Mùa thu ẩm thực | N3 |
| 栗 | くり | Hạt dẻ | N3 |
| さつまいも | さつまいも | Khoai lang | N4 |
| 秋刀魚 | さんま | Cá sanma (cá thu đao) | N3 |
| 松茸 | まつたけ | Nấm matsutake | N2 |
| 新米 | しんまい | Gạo mới (vụ mùa mới) | N2 |

---

### 💬 Câu ví dụ

**1.** 秋は食べ物がおいしい季節ですね。
> あきはたべものがおいしいきせつですね。
> Mùa thu là mùa đồ ăn ngon nhỉ.

**2.** 焼き芋の季節になりましたね。
> やきいものきせつになりましたね。
> Đã đến mùa khoai nướng rồi nhỉ.

**3.** 今年の新米はもう食べましたか。
> ことしのしんまいはもうたべましたか。
> Năm nay bạn đã ăn gạo mới chưa?

---

### 🏢 Small talk mùa thu

「栗ご飯、作りましたか？」→ Bạn đã nấu cơm hạt dẻ chưa?
「秋刀魚の季節ですね」→ Mùa cá sanma rồi nhỉ.`,
  },
  {
    title: "Từ theo mùa — Trăng thu",
    japaneseText: "月見",
    readingText: "つきみ",
    explanationText:
      "Tục ngắm trăng rằm tháng 8 âm lịch (khoảng tháng 9 dương lịch). Người Nhật ăn dango (bánh nếp) và trang trí bông lau (すすき).",
    bodyMd: `## 月見 (つきみ) — Ngắm trăng

お月見 (otsukimi) — truyền thống ngắm trăng rằm mùa thu, thường vào tháng 9.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 月見 | つきみ | Ngắm trăng | N3 |
| 十五夜 | じゅうごや | Đêm rằm (tháng 8 AL) | N2 |
| 団子 | だんご | Bánh nếp tròn | N3 |
| すすき | すすき | Bông lau | N2 |
| 満月 | まんげつ | Trăng tròn | N3 |
| 名月 | めいげつ | Trăng đẹp, trăng thu | N1 |

---

### 💬 Câu ví dụ

**1.** 今夜はお月見ですね。
> こんやはおつきみですね。
> Tối nay ngắm trăng nhỉ.

**2.** 月見団子を買ってきました。
> つきみだんごをかってきました。
> Tôi đã mua bánh dango ngắm trăng rồi.

**3.** 今年の十五夜はいつですか。
> ことしのじゅうごやはいつですか。
> Năm nay rằm tháng 8 là ngày nào?

---

### 🎑 Văn hoá

Ngày nay, chuỗi cửa hàng McDonald's Nhật ra 月見バーガー (Moon Viewing Burger) mỗi mùa thu!`,
  },
  {
    title: "Từ theo mùa — Tuyết đầu mùa",
    japaneseText: "初雪",
    readingText: "はつゆき",
    explanationText:
      "Tuyết rơi lần đầu tiên trong năm. Ở Tokyo thường vào tháng 11–12. Là tin tức được chờ đón mỗi năm.",
    bodyMd: `## 初雪 (はつゆき) — Tuyết đầu mùa

Khi tuyết đầu tiên rơi, đài truyền hình đưa tin và mọi người háo hức. Đây là dấu hiệu đông đã đến.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 初雪 | はつゆき | Tuyết đầu mùa | N2 |
| 雪 | ゆき | Tuyết | N4 |
| 積もる | つもる | (Tuyết) phủ dày | N3 |
| 冷え込む | ひえこむ | Lạnh buốt | N2 |
| 防寒 | ぼうかん | Chống lạnh | N2 |
| 路面凍結 | ろめんとうけつ | Đường đóng băng | N1 |

---

### 💬 Câu ví dụ

**1.** 今朝、初雪が降りましたね。
> けさ、はつゆきがふりましたね。
> Sáng nay tuyết đầu mùa rơi rồi nhỉ.

**2.** 明日は雪が積もるかもしれません。
> あしたはゆきがつもるかもしれません。
> Ngày mai tuyết có thể phủ dày.

**3.** 防寒対策をしっかりしましょう。
> ぼうかんたいさくをしっかりしましょう。
> Hãy chuẩn bị chống lạnh kỹ nhé.

---

### ⚠️ Lưu ý thực tế

Khi tuyết rơi: kiểm tra tàu điện (遅延/運休), mang giày chống trượt, và để thêm thời gian di chuyển.`,
  },
  {
    title: "Từ theo mùa — Lễ hội mùa đông",
    japaneseText: "年末年始",
    readingText: "ねんまつねんし",
    explanationText:
      "Cuối năm – đầu năm mới. Khoảng 28/12 – 3/1 là kỳ nghỉ lớn nhất năm ở Nhật, quan trọng hơn cả Giáng sinh.",
    bodyMd: `## 年末年始 (ねんまつねんし) — Cuối năm – Đầu năm

Kỳ nghỉ quan trọng nhất Nhật Bản. Công ty thường nghỉ từ 28/12 đến 3/1.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 年末年始 | ねんまつねんし | Cuối năm – đầu năm | N3 |
| 大掃除 | おおそうじ | Tổng vệ sinh cuối năm | N3 |
| 忘年会 | ぼうねんかい | Tiệc cuối năm | N3 |
| 初詣 | はつもうで | Đi chùa/đền đầu năm | N3 |
| おせち料理 | おせちりょうり | Món ăn năm mới | N2 |
| 年賀状 | ねんがじょう | Thiệp chúc Tết | N3 |

---

### 💬 Câu ví dụ

**1.** 年末年始のご予定はもう決まりましたか。
> ねんまつねんしのごよていはもうきまりましたか。
> Kế hoạch nghỉ Tết đã quyết chưa?

**2.** 忘年会は12月20日に予定しています。
> ぼうねんかいは12がつ20にちによていしています。
> Tiệc cuối năm dự kiến ngày 20/12.

**3.** 今年も年賀状を書かなきゃ。
> ことしもねんがじょうをかかなきゃ。
> Năm nay cũng phải viết thiệp Tết.

---

### 🏢 Email business cuối năm

「本年も大変お世話になりました。来年もよろしくお願いいたします。」
> Năm nay đã được quý vị giúp đỡ nhiều. Năm tới cũng xin được tiếp tục hợp tác.`,
  },
  {
    title: "Từ theo mùa — Hoa anh đào",
    japaneseText: "桜",
    readingText: "さくら",
    explanationText:
      "Hoa anh đào — biểu tượng của Nhật Bản và mùa xuân. Nở từ cuối tháng 3 đến giữa tháng 4. Mọi người đi 花見 (hanami — ngắm hoa) dưới tán anh đào.",
    bodyMd: `## 桜 (さくら) — Hoa anh đào

Biểu tượng quốc gia của Nhật. Mùa hoa từ cuối tháng 3 đến giữa tháng 4 (Tokyo). Đi hanami là truyền thống cả ngàn năm.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 桜 | さくら | Hoa anh đào | N4 |
| 花見 | はなみ | Ngắm hoa (picnic dưới anh đào) | N4 |
| 満開 | まんかい | Nở rộ (100%) | N2 |
| 桜前線 | さくらぜんせん | "Mặt trận hoa anh đào" (dự báo nở) | N1 |
| 花吹雪 | はなふぶき | Mưa cánh hoa anh đào | N1 |
| お花見弁当 | おはなみべんとう | Hộp cơm picnic ngắm hoa | N3 |

---

### 💬 Câu ví dụ

**1.** 桜が満開ですね。お花見に行きましょう。
> さくらがまんかいですね。おはなみにいきましょう。
> Hoa anh đào nở rộ rồi nhỉ. Đi ngắm hoa đi.

**2.** 桜前線が北上しています。
> さくらぜんせんがほくじょうしています。
> "Mặt trận anh đào" đang tiến lên phía bắc.

**3.** 花吹雪がきれいでした。
> はなふぶきがきれいでした。
> Mưa cánh hoa anh đào thật đẹp.

---

### 🏢 Small talk mùa xuân

「お花見はもう行きましたか？」→ Bạn đã đi ngắm hoa chưa?
「今年の桜は早いですね」→ Năm nay hoa anh đào nở sớm nhỉ.`,
  },
  {
    title: "Từ theo mùa — Mùa xuân mới",
    japaneseText: "新生活",
    readingText: "しんせいかつ",
    explanationText:
      "Tháng 4 ở Nhật là khởi đầu mới: năm học mới, nhân viên mới vào công ty, chuyển nhà. Đây là từ rất hay gặp trên TV và quảng cáo.",
    bodyMd: `## 新生活 (しんせいかつ) — Cuộc sống mới

Tháng 4 = tất cả bắt đầu mới ở Nhật: trường mới, việc mới, nhà mới. Siêu thị tràn ngập quảng cáo 新生活応援セール.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 新生活 | しんせいかつ | Cuộc sống mới | N3 |
| 入社式 | にゅうしゃしき | Lễ nhận nhân viên mới | N2 |
| 入学式 | にゅうがくしき | Lễ nhập học | N3 |
| 引っ越し | ひっこし | Chuyển nhà | N3 |
| 新入社員 | しんにゅうしゃいん | Nhân viên mới | N3 |
| 歓迎会 | かんげいかい | Tiệc chào mừng | N3 |

---

### 💬 Câu ví dụ

**1.** 新生活の準備はできましたか。
> しんせいかつのじゅんびはできましたか。
> Chuẩn bị cho cuộc sống mới xong chưa?

**2.** 4月から新入社員が入ってきます。
> 4がつからしんにゅうしゃいんがはいってきます。
> Từ tháng 4 sẽ có nhân viên mới vào.

**3.** 歓迎会はいつにしましょうか。
> かんげいかいはいつにしましょうか。
> Tiệc chào mừng tổ chức khi nào nhỉ?

---

### 🏢 Lưu ý business

Tháng 4 công ty bận rộn với 入社式 và OJT. Câu hay dùng:
「新年度もよろしくお願いいたします」→ Năm tài chính mới cũng xin được hợp tác.`,
  },
  {
    title: "Từ theo mùa — Tuần lễ vàng",
    japaneseText: "ゴールデンウィーク",
    readingText: "ゴールデンウィーク",
    explanationText:
      "Kỳ nghỉ dài cuối tháng 4 – đầu tháng 5 (thường 4–10 ngày liên tiếp). Viết tắt: GW. Đây là kỳ nghỉ dài thứ 2 trong năm sau 年末年始.",
    bodyMd: `## ゴールデンウィーク (GW) — Tuần lễ vàng

Kỳ nghỉ liên tiếp từ 29/4 đến 5/5, bao gồm nhiều ngày lễ: 昭和の日, 憲法記念日, みどりの日, こどもの日.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| ゴールデンウィーク | ゴールデンウィーク | Tuần lễ vàng (GW) | N3 |
| 大型連休 | おおがたれんきゅう | Kỳ nghỉ dài (nói chung) | N2 |
| 渋滞 | じゅうたい | Tắc đường | N3 |
| 帰省 | きせい | Về quê | N2 |
| 旅行 | りょこう | Du lịch | N4 |
| 混雑 | こんざつ | Đông đúc, chen chúc | N3 |

---

### 💬 Câu ví dụ

**1.** GWの予定はもう決まりましたか。
> ゴールデンウィークのよていはもうきまりましたか。
> Kế hoạch GW đã quyết chưa?

**2.** GW中は高速道路が渋滞します。
> ゴールデンウィークちゅうはこうそくどうろがじゅうたいします。
> Trong GW đường cao tốc tắc nghẽn.

**3.** 今年のGWは実家に帰省します。
> ことしのゴールデンウィークはじっかにきせいします。
> GW năm nay tôi về quê.

---

### 🏢 Dùng ở công ty

「GW明けに打ち合わせをしましょう」→ Sau GW mình họp nhé.
「連休前にこの件を終わらせましょう」→ Trước kỳ nghỉ dài phải xong việc này.`,
  },
  {
    title: "Từ theo mùa — Mùa xuân phấn hoa",
    japaneseText: "花粉症",
    readingText: "かふんしょう",
    explanationText:
      "Dị ứng phấn hoa — bệnh 'quốc dân' mùa xuân Nhật. Khoảng 1/3 dân số Nhật bị ảnh hưởng từ tháng 2 đến tháng 4.",
    bodyMd: `## 花粉症 (かふんしょう) — Dị ứng phấn hoa

Từ tháng 2 đến tháng 4, phấn hoa cây tuyết tùng (スギ) và cây hinoki (ヒノキ) bay đầy. Đây là chủ đề small talk rất phổ biến.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 花粉症 | かふんしょう | Dị ứng phấn hoa | N3 |
| 花粉 | かふん | Phấn hoa | N3 |
| マスク | マスク | Khẩu trang | N4 |
| 目薬 | めぐすり | Thuốc nhỏ mắt | N3 |
| くしゃみ | くしゃみ | Hắt hơi | N3 |
| 鼻水 | はなみず | Nước mũi | N3 |

---

### 💬 Câu ví dụ

**1.** 花粉症がひどくて辛いです。
> かふんしょうがひどくてつらいです。
> Dị ứng phấn hoa nặng quá, khổ lắm.

**2.** 今日は花粉がすごいですね。
> きょうはかふんがすごいですね。
> Hôm nay phấn hoa nhiều quá nhỉ.

**3.** マスクをしていても目がかゆいです。
> マスクをしていてもめがかゆいです。
> Dù đeo khẩu trang mà mắt vẫn ngứa.

---

### 🏢 Small talk ở công ty

「花粉症ですか？大変ですね」→ Bạn bị dị ứng phấn hoa à? Vất vả nhỉ.
「今年の花粉は去年よりひどいらしいです」→ Nghe nói năm nay phấn hoa nặng hơn năm ngoái.`,
  },
  {
    title: "Từ theo mùa — Gió lạnh mùa đông",
    japaneseText: "木枯らし",
    readingText: "こがらし",
    explanationText:
      "Gió bấc lạnh lẽo thổi mạnh cuối thu – đầu đông (tháng 10–11). 木枯らし1号 (cơn gió bấc đầu tiên) được đài khí tượng công bố mỗi năm.",
    bodyMd: `## 木枯らし (こがらし) — Gió bấc mùa đông

Gió lạnh mạnh báo hiệu đông đến. 木 (cây) + 枯らし (làm khô héo) — gió khiến cây trụi lá.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 木枯らし | こがらし | Gió bấc (lạnh, mạnh) | N1 |
| 冬支度 | ふゆじたく | Chuẩn bị đón đông | N1 |
| 暖房 | だんぼう | Sưởi ấm / máy sưởi | N3 |
| マフラー | マフラー | Khăn quàng cổ | N3 |
| 手袋 | てぶくろ | Găng tay | N4 |
| 冬将軍 | ふゆしょうぐん | "Tướng quân mùa đông" (đợt lạnh) | N1 |

---

### 💬 Câu ví dụ

**1.** 今朝は木枯らしが吹いて寒かったですね。
> けさはこがらしがふいてさむかったですね。
> Sáng nay gió bấc thổi lạnh quá nhỉ.

**2.** そろそろ冬支度をしなきゃ。
> そろそろふゆじたくをしなきゃ。
> Sắp phải chuẩn bị đồ đông rồi.

**3.** マフラーと手袋を忘れないでね。
> マフラーとてぶくろをわすれないでね。
> Đừng quên khăn và găng tay nhé.

---

### 📺 Tin tức mùa đông

「木枯らし1号が吹きました」— NHK đưa tin mỗi năm khi cơn gió bấc đầu tiên được ghi nhận.`,
  },
  {
    title: "Từ theo mùa — Suối nước nóng mùa đông",
    japaneseText: "温泉",
    readingText: "おんせん",
    explanationText:
      "Suối nước nóng tự nhiên — đặc sản văn hoá Nhật Bản. Mùa đông là thời điểm lý tưởng để ngâm onsen. Cả nước Nhật có trên 3,000 khu onsen.",
    bodyMd: `## 温泉 (おんせん) — Suối nước nóng

Mùa đông Nhật Bản = mùa onsen. Ngâm mình trong nước nóng tự nhiên giữa tuyết trắng là trải nghiệm đỉnh cao.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 温泉 | おんせん | Suối nước nóng | N4 |
| 露天風呂 | ろてんぶろ | Bể tắm ngoài trời | N2 |
| 湯 | ゆ | Nước nóng | N3 |
| 入浴 | にゅうよく | Tắm (trang trọng) | N2 |
| 効能 | こうのう | Công dụng, hiệu quả | N2 |
| 泉質 | せんしつ | Chất nước suối | N1 |

---

### 💬 Câu ví dụ

**1.** 冬は温泉に行きたくなりますね。
> ふゆはおんせんにいきたくなりますね。
> Mùa đông lại muốn đi onsen nhỉ.

**2.** 露天風呂から雪景色が見えます。
> ろてんぶろからゆきげしきがみえます。
> Từ bể tắm ngoài trời nhìn thấy tuyết.

**3.** この温泉は肌にいい泉質ですよ。
> このおんせんははだにいいせんしつですよ。
> Suối nước nóng này có chất nước tốt cho da đó.

---

### 🗾 Onsen nổi tiếng

箱根 (Hakone), 別府 (Beppu), 草津 (Kusatsu), 下呂 (Gero) — top 4 khu onsen Nhật Bản.`,
  },
  {
    title: "Từ theo mùa — Ngày Valentine & White Day",
    japaneseText: "バレンタインデー",
    readingText: "バレンタインデー",
    explanationText:
      "14/2 ở Nhật: nữ tặng chocolate cho nam. 14/3 (White Day): nam đáp lễ. Có 2 loại: 義理チョコ (cho đồng nghiệp) và 本命チョコ (cho người yêu).",
    bodyMd: `## バレンタインデー — Valentine ở Nhật

Ngày Valentine Nhật Bản khác phương Tây: nữ tặng chocolate, nam nhận. 1 tháng sau (14/3) nam đáp lễ.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| バレンタインデー | バレンタインデー | Ngày Valentine | N3 |
| ホワイトデー | ホワイトデー | White Day (14/3) | N3 |
| 義理チョコ | ぎりチョコ | Chocolate xã giao | N2 |
| 本命チョコ | ほんめいチョコ | Chocolate cho người thương | N2 |
| 手作り | てづくり | Tự làm tay | N3 |
| お返し | おかえし | Quà đáp lễ | N3 |

---

### 💬 Câu ví dụ

**1.** 今年の義理チョコはどうしますか。
> ことしのぎりチョコはどうしますか。
> Năm nay chocolate xã giao làm sao đây?

**2.** ホワイトデーのお返し、何がいいかな。
> ホワイトデーのおかえし、なにがいいかな。
> Quà đáp lễ White Day, gì tốt nhỉ.

**3.** 手作りチョコをもらって嬉しかったです。
> てづくりチョコをもらってうれしかったです。
> Nhận được chocolate tự làm, vui quá.

---

### 🏢 Lưu ý công sở

Nhiều công ty Nhật đang bỏ dần 義理チョコ vì sợ gây áp lực. Xu hướng mới: 自分チョコ (mua cho chính mình).`,
  },
  {
    title: "Từ theo mùa — Hè đến: Tanabata",
    japaneseText: "七夕",
    readingText: "たなばた",
    explanationText:
      "Lễ hội Tanabata (7/7) — ngày Ngưu Lang Chức Nữ gặp nhau. Mọi người viết điều ước lên 短冊 (tanzaku — giấy màu) treo lên cành tre.",
    bodyMd: `## 七夕 (たなばた) — Lễ hội Ngưu Lang Chức Nữ

Ngày 7/7, người Nhật viết ước nguyện lên giấy màu và treo lên cành tre. Nguồn gốc từ truyền thuyết Trung Hoa.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 七夕 | たなばた | Lễ Tanabata (7/7) | N3 |
| 短冊 | たんざく | Giấy viết điều ước | N2 |
| 笹 | ささ | Cành tre nhỏ | N2 |
| 願い事 | ねがいごと | Điều ước | N3 |
| 天の川 | あまのがわ | Dải Ngân Hà | N2 |
| 織姫と彦星 | おりひめとひこぼし | Chức Nữ và Ngưu Lang | N2 |

---

### 💬 Câu ví dụ

**1.** 七夕に何を願いますか。
> たなばたになにをねがいますか。
> Tanabata bạn ước gì?

**2.** 短冊に願い事を書きましょう。
> たんざくにねがいごとをかきましょう。
> Hãy viết điều ước lên tanzaku nhé.

**3.** 今夜は天の川が見えるかな。
> こんやはあまのがわがみえるかな。
> Tối nay liệu có thấy Dải Ngân Hà không nhỉ.

---

### 🎋 Văn hoá

Sendai Tanabata Festival (仙台七夕祭り) — lễ hội Tanabata lớn nhất Nhật, tổ chức ngày 6–8 tháng 8.`,
  },
  {
    title: "Từ theo mùa — Obon: Lễ Vu Lan",
    japaneseText: "お盆",
    readingText: "おぼん",
    explanationText:
      "Lễ Obon (13–16 tháng 8) — tưởng nhớ tổ tiên. Nhiều người về quê, công ty cho nghỉ 1 tuần. Là kỳ nghỉ hè quan trọng nhất.",
    bodyMd: `## お盆 (おぼん) — Lễ Vu Lan / Obon

Khoảng 13–16/8, gia đình đoàn tụ, thăm mộ tổ tiên. Nhiều công ty nghỉ cả tuần (お盆休み).

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| お盆 | おぼん | Lễ Obon (Vu Lan) | N3 |
| お盆休み | おぼんやすみ | Kỳ nghỉ Obon | N3 |
| 帰省 | きせい | Về quê | N2 |
| お墓参り | おはかまいり | Thăm mộ | N3 |
| 盆踊り | ぼんおどり | Múa Bon (điệu nhảy truyền thống) | N2 |
| ご先祖様 | ごせんぞさま | Tổ tiên | N2 |

---

### 💬 Câu ví dụ

**1.** お盆は実家に帰りますか。
> おぼんはじっかにかえりますか。
> Obon bạn có về quê không?

**2.** お盆休みにお墓参りに行きました。
> おぼんやすみにおはかまいりにいきました。
> Nghỉ Obon tôi đã đi thăm mộ.

**3.** 盆踊りに参加しませんか。
> ぼんおどりにさんかしませんか。
> Tham gia múa Bon không?

---

### 🚄 Lưu ý thực tế

Tàu shinkansen, máy bay đều chật kín. Nếu đi du lịch dịp Obon: đặt vé sớm ít nhất 1 tháng.`,
  },
  {
    title: "Từ theo mùa — Tiết Setsubun: Xua đuổi quỷ",
    japaneseText: "節分",
    readingText: "せつぶん",
    explanationText:
      "Ngày 3/2 — ném đậu nành để xua đuổi quỷ (鬼は外、福は内). Ăn 恵方巻 (ehōmaki — cuộn sushi may mắn) quay về hướng tốt.",
    bodyMd: `## 節分 (せつぶん) — Xua quỷ đón phúc

Ngày 3/2: ném đậu và hô「鬼は外！福は内！」(Quỷ ra ngoài! Phúc vào trong!). Trẻ em rất thích.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 節分 | せつぶん | Tiết Setsubun (3/2) | N3 |
| 豆まき | まめまき | Ném đậu (xua quỷ) | N2 |
| 鬼 | おに | Quỷ | N3 |
| 恵方巻 | えほうまき | Cuộn sushi may mắn | N2 |
| 恵方 | えほう | Hướng may mắn (thay đổi mỗi năm) | N2 |
| 福 | ふく | Phúc, may mắn | N3 |

---

### 💬 Câu ví dụ

**1.** 鬼は外！福は内！
> おにはそと！ふくはうち！
> Quỷ ra ngoài! Phúc vào trong!

**2.** 今年の恵方は南南東ですよ。
> ことしのえほうはなんなんとうですよ。
> Năm nay hướng may mắn là Nam-Nam-Đông đó.

**3.** 恵方巻を丸かぶりしましたか。
> えほうまきをまるかぶりしましたか。
> Bạn đã ăn nguyên cuộn ehōmaki chưa?

---

### 🎭 Quy tắc ăn Ehōmaki

1. Quay về hướng may mắn năm đó
2. Không nói chuyện
3. Ăn hết nguyên cuộn không cắt
→ Ước nguyện sẽ thành hiện thực!`,
  },
  {
    title: "Từ theo mùa — Mùa hè: Lễ hội",
    japaneseText: "夏祭り",
    readingText: "なつまつり",
    explanationText:
      "Lễ hội mùa hè — mặc yukata, ăn đồ lễ hội ở 屋台, chơi 金魚すくい (vớt cá vàng), xem pháo hoa. Diễn ra khắp Nhật từ tháng 7 đến tháng 8.",
    bodyMd: `## 夏祭り (なつまつり) — Lễ hội mùa hè

Mùa hè = mùa lễ hội. Mặc yukata, ăn takoyaki, chơi trò chơi truyền thống — trải nghiệm Nhật Bản nhất.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 夏祭り | なつまつり | Lễ hội mùa hè | N3 |
| 屋台 | やたい | Quầy hàng rong lễ hội | N3 |
| 金魚すくい | きんぎょすくい | Vớt cá vàng (trò chơi) | N3 |
| かき氷 | かきごおり | Đá bào | N3 |
| 盆踊り | ぼんおどり | Múa Bon | N2 |
| 神輿 | みこし | Kiệu thần | N2 |

---

### 💬 Câu ví dụ

**1.** 夏祭りに行きませんか。
> なつまつりにいきませんか。
> Đi lễ hội mùa hè không?

**2.** 屋台でたこ焼きを食べましょう。
> やたいでたこやきをたべましょう。
> Ăn takoyaki ở quầy lễ hội đi.

**3.** 金魚すくいは難しいけど楽しい。
> きんぎょすくいはむずかしいけどたのしい。
> Vớt cá vàng khó nhưng vui.

---

### 🏮 Tips

Mua yukata ở UNIQLO hoặc cửa hàng second-hand. Đến lễ hội sớm (17:00) để tránh đông.`,
  },
  {
    title: "Từ theo mùa — Hoa mai mùa xuân",
    japaneseText: "梅",
    readingText: "うめ",
    explanationText:
      "Hoa mai nở sớm hơn anh đào (tháng 2–3), báo hiệu xuân sắp đến. 梅 còn là nguyên liệu làm 梅干し (mơ muối) và 梅酒 (rượu mơ).",
    bodyMd: `## 梅 (うめ) — Hoa mai / Quả mơ

Hoa mai nở trước anh đào, là dấu hiệu đầu tiên của mùa xuân. Quả mơ dùng làm rượu mơ và mơ muối.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 梅 | うめ | Mai / mơ | N3 |
| 梅干し | うめぼし | Mơ muối | N3 |
| 梅酒 | うめしゅ | Rượu mơ | N3 |
| 梅園 | ばいえん | Vườn mai | N2 |
| 早春 | そうしゅん | Đầu xuân | N2 |
| 春の訪れ | はるのおとずれ | Xuân sang | N2 |

---

### 💬 Câu ví dụ

**1.** 梅の花が咲き始めましたね。
> うめのはながさきはじめましたね。
> Hoa mai bắt đầu nở rồi nhỉ.

**2.** 梅酒を漬ける季節ですね。
> うめしゅをつけるきせつですね。
> Đến mùa ngâm rượu mơ rồi nhỉ.

**3.** 梅干しはご飯に合いますよね。
> うめぼしはごはんにあいますよね。
> Mơ muối hợp với cơm nhỉ.

---

### 🌸 So sánh

| | 梅 (Mai) | 桜 (Anh đào) |
|---|---|---|
| Thời gian | Tháng 2–3 | Tháng 3–4 |
| Hương | Thơm ngát | Hầu như không mùi |
| Quả | Dùng làm thực phẩm | Không ăn được |`,
  },
  {
    title: "Từ theo mùa — Mùa xuân: Lễ tốt nghiệp",
    japaneseText: "卒業式",
    readingText: "そつぎょうしき",
    explanationText:
      "Lễ tốt nghiệp diễn ra tháng 3 ở Nhật. Đây là thời điểm chia tay và bắt đầu mới. Học sinh thường khóc và tặng nút áo thứ hai (第二ボタン).",
    bodyMd: `## 卒業式 (そつぎょうしき) — Lễ tốt nghiệp

Tháng 3 = mùa chia tay. Lễ tốt nghiệp ở Nhật rất trang trọng và cảm động.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 卒業式 | そつぎょうしき | Lễ tốt nghiệp | N3 |
| 卒業 | そつぎょう | Tốt nghiệp | N4 |
| 送別会 | そうべつかい | Tiệc chia tay | N3 |
| 思い出 | おもいで | Kỷ niệm | N3 |
| 第二ボタン | だいにボタン | Nút áo thứ 2 (tặng crush) | N2 |
| 感動 | かんどう | Cảm động | N3 |

---

### 💬 Câu ví dụ

**1.** 卒業おめでとうございます。
> そつぎょうおめでとうございます。
> Chúc mừng tốt nghiệp.

**2.** 3月は別れの季節ですね。
> 3がつはわかれのきせつですね。
> Tháng 3 là mùa chia tay nhỉ.

**3.** 送別会を開きましょう。
> そうべつかいをひらきましょう。
> Tổ chức tiệc chia tay thôi.

---

### 🏢 Dùng ở công ty

Tháng 3 cũng là mùa 人事異動 (jinjiidō — điều chuyển nhân sự). Đồng nghiệp chuyển bộ phận/chi nhánh.
「今までお世話になりました」→ Cảm ơn đã giúp đỡ lâu nay.`,
  },
  {
    title: "Từ theo mùa — Cá chép bay trời",
    japaneseText: "鯉のぼり",
    readingText: "こいのぼり",
    explanationText:
      "Cờ cá chép bay trước nhà — biểu tượng Ngày Thiếu nhi (5/5). Mỗi con cá đại diện cho 1 thành viên gia đình. Cá chép tượng trưng cho sức mạnh và kiên cường.",
    bodyMd: `## 鯉のぼり (こいのぼり) — Cá chép bay

Ngày 5/5 (こどもの日 — Ngày Thiếu nhi), nhà có con trai treo cờ cá chép để cầu mong con khoẻ mạnh.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 鯉のぼり | こいのぼり | Cờ cá chép | N3 |
| こどもの日 | こどものひ | Ngày Thiếu nhi (5/5) | N4 |
| 端午の節句 | たんごのせっく | Tết Đoan Ngọ | N2 |
| 兜 | かぶと | Mũ giáp samurai (trang trí) | N2 |
| 柏餅 | かしわもち | Bánh mochi lá sồi | N2 |
| 菖蒲湯 | しょうぶゆ | Tắm nước lá xương bồ | N1 |

---

### 💬 Câu ví dụ

**1.** 近所に大きな鯉のぼりが泳いでいますよ。
> きんじょにおおきなこいのぼりがおよいでいますよ。
> Gần đây có cá chép lớn bay đó.

**2.** こどもの日は何をしますか。
> こどものひはなにをしますか。
> Ngày Thiếu nhi bạn làm gì?

**3.** 柏餅を食べるのが楽しみです。
> かしわもちをたべるのがたのしみです。
> Mong được ăn bánh mochi lá sồi.

---

### 🎏 Ý nghĩa

Cá chép bơi ngược dòng thác → tượng trưng cho sự kiên cường. Cha mẹ mong con mạnh mẽ vượt khó.`,
  },
  {
    title: "Từ theo mùa — Giáng sinh Nhật Bản",
    japaneseText: "クリスマス",
    readingText: "クリスマス",
    explanationText:
      "Giáng sinh ở Nhật không phải lễ tôn giáo mà là sự kiện thương mại/lãng mạn. Cặp đôi đi hẹn hò, gia đình ăn gà rán KFC và bánh kem.",
    bodyMd: `## クリスマス — Giáng sinh kiểu Nhật

Ở Nhật, Giáng sinh = ngày hẹn hò lãng mạn. Truyền thống: ăn gà rán KFC + bánh Christmas cake.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| クリスマス | クリスマス | Giáng sinh | N4 |
| イルミネーション | イルミネーション | Đèn trang trí sáng | N3 |
| クリスマスケーキ | クリスマスケーキ | Bánh kem Giáng sinh | N4 |
| プレゼント | プレゼント | Quà tặng | N4 |
| クリスマスイブ | クリスマスイブ | Đêm Giáng sinh (24/12) | N4 |
| 聖なる夜 | せいなるよる | Đêm thánh (Holy Night) | N2 |

---

### 💬 Câu ví dụ

**1.** クリスマスイブの予定はありますか。
> クリスマスイブのよていはありますか。
> Đêm Giáng sinh bạn có kế hoạch không?

**2.** イルミネーションを見に行きましょう。
> イルミネーションをみにいきましょう。
> Đi xem đèn trang trí Giáng sinh đi.

**3.** KFCのチキンを予約しましたか。
> ケーエフシーのチキンをよやくしましたか。
> Đặt gà KFC chưa?

---

### 🍗 Sự thật thú vị

KFC Nhật phải đặt trước vài tuần! Truyền thống này bắt đầu từ chiến dịch marketing năm 1974.`,
  },
  {
    title: "Từ theo mùa — Năm mới: Osechi",
    japaneseText: "おせち料理",
    readingText: "おせちりょうり",
    explanationText:
      "Bộ món ăn năm mới đựng trong hộp nhiều tầng (重箱). Mỗi món mang ý nghĩa may mắn: 数の子 (trứng cá trích — con cháu đông), 黒豆 (đậu đen — sức khoẻ)...",
    bodyMd: `## おせち料理 (おせちりょうり) — Món ăn năm mới

Bộ món truyền thống đựng trong hộp 重箱 (jūbako — hộp xếp tầng). Mỗi món đều có ý nghĩa tốt lành.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| おせち料理 | おせちりょうり | Món ăn năm mới | N2 |
| 重箱 | じゅうばこ | Hộp xếp tầng | N2 |
| 数の子 | かずのこ | Trứng cá trích (nhiều con) | N1 |
| 黒豆 | くろまめ | Đậu đen (sức khoẻ) | N2 |
| お雑煮 | おぞうに | Súp mochi năm mới | N2 |
| 年越しそば | としこしそば | Mì soba đêm giao thừa | N3 |

---

### 💬 Câu ví dụ

**1.** 今年のおせちは手作りですか。
> ことしのおせちはてづくりですか。
> Năm nay osechi tự làm à?

**2.** 年越しそばは食べましたか。
> としこしそばはたべましたか。
> Bạn đã ăn mì giao thừa chưa?

**3.** おせちの黒豆が一番好きです。
> おせちのくろまめがいちばんすきです。
> Trong osechi tôi thích đậu đen nhất.

---

### 🎍 Ý nghĩa các món

| Món | Ý nghĩa |
|---|---|
| 数の子 | Con cháu đông đúc |
| 黒豆 | Làm việc chăm chỉ (まめ = siêng) |
| 海老 | Sống thọ (lưng cong như ông già) |
| 昆布巻き | Vui vẻ (よろこぶ → こんぶ) |`,
  },
  {
    title: "Từ theo mùa — Trời mưa phùn mùa xuân",
    japaneseText: "春雨",
    readingText: "はるさめ",
    explanationText:
      "Mưa phùn nhẹ mùa xuân, rơi lất phất như sợi miến. Thú vị: 春雨 cũng là tên loại miến trong ẩm thực Nhật!",
    bodyMd: `## 春雨 (はるさめ) — Mưa phùn xuân

Mưa nhẹ rơi lất phất vào mùa xuân. Từ này cũng có nghĩa là "miến" (vì sợi miến giống tia mưa).

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 春雨 | はるさめ | Mưa phùn xuân / miến | N2 |
| 霧雨 | きりさめ | Mưa bụi, mưa sương | N2 |
| にわか雨 | にわかあめ | Mưa rào bất chợt | N3 |
| 小雨 | こさめ | Mưa nhỏ | N3 |
| 花散らし | はなちらし | Mưa/gió làm rụng hoa anh đào | N1 |
| うららか | うららか | (Trời xuân) ấm áp, trong trẻo | N1 |

---

### 💬 Câu ví dụ

**1.** 春雨が降っていて、気持ちいいですね。
> はるさめがふっていて、きもちいいですね。
> Mưa phùn xuân rơi, dễ chịu nhỉ.

**2.** 傘なしでも大丈夫そうな小雨ですね。
> かさなしでもだいじょうぶそうなこさめですね。
> Mưa nhỏ, không cần ô cũng được nhỉ.

**3.** にわか雨に降られちゃいました。
> にわかあめにふられちゃいました。
> Bị mưa rào bất chợt rồi.

---

### 📝 Mẹo nhớ

春雨 (はるさめ):
- Mưa phùn xuân (thời tiết)
- Miến (ẩm thực) — vì sợi miến mỏng như tia mưa xuân!`,
  },
  {
    title: "Từ theo mùa — Mùa đông: Kotatsu",
    japaneseText: "こたつ",
    readingText: "こたつ",
    explanationText:
      "Bàn sưởi truyền thống Nhật — bàn thấp có chăn phủ và bộ sưởi bên dưới. Mùa đông ai cũng muốn ngồi vào kotatsu và không muốn ra.",
    bodyMd: `## こたつ — Bàn sưởi truyền thống

Bàn thấp + chăn dày + bộ sưởi điện bên dưới = thiên đường mùa đông Nhật Bản.

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| こたつ | こたつ | Bàn sưởi | N3 |
| みかん | みかん | Quýt (ăn kèm kotatsu!) | N4 |
| 暖かい | あたたかい | Ấm áp | N4 |
| ぬくぬく | ぬくぬく | Ấm sực (onomatopoeia) | N2 |
| 冬ごもり | ふゆごもり | Ở yên trong nhà mùa đông | N1 |
| 鍋料理 | なべりょうり | Lẩu (món mùa đông) | N3 |

---

### 💬 Câu ví dụ

**1.** こたつから出たくない。
> こたつからでたくない。
> Không muốn ra khỏi kotatsu.

**2.** こたつでみかんを食べるのが最高です。
> こたつでみかんをたべるのがさいこうです。
> Ngồi kotatsu ăn quýt là đỉnh cao.

**3.** 今日は寒いから鍋にしましょう。
> きょうはさむいからなべにしましょう。
> Hôm nay lạnh nên ăn lẩu nhé.

---

### 🍊 Văn hoá

「こたつ + みかん」là combo mùa đông kinh điển của mọi gia đình Nhật. Xuất hiện trong mọi anime/manga về mùa đông.`,
  },
  {
    title: "Từ theo mùa — Mùa hè: Kính gió",
    japaneseText: "風鈴",
    readingText: "ふうりん",
    explanationText:
      "Chuông gió — khi nghe tiếng kính leng keng, người Nhật cảm thấy mát mẻ hơn. Là biểu tượng âm thanh của mùa hè.",
    bodyMd: `## 風鈴 (ふうりん) — Chuông gió

Tiếng chuông gió = âm thanh mùa hè Nhật Bản. Người Nhật tin rằng nghe tiếng chuông sẽ cảm thấy mát hơn (心理的涼しさ).

---

### 📚 Từ vựng liên quan

| Từ | Đọc | Nghĩa | JLPT |
|---|---|---|---|
| 風鈴 | ふうりん | Chuông gió | N2 |
| 涼しげ | すずしげ | Trông mát mẻ | N2 |
| 縁側 | えんがわ | Hiên nhà (kiểu Nhật) | N2 |
| 打ち水 | うちみず | Tưới nước ra đường cho mát | N2 |
| 蚊取り線香 | かとりせんこう | Nhang đuổi muỗi | N3 |
| 夕涼み | ゆうすずみ | Hóng mát buổi chiều | N1 |

---

### 💬 Câu ví dụ

**1.** 風鈴の音が涼しげですね。
> ふうりんのおとがすずしげですね。
> Tiếng chuông gió nghe mát mẻ nhỉ.

**2.** 縁側で夕涼みしましょう。
> えんがわでゆうすずみしましょう。
> Hóng mát ở hiên nhà đi.

**3.** 打ち水をすると少し涼しくなりますよ。
> うちみずをするとすこしすずしくなりますよ。
> Tưới nước ra đường sẽ mát hơn đó.

---

### 🎐 Lễ hội chuông gió

川越 (Kawagoe) tổ chức 風鈴祭り hàng năm — hàng ngàn chuông gió treo khắp đền chùa.`,
  },
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const dates = generateDates(30);
  const locale = "vi";

  try {
    // Ensure vi-locale widget config for seasonal_word exists
    const configCheck = await client.query(
      `SELECT id FROM daily.daily_widget_config
       WHERE widget_kind = 'seasonal_word' AND locale = $1 LIMIT 1`,
      [locale]
    );

    let configId;
    if (configCheck.rowCount === 0) {
      const insert = await client.query(
        `INSERT INTO daily.daily_widget_config
         (id, widget_kind, enabled, display_order, locale, settings, created_at, updated_at)
         VALUES (gen_random_uuid(), 'seasonal_word', true, 3, $1, '{}', NOW(), NOW())
         RETURNING id`,
        [locale]
      );
      configId = insert.rows[0].id;
      console.log(`✅ Created seasonal_word widget config for locale=${locale}`);
    } else {
      configId = configCheck.rows[0].id;
    }

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const entry = seasonalWords[i % seasonalWords.length];

      // Check if already exists
      const existing = await client.query(
        `SELECT id FROM daily.daily_content_item
         WHERE widget_kind = 'seasonal_word' AND content_date = $1 AND locale = $2 LIMIT 1`,
        [date, locale]
      );

      if (existing.rowCount > 0) {
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO daily.daily_content_item
         (id, widget_config_id, widget_kind, content_date, locale, title,
          body_md, japanese_text, reading_text, explanation_text,
          source_provider, source_ref, payload, status, created_at, updated_at)
         VALUES (
           gen_random_uuid(), $1, 'seasonal_word', $2, $3, $4,
           $5, $6, $7, $8,
           'curated_seed', $9, '{}', 'published', NOW(), NOW()
         )`,
        [
          configId,
          date,
          locale,
          entry.title,
          entry.bodyMd,
          entry.japaneseText,
          entry.readingText,
          entry.explanationText,
          `seed-seasonal_word-${date}`,
        ]
      );
      inserted++;
    }

    console.log(`\n🎉 Seasonal words seeded!`);
    console.log(`   Inserted: ${inserted} | Skipped (already exist): ${skipped}`);
    console.log(`   Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
    console.log(`   Locale: ${locale}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
