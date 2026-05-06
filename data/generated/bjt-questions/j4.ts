/**
 * BJT J4 Level Questions — 初級レベル (Elementary)
 * Score range: 200-319
 *
 * Target: Learners who can handle standard office communication,
 * basic phone etiquette, simple email, visitor reception, basic reporting.
 * Contexts: general office, phone calls, visitor reception, basic emails,
 * attendance/commute, supply management, simple meetings.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J4_DATA: SeedLevelData = {
  level: "J4",
  slug: "bjt-j4-practice-v3",
  titleVi: "Đề luyện BJT J4 — Sơ cấp",
  titleJa: "BJT J4 練習テスト — 初級レベル",
  sections: [
    {
      code: "LC_SCENE",
      titleVi: "Nắm bắt tình huống",
      titleJa: "場面把握問題",
      questions: [
        {
          prompt: "社員が電話を取って「はい、○○株式会社でございます」と言っています。相手の声がスピーカーから聞こえています。",
          scenario: "オフィスの自分のデスクで電話を受けている場面。",
          explanationVi: "Nhân viên nhấc điện thoại và trả lời 'Vâng, đây là công ty XX'. Đang tiếp nhận cuộc gọi.",
          skillTag: "phone-reception",
          difficulty: "easy",
          options: opts(
            "社員が電話をかけています。",
            "社員が電話を受けています。",
            "社員が電話を切ろうとしています。",
            "社員が携帯電話を探しています。",
            "B"
          ),
        },
        {
          prompt: "受付で社員が「お名刺を頂戴できますか」と言って、来客に手を差し出しています。",
          scenario: "会社の受付ロビー。来客がスーツを着ている。",
          explanationVi: "Nhân viên lễ tân xin danh thiếp của khách đến thăm.",
          skillTag: "visitor-reception",
          difficulty: "easy",
          options: opts(
            "社員が名刺を渡しています。",
            "来客が帰ろうとしています。",
            "社員が来客に名刺をもらおうとしています。",
            "来客が道を聞いています。",
            "C"
          ),
        },
        {
          prompt: "コピー室で社員がコピー機の前に立って、紙を入れています。隣の社員が「裏表逆ですよ」と言っています。",
          scenario: "オフィスのコピー室。",
          explanationVi: "Đồng nghiệp nhắc 'Giấy ngược rồi' — đang copy nhưng đặt giấy sai mặt.",
          skillTag: "office-equipment",
          difficulty: "easy",
          options: opts(
            "コピー機が故障しています。",
            "紙の向きが間違っています。",
            "コピー用紙がなくなりました。",
            "社員がコピーを取り消しています。",
            "B"
          ),
        },
        {
          prompt: "会議室の入口で社員が「本日の会議は隣の部屋に変更になりました」と案内しています。参加者が移動しています。",
          scenario: "オフィスの会議室フロア。ドアに張り紙がある。",
          explanationVi: "Nhân viên thông báo phòng họp đã đổi sang phòng bên cạnh.",
          skillTag: "room-change-notice",
          difficulty: "standard",
          options: opts(
            "会議が中止になりました。",
            "会議室が変更になりました。",
            "会議の時間が変わりました。",
            "参加者が増えました。",
            "B"
          ),
        },
        {
          prompt: "上司がホワイトボードの前に立って、グラフを指さしながら「先月の売上はこのとおりです」と説明しています。",
          scenario: "会議室。5人ほどの社員が座って聞いている。",
          explanationVi: "Sếp đang thuyết trình về doanh số tháng trước, chỉ vào biểu đồ trên bảng.",
          skillTag: "presentation-scene",
          difficulty: "standard",
          options: opts(
            "上司が質問に答えています。",
            "上司が売上について説明しています。",
            "上司が新商品を紹介しています。",
            "上司が部下を注意しています。",
            "B"
          ),
        },
        {
          prompt: "社員食堂で2人の社員がトレーを持って席を探しています。食堂はほぼ満席です。",
          scenario: "お昼時の社員食堂。",
          explanationVi: "Hai nhân viên đang tìm chỗ ngồi trong nhà ăn gần đầy chỗ.",
          skillTag: "situation-comprehension",
          difficulty: "easy",
          options: opts(
            "食堂が閉まっています。",
            "社員が食事を注文しています。",
            "社員が空いている席を探しています。",
            "社員が食器を片付けています。",
            "C"
          ),
        },
        {
          prompt: "社員が段ボール箱を両手で持って、エレベーターのボタンの前で困っています。別の社員が「押しましょうか」と声をかけています。",
          scenario: "オフィスビルのエレベーターホール。",
          explanationVi: "Nhân viên ôm thùng không bấm được nút. Người khác đề nghị bấm giúp.",
          skillTag: "offer-help",
          difficulty: "standard",
          options: opts(
            "社員がエレベーターを修理しています。",
            "社員が荷物を届けようとしています。",
            "両手がふさがっている社員をボタン操作で手伝おうとしています。",
            "社員が荷物を受け取っています。",
            "C"
          ),
        },
        {
          prompt: "受付の社員が来客に「少々お待ちください。担当者に連絡いたします」と言って、内線電話を取っています。",
          scenario: "会社の受付。来客がソファに座って待っている。",
          explanationVi: "Lễ tân gọi điện nội bộ báo cho người phụ trách rằng khách đã đến.",
          skillTag: "visitor-handling",
          difficulty: "standard",
          options: opts(
            "来客を断っています。",
            "担当者に来客を知らせています。",
            "来客の予約を確認しています。",
            "受付を閉めようとしています。",
            "B"
          ),
        },
        {
          prompt: "社員が自分のパソコンの画面を見ながら、隣の同僚に「このメールの宛先、これで合ってますか」と確認しています。",
          scenario: "オフィスのデスク。メール作成画面が開いている。",
          explanationVi: "Nhân viên nhờ đồng nghiệp kiểm tra địa chỉ email trước khi gửi.",
          skillTag: "email-confirmation",
          difficulty: "standard",
          options: opts(
            "メールを受信しています。",
            "メールの送り先を確認しています。",
            "パソコンが故障しています。",
            "同僚にメールを転送しています。",
            "B"
          ),
        },
        {
          prompt: "朝、社員がタイムカードを機械に通しています。時計は8時55分を指しています。",
          scenario: "オフィスの入口。タイムカードの機械が壁にある。",
          explanationVi: "Nhân viên quẹt thẻ chấm công lúc 8:55 sáng — đang ghi nhận giờ đến.",
          skillTag: "attendance-recording",
          difficulty: "hard",
          options: opts(
            "社員が退勤しています。",
            "社員が出勤の記録をしています。",
            "社員が残業を申請しています。",
            "社員がカードキーで扉を開けています。",
            "B"
          ),
        },
        {
          prompt: "社員が「すみません、プロジェクターが映らないのですが」と電話で話しています。会議室にはプロジェクターとスクリーンがあります。",
          scenario: "会議室。会議が始まる直前。",
          explanationVi: "Nhân viên gọi điện báo máy chiếu không hoạt động trước khi cuộc họp bắt đầu.",
          skillTag: "equipment-trouble",
          difficulty: "hard",
          options: opts(
            "会議が終わったところです。",
            "プロジェクターの故障を報告しています。",
            "新しいプロジェクターを注文しています。",
            "プレゼンの練習をしています。",
            "B"
          ),
        },
        {
          prompt: "上司が部下に「このファイル、共有フォルダに入れておいて」と言っています。部下がパソコンで操作しています。",
          scenario: "オフィスのデスク。",
          explanationVi: "Sếp yêu cầu lưu file vào thư mục chia sẻ. Nhân viên đang thao tác trên máy tính.",
          skillTag: "file-management",
          difficulty: "hard",
          options: opts(
            "ファイルを印刷しています。",
            "ファイルを削除しています。",
            "ファイルを共有フォルダに保存しています。",
            "ファイルをメールで送っています。",
            "C"
          ),
        },
      ],
    },
    {
      code: "LC_STATEMENT",
      titleVi: "Nghe hiểu phát ngôn",
      titleJa: "発言聴解問題",
      questions: [
        {
          prompt: "取引先から電話がかかってきました。担当者の山田は外出中です。何と言いますか。",
          scenario: "オフィスの自分のデスクで電話を受けた場面。",
          explanationVi: "Khi người phụ trách vắng mặt, thông báo lịch sự và đề nghị gọi lại.",
          skillTag: "phone-absence-handling",
          difficulty: "standard",
          options: opts(
            "山田はいません。",
            "申し訳ございません、山田はただいま外出しております。戻りましたらこちらからお電話いたしましょうか。",
            "山田は忙しいです。後で来てください。",
            "山田に伝えます。さようなら。",
            "B"
          ),
        },
        {
          prompt: "上司に「この報告書、いつまでにできる？」と聞かれました。明後日までにできると答えます。",
          scenario: "上司のデスクの前。",
          explanationVi: "Sếp hỏi deadline báo cáo. Trả lời lịch sự: 'Ngày kia sẽ hoàn thành'.",
          skillTag: "deadline-reporting",
          difficulty: "standard",
          options: opts(
            "明後日でいいですか。",
            "明後日までに仕上げます。",
            "わかりません。",
            "もうすぐできます。",
            "B"
          ),
        },
        {
          prompt: "初めて会う取引先の人に名刺を渡すとき、何と言いますか。",
          scenario: "取引先の応接室での初対面の場面。",
          explanationVi: "Trao danh thiếp lần đầu gặp: tự giới thiệu + 'xin hãy chỉ giáo'.",
          skillTag: "business-card-exchange",
          difficulty: "standard",
          options: opts(
            "名刺です。どうぞ。",
            "初めまして。○○会社の△△と申します。どうぞよろしくお願いいたします。",
            "こんにちは。名刺を交換しましょう。",
            "○○です。よろしく。",
            "B"
          ),
        },
        {
          prompt: "会議の日程を変更したいとき、参加者にメールで何と書きますか。",
          scenario: "メール作成中。会議の参加者全員に送る。",
          explanationVi: "Email thông báo đổi lịch họp: dùng kính ngữ, xin lỗi về sự bất tiện.",
          skillTag: "schedule-change-email",
          difficulty: "hard",
          options: opts(
            "会議の日にちが変わります。",
            "お忙しいところ恐れ入りますが、会議の日程を変更させていただきたく、ご連絡いたしました。",
            "会議は別の日にします。都合のいい日を教えてください。",
            "会議を延期します。",
            "B"
          ),
        },
        {
          prompt: "同僚にコピーを頼みたいとき、何と言いますか。",
          scenario: "オフィスで同僚と一緒に仕事をしている。",
          explanationVi: "Nhờ đồng nghiệp copy: 'Xin lỗi nhưng có thể copy giúp tôi được không?'",
          skillTag: "polite-request",
          difficulty: "easy",
          options: opts(
            "コピーして。",
            "すみません、この資料をコピーしてもらえますか。",
            "コピーしなさい。",
            "コピーが必要です。",
            "B"
          ),
        },
        {
          prompt: "来客がエレベーターに乗るとき、何と言いますか。",
          scenario: "エレベーターホールで来客を案内している。",
          explanationVi: "Mời khách vào thang máy: 'Mời quý khách, xin mời đi trước'.",
          skillTag: "visitor-guidance",
          difficulty: "standard",
          options: opts(
            "先に乗ってください。",
            "どうぞ、お先にお乗りください。",
            "乗りますか。",
            "エレベーターはこっちです。",
            "B"
          ),
        },
        {
          prompt: "お客様から商品についての問い合わせの電話がありました。自分ではわからないので、詳しい人に代わります。何と言いますか。",
          scenario: "カスタマーサポートの電話。",
          explanationVi: "Không biết nên chuyển cho người am hiểu: 'Xin phép chuyển cho người phụ trách'.",
          skillTag: "call-transfer",
          difficulty: "standard",
          options: opts(
            "わかりません。",
            "担当の者に代わりますので、少々お待ちいただけますか。",
            "後でかけ直してください。",
            "ネットで調べてください。",
            "B"
          ),
        },
        {
          prompt: "上司から「明日の出張、気をつけて行ってきてね」と言われました。何と答えますか。",
          scenario: "退勤前のオフィス。明日から出張。",
          explanationVi: "Sếp dặn cẩn thận khi đi công tác. Đáp lịch sự: 'Vâng, cảm ơn. Em sẽ đi đây'.",
          skillTag: "departing-response",
          difficulty: "standard",
          options: opts(
            "大丈夫です。",
            "ありがとうございます。行ってまいります。",
            "はい、行きます。",
            "出張は嫌です。",
            "B"
          ),
        },
        {
          prompt: "会議で自分の意見を言いたいとき、何と言って発言しますか。",
          scenario: "会議室。議論中。",
          explanationVi: "Muốn phát biểu trong cuộc họp: 'Xin phép nói một chút'.",
          skillTag: "meeting-participation",
          difficulty: "hard",
          options: opts(
            "ちょっと言いたいことがある。",
            "すみません、一点よろしいでしょうか。",
            "聞いてください。",
            "意見があります。",
            "B"
          ),
        },
        {
          prompt: "取引先の人が帰るとき、エレベーターまで見送ります。何と言いますか。",
          scenario: "エレベーターホールで見送り。",
          explanationVi: "Tiễn khách ra thang máy: 'Cảm ơn hôm nay đã bớt chút thời gian quý báu'.",
          skillTag: "farewell-courtesy",
          difficulty: "hard",
          options: opts(
            "さようなら。",
            "本日はお忙しい中、お越しいただきありがとうございました。",
            "また来てください。",
            "お気をつけて。バイバイ。",
            "B"
          ),
        },
      ],
    },
    {
      code: "LC_INTEGRATED",
      titleVi: "Nghe hiểu tổng hợp",
      titleJa: "総合聴解問題",
      questions: [
        {
          prompt: "上司と部下が話しています。上司：「来週の月曜に新しいパソコンが届くから、古いのはデータを消してから総務に返してね」部下：「わかりました。データのバックアップはどうしますか」上司：「USBに保存して、それも総務に渡して」。部下がすることを順番に並べると？",
          scenario: "オフィス。パソコンの入れ替えの話。",
          explanationVi: "Nhân viên phải: backup dữ liệu vào USB → xóa dữ liệu máy cũ → trả máy cũ + USB cho tổng vụ.",
          skillTag: "task-sequence",
          difficulty: "standard",
          options: opts(
            "パソコンを返す→データを消す→バックアップする",
            "バックアップする→データを消す→パソコンとUSBを総務に渡す",
            "データを消す→バックアップする→パソコンを買う",
            "USBを買う→バックアップする→パソコンを捨てる",
            "B"
          ),
        },
        {
          prompt: "人事部の社員が社内放送しています。「本日午後3時より、4階の大会議室で安全講習会を行います。全社員必ず出席してください。資料は会場で配布します。筆記用具をお持ちください」。社員が持っていくものは何ですか。",
          scenario: "オフィス。社内放送が流れている。",
          explanationVi: "Thông báo: tập huấn an toàn lúc 3h chiều, tầng 4. Mang theo bút viết, tài liệu phát tại chỗ.",
          skillTag: "broadcast-detail",
          difficulty: "standard",
          options: opts(
            "資料と筆記用具。",
            "筆記用具だけ。",
            "パソコン。",
            "名刺。",
            "B"
          ),
        },
        {
          prompt: "総務の人が説明しています。「備品を注文するときは、まず申請書を書いて、課長の印鑑をもらってから、総務に提出してください。急ぎの場合は先にメールで連絡してもらえれば対応します」。急ぎの場合、最初に何をしますか。",
          scenario: "オフィス。新人向けの備品注文の説明。",
          explanationVi: "Đặt văn phòng phẩm: viết đơn → ký trưởng phòng → nộp tổng vụ. Nếu gấp → email trước.",
          skillTag: "procedure-priority",
          difficulty: "standard",
          options: opts(
            "申請書を書く。",
            "課長に印鑑をもらう。",
            "総務にメールで連絡する。",
            "備品を自分で買う。",
            "C"
          ),
        },
        {
          prompt: "店長がアルバイトに説明しています。「閉店後の作業は、まずレジを締めて、売上を記録してね。そのあと床を掃除して、最後にゴミを外に出して鍵をかけて。鍵は翌日の朝番のスタッフに渡してね」。売上を記録した後にすることは？",
          scenario: "閉店作業の説明。",
          explanationVi: "Sau khi ghi doanh thu → quét sàn → đổ rác → khóa cửa → giao chìa khóa.",
          skillTag: "closing-procedure",
          difficulty: "hard",
          options: opts(
            "鍵をかける。",
            "ゴミを出す。",
            "床を掃除する。",
            "レジを締める。",
            "C"
          ),
        },
        {
          prompt: "電話で取引先と話しています。取引先：「来週の打ち合わせですが、火曜日はいかがですか」自分：「火曜は出張がありまして…水曜はいかがでしょうか」取引先：「水曜の午後なら空いています」自分：「では、水曜の午後2時でお願いいたします」。打ち合わせはいつですか。",
          scenario: "電話で日程調整中。",
          explanationVi: "Thứ Ba bận. Đối tác rảnh chiều thứ Tư. Hẹn 2 giờ chiều thứ Tư.",
          skillTag: "schedule-negotiation",
          difficulty: "standard",
          options: opts(
            "火曜日の午前。",
            "火曜日の午後。",
            "水曜日の午後2時。",
            "水曜日の午前。",
            "C"
          ),
        },
        {
          prompt: "部長が朝礼で話しています。「今月の目標は新規顧客20社です。先月は15社でした。あと5社多く獲得する必要があります。各チーム、担当エリアを確認して、訪問計画を今週中に出してください」。今週中に出すものは何ですか。",
          scenario: "朝の全体朝礼。",
          explanationVi: "Mục tiêu tháng: 20 khách mới (tháng trước 15). Nộp kế hoạch thăm khách trong tuần.",
          skillTag: "instruction-extraction",
          difficulty: "hard",
          options: opts(
            "新規顧客のリスト。",
            "先月の報告書。",
            "訪問計画。",
            "担当エリアの地図。",
            "C"
          ),
        },
        {
          prompt: "経理の人が説明しています。「交通費の精算は、月末に申請書を出してください。領収書がないものは精算できません。タクシー代は事前に上司の承認が必要です」。タクシーを使いたい場合、まず何をしますか。",
          scenario: "経理部での精算手続きの説明。",
          explanationVi: "Thanh toán taxi: cần được sếp duyệt trước khi đi. Biên lai bắt buộc.",
          skillTag: "expense-procedure",
          difficulty: "hard",
          options: opts(
            "領収書をもらう。",
            "月末に申請する。",
            "上司の承認をもらう。",
            "経理に相談する。",
            "C"
          ),
        },
        {
          prompt: "ITサポートの人が説明しています。「パスワードは3か月ごとに変更してください。変更するときは、旧パスワードと新パスワードを入力します。新パスワードは8文字以上で、英語と数字を混ぜてください」。新パスワードの条件は何ですか。",
          scenario: "IT部門のセキュリティ研修。",
          explanationVi: "Mật khẩu mới: từ 8 ký tự trở lên, có cả chữ cái lẫn số.",
          skillTag: "security-requirement",
          difficulty: "hard",
          options: opts(
            "英語だけで8文字以上。",
            "数字だけで8文字以上。",
            "8文字以上で英語と数字を含む。",
            "何でもいいが3か月ごとに変える。",
            "C"
          ),
        },
      ],
    },
    {
      code: "LR_SITUATION",
      titleVi: "Nắm bắt tình huống (nghe-đọc)",
      titleJa: "状況把握問題",
      questions: [
        {
          prompt: "オフィスのドアに「会議中　関係者以外立入禁止」と書いてあります。今、中に入ってもいいですか。",
          scenario: "会議室のドア。中から話し声が聞こえる。",
          explanationVi: "Biển 'Đang họp - Cấm vào nếu không liên quan'. Không được vào.",
          skillTag: "sign-comprehension",
          difficulty: "easy",
          options: opts(
            "ノックすれば入れる。",
            "関係者でなければ入れない。",
            "誰でも入れる。",
            "5分後に入れる。",
            "B"
          ),
        },
        {
          prompt: "社内掲示板に「歓迎会のお知らせ　日時：4月5日（金）19:00～　場所：駅前の居酒屋「さくら」　会費：3,000円　参加希望は4月1日までに佐藤まで」とあります。参加するにはどうしますか。",
          scenario: "社内掲示板を見ている。",
          explanationVi: "Tiệc chào mừng: 5/4, 19h, quán Sakura, 3000 yên. Đăng ký trước 1/4 với Sato.",
          skillTag: "event-registration",
          difficulty: "standard",
          options: opts(
            "当日、直接行く。",
            "4月1日までに佐藤さんに連絡する。",
            "3,000円を先に払う。",
            "居酒屋に予約する。",
            "B"
          ),
        },
        {
          prompt: "社内メールに「来週から空調の設定温度を28度にします。暑い場合は卓上扇風機の使用を許可します」と書いてあります。暑いときはどうしますか。",
          scenario: "社内メールを読んでいる。",
          explanationVi: "Nhiệt độ điều hòa 28 độ. Nếu nóng → được dùng quạt bàn.",
          skillTag: "policy-comprehension",
          difficulty: "standard",
          options: opts(
            "エアコンの温度を下げる。",
            "卓上扇風機を使う。",
            "窓を開ける。",
            "上司に相談する。",
            "B"
          ),
        },
        {
          prompt: "名刺に「営業部　主任　田中太郎」と書いてあります。田中さんの役職は何ですか。",
          scenario: "名刺交換の場面。",
          explanationVi: "Danh thiếp ghi: Phòng Kinh doanh, Chủ nhiệm (主任), Tanaka Taro.",
          skillTag: "business-card-reading",
          difficulty: "easy",
          options: opts(
            "部長。",
            "課長。",
            "主任。",
            "係長。",
            "C"
          ),
        },
        {
          prompt: "オフィスの壁に避難経路図が貼ってあります。「火災時は階段を使用してください。エレベーターは使わないでください。集合場所は正面玄関前です」。火事のとき、どこに集まりますか。",
          scenario: "オフィスの壁。避難経路図を見ている。",
          explanationVi: "Khi cháy: dùng cầu thang, không dùng thang máy. Tập trung trước cửa chính.",
          skillTag: "emergency-procedure",
          difficulty: "hard",
          options: opts(
            "エレベーターの前。",
            "屋上。",
            "正面玄関前。",
            "自分のデスク。",
            "C"
          ),
        },
      ],
    },
    {
      code: "LR_DOCUMENT",
      titleVi: "Đọc tài liệu kết hợp nghe",
      titleJa: "資料聴読解問題",
      questions: [
        {
          prompt: "社内の座席表を見ています。「1列目：受付、2列目：営業部、3列目：経理部、4列目：人事部」。経理部のフロアに行きたいとき、何列目に行きますか。",
          scenario: "オフィスフロアの座席表。",
          explanationVi: "Sơ đồ chỗ ngồi: hàng 3 = phòng kế toán.",
          skillTag: "floor-map-reading",
          difficulty: "easy",
          options: opts(
            "1列目。",
            "2列目。",
            "3列目。",
            "4列目。",
            "C"
          ),
        },
        {
          prompt: "会議の出席者リストを見ながら説明を聞いています。「この会議には営業部から3名、技術部から2名、計5名が出席します。技術部の吉田さんは欠席で、代わりに林さんが出席します」。技術部から出席するのは誰ですか。",
          scenario: "会議の出席確認。リストを見ている。",
          explanationVi: "Phòng kỹ thuật: Yoshida vắng, thay bằng Hayashi. 2 người phòng kỹ thuật tham dự (1 người gốc + Hayashi).",
          skillTag: "attendance-tracking",
          difficulty: "standard",
          options: opts(
            "吉田さんと林さん。",
            "吉田さんだけ。",
            "林さんともう1人の技術部員。",
            "林さんだけ。",
            "C"
          ),
        },
        {
          prompt: "給与明細を見ています。「基本給200,000円、残業手当15,000円、通勤手当10,000円、控除合計35,000円、差引支給額190,000円」。手取り額はいくらですか。",
          scenario: "給与明細書を確認している。",
          explanationVi: "Lương cơ bản 200k + OT 15k + đi lại 10k = 225k. Trừ 35k → thực nhận 190,000 yên.",
          skillTag: "payslip-reading",
          difficulty: "standard",
          options: opts(
            "200,000円。",
            "225,000円。",
            "190,000円。",
            "215,000円。",
            "C"
          ),
        },
        {
          prompt: "電車の時刻表を見ながら説明を聞いています。「この電車は各駅停車で、次の急行は15分後です。急行なら○○駅まで20分、各駅だと35分かかります」。急いでいる場合、どうしますか。",
          scenario: "駅のホーム。時刻表を見ている。",
          explanationVi: "Tàu chậm: 35 phút. Tàu nhanh: 20 phút nhưng 15 phút nữa mới có. Nếu gấp → đợi tàu nhanh.",
          skillTag: "transport-decision",
          difficulty: "hard",
          options: opts(
            "各駅停車に乗る。",
            "15分待って急行に乗る。",
            "タクシーに乗る。",
            "バスに乗る。",
            "B"
          ),
        },
        {
          prompt: "社内の健康診断の案内を見ています。「日時：5月20日・21日　場所：3階会議室B　予約制（1人30分）　前日の夜9時以降は飲食禁止」。健康診断の前日、何に気をつけますか。",
          scenario: "健康診断の案内ポスター。",
          explanationVi: "Khám sức khỏe: đêm trước 21h trở đi không được ăn uống.",
          skillTag: "health-check-prep",
          difficulty: "hard",
          options: opts(
            "早く寝る。",
            "夜9時以降は何も食べたり飲んだりしない。",
            "運動をする。",
            "薬を飲む。",
            "B"
          ),
        },
      ],
    },
    {
      code: "LR_INTEGRATED",
      titleVi: "Nghe-đọc tổng hợp",
      titleJa: "総合聴読解問題",
      questions: [
        {
          prompt: "上司がシフト表を見ながら説明しています。「来週は山田が月・火、佐藤が水・木、田中が金・土の担当ね。日曜は全員休みだよ」。水曜日の担当は誰ですか。",
          scenario: "シフト表を見ながらの打ち合わせ。",
          explanationVi: "Lịch tuần sau: Yamada T2-T3, Sato T4-T5, Tanaka T6-T7. Thứ Tư = Sato.",
          skillTag: "shift-reading",
          difficulty: "easy",
          options: opts(
            "山田さん。",
            "佐藤さん。",
            "田中さん。",
            "全員。",
            "B"
          ),
        },
        {
          prompt: "営業の人が見積書を見せながら話しています。「商品A：10個×500円＝5,000円、商品B：5個×1,000円＝5,000円、送料500円、合計10,500円です。10,000円以上で送料無料なので、送料はかかりません」。支払い額はいくらですか。",
          scenario: "取引先と見積書を確認中。",
          explanationVi: "A: 5,000 + B: 5,000 = 10,000. Trên 10,000 → miễn phí ship. Tổng = 10,000 yên.",
          skillTag: "quotation-calculation",
          difficulty: "standard",
          options: opts(
            "10,500円。",
            "10,000円。",
            "5,000円。",
            "11,000円。",
            "B"
          ),
        },
        {
          prompt: "旅行会社のパンフレットを見ながら説明を聞いています。「Aプラン：1泊2食付き25,000円、Bプラン：1泊朝食のみ18,000円、Cプラン：素泊まり12,000円。お子様は全プラン半額です」。大人2人と子供1人でBプランの場合、合計いくらですか。",
          scenario: "旅行の予約相談。パンフレットを見ている。",
          explanationVi: "Plan B: 18,000/người lớn. Trẻ em nửa giá = 9,000. Tổng: 18k×2 + 9k = 45,000 yên.",
          skillTag: "price-calculation",
          difficulty: "hard",
          options: opts(
            "54,000円。",
            "45,000円。",
            "36,000円。",
            "27,000円。",
            "B"
          ),
        },
        {
          prompt: "社内研修のスケジュールを見ながら説明を聞いています。「9:00 受付、9:30 オリエンテーション、10:00 ビジネスマナー講座、12:00 昼食、13:00 グループワーク、15:00 発表、16:00 閉会」。グループワークは何時間ですか。",
          scenario: "研修のスケジュール表を配布されて説明を聞いている。",
          explanationVi: "Group work: 13:00-15:00 = 2 tiếng.",
          skillTag: "schedule-duration",
          difficulty: "standard",
          options: opts(
            "1時間。",
            "2時間。",
            "3時間。",
            "30分。",
            "B"
          ),
        },
        {
          prompt: "電器店のチラシを見ながら店員が説明しています。「このエアコンは通常価格98,000円ですが、今週末限定で20%オフです。さらに古いエアコンの下取りで5,000円引きになります」。下取りありで買うといくらですか。",
          scenario: "電器店でエアコンを検討中。チラシを持っている。",
          explanationVi: "Giá gốc 98,000 × 80% = 78,400. Trừ đổi cũ 5,000 → 73,400 yên.",
          skillTag: "discount-calculation",
          difficulty: "hard",
          options: opts(
            "78,400円。",
            "73,400円。",
            "93,000円。",
            "74,200円。",
            "B"
          ),
        },
      ],
    },
    {
      code: "RC_VOCAB_GRAMMAR",
      titleVi: "Từ vựng - Ngữ pháp",
      titleJa: "語彙・文法問題",
      questions: [
        {
          prompt: "部長に報告書を＿＿いただきました。",
          scenario: null,
          explanationVi: "'ご確認' — kính ngữ: 'Đã được trưởng phòng xác nhận báo cáo'.",
          skillTag: "honorific-verb",
          difficulty: "standard",
          options: opts("確認して", "ご確認", "確認を", "確認する", "B"),
        },
        {
          prompt: "この件について＿＿ご連絡いたします。",
          scenario: null,
          explanationVi: "'改めて' = sẽ liên lạc lại (một lần nữa/chính thức). Dùng trong email/điện thoại công việc.",
          skillTag: "business-adverb",
          difficulty: "standard",
          options: opts("改めて", "初めて", "始めて", "重ねて", "A"),
        },
        {
          prompt: "お客様をお待たせ＿＿申し訳ございません。",
          scenario: null,
          explanationVi: "'して' — 'Xin lỗi đã để quý khách chờ'. Cấu trúc: お待たせして + 申し訳ございません.",
          skillTag: "apology-pattern",
          difficulty: "easy",
          options: opts("する", "して", "した", "しまい", "B"),
        },
        {
          prompt: "会議の＿＿を取ってください。",
          scenario: null,
          explanationVi: "'議事録' = biên bản họp. 'Hãy ghi biên bản cuộc họp.'",
          skillTag: "business-vocabulary",
          difficulty: "standard",
          options: opts("記録", "議事録", "メモ", "日記", "B"),
        },
        {
          prompt: "ご不明な点が＿＿、お気軽にお問い合わせください。",
          scenario: null,
          explanationVi: "'ございましたら' = nếu có (dạng lịch sự nhất). 'Nếu có điểm nào chưa rõ...'",
          skillTag: "conditional-keigo",
          difficulty: "hard",
          options: opts("あれば", "あったら", "ございましたら", "ありましたら", "C"),
        },
        {
          prompt: "社長は来週、海外に＿＿予定です。",
          scenario: null,
          explanationVi: "'出張される' — kính ngữ của 出張する. 'Giám đốc dự định đi công tác nước ngoài tuần tới.'",
          skillTag: "honorific-schedule",
          difficulty: "standard",
          options: opts("出張する", "出張される", "出張させる", "出張した", "B"),
        },
        {
          prompt: "このプロジェクトの＿＿は来月末です。",
          scenario: null,
          explanationVi: "'納期' = deadline giao hàng. 'Hạn chót dự án là cuối tháng sau.'",
          skillTag: "business-term",
          difficulty: "standard",
          options: opts("期限", "納期", "始まり", "予定", "B"),
        },
        {
          prompt: "予算を＿＿しないように注意してください。",
          scenario: null,
          explanationVi: "'超過' = vượt quá. 'Hãy cẩn thận đừng vượt ngân sách.'",
          skillTag: "financial-term",
          difficulty: "hard",
          options: opts("超過", "増加", "拡大", "膨張", "A"),
        },
        {
          prompt: "＿＿ながら申し上げますが、その提案は難しいかと思います。",
          scenario: null,
          explanationVi: "'恐れ入り' = 'Xin thứ lỗi nhưng...' — mở đầu lịch sự khi từ chối.",
          skillTag: "refusal-cushion",
          difficulty: "hard",
          options: opts("すみません", "恐れ入り", "申し訳", "残念", "B"),
        },
        {
          prompt: "添付ファイルをご＿＿ください。",
          scenario: null,
          explanationVi: "'ご確認' — 'Xin vui lòng kiểm tra file đính kèm.' Kính ngữ trong email.",
          skillTag: "email-keigo",
          difficulty: "easy",
          options: opts("確認", "見て", "チェック", "読んで", "A"),
        },
        {
          prompt: "先日は大変お世話に＿＿。",
          scenario: null,
          explanationVi: "'なりました' — 'Hôm trước đã được anh/chị giúp đỡ rất nhiều.' Câu cảm ơn công việc.",
          skillTag: "gratitude-formula",
          difficulty: "easy",
          options: opts("しました", "なりました", "ありました", "いたしました", "B"),
        },
        {
          prompt: "彼は入社3年目＿＿、もうプロジェクトリーダーを任されている。",
          scenario: null,
          explanationVi: "'にもかかわらず' = mặc dù. Dù mới vào năm thứ 3 mà đã được giao làm leader.",
          skillTag: "contrast-connector",
          difficulty: "hard",
          options: opts("なのに", "にもかかわらず", "だから", "それで", "B"),
        },
        {
          prompt: "来月の研修に＿＿いただけますでしょうか。",
          scenario: null,
          explanationVi: "'ご参加' — kính ngữ: 'Quý vị có thể tham gia khóa đào tạo tháng sau không?'",
          skillTag: "invitation-keigo",
          difficulty: "standard",
          options: opts("参加して", "ご参加", "参加を", "参加する", "B"),
        },
        {
          prompt: "在庫が＿＿次第、ご連絡いたします。",
          scenario: null,
          explanationVi: "'確認でき' — 'Ngay khi xác nhận được hàng tồn kho, sẽ liên lạc.' ～次第 = ngay khi.",
          skillTag: "business-conditional",
          difficulty: "hard",
          options: opts("確認する", "確認した", "確認でき", "確認の", "C"),
        },
        {
          prompt: "社員証を＿＿入場してください。",
          scenario: null,
          explanationVi: "'提示して' = xuất trình. 'Xin xuất trình thẻ nhân viên để vào.'",
          skillTag: "instruction-verb",
          difficulty: "standard",
          options: opts("見せて", "提示して", "持って", "出して", "B"),
        },
      ],
    },
    {
      code: "RC_EXPRESSION",
      titleVi: "Biểu đạt - Đọc hiểu",
      titleJa: "表現読解問題",
      questions: [
        {
          prompt: "メールで取引先に資料を送るとき「＿＿」",
          scenario: null,
          explanationVi: "'Xin gửi kèm tài liệu.' — dạng kính ngữ trong email công việc.",
          skillTag: "email-attachment",
          difficulty: "easy",
          options: opts(
            "資料を送ります。",
            "資料を添付いたしましたので、ご確認のほどよろしくお願いいたします。",
            "資料はこれです。見てください。",
            "添付しました。",
            "B"
          ),
        },
        {
          prompt: "お客様の依頼を断るとき「＿＿」",
          scenario: null,
          explanationVi: "Từ chối lịch sự: 'Rất tiếc nhưng rất khó để đáp ứng yêu cầu lần này.'",
          skillTag: "polite-refusal",
          difficulty: "standard",
          options: opts(
            "それはできません。",
            "大変申し訳ございませんが、今回のご要望にはお応えしかねます。",
            "無理です。",
            "難しいと思います。",
            "B"
          ),
        },
        {
          prompt: "上司に提案するとき「＿＿」",
          scenario: null,
          explanationVi: "'Tôi có một đề xuất nhỏ...' — mở đầu lịch sự khi đề xuất với cấp trên.",
          skillTag: "proposal-opening",
          difficulty: "standard",
          options: opts(
            "こうした方がいいと思います。",
            "差し出がましいようですが、一つご提案がございます。",
            "提案があります。聞いてください。",
            "いい考えがあるんですが。",
            "B"
          ),
        },
        {
          prompt: "会議の最後に「＿＿」",
          scenario: null,
          explanationVi: "Kết thúc cuộc họp: 'Nếu không có ý kiến nào khác, xin kết thúc cuộc họp.'",
          skillTag: "meeting-closing",
          difficulty: "standard",
          options: opts(
            "じゃあ終わりにしましょう。",
            "他にご質問がなければ、本日の会議はこれで終了とさせていただきます。",
            "もう終わりです。",
            "会議は終わりです。帰ってください。",
            "B"
          ),
        },
        {
          prompt: "体調が悪くて休みたいとき、上司に「＿＿」",
          scenario: null,
          explanationVi: "'Xin lỗi nhưng vì sức khỏe không tốt, xin phép được nghỉ hôm nay.'",
          skillTag: "sick-leave-request",
          difficulty: "standard",
          options: opts(
            "今日は休みます。",
            "申し訳ございませんが、体調が悪いため、本日お休みをいただけないでしょうか。",
            "具合が悪いので帰ります。",
            "熱があります。",
            "B"
          ),
        },
        {
          prompt: "相手のメールに返信するとき「＿＿」",
          scenario: null,
          explanationVi: "'Cảm ơn đã liên lạc.' — câu mở đầu khi trả lời email.",
          skillTag: "email-reply-opening",
          difficulty: "easy",
          options: opts(
            "メールありがとう。",
            "ご連絡いただきありがとうございます。",
            "メールを読みました。",
            "返事します。",
            "B"
          ),
        },
        {
          prompt: "お客様に商品を勧めるとき「＿＿」",
          scenario: null,
          explanationVi: "'Sản phẩm này được nhiều khách hàng đánh giá cao.' — giới thiệu sản phẩm lịch sự.",
          skillTag: "product-recommendation",
          difficulty: "standard",
          options: opts(
            "これ、いいですよ。買ってください。",
            "こちらの商品は多くのお客様にご好評をいただいております。",
            "これが一番売れています。",
            "安いから買った方がいいです。",
            "B"
          ),
        },
        {
          prompt: "取引先との約束に遅刻しそうなとき「＿＿」",
          scenario: null,
          explanationVi: "Báo trước sẽ đến trễ: 'Rất xin lỗi nhưng do tàu trễ, có thể đến muộn khoảng 10 phút.'",
          skillTag: "lateness-notification",
          difficulty: "hard",
          options: opts(
            "遅れます。",
            "大変申し訳ございません。電車遅延のため、10分ほど遅れる見込みです。",
            "ちょっと遅くなります。",
            "遅刻します。すみません。",
            "B"
          ),
        },
        {
          prompt: "先輩に仕事のやり方を教わった後「＿＿」",
          scenario: null,
          explanationVi: "'Cảm ơn đã dành thời gian chỉ dạy.' — cảm ơn tiền bối sau khi được hướng dẫn.",
          skillTag: "learning-gratitude",
          difficulty: "hard",
          options: opts(
            "ありがとう。わかった。",
            "お忙しいところ、丁寧に教えていただきありがとうございました。",
            "なるほど。そうするんですね。",
            "勉強になりました。",
            "B"
          ),
        },
        {
          prompt: "社内メールで全員に連絡するとき「＿＿」",
          scenario: null,
          explanationVi: "'Gửi toàn thể nhân viên' — tiêu đề/đầu email nội bộ.",
          skillTag: "internal-email-address",
          difficulty: "easy",
          options: opts(
            "みなさんへ。",
            "社員各位",
            "みんな、聞いてください。",
            "関係者の皆様",
            "B"
          ),
        },
      ],
    },
    {
      code: "RC_INTEGRATED",
      titleVi: "Đọc hiểu tổng hợp",
      titleJa: "総合読解問題",
      questions: [
        {
          prompt: "次のメールを読んでください。\n\n「件名：備品発注について\n総務部各位\n下記の備品が不足しています。必要な方は本日中に数量をご連絡ください。\n・コピー用紙（A4）\n・ボールペン（黒）\n・付箋（大）\n発注は毎週金曜日に行います。\n総務部 木村」\n\n備品がほしい場合、いつまでに連絡しますか。",
          scenario: null,
          explanationVi: "Email yêu cầu báo số lượng văn phòng phẩm trong ngày hôm nay.",
          skillTag: "deadline-extraction",
          difficulty: "easy",
          options: opts(
            "金曜日まで。",
            "来週まで。",
            "今日中。",
            "明日まで。",
            "C"
          ),
        },
        {
          prompt: "次の掲示を読んでください。\n\n「駐車場利用規則\n・社員は事前申請制です（月額5,000円）\n・来客用は受付に申し出てください（無料・2時間まで）\n・バイク・自転車は別の駐輪場をご利用ください\n・違反車両はレッカー移動します」\n\n来客の車はどうしますか。",
          scenario: null,
          explanationVi: "Xe khách: báo lễ tân, miễn phí trong 2 giờ.",
          skillTag: "rule-application",
          difficulty: "standard",
          options: opts(
            "月額5,000円を払う。",
            "受付に申し出て、2時間まで無料で使える。",
            "駐輪場に停める。",
            "近くのコインパーキングを使う。",
            "B"
          ),
        },
        {
          prompt: "次のメールを読んでください。\n\n「件名：出張報告書の提出について\nお疲れ様です。\n出張から戻った方は、5営業日以内に出張報告書を提出してください。\nフォーマットは社内ポータルの「書式集」からダウンロードできます。\n提出先は直属の上司です。\n経費精算は報告書提出後に行ってください。\n経理部」\n\n出張報告書はどこから入手しますか。",
          scenario: null,
          explanationVi: "Mẫu báo cáo công tác: tải từ 'Bộ sưu tập biểu mẫu' trên cổng thông tin nội bộ.",
          skillTag: "procedure-extraction",
          difficulty: "standard",
          options: opts(
            "経理部でもらう。",
            "上司からもらう。",
            "社内ポータルの書式集からダウンロードする。",
            "メールに添付されている。",
            "C"
          ),
        },
        {
          prompt: "次の社内通知を読んでください。\n\n「セキュリティ強化のお知らせ\n来月1日より、以下の変更を実施します。\n1. 入退館にはICカードが必要です\n2. 来客は必ず受付で入館証を発行してください\n3. 退館時に入館証を返却してください\n4. カードの紛失は即日セキュリティ部に届け出てください\n※ICカード未発行の方は総務部まで」\n\nICカードをまだ持っていない場合、どうしますか。",
          scenario: null,
          explanationVi: "Chưa có thẻ IC → liên hệ phòng tổng vụ.",
          skillTag: "instruction-following",
          difficulty: "standard",
          options: opts(
            "セキュリティ部に行く。",
            "受付で入館証をもらう。",
            "総務部に連絡する。",
            "来月まで待つ。",
            "C"
          ),
        },
        {
          prompt: "次の求人情報を読んでください。\n\n「一般事務スタッフ募集\n勤務地：東京都新宿区\n勤務時間：9:00～18:00（休憩1時間）\n給与：月給22万円～（経験による）\n休日：土日祝、年末年始、夏季休暇\n応募条件：基本的なPC操作ができる方、Excel・Word使用経験のある方優遇\n応募方法：履歴書と職務経歴書をメールでお送りください」\n\n実際の労働時間は1日何時間ですか。",
          scenario: null,
          explanationVi: "9:00-18:00 = 9 tiếng, trừ nghỉ 1 tiếng → 8 tiếng làm việc thực tế.",
          skillTag: "work-condition-calc",
          difficulty: "standard",
          options: opts(
            "9時間。",
            "8時間。",
            "7時間。",
            "10時間。",
            "B"
          ),
        },
        {
          prompt: "次のメールを読んでください。\n\n「件名：フロア移動のお知らせ\n営業部各位\n6月1日より、営業部は3階から5階に移動します。\n5月30日に引っ越し作業を行いますので、前日までにデスクの私物を段ボールに入れてください。\nパソコンはIT部が移動しますので、そのままにしてください。\n不要な書類はシュレッダーにかけてください。\n総務部」\n\n社員がすることは何ですか。",
          scenario: null,
          explanationVi: "Nhân viên tự đóng gói đồ cá nhân vào thùng trước 29/5. PC để nguyên (IT lo). Tài liệu không cần → hủy.",
          skillTag: "action-extraction",
          difficulty: "hard",
          options: opts(
            "パソコンを5階に持っていく。",
            "私物を段ボールに入れて、不要な書類をシュレッダーにかける。",
            "引っ越し業者に電話する。",
            "6月1日に自分で荷物を運ぶ。",
            "B"
          ),
        },
        {
          prompt: "次の案内を読んでください。\n\n「社内英語研修のお知らせ\n対象：全社員（任意参加）\n日時：毎週火曜 18:00～19:30\n場所：4階研修室\n講師：外部ネイティブ講師\n費用：会社負担（テキスト代1,500円のみ自己負担）\n申込：人事部山本まで（定員20名・先着順）」\n\n自分で払うものは何ですか。",
          scenario: null,
          explanationVi: "Khóa học tiếng Anh: công ty trả, riêng tiền giáo trình 1500 yên tự trả.",
          skillTag: "cost-detail",
          difficulty: "hard",
          options: opts(
            "研修費全額。",
            "テキスト代1,500円。",
            "講師への謝礼。",
            "何も払わなくてよい。",
            "B"
          ),
        },
        {
          prompt: "次の通知を読んでください。\n\n「電話応対マニュアル（抜粋）\n1. 3コール以内に出る\n2. 「はい、○○株式会社でございます」と名乗る\n3. 相手の名前と用件をメモする\n4. 担当者に取り次ぐ。不在の場合は折り返しの連絡先を聞く\n5. 「お電話ありがとうございました」で締める」\n\n担当者がいないとき、何をしますか。",
          scenario: null,
          explanationVi: "Khi người phụ trách vắng: hỏi số liên lạc để gọi lại.",
          skillTag: "phone-manual",
          difficulty: "hard",
          options: opts(
            "電話を切る。",
            "折り返しの連絡先を聞く。",
            "他の人に代わる。",
            "メールで連絡する。",
            "B"
          ),
        },
        {
          prompt: "次のメールを読んでください。\n\n「件名：今週の予定共有\n営業1課各位\n今週の予定です。\n月：全体朝礼（9:00）＋ 通常業務\n火：A社訪問（田中・山田）、B社提案書作成（佐藤）\n水：チームミーティング（15:00）\n木：C社納品対応（全員）\n金：月次報告書提出日\n佐藤」\n\n水曜日に何がありますか。",
          scenario: null,
          explanationVi: "Thứ Tư: họp team lúc 15:00.",
          skillTag: "schedule-extraction",
          difficulty: "easy",
          options: opts(
            "A社訪問。",
            "全体朝礼。",
            "チームミーティング。",
            "月次報告書提出。",
            "C"
          ),
        },
        {
          prompt: "次の規則を読んでください。\n\n「会議室予約ルール\n・予約は社内システムから（最大2週間先まで）\n・1回の予約は最大2時間\n・10分前からの入室可\n・終了時間を過ぎたら速やかに退室\n・キャンセルは前日17時まで\n・連続予約は不可（最低30分空ける）」\n\n10時から12時まで予約して、12時から14時もまた予約できますか。",
          scenario: null,
          explanationVi: "Không được đặt liên tiếp — phải cách ít nhất 30 phút.",
          skillTag: "rule-application",
          difficulty: "hard",
          options: opts(
            "はい、できます。",
            "いいえ、連続予約は不可で、最低30分空ける必要があります。",
            "12時半からなら予約できます。",
            "上司の許可があればできます。",
            "B"
          ),
        },
      ],
    },
  ],
};
