/**
 * Seed thêm 15 public flashcard decks — workplace Japanese (mở rộng).
 * Bổ sung cho seed-flashcard-decks-workplace.ts, phủ thêm nhiều tình huống.
 *
 * Topics:
 * 11. 出張・移動 (Business trips & Travel)
 * 12. クレーム対応 (Handling complaints)
 * 13. 社内システム・IT環境 (Internal systems)
 * 14. 面接・採用 (Interviews & Recruitment)
 * 15. プロジェクト管理 (Project management)
 * 16. 数字・グラフ・データ (Numbers, graphs, data presentation)
 * 17. 接待・会食 (Business entertainment & dining)
 * 18. 上司への依頼・断り (Requesting/Declining with superiors)
 * 19. チームワーク・協力 (Teamwork & Collaboration)
 * 20. 転職・キャリア (Job change & Career)
 * 21. 社内規則・コンプライアンス (Company rules & Compliance)
 * 22. マーケティング・広報 (Marketing & PR)
 * 23. 経理・会計 (Accounting & Finance)
 * 24. 製造・品質管理 (Manufacturing & Quality)
 * 25. ビジネスカタカナ (Business katakana loanwords)
 *
 * Run: pnpm exec tsx database/scripts/seeds/content/seed-flashcard-decks-workplace-2.ts
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

import { createPrismaClient } from "../../../../packages/database/src/index.js";

const prisma = createPrismaClient();

interface CardData {
  front: string;
  back: string;
  reading?: string;
}

interface DeckData {
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  descriptionJa: string;
  cards: CardData[];
}

const DECKS: DeckData[] = [
  // ─── 11. Business Trips & Travel ─────────────────────────
  {
    titleVi: "Công tác & Di chuyển",
    titleJa: "出張・移動",
    descriptionVi: "Từ vựng và mẫu câu khi đi công tác, đặt vé, khách sạn, di chuyển",
    descriptionJa: "出張時の予約・移動・滞在に関する表現",
    cards: [
      { front: "出張", back: "Đi công tác", reading: "しゅっちょう" },
      { front: "出張報告書", back: "Báo cáo công tác", reading: "しゅっちょうほうこくしょ" },
      { front: "日帰り出張", back: "Công tác trong ngày (không qua đêm)", reading: "ひがえりしゅっちょう" },
      { front: "新幹線を予約する", back: "Đặt vé tàu Shinkansen", reading: "しんかんせんをよやくする" },
      { front: "経費精算", back: "Thanh toán chi phí / quyết toán công tác phí", reading: "けいひせいさん" },
      { front: "領収書をください。", back: "Cho tôi hóa đơn.", reading: "りょうしゅうしょをください。" },
      { front: "宿泊先", back: "Nơi ở / khách sạn (khi đi công tác)", reading: "しゅくはくさき" },
      { front: "出張手当", back: "Phụ cấp công tác", reading: "しゅっちょうてあて" },
      { front: "現地集合", back: "Tập trung tại hiện trường (không đi cùng từ công ty)", reading: "げんちしゅうごう" },
      { front: "交通費", back: "Chi phí đi lại", reading: "こうつうひ" },
      { front: "直行直帰", back: "Đi thẳng đến/về (không qua công ty)", reading: "ちょっこうちょっき" },
      { front: "チェックイン / チェックアウト", back: "Check-in / Check-out", reading: "チェックイン / チェックアウト" },
    ]
  },

  // ─── 12. Handling Complaints ──────────────────────────────
  {
    titleVi: "Xử lý khiếu nại",
    titleJa: "クレーム対応",
    descriptionVi: "Cách ứng xử khi tiếp nhận và xử lý khiếu nại từ khách hàng/đối tác",
    descriptionJa: "クレームを受けた際の基本的な対応表現",
    cards: [
      { front: "ご不便をおかけして申し訳ございません。", back: "Xin lỗi vì đã gây bất tiện.", reading: "ごふべんをおかけしてもうしわけございません。" },
      { front: "詳しい状況をお聞かせいただけますか。", back: "Anh/chị có thể cho biết chi tiết tình hình không?", reading: "くわしいじょうきょうをおきかせいただけますか。" },
      { front: "早急に確認いたします。", back: "Tôi sẽ xác nhận gấp.", reading: "さっきゅうにかくにんいたします。" },
      { front: "改善策を検討いたします。", back: "Tôi sẽ xem xét biện pháp cải thiện.", reading: "かいぜんさくをけんとういたします。" },
      { front: "お気持ちは十分に理解しております。", back: "Tôi hoàn toàn hiểu cảm nhận của quý khách.", reading: "おきもちはじゅうぶんにりかいしております。" },
      { front: "今後このようなことがないよう努めます。", back: "Từ nay chúng tôi sẽ cố gắng không để tái diễn.", reading: "こんごこのようなことがないようつとめます。" },
      { front: "責任者に代わります。", back: "Tôi chuyển cho người có trách nhiệm.", reading: "せきにんしゃにかわります。" },
      { front: "代替品をお送りいたします。", back: "Chúng tôi sẽ gửi sản phẩm thay thế.", reading: "だいたいひんをおおくりいたします。" },
      { front: "返金", back: "Hoàn tiền", reading: "へんきん" },
      { front: "再発防止", back: "Phòng ngừa tái phát", reading: "さいはつぼうし" },
      { front: "ご迷惑をおかけし大変申し訳ございません。", back: "Thành thật xin lỗi vì đã gây phiền muộn.", reading: "ごめいわくをおかけしたいへんもうしわけございません。" },
      { front: "原因を調査中です。", back: "Đang điều tra nguyên nhân.", reading: "げんいんをちょうさちゅうです。" },
    ]
  },

  // ─── 13. Internal Systems & IT Environment ───────────────
  {
    titleVi: "Hệ thống nội bộ & Môi trường IT",
    titleJa: "社内システム・IT環境",
    descriptionVi: "Từ vựng về hệ thống nội bộ, tài khoản, bảo mật thông tin trong công ty",
    descriptionJa: "社内のシステムやIT環境に関する用語",
    cards: [
      { front: "ログイン / ログアウト", back: "Đăng nhập / Đăng xuất", reading: "ログイン / ログアウト" },
      { front: "パスワードを変更する", back: "Đổi mật khẩu", reading: "パスワードをへんこうする" },
      { front: "アクセス権", back: "Quyền truy cập", reading: "アクセスけん" },
      { front: "社内ネットワーク", back: "Mạng nội bộ công ty", reading: "しゃないネットワーク" },
      { front: "VPN接続", back: "Kết nối VPN", reading: "VPNせつぞく" },
      { front: "情報漏洩", back: "Rò rỉ thông tin", reading: "じょうほうろうえい" },
      { front: "バックアップ", back: "Sao lưu dữ liệu", reading: "バックアップ" },
      { front: "共有フォルダ", back: "Thư mục dùng chung (shared folder)", reading: "きょうゆうフォルダ" },
      { front: "セキュリティ研修", back: "Tập huấn bảo mật", reading: "セキュリティけんしゅう" },
      { front: "個人情報保護", back: "Bảo vệ thông tin cá nhân", reading: "こじんじょうほうほご" },
      { front: "システム障害", back: "Sự cố hệ thống", reading: "システムしょうがい" },
      { front: "ヘルプデスク", back: "Help desk (bộ phận hỗ trợ IT)", reading: "ヘルプデスク" },
    ]
  },

  // ─── 14. Interviews & Recruitment ────────────────────────
  {
    titleVi: "Phỏng vấn & Tuyển dụng",
    titleJa: "面接・採用",
    descriptionVi: "Từ vựng dùng trong quy trình phỏng vấn xin việc tại công ty Nhật",
    descriptionJa: "就職・転職の面接で使う表現",
    cards: [
      { front: "志望動機", back: "Lý do ứng tuyển / động lực", reading: "しぼうどうき" },
      { front: "自己PR", back: "Tự giới thiệu điểm mạnh (self-PR)", reading: "じこPR" },
      { front: "長所 / 短所", back: "Điểm mạnh / Điểm yếu", reading: "ちょうしょ / たんしょ" },
      { front: "御社を志望した理由は〜です。", back: "Lý do tôi muốn vào quý công ty là ~.", reading: "おんしゃをしぼうしたりゆうは〜です。" },
      { front: "前職での経験を活かしたいと思います。", back: "Tôi muốn phát huy kinh nghiệm từ công việc trước.", reading: "ぜんしょくでのけいけんをいかしたいとおもいます。" },
      { front: "入社後は〜に貢献したいです。", back: "Sau khi vào công ty tôi muốn đóng góp cho ~.", reading: "にゅうしゃごは〜にこうけんしたいです。" },
      { front: "内定", back: "Được chấp nhận (offer letter)", reading: "ないてい" },
      { front: "履歴書", back: "Sơ yếu lý lịch (CV Nhật)", reading: "りれきしょ" },
      { front: "職務経歴書", back: "CV chi tiết kinh nghiệm làm việc", reading: "しょくむけいれきしょ" },
      { front: "書類選考", back: "Xét duyệt hồ sơ (vòng CV)", reading: "しょるいせんこう" },
      { front: "最終面接", back: "Phỏng vấn vòng cuối", reading: "さいしゅうめんせつ" },
      { front: "即戦力", back: "Nhân lực có thể làm việc ngay (không cần đào tạo)", reading: "そくせんりょく" },
    ]
  },

  // ─── 15. Project Management ──────────────────────────────
  {
    titleVi: "Quản lý dự án",
    titleJa: "プロジェクト管理",
    descriptionVi: "Từ vựng quản lý dự án, lập kế hoạch, theo dõi tiến độ trong công ty Nhật",
    descriptionJa: "プロジェクトの計画・進行管理の用語",
    cards: [
      { front: "スケジュール", back: "Lịch trình (schedule)", reading: "スケジュール" },
      { front: "マイルストーン", back: "Mốc quan trọng (milestone)", reading: "マイルストーン" },
      { front: "タスク", back: "Công việc cụ thể (task)", reading: "タスク" },
      { front: "締め切り / 期限", back: "Deadline / hạn chót", reading: "しめきり / きげん" },
      { front: "遅延", back: "Trễ tiến độ (delay)", reading: "ちえん" },
      { front: "リスク管理", back: "Quản lý rủi ro", reading: "リスクかんり" },
      { front: "工程表", back: "Bảng kế hoạch công đoạn (Gantt chart)", reading: "こうていひょう" },
      { front: "キックオフミーティング", back: "Họp khởi động dự án", reading: "キックオフミーティング" },
      { front: "振り返り / 反省会", back: "Họp rút kinh nghiệm (retrospective)", reading: "ふりかえり / はんせいかい" },
      { front: "担当割り振り", back: "Phân công nhiệm vụ", reading: "たんとうわりふり" },
      { front: "ボトルネック", back: "Điểm nghẽn (bottleneck)", reading: "ボトルネック" },
      { front: "優先順位をつける", back: "Sắp xếp thứ tự ưu tiên", reading: "ゆうせんじゅんいをつける" },
    ]
  },

  // ─── 16. Numbers, Graphs & Data ──────────────────────────
  {
    titleVi: "Số liệu, Biểu đồ & Trình bày dữ liệu",
    titleJa: "数字・グラフ・データ発表",
    descriptionVi: "Cách diễn đạt số liệu, xu hướng, biểu đồ trong báo cáo và thuyết trình",
    descriptionJa: "データやグラフを説明する際の表現",
    cards: [
      { front: "前年比", back: "So với năm trước (YoY)", reading: "ぜんねんひ" },
      { front: "売上", back: "Doanh thu", reading: "うりあげ" },
      { front: "利益", back: "Lợi nhuận", reading: "りえき" },
      { front: "増加 / 減少", back: "Tăng / Giảm", reading: "ぞうか / げんしょう" },
      { front: "横ばい", back: "Đi ngang (không tăng không giảm)", reading: "よこばい" },
      { front: "棒グラフ / 円グラフ", back: "Biểu đồ cột / Biểu đồ tròn", reading: "ぼうグラフ / えんグラフ" },
      { front: "折れ線グラフ", back: "Biểu đồ đường", reading: "おれせんグラフ" },
      { front: "〜パーセント増加しました。", back: "Đã tăng ~%.", reading: "〜パーセントぞうかしました。" },
      { front: "目標達成率", back: "Tỷ lệ đạt mục tiêu", reading: "もくひょうたっせいりつ" },
      { front: "四半期", back: "Quý (Q1, Q2...)", reading: "しはんき" },
      { front: "この表が示す通り", back: "Như bảng này cho thấy...", reading: "このひょうがしめすとおり" },
      { front: "市場シェア", back: "Thị phần", reading: "しじょうシェア" },
    ]
  },

  // ─── 17. Business Entertainment & Dining ─────────────────
  {
    titleVi: "Tiếp khách & Hội thực (会食)",
    titleJa: "接待・会食",
    descriptionVi: "Cách ứng xử khi đi ăn với khách hàng, đối tác — văn hóa tiếp khách Nhật",
    descriptionJa: "接待や会食でのマナーと表現",
    cards: [
      { front: "接待", back: "Tiếp khách (chiêu đãi đối tác)", reading: "せったい" },
      { front: "会食", back: "Ăn cơm cùng (business dinner)", reading: "かいしょく" },
      { front: "乾杯！", back: "Chúc mừng! (Nâng ly)", reading: "かんぱい！" },
      { front: "お好きなものをどうぞ。", back: "Xin mời gọi món anh/chị thích.", reading: "おすきなものをどうぞ。" },
      { front: "ご馳走になります。", back: "Tôi xin phép được mời. (Khi được đãi)", reading: "ごちそうになります。" },
      { front: "お会計は弊社で持ちます。", back: "Công ty chúng tôi sẽ thanh toán.", reading: "おかいけいはへいしゃでもちます。" },
      { front: "上座 / 下座", back: "Ghế chính (khách/sếp) / Ghế phụ (người mời)", reading: "かみざ / しもざ" },
      { front: "アレルギーはありますか。", back: "Anh/chị có dị ứng gì không?", reading: "アレルギーはありますか。" },
      { front: "本日はお招きいただきありがとうございます。", back: "Cảm ơn đã mời tôi hôm nay.", reading: "ほんじつはおまねきいただきありがとうございます。" },
      { front: "二次会", back: "Tiệc vòng 2 (after-party)", reading: "にじかい" },
      { front: "お開きにしましょう。", back: "Chúng ta kết thúc (tại đây) nhé.", reading: "おひらきにしましょう。" },
      { front: "昨日はありがとうございました。", back: "Cảm ơn về ngày hôm qua. (Sáng hôm sau)", reading: "きのうはありがとうございました。" },
    ]
  },

  // ─── 18. Requesting & Declining with Superiors ───────────
  {
    titleVi: "Nhờ vả & Từ chối khéo với cấp trên",
    titleJa: "上司への依頼・断り方",
    descriptionVi: "Cách lịch sự khi nhờ sếp, xin phép, hoặc từ chối mà không mất lòng",
    descriptionJa: "上司や目上の人への依頼表現と丁寧な断り方",
    cards: [
      { front: "お時間をいただけますでしょうか。", back: "Anh/chị cho tôi xin chút thời gian được không?", reading: "おじかんをいただけますでしょうか。" },
      { front: "ご相談があるのですが。", back: "Tôi muốn trao đổi một chút ạ.", reading: "ごそうだんがあるのですが。" },
      { front: "お力添えいただけると助かります。", back: "Nếu được anh/chị hỗ trợ sẽ rất tốt.", reading: "おちからぞえいただけるとたすかります。" },
      { front: "申し訳ありませんが、今回は難しい状況です。", back: "Xin lỗi, lần này tình hình khó khăn (cách từ chối khéo).", reading: "もうしわけありませんが、こんかいはむずかしいじょうきょうです。" },
      { front: "前向きに検討させてください。", back: "Cho tôi xem xét tích cực ạ. (Từ chối mềm)", reading: "まえむきにけんとうさせてください。" },
      { front: "少し考える時間をいただけますか。", back: "Cho tôi chút thời gian suy nghĩ được không?", reading: "すこしかんがえるじかんをいただけますか。" },
      { front: "ご了承いただけますと幸いです。", back: "Mong anh/chị thông cảm.", reading: "ごりょうしょういただけますとさいわいです。" },
      { front: "代替案を提案してもよろしいでしょうか。", back: "Tôi đề xuất phương án thay thế được không ạ?", reading: "だいたいあんをていあんしてもよろしいでしょうか。" },
      { front: "休暇をいただきたいのですが。", back: "Tôi muốn xin nghỉ phép ạ.", reading: "きゅうかをいただきたいのですが。" },
      { front: "残業を減らしていただけると助かります。", back: "Nếu được giảm OT sẽ rất tốt ạ.", reading: "ざんぎょうをへらしていただけるとたすかります。" },
      { front: "ご期待に添えず申し訳ございません。", back: "Xin lỗi vì không đáp ứng được kỳ vọng.", reading: "ごきたいにそえずもうしわけございません。" },
      { front: "別の方法を検討させていただけますか。", back: "Cho tôi xem xét cách khác được không ạ?", reading: "べつのほうほうをけんとうさせていただけますか。" },
    ]
  },

  // ─── 19. Teamwork & Collaboration ────────────────────────
  {
    titleVi: "Làm việc nhóm & Hợp tác",
    titleJa: "チームワーク・協力",
    descriptionVi: "Biểu đạt khi phối hợp, hỗ trợ, phân công trong nhóm làm việc",
    descriptionJa: "チームでの協力・分担に関する表現",
    cards: [
      { front: "役割分担", back: "Phân chia vai trò", reading: "やくわりぶんたん" },
      { front: "情報共有", back: "Chia sẻ thông tin", reading: "じょうほうきょうゆう" },
      { front: "連携", back: "Phối hợp / liên kết", reading: "れんけい" },
      { front: "手伝いましょうか。", back: "Để tôi giúp nhé?", reading: "てつだいましょうか。" },
      { front: "お互い様です。", back: "Đâu có gì, giúp nhau mà. (Khi được cảm ơn)", reading: "おたがいさまです。" },
      { front: "フォローをお願いします。", back: "Nhờ anh/chị hỗ trợ (follow-up).", reading: "フォローをおねがいします。" },
      { front: "ブレインストーミング", back: "Brainstorming (động não nhóm)", reading: "ブレインストーミング" },
      { front: "合意形成", back: "Đạt được đồng thuận", reading: "ごういけいせい" },
      { front: "すり合わせ", back: "Trao đổi để thống nhất (alignment)", reading: "すりあわせ" },
      { front: "引き継ぎ", back: "Bàn giao công việc (handover)", reading: "ひきつぎ" },
      { front: "ダブルチェック", back: "Kiểm tra chéo (double check)", reading: "ダブルチェック" },
      { front: "一人で抱え込まないでください。", back: "Đừng ôm hết một mình nhé.", reading: "ひとりでかかえこまないでください。" },
    ]
  },

  // ─── 20. Job Change & Career ─────────────────────────────
  {
    titleVi: "Chuyển việc & Phát triển sự nghiệp",
    titleJa: "転職・キャリア",
    descriptionVi: "Từ vựng về chuyển việc, phát triển bản thân, thăng tiến sự nghiệp",
    descriptionJa: "転職活動やキャリアアップに関する表現",
    cards: [
      { front: "転職", back: "Chuyển việc (đổi công ty)", reading: "てんしょく" },
      { front: "キャリアアップ", back: "Thăng tiến sự nghiệp", reading: "キャリアアップ" },
      { front: "スキルアップ", back: "Nâng cao kỹ năng", reading: "スキルアップ" },
      { front: "退職理由", back: "Lý do nghỉ việc", reading: "たいしょくりゆう" },
      { front: "円満退社", back: "Nghỉ việc êm đẹp (không mâu thuẫn)", reading: "えんまんたいしゃ" },
      { front: "引き止め", back: "Giữ người (khi nhân viên muốn nghỉ)", reading: "ひきとめ" },
      { front: "年収", back: "Thu nhập năm", reading: "ねんしゅう" },
      { front: "福利厚生", back: "Phúc lợi (benefits)", reading: "ふくりこうせい" },
      { front: "ワークライフバランス", back: "Cân bằng công việc - cuộc sống", reading: "ワークライフバランス" },
      { front: "人材紹介会社", back: "Công ty giới thiệu nhân sự (headhunter)", reading: "じんざいしょうかいがいしゃ" },
      { front: "エージェント", back: "Agent tuyển dụng", reading: "エージェント" },
      { front: "自己成長", back: "Phát triển bản thân", reading: "じこせいちょう" },
    ]
  },

  // ─── 21. Company Rules & Compliance ──────────────────────
  {
    titleVi: "Nội quy & Tuân thủ (Compliance)",
    titleJa: "社内規則・コンプライアンス",
    descriptionVi: "Từ vựng về nội quy, đạo đức nghề nghiệp, tuân thủ pháp luật trong doanh nghiệp",
    descriptionJa: "会社のルールや法令遵守に関する用語",
    cards: [
      { front: "就業規則", back: "Nội quy lao động", reading: "しゅうぎょうきそく" },
      { front: "コンプライアンス", back: "Tuân thủ (compliance)", reading: "コンプライアンス" },
      { front: "ハラスメント", back: "Quấy rối (harassment)", reading: "ハラスメント" },
      { front: "パワハラ", back: "Quấy rối quyền lực (power harassment)", reading: "パワハラ" },
      { front: "セクハラ", back: "Quấy rối tình dục", reading: "セクハラ" },
      { front: "内部告発", back: "Tố giác nội bộ (whistleblowing)", reading: "ないぶこくはつ" },
      { front: "守秘義務", back: "Nghĩa vụ bảo mật", reading: "しゅひぎむ" },
      { front: "競業避止", back: "Cấm cạnh tranh (non-compete)", reading: "きょうぎょうひし" },
      { front: "勤怠管理", back: "Quản lý chấm công", reading: "きんたいかんり" },
      { front: "タイムカード", back: "Thẻ chấm công", reading: "タイムカード" },
      { front: "副業禁止", back: "Cấm làm thêm ngoài công ty", reading: "ふくぎょうきんし" },
      { front: "機密情報", back: "Thông tin mật", reading: "きみつじょうほう" },
    ]
  },

  // ─── 22. Marketing & PR ──────────────────────────────────
  {
    titleVi: "Marketing & Truyền thông",
    titleJa: "マーケティング・広報",
    descriptionVi: "Từ vựng marketing, quảng cáo, PR dùng trong môi trường doanh nghiệp Nhật",
    descriptionJa: "マーケティングや広報活動で使う用語",
    cards: [
      { front: "ターゲット層", back: "Đối tượng mục tiêu (target audience)", reading: "ターゲットそう" },
      { front: "ブランディング", back: "Xây dựng thương hiệu (branding)", reading: "ブランディング" },
      { front: "認知度", back: "Độ nhận biết thương hiệu", reading: "にんちど" },
      { front: "プレスリリース", back: "Thông cáo báo chí", reading: "プレスリリース" },
      { front: "キャンペーン", back: "Chiến dịch (campaign)", reading: "キャンペーン" },
      { front: "集客", back: "Thu hút khách hàng", reading: "しゅうきゃく" },
      { front: "コンバージョン率", back: "Tỷ lệ chuyển đổi (conversion rate)", reading: "コンバージョンりつ" },
      { front: "SNSマーケティング", back: "Marketing trên mạng xã hội", reading: "SNSマーケティング" },
      { front: "広告費", back: "Chi phí quảng cáo", reading: "こうこくひ" },
      { front: "顧客満足度", back: "Mức độ hài lòng khách hàng (CSAT)", reading: "こきゃくまんぞくど" },
      { front: "リピーター", back: "Khách hàng quay lại (repeat customer)", reading: "リピーター" },
      { front: "口コミ", back: "Truyền miệng (word of mouth)", reading: "くちコミ" },
    ]
  },

  // ─── 23. Accounting & Finance ────────────────────────────
  {
    titleVi: "Kế toán & Tài chính",
    titleJa: "経理・会計",
    descriptionVi: "Từ vựng kế toán, tài chính, thanh toán thường gặp trong công ty Nhật",
    descriptionJa: "経理部門や会計処理で使う基本用語",
    cards: [
      { front: "請求書", back: "Hóa đơn (invoice)", reading: "せいきゅうしょ" },
      { front: "見積書", back: "Bản báo giá", reading: "みつもりしょ" },
      { front: "発注書", back: "Đơn đặt hàng (PO)", reading: "はっちゅうしょ" },
      { front: "入金 / 出金", back: "Tiền vào / Tiền ra", reading: "にゅうきん / しゅっきん" },
      { front: "決算", back: "Quyết toán (fiscal year closing)", reading: "けっさん" },
      { front: "予算", back: "Ngân sách", reading: "よさん" },
      { front: "経費", back: "Chi phí (expense)", reading: "けいひ" },
      { front: "税込み / 税抜き", back: "Đã bao gồm thuế / Chưa thuế", reading: "ぜいこみ / ぜいぬき" },
      { front: "振込", back: "Chuyển khoản", reading: "ふりこみ" },
      { front: "月末締め翌月払い", back: "Chốt cuối tháng, thanh toán tháng sau", reading: "げつまつじめよくげつばらい" },
      { front: "消費税", back: "Thuế tiêu thụ (VAT Nhật)", reading: "しょうひぜい" },
      { front: "仮払い", back: "Tạm ứng", reading: "かりばらい" },
    ]
  },

  // ─── 24. Manufacturing & Quality ─────────────────────────
  {
    titleVi: "Sản xuất & Quản lý chất lượng",
    titleJa: "製造・品質管理",
    descriptionVi: "Từ vựng dùng trong nhà máy, dây chuyền sản xuất, kiểm tra chất lượng",
    descriptionJa: "製造現場や品質管理で使う用語",
    cards: [
      { front: "品質管理", back: "Quản lý chất lượng (QC)", reading: "ひんしつかんり" },
      { front: "不良品", back: "Sản phẩm lỗi", reading: "ふりょうひん" },
      { front: "検品", back: "Kiểm tra hàng (inspection)", reading: "けんぴん" },
      { front: "生産ライン", back: "Dây chuyền sản xuất", reading: "せいさんライン" },
      { front: "在庫", back: "Tồn kho (inventory)", reading: "ざいこ" },
      { front: "歩留まり", back: "Tỷ lệ thành phẩm đạt chuẩn (yield rate)", reading: "ぶどまり" },
      { front: "改善 (カイゼン)", back: "Cải tiến liên tục (Kaizen)", reading: "かいぜん" },
      { front: "5S", back: "5S: Sàng lọc, Sắp xếp, Sạch sẽ, Săn sóc, Sẵn sàng", reading: "ごエス" },
      { front: "ISO認証", back: "Chứng nhận ISO", reading: "ISOにんしょう" },
      { front: "安全衛生", back: "An toàn vệ sinh (lao động)", reading: "あんぜんえいせい" },
      { front: "納期遵守", back: "Tuân thủ deadline giao hàng", reading: "のうきじゅんしゅ" },
      { front: "原材料", back: "Nguyên vật liệu", reading: "げんざいりょう" },
    ]
  },

  // ─── 25. Business Katakana Loanwords ─────────────────────
  {
    titleVi: "Katakana kinh doanh thường gặp",
    titleJa: "ビジネスカタカナ用語",
    descriptionVi: "Các từ katakana mượn tiếng Anh phổ biến trong văn phòng Nhật (dễ nhầm nghĩa!)",
    descriptionJa: "日本のビジネスでよく使われるカタカナ語",
    cards: [
      { front: "アジェンダ", back: "Chương trình nghị sự (agenda)", reading: "アジェンダ" },
      { front: "エビデンス", back: "Bằng chứng / tài liệu chứng minh (evidence)", reading: "エビデンス" },
      { front: "コンセンサス", back: "Sự đồng thuận (consensus)", reading: "コンセンサス" },
      { front: "フィードバック", back: "Phản hồi (feedback)", reading: "フィードバック" },
      { front: "リソース", back: "Nguồn lực (resource)", reading: "リソース" },
      { front: "コミットする", back: "Cam kết (commit)", reading: "コミットする" },
      { front: "ペンディング", back: "Tạm hoãn / chờ xử lý (pending)", reading: "ペンディング" },
      { front: "バッファ", back: "Dự trữ / thời gian đệm (buffer)", reading: "バッファ" },
      { front: "ジャストアイデア", back: "Ý tưởng sơ bộ (chưa chắc chắn) — tiếng Nhật tạo", reading: "ジャストアイデア" },
      { front: "イニシアチブ", back: "Sáng kiến / quyền chủ động (initiative)", reading: "イニシアチブ" },
      { front: "アサインする", back: "Giao việc / phân công (assign)", reading: "アサインする" },
      { front: "ナレッジ", back: "Kiến thức tích lũy (knowledge)", reading: "ナレッジ" },
    ]
  },
];

async function main() {
  console.log("🃏 Seeding 15 public workplace flashcard decks (wave 2)...\n");

  for (const deckData of DECKS) {
    const existing = await prisma.deck.findFirst({
      where: { titleVi: deckData.titleVi, ownerUserId: null, visibility: "public" }
    });

    let deckId: string;

    if (existing) {
      await prisma.deck.update({
        where: { id: existing.id },
        data: {
          titleJa: deckData.titleJa,
          descriptionVi: deckData.descriptionVi,
          descriptionJa: deckData.descriptionJa,
        }
      });
      deckId = existing.id;

      await prisma.deckCard.deleteMany({ where: { deckId } });
      const orphanCards = await prisma.flashcardVariant.findMany({
        where: { deckLinks: { none: {} }, sourceType: "seed_workplace" }
      });
      if (orphanCards.length > 0) {
        await prisma.flashcardVariant.deleteMany({
          where: { id: { in: orphanCards.map((c) => c.id) } }
        });
      }
      console.log(`  ♻️  Updated: ${deckData.titleVi}`);
    } else {
      const deck = await prisma.deck.create({
        data: {
          titleVi: deckData.titleVi,
          titleJa: deckData.titleJa,
          descriptionVi: deckData.descriptionVi,
          descriptionJa: deckData.descriptionJa,
          visibility: "public",
          ownerUserId: null,
        }
      });
      deckId = deck.id;
      console.log(`  ✨ Created: ${deckData.titleVi}`);
    }

    for (let i = 0; i < deckData.cards.length; i++) {
      const c = deckData.cards[i]!;
      const card = await prisma.flashcardVariant.create({
        data: {
          frontText: c.front,
          backText: c.back,
          reading: c.reading ?? null,
          sourceType: "seed_workplace",
          sourceId: deckId,
        }
      });
      await prisma.deckCard.create({
        data: { deckId, cardId: card.id, position: i }
      });
    }
  }

  const totalCards = DECKS.reduce((sum, d) => sum + d.cards.length, 0);
  console.log(`\n✅ Done! ${DECKS.length} decks, ${totalCards} cards total.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
