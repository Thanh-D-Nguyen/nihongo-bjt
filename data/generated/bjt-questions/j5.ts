/**
 * BJT J5 Level Questions — 基礎レベル (Basic)
 * Score range: 0-199
 *
 * Target: Learners who can handle basic daily business greetings,
 * simple instructions, basic です/ます polite forms.
 * Contexts: convenience store, restaurant reception, simple office tasks,
 * factory line, cleaning, basic customer service.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J5_DATA: SeedLevelData = {
  level: "J5",
  slug: "bjt-j5-practice-v3",
  titleVi: "Đề luyện BJT J5 — Cơ bản",
  titleJa: "BJT J5 練習テスト — 基礎レベル",
  sections: [
    // ======================== LC_SCENE (12) ========================
    {
      code: "LC_SCENE",
      titleVi: "Nắm bắt tình huống",
      titleJa: "場面把握問題",
      questions: [
        {
          prompt: "コンビニの店員が「いらっしゃいませ」と言っています。お客さんはレジの前に立っています。",
          scenario: "コンビニのレジ前。お客さんがお弁当を持って並んでいる。",
          explanationVi: "Nhân viên cửa hàng tiện lợi chào khách 'Xin mời'. Khách đang đứng trước quầy thanh toán với hộp cơm.",
          skillTag: "greeting-recognition",
          difficulty: "easy",
          options: opts(
            "お客さんが商品を棚に戻しています。",
            "お客さんが買い物をしようとしています。",
            "店員が休憩をしています。",
            "お客さんが店を出ようとしています。",
            "B"
          ),
        },
        {
          prompt: "レストランのウェイターが「ご注文はお決まりですか」と聞いています。お客さんはメニューを見ています。",
          scenario: "レストランのテーブル。お客さん2人がメニューを広げている。",
          explanationVi: "Phục vụ hỏi 'Quý khách đã chọn món chưa?'. Khách đang xem menu.",
          skillTag: "situation-comprehension",
          difficulty: "easy",
          options: opts(
            "お客さんは食事が終わったところです。",
            "ウェイターが料理を運んでいます。",
            "お客さんはこれから注文するところです。",
            "お客さんがお会計をしています。",
            "C"
          ),
        },
        {
          prompt: "受付の人が「おはようございます。ご用件をお聞かせください」と言っています。訪問者がカバンを持って立っています。",
          scenario: "会社の受付ロビー。朝の時間帯。",
          explanationVi: "Lễ tân chào buổi sáng và hỏi mục đích đến. Khách đến mang cặp.",
          skillTag: "greeting-recognition",
          difficulty: "easy",
          options: opts(
            "訪問者が帰ろうとしています。",
            "受付の人が退勤しています。",
            "訪問者が会社を訪れたところです。",
            "受付が閉まっています。",
            "C"
          ),
        },
        {
          prompt: "工場で班長が「この部品を箱に入れてください」と言っています。新しい作業員が部品を手に持っています。",
          scenario: "工場の組立ライン。部品と箱が作業台に並んでいる。",
          explanationVi: "Trưởng nhóm yêu cầu 'Hãy bỏ linh kiện này vào hộp'. Công nhân mới đang cầm linh kiện.",
          skillTag: "instruction-comprehension",
          difficulty: "easy",
          options: opts(
            "作業員が部品を検査しています。",
            "作業員が部品を箱に入れる指示を受けています。",
            "班長が機械を修理しています。",
            "作業員が休憩をしています。",
            "B"
          ),
        },
        {
          prompt: "ホテルのフロントで「チェックインですか」とスタッフが聞いています。お客さんがスーツケースを持っています。",
          scenario: "ホテルのフロントデスク。夕方。",
          explanationVi: "Nhân viên lễ tân khách sạn hỏi 'Quý khách check-in ạ?'. Khách mang vali.",
          skillTag: "situation-comprehension",
          difficulty: "easy",
          options: opts(
            "お客さんがチェックアウトしています。",
            "お客さんがホテルに到着したところです。",
            "スタッフが掃除をしています。",
            "お客さんがレストランを探しています。",
            "B"
          ),
        },
        {
          prompt: "スーパーのスタッフが「袋はご利用ですか」と聞いています。お客さんが商品をレジに置いています。",
          scenario: "スーパーマーケットのレジ。エコバッグを持っていないお客さん。",
          explanationVi: "Nhân viên hỏi 'Quý khách có dùng túi không?'. Khách đặt hàng lên quầy.",
          skillTag: "service-interaction",
          difficulty: "easy",
          options: opts(
            "お客さんが袋を必要とするか聞いています。",
            "スタッフが商品を棚に並べています。",
            "お客さんが返品しています。",
            "スタッフが閉店の準備をしています。",
            "A"
          ),
        },
        {
          prompt: "宅配便のドライバーが「こちらにサインをお願いします」と言っています。受け取る人がペンを持っています。",
          scenario: "マンションの玄関前。宅配便の荷物が1つ。",
          explanationVi: "Tài xế giao hàng yêu cầu 'Xin ký tên vào đây'. Người nhận cầm bút.",
          skillTag: "instruction-comprehension",
          difficulty: "standard",
          options: opts(
            "ドライバーが荷物を集荷しています。",
            "荷物の受け取りのサインを求めています。",
            "ドライバーが道を聞いています。",
            "荷物を返送しています。",
            "B"
          ),
        },
        {
          prompt: "清掃員が「この部屋は今掃除中です。少しお待ちください」と言っています。ドアの前に「清掃中」の看板があります。",
          scenario: "オフィスビルのトイレ前。",
          explanationVi: "Nhân viên vệ sinh nói 'Phòng đang dọn dẹp, xin vui lòng đợi'. Có biển 'Đang dọn dẹp'.",
          skillTag: "instruction-comprehension",
          difficulty: "standard",
          options: opts(
            "部屋の掃除が終わったところです。",
            "清掃員が休憩をしています。",
            "部屋は今使えません。",
            "部屋の鍵が壊れています。",
            "C"
          ),
        },
        {
          prompt: "バスのドライバーが「次は○○駅前です。お降りの方はボタンを押してください」と言っています。",
          scenario: "路線バスの車内。乗客が数人座っている。",
          explanationVi: "Tài xế xe buýt thông báo trạm tiếp theo và yêu cầu bấm nút nếu muốn xuống.",
          skillTag: "announcement-comprehension",
          difficulty: "standard",
          options: opts(
            "バスが終点に着きました。",
            "次の停留所の案内をしています。",
            "バスが故障しました。",
            "ドライバーが道を間違えました。",
            "B"
          ),
        },
        {
          prompt: "郵便局の窓口で「この荷物は速達でよろしいですか」と聞いています。お客さんが小さな箱を出しています。",
          scenario: "郵便局の窓口。",
          explanationVi: "Nhân viên bưu điện hỏi xác nhận 'Gói này gửi nhanh được chứ ạ?'",
          skillTag: "service-confirmation",
          difficulty: "standard",
          options: opts(
            "お客さんが手紙を受け取っています。",
            "荷物の送り方を確認しています。",
            "窓口が閉まっています。",
            "お客さんが切手を買っています。",
            "B"
          ),
        },
        {
          prompt: "ドラッグストアのスタッフが「ポイントカードはお持ちですか」と聞いています。お客さんが財布を開けています。",
          scenario: "ドラッグストアのレジ。",
          explanationVi: "Nhân viên hỏi 'Quý khách có thẻ tích điểm không?'. Khách đang mở ví.",
          skillTag: "service-interaction",
          difficulty: "standard",
          options: opts(
            "スタッフがポイントカードについて聞いています。",
            "お客さんが薬の相談をしています。",
            "スタッフが商品を説明しています。",
            "お客さんが返品しています。",
            "A"
          ),
        },
        {
          prompt: "駅の改札で駅員が「このきっぷは期限が切れています」と言っています。お客さんが困った顔をしています。",
          scenario: "駅の改札口。お客さんがきっぷを持っている。",
          explanationVi: "Nhân viên ga nói 'Vé này đã hết hạn'. Khách tỏ vẻ lúng túng.",
          skillTag: "problem-identification",
          difficulty: "hard",
          options: opts(
            "お客さんのきっぷに問題があります。",
            "改札機が故障しています。",
            "駅員がきっぷを販売しています。",
            "お客さんが定期券を更新しています。",
            "A"
          ),
        },
      ],
    },
    // ======================== LC_STATEMENT (10) ========================
    {
      code: "LC_STATEMENT",
      titleVi: "Nghe hiểu phát ngôn",
      titleJa: "発言聴解問題",
      questions: [
        {
          prompt: "お店で「温めますか」と聞かれました。何と答えますか。",
          scenario: "コンビニでお弁当を買った場面。",
          explanationVi: "Nhân viên hỏi 'Có hâm nóng không?'. Trả lời lịch sự 'Vâng, làm ơn'.",
          skillTag: "polite-response",
          difficulty: "easy",
          options: opts(
            "はい、お願いします。",
            "いいえ、売り切れです。",
            "はい、持ち帰りです。",
            "いいえ、いりません。ありがとうございます。",
            "A"
          ),
        },
        {
          prompt: "上司に「明日は何時に来られますか」と聞かれました。朝9時に来ると答えます。",
          scenario: "オフィスで上司と話している場面。",
          explanationVi: "Sếp hỏi 'Ngày mai mấy giờ đến được?'. Trả lời sẽ đến lúc 9 giờ sáng.",
          skillTag: "polite-response",
          difficulty: "easy",
          options: opts(
            "9時に来ます。",
            "9時に参ります。",
            "9時に行くよ。",
            "9時でいいんじゃない？",
            "B"
          ),
        },
        {
          prompt: "電話がかかってきました。「○○株式会社の田中様でいらっしゃいますか」と聞かれました。田中さんは隣の席にいます。",
          scenario: "オフィスの電話。田中さんの代わりに電話を取った場面。",
          explanationVi: "Ai đó gọi hỏi tìm Tanaka. Tanaka ngồi bên cạnh. Trả lời đúng là chuyển máy.",
          skillTag: "phone-handling",
          difficulty: "standard",
          options: opts(
            "田中は今いません。",
            "少々お待ちください。田中に代わります。",
            "田中は忙しいです。",
            "田中は知りません。",
            "B"
          ),
        },
        {
          prompt: "お客さんが「トイレはどこですか」と聞いています。トイレは2階にあります。",
          scenario: "1階の店舗で接客中。",
          explanationVi: "Khách hỏi nhà vệ sinh ở đâu. Nhà vệ sinh ở tầng 2.",
          skillTag: "direction-giving",
          difficulty: "easy",
          options: opts(
            "トイレはありません。",
            "2階にございます。",
            "知りません。",
            "まっすぐ行ってください。",
            "B"
          ),
        },
        {
          prompt: "先輩に「この書類をコピーしてくれる？」と頼まれました。どう答えますか。",
          scenario: "オフィスで先輩から仕事を頼まれた場面。",
          explanationVi: "Tiền bối nhờ photocopy tài liệu. Trả lời đồng ý lịch sự.",
          skillTag: "polite-acceptance",
          difficulty: "easy",
          options: opts(
            "はい、すぐやります。",
            "自分でやってください。",
            "それは私の仕事じゃないです。",
            "コピー機がわかりません。",
            "A"
          ),
        },
        {
          prompt: "「お疲れ様です」と同僚に言われました。何と返しますか。",
          scenario: "夕方、オフィスで同僚とすれ違った場面。",
          explanationVi: "'Otsukaresama desu' là câu chào khi gặp đồng nghiệp. Đáp lại bằng cùng cụm từ.",
          skillTag: "greeting-response",
          difficulty: "easy",
          options: opts(
            "さようなら。",
            "おはようございます。",
            "お疲れ様です。",
            "失礼します。",
            "C"
          ),
        },
        {
          prompt: "店長に「今日のシフトは6時までです」と言われました。6時に帰っていいですか、と確認します。",
          scenario: "アルバイト先の飲食店。シフトの確認。",
          explanationVi: "Quản lý nói ca hôm nay đến 6 giờ. Xác nhận lịch sự có thể về lúc 6 giờ.",
          skillTag: "confirmation-request",
          difficulty: "standard",
          options: opts(
            "6時に上がってもよろしいですか。",
            "6時にまだ仕事がある？",
            "もう帰っていい？",
            "6時は早いです。",
            "A"
          ),
        },
        {
          prompt: "配達先で「ここに置いてください」と言われました。荷物を玄関に置きます。どう言いますか。",
          scenario: "宅配の仕事中。お客さんの家の前。",
          explanationVi: "Khách yêu cầu đặt hàng ở đây. Đặt xong và nói lời chào kết thúc.",
          skillTag: "completion-acknowledgment",
          difficulty: "standard",
          options: opts(
            "こちらに置きました。ありがとうございました。",
            "自分で持ってきてください。",
            "もう行きます。",
            "お金をください。",
            "A"
          ),
        },
        {
          prompt: "「すみません、この商品の値段を教えてください」とお客さんに聞かれました。値札を確認します。",
          scenario: "小売店で接客中。",
          explanationVi: "Khách hỏi giá sản phẩm. Kiểm tra giá và trả lời lịch sự.",
          skillTag: "price-inquiry-response",
          difficulty: "standard",
          options: opts(
            "知りません。",
            "確認いたしますので、少々お待ちください。",
            "自分で見てください。",
            "高いですよ。",
            "B"
          ),
        },
        {
          prompt: "上司が「今日は早く帰っていいよ」と言いました。お礼を言って帰ります。",
          scenario: "仕事が早く終わったオフィス。",
          explanationVi: "Sếp cho về sớm. Cảm ơn và chào lịch sự khi về.",
          skillTag: "gratitude-expression",
          difficulty: "hard",
          options: opts(
            "じゃあ帰ります。",
            "ありがとうございます。お先に失礼します。",
            "本当ですか。うれしいです。",
            "いいんですか？",
            "B"
          ),
        },
      ],
    },
    // ======================== LC_INTEGRATED (8) ========================
    {
      code: "LC_INTEGRATED",
      titleVi: "Nghe hiểu tổng hợp",
      titleJa: "総合聴解問題",
      questions: [
        {
          prompt: "店長が新しいアルバイトに仕事の流れを説明しています。「まず手を洗って、エプロンをつけて、それからレジに入ってください」。新しいアルバイトが最初にすることは何ですか。",
          scenario: "飲食店のバックヤード。新人研修中。",
          explanationVi: "Quản lý hướng dẫn: rửa tay → đeo tạp dề → vào quầy. Việc đầu tiên là rửa tay.",
          skillTag: "sequence-comprehension",
          difficulty: "easy",
          options: opts(
            "レジに入る。",
            "エプロンをつける。",
            "手を洗う。",
            "注文を取る。",
            "C"
          ),
        },
        {
          prompt: "駅のアナウンスです。「本日、強風のため、○○線は運転を見合わせております。振替輸送をご利用ください」。このアナウンスは何を伝えていますか。",
          scenario: "駅のホーム。電光掲示板にも情報が出ている。",
          explanationVi: "Thông báo ga: do gió mạnh, tuyến XX ngừng chạy, hãy dùng phương tiện thay thế.",
          skillTag: "announcement-comprehension",
          difficulty: "standard",
          options: opts(
            "電車が遅れている。",
            "電車が止まっていて、別の方法で行く必要がある。",
            "電車の時刻が変わった。",
            "駅が閉まっている。",
            "B"
          ),
        },
        {
          prompt: "コンビニの店長と店員が話しています。店長：「明日の朝、パンの納品が6時に来るから、5時半に開けてくれる？」店員：「はい、わかりました」。店員は明日何をしますか。",
          scenario: "コンビニのバックヤード。翌日のシフトの話。",
          explanationVi: "Quản lý nhờ mở cửa lúc 5:30 vì hàng bánh mì giao lúc 6:00.",
          skillTag: "task-identification",
          difficulty: "standard",
          options: opts(
            "パンを注文する。",
            "5時半に店を開ける。",
            "6時にパンを届ける。",
            "朝のシフトを休む。",
            "B"
          ),
        },
        {
          prompt: "病院の受付で案内しています。「初診の方は、まず1番の窓口で受付をしてから、2番の窓口で保険証をお見せください」。初めて来た人は最初にどこへ行きますか。",
          scenario: "病院の待合室。番号の窓口が2つ見える。",
          explanationVi: "Bệnh nhân lần đầu: đăng ký ở quầy 1 trước, rồi xuất trình bảo hiểm ở quầy 2.",
          skillTag: "procedure-comprehension",
          difficulty: "standard",
          options: opts(
            "2番の窓口。",
            "診察室。",
            "1番の窓口。",
            "薬局。",
            "C"
          ),
        },
        {
          prompt: "スーパーの店内放送です。「本日のタイムセール、お肉コーナーにて、国産豚肉が30%オフとなっております。5時までの限定です」。このセールはいつまでですか。",
          scenario: "スーパーマーケットの店内。午後の時間帯。",
          explanationVi: "Siêu thị thông báo giảm giá thịt heo 30%, đến 5 giờ.",
          skillTag: "time-detail-extraction",
          difficulty: "standard",
          options: opts(
            "閉店まで。",
            "3時まで。",
            "5時まで。",
            "明日まで。",
            "C"
          ),
        },
        {
          prompt: "引っ越し業者が説明しています。「大きい家具は私たちが運びます。小さい箱はお客様でお願いします。ただし、壊れやすいものはこちらで梱包しますので、教えてください」。お客さんがすることは何ですか。",
          scenario: "引っ越し当日。部屋に段ボール箱と大きな家具がある。",
          explanationVi: "Đội chuyển nhà vận chuyển đồ lớn. Khách tự mang hộp nhỏ. Đồ dễ vỡ báo để đội đóng gói.",
          skillTag: "task-distribution",
          difficulty: "hard",
          options: opts(
            "大きい家具を運ぶ。",
            "小さい箱を運んで、壊れやすいものを教える。",
            "全部の荷物を梱包する。",
            "壊れやすいものだけ運ぶ。",
            "B"
          ),
        },
        {
          prompt: "マンションの管理人が掲示板に張り紙をしています。「来週月曜日、水道の点検があります。9時から12時の間、水が出ません。水をためておいてください」。住民は何をしておくべきですか。",
          scenario: "マンションの掲示板前。",
          explanationVi: "Quản lý chung cư thông báo kiểm tra đường nước thứ Hai, 9-12h không có nước. Cần trữ nước trước.",
          skillTag: "preparation-identification",
          difficulty: "hard",
          options: opts(
            "月曜日に引っ越す。",
            "水をためておく。",
            "管理人に電話する。",
            "月曜日は家にいない。",
            "B"
          ),
        },
        {
          prompt: "バイト先の先輩が説明しています。「お客さんが来たら、まず『いらっしゃいませ』と言って、席に案内して、メニューを渡してね。水はセルフサービスだから、置いてある場所を教えてあげて」。お水について何と言いますか。",
          scenario: "ファミリーレストラン。新人の接客研修中。",
          explanationVi: "Tiền bối dặn: chào → dẫn chỗ ngồi → đưa menu → chỉ chỗ nước (tự phục vụ).",
          skillTag: "multi-step-instruction",
          difficulty: "hard",
          options: opts(
            "水を持っていく。",
            "水はありません。",
            "水はあちらにございます。ご自由にどうぞ。",
            "水は有料です。",
            "C"
          ),
        },
      ],
    },
    // ======================== LR_SITUATION (5) ========================
    {
      code: "LR_SITUATION",
      titleVi: "Nắm bắt tình huống (nghe-đọc)",
      titleJa: "状況把握問題",
      questions: [
        {
          prompt: "コンビニの入口に「アルバイト募集　時給1,050円　週3日～OK」と書いてあります。この紙は何を知らせていますか。",
          scenario: "コンビニの入口に貼り紙がある。通りがかりの人が見ている。",
          explanationVi: "Biển thông báo tuyển nhân viên part-time, 1050 yên/giờ, từ 3 ngày/tuần.",
          skillTag: "notice-comprehension",
          difficulty: "easy",
          options: opts(
            "新商品の案内。",
            "アルバイトを募集している。",
            "営業時間の変更。",
            "閉店のお知らせ。",
            "B"
          ),
        },
        {
          prompt: "エレベーターに「定員10名　最大積載量650kg」と書いてあります。今8人乗っています。あと何人乗れますか。",
          scenario: "オフィスビルのエレベーター内。",
          explanationVi: "Biển ghi tối đa 10 người. Hiện có 8 người → còn 2 người nữa.",
          skillTag: "numerical-comprehension",
          difficulty: "standard",
          options: opts(
            "あと5人。",
            "あと3人。",
            "あと2人。",
            "もう乗れない。",
            "C"
          ),
        },
        {
          prompt: "店の入口に「本日定休日」と書いてあります。お客さんが来ました。どうしますか。",
          scenario: "飲食店の前。看板が出ている。",
          explanationVi: "Biển ghi 'Hôm nay nghỉ'. Khách đến thì phải quay về — cửa hàng đóng cửa.",
          skillTag: "sign-comprehension",
          difficulty: "easy",
          options: opts(
            "中に入って待つ。",
            "今日は休みなので、別の日に来る。",
            "裏口から入る。",
            "電話をかけて開けてもらう。",
            "B"
          ),
        },
        {
          prompt: "駅の時刻表を見ています。「平日　始発5:12　終電23:45」「土日祝　始発5:30　終電23:15」。日曜日の終電は何時ですか。",
          scenario: "駅のホームに時刻表が掲示されている。",
          explanationVi: "Bảng giờ: ngày thường chuyến cuối 23:45, cuối tuần/lễ 23:15. Chủ nhật = 23:15.",
          skillTag: "schedule-reading",
          difficulty: "standard",
          options: opts(
            "23:45",
            "5:30",
            "5:12",
            "23:15",
            "D"
          ),
        },
        {
          prompt: "病院の受付に「診察受付時間　午前8:30～12:00　午後1:30～5:00　水曜午後・日曜・祝日は休診」と書いてあります。水曜日の午後に行けますか。",
          scenario: "病院の入口。受付時間の案内板。",
          explanationVi: "Bảng ghi: chiều thứ Tư, Chủ nhật, ngày lễ nghỉ khám. Chiều thứ Tư không đi được.",
          skillTag: "schedule-reading",
          difficulty: "hard",
          options: opts(
            "午後1:30から行ける。",
            "水曜日の午後は休みなので行けない。",
            "午後5時まで行ける。",
            "水曜日は一日中休み。",
            "B"
          ),
        },
      ],
    },
    // ======================== LR_DOCUMENT (5) ========================
    {
      code: "LR_DOCUMENT",
      titleVi: "Đọc tài liệu kết hợp nghe",
      titleJa: "資料聴読解問題",
      questions: [
        {
          prompt: "レストランのメニューを見ています。「ランチセット：パスタ＋サラダ＋ドリンク　980円（11:00～14:00限定）」。午後3時に来たら、ランチセットは頼めますか。",
          scenario: "レストラン。メニュー表を読みながら注文する場面。",
          explanationVi: "Set lunch 980 yên, giới hạn 11:00-14:00. Đến lúc 3 giờ chiều = hết thời gian.",
          skillTag: "time-restriction-comprehension",
          difficulty: "easy",
          options: opts(
            "はい、頼めます。",
            "いいえ、14時までなので頼めません。",
            "ドリンクだけ頼めます。",
            "980円追加で頼めます。",
            "B"
          ),
        },
        {
          prompt: "スーパーのチラシを見ています。「本日限り！卵1パック98円（お一人様2パックまで）」。一人で3パック買えますか。",
          scenario: "スーパーのチラシを見ている場面。",
          explanationVi: "Quảng cáo trứng 98 yên/hộp, giới hạn 2 hộp/người. Không mua được 3 hộp.",
          skillTag: "restriction-comprehension",
          difficulty: "standard",
          options: opts(
            "はい、3パック買えます。",
            "いいえ、2パックまでです。",
            "いいえ、1パックだけです。",
            "今日は買えません。",
            "B"
          ),
        },
        {
          prompt: "バスの路線図を見ています。○○駅前から△△病院まで行きたいです。路線図には「○○駅前→市役所前→△△病院前→公園前」と書いてあります。何番目のバス停で降りますか。",
          scenario: "バス停で路線図を確認している場面。",
          explanationVi: "Lộ trình: Ga XX → Tòa thị chính → Bệnh viện △△ → Công viên. Xuống trạm thứ 3 (trạm thứ 2 từ ga).",
          skillTag: "route-reading",
          difficulty: "standard",
          options: opts(
            "1番目。",
            "2番目。",
            "3番目。",
            "4番目。",
            "C"
          ),
        },
        {
          prompt: "商品の説明書を読んでいます。「使用方法：①フタを開ける ②中の液体をよく振る ③適量を手に取り、髪になじませる ④5分後に洗い流す」。液体を振った後、何をしますか。",
          scenario: "ヘアトリートメントの使用説明書。",
          explanationVi: "Hướng dẫn: lắc → lấy lượng vừa → thoa vào tóc → rửa sau 5 phút. Sau khi lắc → thoa tóc.",
          skillTag: "instruction-sequence",
          difficulty: "standard",
          options: opts(
            "フタを閉める。",
            "すぐ洗い流す。",
            "適量を手に取って髪につける。",
            "5分待つ。",
            "C"
          ),
        },
        {
          prompt: "アパートの掲示板に「ゴミの出し方：燃えるゴミ→月・木、燃えないゴミ→火、ペットボトル→水、朝8時までに出してください」と書いてあります。ペットボトルは何曜日に出しますか。",
          scenario: "アパートのゴミ置き場の掲示板。",
          explanationVi: "Lịch đổ rác: cháy được → T2/T5, không cháy → T3, chai nhựa → T4. Chai nhựa = thứ Tư.",
          skillTag: "schedule-extraction",
          difficulty: "hard",
          options: opts(
            "月曜日。",
            "火曜日。",
            "水曜日。",
            "木曜日。",
            "C"
          ),
        },
      ],
    },
    // ======================== LR_INTEGRATED (5) ========================
    {
      code: "LR_INTEGRATED",
      titleVi: "Nghe-đọc tổng hợp",
      titleJa: "総合聴読解問題",
      questions: [
        {
          prompt: "スーパーの店長が新人に説明しています。「このリストの順番で棚に並べてね。賞味期限が近いものを前に出して。これが今日届いた商品リストだよ」。リストには「牛乳(賞味期限5/3)、ヨーグルト(5/5)、チーズ(5/10)」と書いてあります。一番前に出すものは何ですか。",
          scenario: "スーパーのバックヤード。商品リストを見ながら。",
          explanationVi: "Sếp dặn: xếp theo thứ tự, đồ sắp hết hạn ra trước. Sữa (5/3) gần nhất → ra trước.",
          skillTag: "priority-determination",
          difficulty: "standard",
          options: opts(
            "ヨーグルト。",
            "チーズ。",
            "牛乳。",
            "全部同じ場所に置く。",
            "C"
          ),
        },
        {
          prompt: "駅の窓口で説明を聞いています。「この路線図をご覧ください。○○駅から××駅へは、△△駅で乗り換えてください。所要時間は約40分です」。路線図には赤い線と青い線が描いてあります。どこで乗り換えますか。",
          scenario: "駅の窓口。路線図を見ながら説明を聞いている。",
          explanationVi: "Nhân viên chỉ trên bản đồ: chuyển tàu ở ga △△. Mất khoảng 40 phút.",
          skillTag: "transfer-point-identification",
          difficulty: "standard",
          options: opts(
            "○○駅。",
            "××駅。",
            "△△駅。",
            "乗り換えなくてよい。",
            "C"
          ),
        },
        {
          prompt: "引っ越し業者が見積書を見せながら説明しています。「基本料金が30,000円、エアコンの取り外しが8,000円、合計38,000円です。ただし、土日は20%増しになります」。土曜日に頼むといくらですか。",
          scenario: "自宅で見積書を見ながら説明を聞いている。",
          explanationVi: "Cơ bản 30,000 + tháo máy lạnh 8,000 = 38,000. Cuối tuần +20% → 45,600 yên.",
          skillTag: "calculation-comprehension",
          difficulty: "hard",
          options: opts(
            "38,000円。",
            "30,000円。",
            "45,600円。",
            "46,000円。",
            "C"
          ),
        },
        {
          prompt: "クリーニング店で説明を聞いています。「料金表をご覧ください。ワイシャツは1枚200円、スーツ上下で1,500円です。5枚以上で10%引きになります」。ワイシャツ3枚とスーツ1着を出すといくらですか。",
          scenario: "クリーニング店のカウンター。料金表が貼ってある。",
          explanationVi: "Áo sơ mi 200×3=600 + Vest 1500 = 2100 yên. Tổng 4 món < 5 nên không giảm.",
          skillTag: "calculation-comprehension",
          difficulty: "hard",
          options: opts(
            "1,890円。",
            "2,100円。",
            "1,700円。",
            "2,300円。",
            "B"
          ),
        },
        {
          prompt: "市役所の窓口で説明を聞いています。「住所変更の届け出には、この用紙に記入して、身分証明書のコピーをつけてください。届け出は14日以内にお願いします」。届け出に必要なものは何ですか。",
          scenario: "市役所の窓口。申請用紙が置いてある。",
          explanationVi: "Đăng ký thay đổi địa chỉ cần: điền tờ khai + bản sao giấy tờ tùy thân, trong vòng 14 ngày.",
          skillTag: "requirement-identification",
          difficulty: "standard",
          options: opts(
            "用紙だけ。",
            "身分証明書の原本。",
            "記入した用紙と身分証明書のコピー。",
            "写真2枚。",
            "C"
          ),
        },
      ],
    },
    // ======================== RC_VOCAB_GRAMMAR (15) ========================
    {
      code: "RC_VOCAB_GRAMMAR",
      titleVi: "Từ vựng - Ngữ pháp",
      titleJa: "語彙・文法問題",
      questions: [
        {
          prompt: "明日は会議が＿＿ので、早く来てください。",
          scenario: null,
          explanationVi: "'ある' (có) phù hợp: 'Ngày mai có cuộc họp nên hãy đến sớm.'",
          skillTag: "basic-grammar",
          difficulty: "easy",
          options: opts("いる", "ある", "する", "なる", "B"),
        },
        {
          prompt: "この書類は＿＿までに提出してください。",
          scenario: null,
          explanationVi: "'金曜日' (thứ Sáu) — hỏi về hạn nộp, cần điền thời gian.",
          skillTag: "deadline-vocabulary",
          difficulty: "easy",
          options: opts("金曜日", "金曜日に", "金曜日で", "金曜日から", "A"),
        },
        {
          prompt: "お客様が＿＿になりました。",
          scenario: null,
          explanationVi: "'お見えになりました' là kính ngữ của '来ました' (đã đến).",
          skillTag: "basic-keigo",
          difficulty: "standard",
          options: opts("来て", "見えて", "お見え", "来られて", "C"),
        },
        {
          prompt: "すみません、もう少し＿＿話していただけますか。",
          scenario: null,
          explanationVi: "'ゆっくり' (chậm hơn) — Nhờ nói chậm hơn để nghe rõ.",
          skillTag: "adverb-usage",
          difficulty: "easy",
          options: opts("ゆっくり", "はやく", "おおきく", "ちいさく", "A"),
        },
        {
          prompt: "受付は1階に＿＿。",
          scenario: null,
          explanationVi: "'ございます' là dạng lịch sự nhất của 'あります' (có/ở).",
          skillTag: "polite-existence",
          difficulty: "standard",
          options: opts("います", "あります", "ございます", "おります", "C"),
        },
        {
          prompt: "この仕事は来週＿＿終わらせなければなりません。",
          scenario: null,
          explanationVi: "'までに' = trước thời điểm đó. Công việc phải xong trước tuần sau.",
          skillTag: "particle-usage",
          difficulty: "standard",
          options: opts("までに", "まで", "から", "より", "A"),
        },
        {
          prompt: "エアコンが＿＿いるので、暑いです。",
          scenario: null,
          explanationVi: "'壊れて' (bị hỏng) — Máy lạnh bị hỏng nên nóng.",
          skillTag: "te-form",
          difficulty: "standard",
          options: opts("壊して", "壊れて", "壊す", "壊れる", "B"),
        },
        {
          prompt: "昨日＿＿メールを確認しましたか。",
          scenario: null,
          explanationVi: "'送った' (đã gửi) — 'Bạn đã kiểm tra email gửi hôm qua chưa?'",
          skillTag: "past-tense",
          difficulty: "easy",
          options: opts("送る", "送って", "送った", "送り", "C"),
        },
        {
          prompt: "会議室は3階＿＿あります。",
          scenario: null,
          explanationVi: "'に' — trợ từ chỉ vị trí. Phòng họp ở tầng 3.",
          skillTag: "particle-location",
          difficulty: "easy",
          options: opts("で", "に", "を", "が", "B"),
        },
        {
          prompt: "この商品は人気＿＿、すぐ売り切れました。",
          scenario: null,
          explanationVi: "'なので' = vì (dạng lịch sự của だから). Sản phẩm phổ biến nên hết ngay.",
          skillTag: "reason-connector",
          difficulty: "standard",
          options: opts("だから", "なので", "けど", "でも", "B"),
        },
        {
          prompt: "＿＿を押してから、コピーのボタンを押してください。",
          scenario: null,
          explanationVi: "'電源' (nguồn điện) — Bấm nút nguồn trước, rồi bấm nút copy.",
          skillTag: "office-equipment-vocab",
          difficulty: "standard",
          options: opts("電源", "電話", "電池", "電車", "A"),
        },
        {
          prompt: "毎朝、出勤＿＿メールをチェックします。",
          scenario: null,
          explanationVi: "'したら' = sau khi. Mỗi sáng sau khi đến công ty thì kiểm tra email.",
          skillTag: "conditional-form",
          difficulty: "standard",
          options: opts("して", "したら", "すると", "しても", "B"),
        },
        {
          prompt: "この資料を10＿＿コピーしてください。",
          scenario: null,
          explanationVi: "'部' là đơn vị đếm tài liệu. Copy 10 bộ.",
          skillTag: "counter-word",
          difficulty: "hard",
          options: opts("個", "枚", "部", "冊", "C"),
        },
        {
          prompt: "お客様にお茶を＿＿しましょうか。",
          scenario: null,
          explanationVi: "'お出し' = dạng kính ngữ của 出す (mang ra). Mang trà cho khách.",
          skillTag: "humble-keigo",
          difficulty: "hard",
          options: opts("出し", "お出し", "出して", "お出して", "B"),
        },
        {
          prompt: "田中さんは今日＿＿です。",
          scenario: null,
          explanationVi: "'お休み' = nghỉ (dạng lịch sự). Tanaka hôm nay nghỉ.",
          skillTag: "polite-vocabulary",
          difficulty: "easy",
          options: opts("休む", "休んで", "お休み", "休める", "C"),
        },
      ],
    },
    // ======================== RC_EXPRESSION (10) ========================
    {
      code: "RC_EXPRESSION",
      titleVi: "Biểu đạt - Đọc hiểu",
      titleJa: "表現読解問題",
      questions: [
        {
          prompt: "「すみません、＿＿」 — 道を聞きたいとき",
          scenario: null,
          explanationVi: "Khi muốn hỏi đường, dùng 'chút ít nhưng có thể hỏi được không?' — lịch sự.",
          skillTag: "asking-directions",
          difficulty: "easy",
          options: opts(
            "ちょっとお聞きしてもいいですか。",
            "道を教えろ。",
            "ここはどこだ。",
            "地図をください。",
            "A"
          ),
        },
        {
          prompt: "電話で「＿＿」— 相手の名前を聞きたいとき",
          scenario: null,
          explanationVi: "Hỏi tên qua điện thoại: 'Xin cho hỏi quý danh?' — dạng lịch sự.",
          skillTag: "phone-etiquette",
          difficulty: "easy",
          options: opts(
            "名前は何？",
            "お名前を教えてください。",
            "失礼ですが、お名前をお聞かせいただけますか。",
            "だれ？",
            "C"
          ),
        },
        {
          prompt: "初めて会う取引先の人に「＿＿」",
          scenario: null,
          explanationVi: "'Hajimemashite' + tên + 'yoroshiku onegai itashimasu' — chào lần đầu.",
          skillTag: "self-introduction",
          difficulty: "easy",
          options: opts(
            "やあ、はじめまして。",
            "はじめまして。○○と申します。よろしくお願いいたします。",
            "こんにちは。○○です。",
            "どうも。○○です。よろしく。",
            "B"
          ),
        },
        {
          prompt: "お客様に飲み物を聞くとき「＿＿」",
          scenario: null,
          explanationVi: "'Có muốn dùng gì không ạ?' — dùng kính ngữ để hỏi khách.",
          skillTag: "offering-drinks",
          difficulty: "standard",
          options: opts(
            "何か飲む？",
            "お飲み物はいかがですか。",
            "飲み物がほしいですか。",
            "コーヒーでいいですか。",
            "B"
          ),
        },
        {
          prompt: "帰るとき、まだ仕事をしている同僚に「＿＿」",
          scenario: null,
          explanationVi: "'Xin phép về trước' — câu chào khi về trước đồng nghiệp.",
          skillTag: "leaving-greeting",
          difficulty: "easy",
          options: opts(
            "さようなら。",
            "お先に失礼します。",
            "じゃあね。",
            "もう帰ります。",
            "B"
          ),
        },
        {
          prompt: "頼まれた仕事が終わったとき「＿＿」",
          scenario: null,
          explanationVi: "Báo cáo xong việc: 'Công việc được giao đã hoàn thành' — dạng lịch sự.",
          skillTag: "task-completion-report",
          difficulty: "standard",
          options: opts(
            "終わった。",
            "ご依頼の件、完了いたしました。",
            "やっと終わりました。",
            "できました。どうぞ。",
            "B"
          ),
        },
        {
          prompt: "約束の時間に遅れたとき「＿＿」",
          scenario: null,
          explanationVi: "'Xin lỗi đã để quý khách chờ' — xin lỗi khi đến trễ.",
          skillTag: "apology-expression",
          difficulty: "standard",
          options: opts(
            "遅れてすみません。",
            "お待たせして申し訳ございません。",
            "ちょっと遅れちゃった。",
            "遅れました。",
            "B"
          ),
        },
        {
          prompt: "電話を切るとき「＿＿」",
          scenario: null,
          explanationVi: "'Xin cảm ơn, thất lễ' — kết thúc cuộc gọi lịch sự.",
          skillTag: "phone-closing",
          difficulty: "standard",
          options: opts(
            "じゃあね。",
            "それでは、失礼いたします。",
            "切るよ。",
            "はい、さようなら。",
            "B"
          ),
        },
        {
          prompt: "わからないことを質問するとき「＿＿」",
          scenario: null,
          explanationVi: "Khi có điều không hiểu: 'Xin lỗi nhưng có thể hỏi 1 chút được không?'",
          skillTag: "polite-question",
          difficulty: "hard",
          options: opts(
            "ねえ、これなに？",
            "すみません、1つ質問してもよろしいですか。",
            "質問があります。",
            "ちょっと聞きたいんだけど。",
            "B"
          ),
        },
        {
          prompt: "コピー機の使い方がわからないとき「＿＿」",
          scenario: null,
          explanationVi: "Nhờ người chỉ cách dùng máy photocopy: dạng lịch sự 'có thể chỉ cho tôi không?'",
          skillTag: "asking-help",
          difficulty: "hard",
          options: opts(
            "コピー機を教えて。",
            "すみません、コピー機の使い方を教えていただけますか。",
            "コピーしたいんだけど。",
            "これ、どうやるの？",
            "B"
          ),
        },
      ],
    },
    // ======================== RC_INTEGRATED (10) ========================
    {
      code: "RC_INTEGRATED",
      titleVi: "Đọc hiểu tổng hợp",
      titleJa: "総合読解問題",
      questions: [
        {
          prompt: "次のお知らせを読んでください。\n\n「社員食堂リニューアルのお知らせ\n期間：5月1日～5月15日\nこの期間、社員食堂は改装工事のため閉鎖いたします。\nお昼は1階の売店をご利用ください。」\n\n5月10日にお昼ご飯を食べたい場合、どうしますか。",
          scenario: null,
          explanationVi: "Nhà ăn đóng cửa 1/5-15/5. Ngày 10/5 phải ăn ở cửa hàng tầng 1.",
          skillTag: "notice-comprehension",
          difficulty: "easy",
          options: opts(
            "社員食堂で食べる。",
            "1階の売店を利用する。",
            "外のレストランに行く。",
            "お昼を食べない。",
            "B"
          ),
        },
        {
          prompt: "次のメールを読んでください。\n\n「件名：明日の会議について\n田中さん\n明日の会議は10時から11時に変更になりました。\n場所は3階の会議室Bです。\n資料を5部用意してください。\n山田」\n\n田中さんは何を準備しますか。",
          scenario: null,
          explanationVi: "Email thông báo: họp đổi sang 11h, phòng họp B tầng 3. Tanaka chuẩn bị 5 bộ tài liệu.",
          skillTag: "email-comprehension",
          difficulty: "easy",
          options: opts(
            "会議室の予約。",
            "資料を5部。",
            "お茶の準備。",
            "出席者への連絡。",
            "B"
          ),
        },
        {
          prompt: "次の張り紙を読んでください。\n\n「年末年始の営業について\n12月29日～1月3日は休業いたします。\n1月4日より通常営業いたします。\nご不便をおかけしますが、よろしくお願いいたします。」\n\n1月2日にこの店は開いていますか。",
          scenario: null,
          explanationVi: "Nghỉ 29/12 đến 3/1. Ngày 2/1 = đang nghỉ → cửa hàng đóng.",
          skillTag: "holiday-schedule",
          difficulty: "easy",
          options: opts(
            "はい、開いています。",
            "いいえ、休業中です。",
            "午前中だけ開いています。",
            "1月1日から開いています。",
            "B"
          ),
        },
        {
          prompt: "次のお知らせを読んでください。\n\n「落とし物のお知らせ\n3月5日、2階の廊下で黒い傘が見つかりました。\nお心当たりのある方は、1階受付までお越しください。\n保管期限：3月31日」\n\nこの傘を受け取りたい場合、どこへ行きますか。",
          scenario: null,
          explanationVi: "Thông báo đồ thất lạc: ô đen tìm thấy ở hành lang tầng 2. Nhận ở lễ tân tầng 1.",
          skillTag: "lost-found-notice",
          difficulty: "standard",
          options: opts(
            "2階の廊下。",
            "1階の受付。",
            "3階の事務所。",
            "警察。",
            "B"
          ),
        },
        {
          prompt: "次のメモを読んでください。\n\n「佐藤さんへ\n14時にABC商事の鈴木様からお電話がありました。\n明日の打ち合わせの時間を15時から16時に変えたいそうです。\n折り返しお電話ください。TEL: 03-1234-5678\n高橋」\n\n鈴木さんは何をお願いしていますか。",
          scenario: null,
          explanationVi: "Memo: Suzuki từ ABC gọi, muốn đổi giờ họp từ 15h sang 16h. Nhờ gọi lại.",
          skillTag: "message-comprehension",
          difficulty: "standard",
          options: opts(
            "会議をキャンセルしたい。",
            "打ち合わせの時間を変更したい。",
            "新しい資料がほしい。",
            "佐藤さんに会いたい。",
            "B"
          ),
        },
        {
          prompt: "次の求人広告を読んでください。\n\n「アルバイト募集\n仕事内容：レジ、品出し\n時給：1,100円（土日は1,200円）\n勤務時間：9:00～22:00の間で4時間以上\n条件：週3日以上勤務できる方\n応募方法：お電話ください」\n\n日曜日に5時間働いたら、いくらもらえますか。",
          scenario: null,
          explanationVi: "Chủ nhật = 1200 yên/giờ × 5 giờ = 6000 yên.",
          skillTag: "calculation-from-text",
          difficulty: "standard",
          options: opts(
            "5,500円。",
            "6,000円。",
            "5,000円。",
            "6,600円。",
            "B"
          ),
        },
        {
          prompt: "次のメールを読んでください。\n\n「件名：社員旅行のお知らせ\nみなさま\n今年の社員旅行は6月15日（土）に箱根に行きます。\n参加希望の方は5月20日までに総務の山本まで申し込んでください。\n費用は会社負担ですが、お土産代は各自でお願いします。\n総務部 山本」\n\n自分で払うものは何ですか。",
          scenario: null,
          explanationVi: "Du lịch công ty: chi phí công ty trả, riêng tiền quà lưu niệm tự trả.",
          skillTag: "detail-extraction",
          difficulty: "standard",
          options: opts(
            "旅行の費用全部。",
            "交通費。",
            "お土産代。",
            "ホテル代。",
            "C"
          ),
        },
        {
          prompt: "次の案内を読んでください。\n\n「図書館利用案内\n開館時間：平日9:00～20:00、土日9:00～17:00\n貸出冊数：1人5冊まで\n貸出期間：2週間\n延長：1回のみ可能（電話またはウェブで）\n返却：カウンターまたは返却ポストへ」\n\n本を2週間以上借りたい場合、どうしますか。",
          scenario: null,
          explanationVi: "Thư viện: mượn 2 tuần, gia hạn 1 lần qua điện thoại hoặc web.",
          skillTag: "procedure-extraction",
          difficulty: "hard",
          options: opts(
            "もう一度借りる。",
            "延長の手続きをする。",
            "返却期限は変えられない。",
            "図書館に相談する。",
            "B"
          ),
        },
        {
          prompt: "次の注意書きを読んでください。\n\n「プールご利用の皆様へ\n・水着、水泳帽を着用してください。\n・シャワーを浴びてから入ってください。\n・飲食は更衣室外でお願いします。\n・小学生以下は保護者同伴でお願いします。」\n\n小学校2年生の子どもだけでプールに入れますか。",
          scenario: null,
          explanationVi: "Trẻ tiểu học trở xuống phải có người lớn đi kèm. Lớp 2 = tiểu học → không được vào 1 mình.",
          skillTag: "rule-comprehension",
          difficulty: "hard",
          options: opts(
            "はい、入れます。",
            "いいえ、保護者と一緒でないと入れません。",
            "水泳帽があれば入れます。",
            "午前中だけ入れます。",
            "B"
          ),
        },
        {
          prompt: "次の掲示を読んでください。\n\n「エレベーター点検のお知らせ\n日時：4月10日（水）9:00～12:00\nこの間、エレベーターは使えません。\n階段をご利用ください。\nご迷惑をおかけして申し訳ございません。\n管理事務所」\n\n4月10日の10時に5階へ行きたい場合、どうしますか。",
          scenario: null,
          explanationVi: "Thang máy bảo trì 9-12h ngày 10/4. Lúc 10h phải dùng cầu thang bộ.",
          skillTag: "alternative-action",
          difficulty: "hard",
          options: opts(
            "エレベーターで行く。",
            "階段で行く。",
            "12時まで待つ。",
            "管理事務所に頼む。",
            "B"
          ),
        },
      ],
    },
  ],
};
