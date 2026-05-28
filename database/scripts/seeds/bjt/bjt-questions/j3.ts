/**
 * BJT J3 Level Questions — 中級レベル (Intermediate)
 * Score range: 320-419
 *
 * Target: Learners who can handle meetings, basic presentations,
 * business documents, trip planning, moderate keigo, client communication.
 * Contexts: sales visits, internal meetings, business trip planning,
 * report writing, schedule coordination, client presentations.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J3_DATA: SeedLevelData = {
  level: "J3",
  slug: "bjt-j3-practice-v3",
  titleVi: "Đề luyện BJT J3 — Trung cấp",
  titleJa: "BJT J3 練習テスト — 中級レベル",
  sections: [
    {
      code: "LC_SCENE", titleVi: "Nắm bắt tình huống", titleJa: "場面把握問題",
      questions: [
        { prompt: "営業担当が取引先で「こちらが新しいカタログでございます。ぜひご覧ください」とカタログを差し出しています。", scenario: "取引先の応接室。テーブルに資料が広げてある。", explanationVi: "Nhân viên kinh doanh đang giới thiệu catalogue mới cho đối tác.", skillTag: "sales-presentation", difficulty: "easy", options: opts("製品のクレームを受けている。", "新しいカタログを紹介している。", "見積書を提出している。", "契約書にサインしている。", "B") },
        { prompt: "社員がプロジェクターにパソコンをつなぎながら「すみません、画面が映るまで少々お待ちください」と言っています。会議室に数人が座っています。", scenario: "会議室。プレゼンの準備中。", explanationVi: "Nhân viên đang chuẩn bị máy chiếu cho buổi thuyết trình.", skillTag: "presentation-setup", difficulty: "easy", options: opts("会議が終わったところです。", "プレゼンの準備をしています。", "パソコンを修理しています。", "動画を見ています。", "B") },
        { prompt: "部長と課長がグラフを見ながら「前年比で売上が15%伸びていますね」「はい、新製品の効果が大きいです」と話しています。", scenario: "部長室。売上報告のグラフがモニターに映っている。", explanationVi: "Trưởng phòng và phó phòng đang xem biểu đồ doanh thu, tăng 15% so với năm trước.", skillTag: "performance-review", difficulty: "standard", options: opts("人事評価の面談をしている。", "売上実績について報告している。", "新製品の企画を相談している。", "予算を削減する話をしている。", "B") },
        { prompt: "空港のロビーで社員がスーツケースを引きながら携帯電話で「はい、今空港に着きました。これからホテルに向かいます」と話しています。", scenario: "空港の到着ロビー。出張中の社員。", explanationVi: "Nhân viên vừa đến sân bay, đang gọi báo cáo cho công ty về tình trạng công tác.", skillTag: "business-trip-report", difficulty: "easy", options: opts("出張先から上司に報告している。", "旅行の予約をしている。", "タクシーを呼んでいる。", "ホテルにチェックインしている。", "A") },
        { prompt: "社員2人がホワイトボードの前で「納期は来月20日で、作業工程はこの3つに分けましょう」「人員は各工程2人ずつでどうですか」と議論しています。", scenario: "会議室。プロジェクトの計画会議。", explanationVi: "Hai nhân viên đang lập kế hoạch dự án: chia 3 giai đoạn, mỗi giai đoạn 2 người.", skillTag: "project-planning", difficulty: "standard", options: opts("プロジェクトの計画を立てている。", "人事異動について話している。", "残業時間を計算している。", "研修のスケジュールを決めている。", "A") },
        { prompt: "会議で司会が「では、営業部から今月の進捗報告をお願いします」と言い、営業部の社員が立ち上がって資料を配り始めています。", scenario: "定例会議。10人ほどの参加者。", explanationVi: "Người điều hành mời phòng kinh doanh báo cáo. Nhân viên kinh doanh đứng lên phát tài liệu.", skillTag: "meeting-progress", difficulty: "standard", options: opts("営業部が新しい提案をしている。", "月次の進捗報告が始まるところです。", "会議が終わったところです。", "営業部が研修を受けている。", "B") },
        { prompt: "社員がパソコンの画面で「出張申請書」というフォームに日程や行き先を入力しています。隣の社員が「行き先は大阪支社？」と聞いています。", scenario: "オフィスのデスク。", explanationVi: "Nhân viên đang điền đơn xin công tác trên máy tính — đi Osaka.", skillTag: "travel-request", difficulty: "standard", options: opts("有給休暇を申請している。", "出張の申請書を作成している。", "大阪支社に転勤する。", "交通費の精算をしている。", "B") },
        { prompt: "社員が展示会の会場で来場者に「弊社の最新技術についてご説明いたします。こちらのパネルをご覧ください」と案内しています。", scenario: "大きな展示会場。企業ブースに製品サンプルとパネルが並んでいる。", explanationVi: "Nhân viên hướng dẫn khách tham quan tại hội chợ triển lãm, giới thiệu công nghệ mới.", skillTag: "exhibition-presentation", difficulty: "hard", options: opts("工場見学をしている。", "展示会で自社の技術を紹介している。", "新入社員に研修をしている。", "取引先と契約を結んでいる。", "B") },
        { prompt: "課長がチームメンバーに「今回のクレーム、原因を調べて明日までに報告書を出して」と言っています。メンバーがノートに書き留めています。", scenario: "オフィス。緊急のミーティング。", explanationVi: "Trưởng nhóm yêu cầu điều tra nguyên nhân khiếu nại và nộp báo cáo trước ngày mai.", skillTag: "complaint-investigation", difficulty: "hard", options: opts("新製品の開発について相談している。", "クレームの原因調査を指示している。", "報告書の書き方を教えている。", "明日の会議の準備をしている。", "B") },
        { prompt: "受付の社員が来客2名に「こちらの面談室にどうぞ。担当の田中は間もなく参ります」と言って、部屋のドアを開けています。", scenario: "会社の来客フロア。応接室が並んでいる。", explanationVi: "Lễ tân dẫn 2 khách vào phòng tiếp khách, thông báo Tanaka sẽ đến ngay.", skillTag: "visitor-guidance", difficulty: "standard", options: opts("来客が帰ろうとしている。", "面談が終わったところです。", "来客を面談室に案内している。", "田中が来客を迎えに来た。", "C") },
        { prompt: "社員が電話で「在庫を確認いたしますので、折り返しお電話してもよろしいでしょうか」と話しています。メモを取りながら電話をしています。", scenario: "オフィスの自席。取引先からの問い合わせ。", explanationVi: "Nhân viên đề nghị kiểm tra hàng tồn và gọi lại — đang xử lý yêu cầu của đối tác.", skillTag: "inventory-inquiry", difficulty: "hard", options: opts("注文をキャンセルしている。", "在庫確認のため折り返し電話を提案している。", "在庫がないことを断っている。", "新しい商品を注文している。", "B") },
        { prompt: "3人の社員がランチを食べながら「来週の歓送迎会、幹事は誰がやる？」「私がやりますよ。店は前回のところでいいですか」と話しています。", scenario: "社員食堂。昼休み。", explanationVi: "Ba nhân viên bàn về tiệc tiễn-đón, ai sẽ làm người tổ chức.", skillTag: "event-planning", difficulty: "standard", options: opts("仕事の相談をしている。", "歓送迎会の幹事を決めている。", "ランチの注文をしている。", "レストランの評価をしている。", "B") },
      ],
    },
    {
      code: "LC_STATEMENT", titleVi: "Nghe hiểu phát ngôn", titleJa: "発言聴解問題",
      questions: [
        { prompt: "取引先の部長に「ご検討のほど、よろしくお願いいたします」と言って提案書を渡します。この後、相手は何と言いますか。", scenario: "取引先の応接室。提案のプレゼン後。", explanationVi: "Sau khi nhận đề xuất, đối tác nói 'Chúng tôi sẽ xem xét trong nội bộ' — lịch sự.", skillTag: "proposal-response", difficulty: "standard", options: opts("はい、買います。", "社内で検討させていただきます。", "いりません。", "もう決めました。", "B") },
        { prompt: "会議の冒頭で司会として「それでは、定刻になりましたので、会議を始めさせていただきます」と言います。次に何を言いますか。", scenario: "会議室。全員着席済み。", explanationVi: "Mở đầu cuộc họp đúng giờ. Tiếp theo: thông báo nội dung/chương trình.", skillTag: "meeting-facilitation", difficulty: "standard", options: opts("もう帰ってもいいですか。", "本日の議題は3点ございます。", "コーヒーはいかがですか。", "では、終わりにしましょう。", "B") },
        { prompt: "上司に「この案件、スケジュール的に厳しいんだが…」と相談されました。何と答えますか。", scenario: "上司のデスク前。", explanationVi: "Sếp nói dự án khó về mặt tiến độ. Trả lời: đề xuất ưu tiên hoặc điều chỉnh.", skillTag: "schedule-negotiation", difficulty: "hard", options: opts("無理です。", "優先順位を見直して、対応可能な範囲をご相談させていただけますか。", "なんとかなると思います。", "人を増やしてください。", "B") },
        { prompt: "取引先に見積もりについて「少々お値引きいただくことは可能でしょうか」と聞かれました。社内で確認が必要です。何と答えますか。", scenario: "取引先との商談中。", explanationVi: "Đối tác hỏi giảm giá. Cần xác nhận nội bộ → 'Cho phép tôi mang về công ty kiểm tra'.", skillTag: "price-negotiation", difficulty: "hard", options: opts("できません。", "社内で確認の上、改めてご連絡いたします。", "いくら引けばいいですか。", "そちらの言い値でいいです。", "B") },
        { prompt: "プレゼンの途中で聞き手から「すみません、その数字の根拠を教えていただけますか」と質問されました。手元に詳細データがありません。", scenario: "プレゼン中。質疑応答。", explanationVi: "Bị hỏi căn cứ số liệu nhưng không có chi tiết. Hẹn gửi sau.", skillTag: "q-and-a-handling", difficulty: "hard", options: opts("わかりません。", "詳細なデータは後ほどメールでお送りいたします。", "たぶんこの数字だと思います。", "それは重要ではありません。", "B") },
        { prompt: "部下が「すみません、体調が悪いので午後から早退してもいいですか」と言いました。上司として何と言いますか。", scenario: "オフィス。午前中。", explanationVi: "Nhân viên xin về sớm vì ốm. Sếp: cho phép + dặn cẩn thận + bàn giao việc.", skillTag: "leave-approval", difficulty: "standard", options: opts("だめです、我慢してください。", "わかりました。急ぎの仕事があれば引き継ぎをしてから帰ってね。お大事に。", "明日も休んでいいですよ。", "病院に行った方がいいんじゃない。", "B") },
        { prompt: "メールで「ご多忙のところ恐れ入りますが、来週中にご回答いただければ幸いです」と書きます。これはどういう意味ですか。", scenario: "メール作成中。", explanationVi: "'Biết anh/chị bận nhưng nếu có thể trả lời trong tuần tới thì tốt quá' — yêu cầu lịch sự.", skillTag: "email-comprehension", difficulty: "standard", options: opts("すぐに返事がほしい。", "忙しいことを理解した上で来週中の返答を丁寧にお願いしている。", "返事はいらない。", "来週会いたい。", "B") },
        { prompt: "新しいチームメンバーを紹介するとき「今月から我々のチームに加わった○○さんです。前職では3年間マーケティングを担当されていました」。次に何を言いますか。", scenario: "チームミーティング。新メンバー紹介。", explanationVi: "Giới thiệu thành viên mới xong, mời người mới tự giới thiệu.", skillTag: "introduction-facilitation", difficulty: "standard", options: opts("では、一言ご挨拶をお願いします。", "質問はありますか。", "席はあちらです。", "早く仕事に慣れてください。", "A") },
        { prompt: "外出先で上司から電話があり「今どこにいる？急ぎの案件が入ったんだけど」と言われました。取引先に向かっている途中です。", scenario: "移動中の電話。", explanationVi: "Sếp gọi gấp khi đang trên đường đến đối tác. Thông báo vị trí + thời gian có thể xử lý.", skillTag: "status-report", difficulty: "hard", options: opts("今忙しいです。", "現在○○へ向かっております。訪問後、すぐに対応いたしますがよろしいでしょうか。", "後で連絡します。", "何の件ですか。", "B") },
        { prompt: "会議のまとめとして「本日の決定事項を確認します。第一に…」と発言します。これは何をしていますか。", scenario: "会議の終盤。", explanationVi: "Tóm tắt quyết định cuộc họp — vai trò thư ký/người tổng kết.", skillTag: "meeting-summary", difficulty: "easy", options: opts("新しい議題を出している。", "会議の決定事項をまとめている。", "反対意見を述べている。", "次回の会議を提案している。", "B") },
      ],
    },
    {
      code: "LC_INTEGRATED", titleVi: "Nghe hiểu tổng hợp", titleJa: "総合聴解問題",
      questions: [
        { prompt: "課長と社員が話しています。課長：「来週の大阪出張、2泊3日で行ってくれ。月曜に支社でミーティング、火曜にA社訪問、水曜は報告書を書いて戻ってきて」社員：「承知しました。ホテルの予約はどうしましょう」課長：「総務に頼んで」。社員が総務に頼むことは？", scenario: "オフィス。出張の打ち合わせ。", explanationVi: "Nhân viên nhờ tổng vụ: đặt khách sạn cho chuyến công tác Osaka 2 đêm.", skillTag: "delegation-identification", difficulty: "standard", options: opts("大阪支社の会議室予約。", "ホテルの予約。", "A社への連絡。", "新幹線の切符の予約。", "B") },
        { prompt: "マーケティング部のミーティングです。部長：「新商品のターゲットは30代女性にしよう」社員A：「SNSでの宣伝が効果的だと思います」社員B：「インフルエンサーを使うのはいかがでしょう」部長：「では、SNS戦略とインフルエンサー案、両方の見積もりを来週出してくれ」。来週までに出すものは？", scenario: "マーケティング部の企画会議。", explanationVi: "Trưởng phòng yêu cầu: báo giá 2 phương án (chiến lược SNS + influencer) trước tuần sau.", skillTag: "action-item-extraction", difficulty: "standard", options: opts("新商品のサンプル。", "SNS戦略とインフルエンサー案の見積もり。", "30代女性のアンケート結果。", "広告のデザイン案。", "B") },
        { prompt: "工場の品質管理責任者が説明しています。「先月の不良品率は0.8%でした。目標の0.5%を超えています。原因は検査工程のミスが3件、機械の調整不足が2件です。今月から検査を二重チェック体制にします」。今月から変わることは？", scenario: "工場の品質会議。不良品率のグラフが映っている。", explanationVi: "Tỉ lệ phế phẩm 0.8% > mục tiêu 0.5%. Tháng này: chuyển sang kiểm tra kép.", skillTag: "quality-improvement", difficulty: "hard", options: opts("機械を新しくする。", "検査を二重チェックにする。", "不良品率の目標を変える。", "検査工程を減らす。", "B") },
        { prompt: "取引先との電話です。取引先：「納品が3日遅れるとのことですが、うちの生産ラインに影響が出ます」自分：「大変申し訳ございません。原因は部品の入荷遅延です。現在、別ルートで手配中です」取引先：「いつ届きますか」自分：「明後日には確実にお届けいたします」。遅延の原因は？", scenario: "電話対応。納品遅延のお詫び。", explanationVi: "Nguyên nhân chậm giao: linh kiện nhập chậm. Đang tìm nguồn khác, hẹn 2 ngày nữa.", skillTag: "delay-explanation", difficulty: "hard", options: opts("工場の故障。", "部品の入荷遅延。", "運送会社のミス。", "天候不良。", "B") },
        { prompt: "社長のスピーチです。「今期の業績は売上高100億円、前期比10%増を達成しました。特に海外事業が好調で、来期は海外拠点を3か所増やす計画です。社員の皆さんの努力に感謝します」。来期の計画は？", scenario: "全社集会。スライドに業績グラフが映っている。", explanationVi: "Kỳ này doanh thu 100 tỷ yên (+10%). Kỳ tới: tăng 3 chi nhánh nước ngoài.", skillTag: "corporate-announcement", difficulty: "standard", options: opts("社員を10%増やす。", "海外拠点を3か所増やす。", "売上目標を50%上げる。", "本社を移転する。", "B") },
        { prompt: "人事部が研修の案内をしています。「今回の研修は管理職候補者向けです。内容はリーダーシップ、チームマネジメント、評価制度の3つです。2日間の集中研修で、最終日にレポートを提出していただきます」。研修の対象者は？", scenario: "社内メールの内容を読み上げている。", explanationVi: "Đối tượng: ứng viên quản lý. Nội dung: leadership, quản lý team, hệ thống đánh giá.", skillTag: "training-target", difficulty: "standard", options: opts("新入社員。", "管理職候補者。", "全社員。", "退職予定者。", "B") },
        { prompt: "システム部の発表です。「来月から社内システムのアップデートを行います。作業は土曜日の夜間に実施します。月曜の朝にはパスワードの再設定が必要です。手順書は来週メールで配布します」。月曜日にすることは？", scenario: "全体朝礼でのIT部門からの連絡。", explanationVi: "Hệ thống cập nhật cuối tuần. Thứ Hai cần đặt lại mật khẩu.", skillTag: "system-update-action", difficulty: "hard", options: opts("システムをインストールする。", "パスワードを再設定する。", "手順書を読む。", "IT部門に連絡する。", "B") },
        { prompt: "営業会議で話しています。課長：「A社との契約更新だが、先方が値下げを要求している。5%下げると利益が出ない」社員：「代わりに保守サービスをつけて付加価値を提案するのはどうですか」課長：「いいね、見積もりを作って」。社員の提案は？", scenario: "営業チームの作戦会議。", explanationVi: "Khách hàng yêu cầu giảm giá 5%. Nhân viên đề xuất: thay vì giảm giá, thêm dịch vụ bảo trì.", skillTag: "value-proposition", difficulty: "hard", options: opts("5%値下げする。", "保守サービスを付加価値として提案する。", "契約を断る。", "他の会社を紹介する。", "B") },
      ],
    },
    {
      code: "LR_SITUATION", titleVi: "Nắm bắt tình huống (nghe-đọc)", titleJa: "状況把握問題",
      questions: [
        { prompt: "会議室のドアに「〇〇プロジェクト キックオフミーティング　13:30～15:00　参加者：企画部・技術部・営業部」と書いてあります。この会議は何の会議ですか。", scenario: "会議室前。張り紙を見ている。", explanationVi: "Kickoff meeting dự án XX — cuộc họp khởi động dự án giữa 3 phòng ban.", skillTag: "meeting-type-identification", difficulty: "easy", options: opts("定例報告会。", "プロジェクトの開始会議。", "送別会。", "採用面接。", "B") },
        { prompt: "メールに「cc: 山田部長、佐藤課長　件名：A社提案書レビューのお願い　添付の提案書についてご確認・ご意見をいただけますでしょうか。金曜日までにお願いいたします」と書いてあります。レビュー期限はいつですか。", scenario: "メールを読んでいる。", explanationVi: "Email nhờ xem xét đề xuất cho công ty A. Hạn: thứ Sáu.", skillTag: "email-deadline", difficulty: "standard", options: opts("今日中。", "明日まで。", "金曜日まで。", "来週まで。", "C") },
        { prompt: "名刺に「株式会社テクノソリューションズ　取締役　営業本部長　高橋誠」と書いてあります。この方の立場は？", scenario: "名刺交換後。名刺を見ている。", explanationVi: "Danh thiếp: Giám đốc điều hành (取締役), Tổng phụ trách kinh doanh. Vị trí rất cao.", skillTag: "title-reading", difficulty: "standard", options: opts("一般社員。", "課長クラスの中間管理職。", "経営に関わる上級管理職。", "新入社員。", "C") },
        { prompt: "社内ポータルに「10月1日付 人事異動のお知らせ：営業部 佐藤太郎 → 海外事業部 主任」と掲載されています。佐藤さんはどうなりますか。", scenario: "社内ポータルサイトを見ている。", explanationVi: "Thông báo nhân sự: Sato chuyển từ phòng Kinh doanh sang phòng Kinh doanh Quốc tế, chức Chủ nhiệm.", skillTag: "personnel-change", difficulty: "hard", options: opts("退職する。", "海外事業部に異動して主任になる。", "営業部の部長になる。", "出向する。", "B") },
        { prompt: "取引先からのFAXに「ご注文書　品名：プリンタートナー型番CT-200　数量：50個　納品希望日：11月15日　送付先：東京本社」と書いてあります。何を50個納品しますか。", scenario: "FAXを確認している。", explanationVi: "Đơn đặt hàng: Mực in CT-200, số lượng 50, giao 15/11 đến trụ sở Tokyo.", skillTag: "order-detail", difficulty: "standard", options: opts("プリンター本体。", "プリンタートナー。", "コピー用紙。", "インクカートリッジ。", "B") },
      ],
    },
    {
      code: "LR_DOCUMENT", titleVi: "Đọc tài liệu kết hợp nghe", titleJa: "資料聴読解問題",
      questions: [
        { prompt: "売上グラフを見ながら説明を聞いています。「第1四半期は横ばいでしたが、第2四半期から上昇トレンドに入り、第3四半期で過去最高を記録しました。第4四半期は若干下降しています」。最も売上が高かった時期は？", scenario: "売上推移の棒グラフを見ている。", explanationVi: "Q1 ổn định, Q2 tăng, Q3 cao nhất lịch sử, Q4 giảm nhẹ. Cao nhất = Q3.", skillTag: "graph-interpretation", difficulty: "standard", options: opts("第1四半期。", "第2四半期。", "第3四半期。", "第4四半期。", "C") },
        { prompt: "組織図を見ながら説明しています。「社長の下に3つの本部があります。営業本部、技術本部、管理本部です。各本部には2～3の部があり、各部の下に課があります」。営業本部の直属の上司は？", scenario: "組織図のスライドを見ている。", explanationVi: "Sơ đồ tổ chức: CEO → 3 bộ phận chính. Cấp trên trực tiếp của Bộ Kinh doanh = CEO.", skillTag: "org-chart-reading", difficulty: "standard", options: opts("部長。", "課長。", "社長。", "取締役。", "C") },
        { prompt: "プロジェクトのガントチャートを見ながら説明しています。「設計フェーズは4月～5月、開発は5月～8月、テストは8月～9月、リリースは10月1日です。現在7月ですので、開発フェーズの真ん中です」。テスト開始はいつですか。", scenario: "プロジェクト管理ツールの画面を見ている。", explanationVi: "Gantt chart: thiết kế 4-5, phát triển 5-8, test 8-9, release 1/10. Test bắt đầu tháng 8.", skillTag: "schedule-chart", difficulty: "hard", options: opts("5月。", "7月。", "8月。", "9月。", "C") },
        { prompt: "出張旅費規程を見ながら説明しています。「日帰り出張は日当2,000円、宿泊を伴う場合は日当3,000円とホテル代上限10,000円です。新幹線はグリーン車不可、普通車のみ」。1泊2日の出張で、日当はいくらですか。", scenario: "出張規程の資料を見ている。", explanationVi: "Công tác có qua đêm: phụ cấp 3,000 yên/ngày. 2 ngày = 6,000 yên.", skillTag: "regulation-calculation", difficulty: "hard", options: opts("2,000円。", "3,000円。", "5,000円。", "6,000円。", "D") },
        { prompt: "顧客満足度アンケートの結果を見ています。「品質：4.5/5点、価格：3.2/5点、サービス：4.0/5点、納期：3.8/5点」。評価が最も低い項目は？", scenario: "アンケート結果の一覧表。", explanationVi: "Khảo sát: chất lượng 4.5, giá 3.2, dịch vụ 4.0, giao hàng 3.8. Thấp nhất = giá.", skillTag: "survey-reading", difficulty: "easy", options: opts("品質。", "価格。", "サービス。", "納期。", "B") },
      ],
    },
    {
      code: "LR_INTEGRATED", titleVi: "Nghe-đọc tổng hợp", titleJa: "総合聴読解問題",
      questions: [
        { prompt: "予算表を見ながら経理部長が説明しています。「今年度の広告予算は500万円です。前年は400万円でした。ただし、来期は10%削減の方針です」。来期の広告予算はいくらですか。", scenario: "予算会議。予算表のスライドが映っている。", explanationVi: "Ngân sách quảng cáo năm nay 500万. Kỳ tới giảm 10% → 450万 yên.", skillTag: "budget-calculation", difficulty: "hard", options: opts("400万円。", "450万円。", "500万円。", "550万円。", "B") },
        { prompt: "工場の生産計画表を見ながら工場長が説明しています。「A製品は月産1000個、B製品は月産500個です。来月からB製品の需要が増えるので、B製品を800個に増やして、その分A製品を700個に減らします」。来月のA製品の生産数は？", scenario: "生産計画会議。計画表を見ている。", explanationVi: "Tháng sau: A giảm từ 1000→700, B tăng từ 500→800.", skillTag: "production-adjustment", difficulty: "standard", options: opts("1000個。", "800個。", "700個。", "500個。", "C") },
        { prompt: "研修の評価シートを見ながらフィードバックしています。「プレゼンの構成は良かったですが、時間オーバーが5分ありました。次回は15分以内に収めてください。質疑応答の対応は的確でした」。改善点は？", scenario: "研修の評価面談。評価シートを見ている。", explanationVi: "Điểm tốt: cấu trúc + xử lý Q&A. Điểm cải thiện: quá giờ 5 phút → cần giữ trong 15 phút.", skillTag: "feedback-interpretation", difficulty: "standard", options: opts("プレゼンの構成。", "時間管理。", "質疑応答。", "資料の作り方。", "B") },
        { prompt: "取引先との商談で、価格比較表を見ながら話しています。「弊社のA案は初期費用100万円・月額5万円、B案は初期費用50万円・月額8万円です。2年間でのトータルコストをご覧ください」。2年間でA案のトータルコストは？", scenario: "商談。価格比較表を見ている。", explanationVi: "Plan A: 100万 + 5万×24月 = 220万 yên trong 2 năm.", skillTag: "cost-comparison", difficulty: "hard", options: opts("160万円。", "220万円。", "242万円。", "200万円。", "B") },
        { prompt: "旅行会社が団体旅行の行程表を説明しています。「1日目：新幹線で京都（10:00着）→清水寺→ホテル。2日目：嵐山→金閣寺→新幹線で東京（18:00着）。昼食はどちらの日も自由行動中に各自でお願いします」。2日目の最後の観光地は？", scenario: "社員旅行の説明会。行程表を配布されている。", explanationVi: "Ngày 2: Arashiyama → Kinkakuji → tàu về Tokyo. Điểm tham quan cuối = Kinkakuji.", skillTag: "itinerary-reading", difficulty: "standard", options: opts("清水寺。", "嵐山。", "金閣寺。", "東京タワー。", "C") },
      ],
    },
    {
      code: "RC_VOCAB_GRAMMAR", titleVi: "Từ vựng - Ngữ pháp", titleJa: "語彙・文法問題",
      questions: [
        { prompt: "この案件は部長の＿＿を得てから進めてください。", scenario: null, explanationVi: "'承認' = sự chấp thuận. 'Hãy tiến hành sau khi được trưởng phòng phê duyệt.'", skillTag: "approval-term", difficulty: "standard", options: opts("許可", "承認", "認定", "免許", "B") },
        { prompt: "先方のご要望に＿＿よう、最善を尽くします。", scenario: null, explanationVi: "'沿える' = đáp ứng được. 'Sẽ cố gắng hết sức để đáp ứng yêu cầu.'", skillTag: "business-verb", difficulty: "hard", options: opts("答える", "沿える", "応える", "こたえる", "B") },
        { prompt: "この件に関しましては、＿＿検討いたします。", scenario: null, explanationVi: "'前向きに' = tích cực, hướng tới. 'Sẽ xem xét tích cực về vấn đề này.'", skillTag: "positive-adverb", difficulty: "standard", options: opts("後ろ向きに", "前向きに", "横向きに", "下向きに", "B") },
        { prompt: "プロジェクトの＿＿を管理するのはリーダーの役割です。", scenario: null, explanationVi: "'進捗' = tiến độ. 'Quản lý tiến độ dự án là vai trò của leader.'", skillTag: "project-term", difficulty: "standard", options: opts("進展", "進捗", "推進", "促進", "B") },
        { prompt: "お手数を＿＿しますが、ご対応のほどお願い申し上げます。", scenario: null, explanationVi: "'おかけ' — 'Xin lỗi đã gây phiền nhưng mong được giúp đỡ.'", skillTag: "apology-formula", difficulty: "standard", options: opts("かけ", "おかけ", "とり", "つけ", "B") },
        { prompt: "市場調査の＿＿、新商品の需要は高いことが分かりました。", scenario: null, explanationVi: "'結果' = kết quả. 'Kết quả nghiên cứu thị trường cho thấy nhu cầu cao.'", skillTag: "result-connector", difficulty: "easy", options: opts("結局", "結果", "結論", "結末", "B") },
        { prompt: "来月の展示会に＿＿出展する予定です。", scenario: null, explanationVi: "'初めて' = lần đầu tiên. 'Dự kiến tham gia triển lãm lần đầu tháng sau.'", skillTag: "frequency-adverb", difficulty: "easy", options: opts("初めて", "初めに", "最初に", "一度", "A") },
        { prompt: "この資料は社外秘ですので、＿＿にはお見せできません。", scenario: null, explanationVi: "'部外者' = người ngoài. 'Tài liệu mật nội bộ, không cho người ngoài xem.'", skillTag: "confidentiality-term", difficulty: "hard", options: opts("お客様", "部外者", "上司", "同僚", "B") },
        { prompt: "コスト削減＿＿、品質は維持しなければなりません。", scenario: null, explanationVi: "'とはいえ' = tuy nhiên/dù vậy. 'Dù cắt giảm chi phí nhưng phải giữ chất lượng.'", skillTag: "contrast-conjunction", difficulty: "hard", options: opts("だから", "しかし", "とはいえ", "それで", "C") },
        { prompt: "このシステムは＿＿性に優れています。", scenario: null, explanationVi: "'操作' = thao tác. 'Hệ thống này ưu việt về tính dễ sử dụng.'", skillTag: "system-attribute", difficulty: "standard", options: opts("作業", "操作", "運用", "活用", "B") },
        { prompt: "ご不便を＿＿して誠に申し訳ございません。", scenario: null, explanationVi: "'おかけ' = gây ra (cho quý khách). 'Rất xin lỗi đã gây bất tiện.'", skillTag: "formal-apology", difficulty: "standard", options: opts("かけ", "おかけ", "つけ", "あたえ", "B") },
        { prompt: "次回の会議は＿＿決まり次第ご連絡いたします。", scenario: null, explanationVi: "'日程が' = lịch trình. 'Sẽ liên lạc ngay khi lịch họp được quyết định.'", skillTag: "schedule-phrase", difficulty: "easy", options: opts("時間が", "日程が", "場所が", "内容が", "B") },
        { prompt: "予算は＿＿的に見直す必要があります。", scenario: null, explanationVi: "'抜本' = triệt để/căn bản. 'Cần xem xét lại ngân sách một cách căn bản.'", skillTag: "reform-adverb", difficulty: "hard", options: opts("基本", "抜本", "根本", "全面", "B") },
        { prompt: "弊社としては、＿＿の余地はないものと考えております。", scenario: null, explanationVi: "'交渉' = đàm phán. 'Phía công ty chúng tôi cho rằng không còn chỗ để đàm phán.'", skillTag: "negotiation-term", difficulty: "hard", options: opts("相談", "交渉", "議論", "妥協", "B") },
        { prompt: "お見積もりの＿＿は30日間です。", scenario: null, explanationVi: "'有効期限' = thời hạn hiệu lực. 'Báo giá có hiệu lực 30 ngày.'", skillTag: "validity-term", difficulty: "standard", options: opts("期間", "期限", "有効期限", "締め切り", "C") },
      ],
    },
    {
      code: "RC_EXPRESSION", titleVi: "Biểu đạt - Đọc hiểu", titleJa: "表現読解問題",
      questions: [
        { prompt: "見積書を送付するメールで「＿＿」", scenario: null, explanationVi: "'Xin gửi kèm báo giá theo yêu cầu. Xin vui lòng kiểm tra.'", skillTag: "quotation-email", difficulty: "standard", options: opts("見積もりです。確認してください。", "ご依頼いただきましたお見積書を添付いたします。ご査収のほどよろしくお願いいたします。", "見積書を作りました。", "添付の見積書を見てね。", "B") },
        { prompt: "打ち合わせの日程を提案するとき「＿＿」", scenario: null, explanationVi: "'Về lịch trình, tuần sau thứ Ba hoặc thứ Tư anh/chị có tiện không?'", skillTag: "scheduling-proposal", difficulty: "standard", options: opts("来週いつがいい？", "ご都合のよろしい日時をご教示いただけますでしょうか。", "来週会えますか。", "都合のいい日を教えて。", "B") },
        { prompt: "社外向けメールの結びで「＿＿」", scenario: null, explanationVi: "'Kính mong tiếp tục nhận được sự hướng dẫn.' — kết thúc email với đối tác.", skillTag: "email-closing", difficulty: "easy", options: opts("よろしく。", "今後ともどうぞよろしくお願い申し上げます。", "では、さようなら。", "返事待ってます。", "B") },
        { prompt: "会議で反対意見を述べるとき「＿＿」", scenario: null, explanationVi: "'Quan điểm rất hay nhưng cho phép tôi nêu một quan ngại' — phản đối lịch sự.", skillTag: "polite-disagreement", difficulty: "hard", options: opts("それは間違いです。", "おっしゃる通りかと存じますが、一点懸念がございます。", "私は反対です。", "それはだめだと思います。", "B") },
        { prompt: "プレゼンの冒頭で「＿＿」", scenario: null, explanationVi: "'Hôm nay tôi sẽ trình bày về... Xin cảm ơn thời gian quý báu của quý vị.'", skillTag: "presentation-opening", difficulty: "standard", options: opts("始めます。", "本日は貴重なお時間をいただきありがとうございます。○○についてご説明いたします。", "今日のプレゼンは○○についてです。", "聞いてください。", "B") },
        { prompt: "納品遅延をお客様に連絡するとき「＿＿」", scenario: null, explanationVi: "'Rất xin lỗi nhưng do tình hình sản xuất, việc giao hàng sẽ chậm 3 ngày.'", skillTag: "delay-notification", difficulty: "hard", options: opts("遅れます。すみません。", "誠に申し訳ございませんが、製造上の事情により、納品が3日遅延する見込みです。", "3日遅くなります。", "ちょっと遅れるかもしれません。", "B") },
        { prompt: "上司の提案に賛成するとき「＿＿」", scenario: null, explanationVi: "'Tôi hoàn toàn đồng ý với ý kiến đó. Đặc biệt là về điểm...'", skillTag: "agreement-expression", difficulty: "standard", options: opts("そう思います。", "おっしゃる通りだと思います。特に○○の点は重要だと考えます。", "いいと思います。", "賛成です。", "B") },
        { prompt: "商談でお礼を言うとき「＿＿」", scenario: null, explanationVi: "'Cảm ơn đã dành thời gian quý báu cho chúng tôi hôm nay.'", skillTag: "meeting-gratitude", difficulty: "easy", options: opts("ありがとう。", "本日は貴重なお時間を頂戴し、誠にありがとうございました。", "お疲れ様でした。", "助かりました。", "B") },
        { prompt: "社内での改善提案をするとき「＿＿」", scenario: null, explanationVi: "'Về quy trình này, tôi có một đề xuất cải thiện...' — đề xuất nội bộ lịch sự.", skillTag: "improvement-proposal", difficulty: "hard", options: opts("もっといい方法があります。", "僭越ながら、この業務フローについて改善のご提案をさせていただきます。", "変えた方がいいと思います。", "この方法は効率が悪いです。", "B") },
        { prompt: "電話で伝言を頼むとき「＿＿」", scenario: null, explanationVi: "'Xin lỗi phiền anh/chị nhưng có thể nhắn lại cho người phụ trách được không?'", skillTag: "message-request", difficulty: "standard", options: opts("伝えてください。", "恐れ入りますが、ご担当者様にお伝えいただけますでしょうか。", "メッセージを残したいです。", "伝言お願い。", "B") },
      ],
    },
    {
      code: "RC_INTEGRATED", titleVi: "Đọc hiểu tổng hợp", titleJa: "総合読解問題",
      questions: [
        { prompt: "次のメールを読んでください。\n\n「件名：来週の出張について\n佐藤課長\nお疲れ様です。来週の大阪出張の件です。\n・日程：10月15日（月）～16日（火）\n・目的：A社との技術打ち合わせ\n・移動：新幹線（のぞみ指定席）\n・宿泊：大阪駅前のビジネスホテル（経理手配済み）\n・持参資料：技術仕様書、見積書\n出張申請書は本日中に提出します。\n田中」\n\n田中さんが今日中にすることは？", scenario: null, explanationVi: "Tanaka cần nộp đơn xin công tác trong ngày hôm nay.", skillTag: "action-extraction", difficulty: "easy", options: opts("ホテルを予約する。", "出張申請書を提出する。", "技術仕様書を作成する。", "A社に連絡する。", "B") },
        { prompt: "次の議事録を読んでください。\n\n「第12回 営業戦略会議 議事録\n日時：9月5日 14:00～15:30\n出席者：山田部長、佐藤、田中、鈴木\n議題：Q3の振り返りと Q4の目標設定\n決定事項：\n1. Q4の売上目標は前年比15%増\n2. 新規顧客開拓に注力する\n3. 各担当者は10月1日までに個人目標を提出\n次回：10月3日 14:00～」\n\n各担当者が10月1日までに出すものは？", scenario: null, explanationVi: "Biên bản: mỗi người nộp mục tiêu cá nhân trước 1/10.", skillTag: "minutes-comprehension", difficulty: "standard", options: opts("Q3の報告書。", "個人の売上目標。", "顧客リスト。", "Q4の予算案。", "B") },
        { prompt: "次のビジネスレターを読んでください。\n\n「拝啓　時下ますますご清栄のこととお慶び申し上げます。\nさて、このたび弊社は本社を下記の住所に移転することになりました。\n新住所：東京都港区芝公園1-1-1\n移転日：11月1日\n電話番号：変更なし\n新オフィスでも変わらぬご愛顧を賜りますようお願い申し上げます。\n敬具」\n\n変わらないものは何ですか？", scenario: null, explanationVi: "Thông báo chuyển trụ sở. Địa chỉ mới, nhưng số điện thoại không đổi.", skillTag: "letter-detail", difficulty: "standard", options: opts("住所。", "移転日。", "電話番号。", "会社名。", "C") },
        { prompt: "次の社内通知を読んでください。\n\n「年次有給休暇の計画的付与について\n社員各位\n当社では、年次有給休暇の取得促進のため、以下の通り計画的付与日を設定します。\n・8月13日～15日（夏季一斉休業）\n・12月29日～31日（年末一斉休業）\n上記の日は有給休暇として自動的に消化されます。\n有給残日数が不足する場合は、人事部にご相談ください。\n人事部」\n\n有給が足りない場合、どうしますか？", scenario: null, explanationVi: "Nghỉ tập thể tự động trừ phép. Nếu không đủ phép → liên hệ phòng nhân sự.", skillTag: "policy-action", difficulty: "hard", options: opts("休めない。", "人事部に相談する。", "欠勤になる。", "無給休暇を取る。", "B") },
        { prompt: "次のクレーム対応記録を読んでください。\n\n「日時：10月10日 15:30\n顧客：B社 鈴木様\n内容：先週納品した製品50個のうち3個に傷があった\n対応：謝罪の上、良品3個を本日中に再送する旨を約束\n担当：営業部 田中\nステータス：良品手配中」\n\n田中さんが今日中にすることは？", scenario: null, explanationVi: "Ghi chú khiếu nại: 3 sản phẩm bị trầy. Hứa gửi lại 3 sản phẩm tốt trong ngày.", skillTag: "complaint-follow-up", difficulty: "standard", options: opts("鈴木様に電話する。", "良品3個を再送する。", "50個すべてを検品する。", "上司に報告する。", "B") },
        { prompt: "次の募集要項を読んでください。\n\n「営業職 中途採用\n応募資格：法人営業経験3年以上、普通自動車免許\n歓迎条件：IT業界経験、TOEIC 600以上\n年収：500万～700万円（経験・能力による）\n選考プロセス：書類選考→一次面接→二次面接→最終面接\n提出書類：履歴書、職務経歴書」\n\n必ず必要な資格は？", scenario: null, explanationVi: "Yêu cầu bắt buộc: kinh nghiệm bán hàng B2B 3 năm + bằng lái xe.", skillTag: "requirement-distinction", difficulty: "hard", options: opts("TOEIC 600点以上。", "IT業界の経験。", "普通自動車免許。", "大学の学位。", "C") },
        { prompt: "次の案内を読んでください。\n\n「展示会出展のお知らせ\n弊社は下記の展示会に出展いたします。\n展示会名：ビジネスITソリューション展2026\n日時：11月10日～12日 10:00～17:00\n場所：東京ビッグサイト 東ホール ブースC-15\n出展内容：クラウド型業務管理システム、AI文書管理ソリューション\nご来場の際はぜひお立ち寄りください。」\n\n展示会は何日間ですか？", scenario: null, explanationVi: "Triển lãm từ 10/11 đến 12/11 = 3 ngày.", skillTag: "duration-calculation", difficulty: "easy", options: opts("1日間。", "2日間。", "3日間。", "5日間。", "C") },
        { prompt: "次の報告書の冒頭を読んでください。\n\n「出張報告書\n出張者：営業部 佐藤太郎\n出張先：名古屋支社、C社本社\n期間：10月20日～21日\n目的：①名古屋支社との情報共有 ②C社への提案プレゼン\n結果：C社より前向きに検討するとの回答を得た。正式回答は11月中旬予定。」\n\nC社の正式回答はいつ？", scenario: null, explanationVi: "C社 trả lời chính thức dự kiến giữa tháng 11.", skillTag: "report-timeline", difficulty: "standard", options: opts("10月中。", "11月中旬。", "12月初め。", "来年。", "B") },
        { prompt: "次の社内アンケート結果を読んでください。\n\n「テレワーク満足度調査（回答数：150名）\n・とても満足：20%\n・満足：45%\n・普通：20%\n・不満：10%\n・とても不満：5%\n主な不満理由：コミュニケーション不足(60%)、設備環境(25%)、孤独感(15%)」\n\n不満の最大の理由は？", scenario: null, explanationVi: "Lý do bất mãn lớn nhất về WFH: thiếu giao tiếp (60%).", skillTag: "survey-analysis", difficulty: "standard", options: opts("設備環境。", "孤独感。", "コミュニケーション不足。", "給与。", "C") },
        { prompt: "次の商品カタログの説明を読んでください。\n\n「クラウド型勤怠管理システム『タイムクラウド』\n特徴：\n・PC・スマホ対応、どこでも打刻可能\n・残業時間の自動計算\n・有給休暇の申請・承認がオンラインで完結\n・月額料金：1ユーザーあたり300円（最低契約10ユーザー）\n・初期費用：無料\n・無料トライアル：30日間」\n\n10人で1年間使うと月額いくらですか？", scenario: null, explanationVi: "10 người × 300 yên = 3,000 yên/tháng.", skillTag: "pricing-calculation", difficulty: "hard", options: opts("300円。", "3,000円。", "30,000円。", "36,000円。", "B") },
      ],
    },
  ],
};
