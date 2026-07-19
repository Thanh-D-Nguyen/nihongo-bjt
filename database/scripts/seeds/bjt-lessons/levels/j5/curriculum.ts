import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";

export const J5_BLUEPRINT: LevelBlueprint = {
  level: "J5",
  difficulty: "foundation",
  register: "câu ngắn, です／ます rõ ràng; xác nhận trực tiếp nhưng mềm",
  speakerRoleJa: "新入社員",
  counterpartRoleJa: "先輩",
  acknowledgementJa: "はい、わかりました。",
  closingJa: "よろしくお願いします。",
  weeks: [
    {
      week: 1,
      themeJa: "職場の挨拶",
      themeVi: "Chào hỏi tại nơi làm việc",
      objectiveVi: "Chào, tự giới thiệu và kết thúc trao đổi ngắn đúng thời điểm.",
      scenarioJa: "ベトナム人の新入社員が初日に同じ部署の人へ挨拶します。",
      scenarioVi: "Nhân viên mới người Việt chào mọi người trong phòng ban vào ngày đầu.",
      problemVi: "người học cần tạo thiện cảm nhưng chưa biết vai trò của từng người.",
      desiredOutcomeVi: "đối phương hiểu tên, bộ phận và mong muốn hợp tác của người nói.",
      relationship: "senior-junior",
      stimulusType: "dialogue",
      businessTopic: "workplace-introduction",
      skillTags: ["greeting", "self-introduction", "closing"],
      vocabulary: [
        vocab("初めまして", "はじめまして", "rất hân hạnh"),
        vocab("新入社員", "しんにゅうしゃいん", "nhân viên mới"),
        vocab("部署", "ぶしょ", "phòng ban"),
        vocab("名前", "なまえ", "tên"),
        vocab("今日", "きょう", "hôm nay"),
        vocab("よろしく", "よろしく", "mong được giúp đỡ")
      ],
      grammar: [
        grammar("～です", "Giới thiệu danh tính hoặc thông tin một cách lịch sự."),
        grammar("～から来ました", "Nói nơi mình đến từ.")
      ],
      focuses: [
        focus(
          "おはようございます。",
          "Chào buổi sáng",
          "chào khi bắt đầu ngày làm việc",
          "Dùng khi gặp đồng nghiệp vào buổi sáng; nói rõ và vừa đủ trang trọng."
        ),
        focus(
          "初めまして、グエンです。",
          "Rất hân hạnh, tôi là Nguyễn",
          "tự giới thiệu tên lần đầu",
          "初めまして chỉ dùng trong lần gặp đầu tiên."
        ),
        focus(
          "ベトナムから来ました。",
          "Tôi đến từ Việt Nam",
          "nói ngắn gọn về xuất thân",
          "Không cần thêm 私は nếu ngữ cảnh đã rõ."
        ),
        focus(
          "今日からよろしくお願いします。",
          "Từ hôm nay mong anh/chị giúp đỡ",
          "bày tỏ mong muốn hợp tác",
          "Câu kết tự nhiên cho lời chào ngày đầu."
        ),
        focus(
          "お先に失礼します。",
          "Tôi xin phép về trước",
          "xin phép rời nơi làm việc",
          "Nói với người còn ở lại, không dùng như lời chào khi đến."
        )
      ]
    },
    {
      week: 2,
      themeJa: "簡単な指示",
      themeVi: "Nhận chỉ thị đơn giản",
      objectiveVi: "Nghe, nhắc lại và hỏi lại một chỉ thị ngắn về đồ vật hoặc địa điểm.",
      scenarioJa: "先輩が新入社員に書類のコピーと提出場所を指示します。",
      scenarioVi: "Tiền bối hướng dẫn nhân viên mới sao chép tài liệu và nơi nộp.",
      problemVi: "chỉ thị có hai bước và người học chưa chắc số lượng lẫn địa điểm.",
      desiredOutcomeVi: "người học xác nhận đúng việc, số lượng và nơi giao.",
      relationship: "senior-junior",
      stimulusType: "dialogue",
      businessTopic: "task-instruction",
      skillTags: ["instruction", "confirmation", "clarification"],
      vocabulary: [
        vocab("書類", "しょるい", "tài liệu"),
        vocab("コピー", "コピー", "bản sao"),
        vocab("三部", "さんぶ", "ba bản"),
        vocab("机", "つくえ", "bàn"),
        vocab("置く", "おく", "đặt"),
        vocab("提出", "ていしゅつ", "nộp")
      ],
      grammar: [
        grammar("～てください", "Yêu cầu ai làm một hành động."),
        grammar("～でいいですか", "Xác nhận lựa chọn hoặc cách làm.")
      ],
      focuses: [
        focus(
          "この書類をコピーしてください。",
          "Hãy sao chép tài liệu này",
          "hiểu nhiệm vụ cần làm",
          "を đánh dấu đối tượng của hành động コピーする."
        ),
        focus(
          "三部ですね。",
          "Ba bản đúng không ạ",
          "xác nhận lại số lượng",
          "Lặp lại thông tin kèm ですね giúp xác nhận ngắn gọn."
        ),
        focus(
          "どこに置きますか。",
          "Tôi đặt ở đâu ạ",
          "hỏi địa điểm giao tài liệu",
          "Dùng に cho điểm đến của hành động đặt."
        ),
        focus(
          "この机でいいですか。",
          "Bàn này có được không ạ",
          "xác nhận vị trí cụ thể",
          "でいいですか hỏi lựa chọn có được chấp nhận hay không."
        ),
        focus(
          "もう一度お願いします。",
          "Xin nói lại một lần nữa",
          "xin nhắc lại khi chưa nghe rõ",
          "Nói sớm sẽ an toàn hơn giả vờ đã hiểu chỉ thị."
        )
      ]
    },
    {
      week: 3,
      themeJa: "進捗の確認",
      themeVi: "Xác nhận tiến độ cơ bản",
      objectiveVi: "Nói việc đã xong, đang làm hoặc chưa xong bằng câu ngắn có thời điểm.",
      scenarioJa: "昼休み前に、先輩が入力作業の進み方を確認します。",
      scenarioVi: "Trước giờ nghỉ trưa, tiền bối hỏi tiến độ nhập dữ liệu.",
      problemVi: "một phần công việc chưa hoàn tất và cần báo đúng trạng thái.",
      desiredOutcomeVi: "tiền bối biết phần đã làm, phần còn lại và thời điểm hoàn thành dự kiến.",
      relationship: "senior-junior",
      stimulusType: "internal_chat",
      businessTopic: "progress-reporting",
      skillTags: ["progress", "time", "status"],
      vocabulary: [
        vocab("作業", "さぎょう", "công việc"),
        vocab("入力", "にゅうりょく", "nhập dữ liệu"),
        vocab("終わる", "おわる", "xong"),
        vocab("まだ", "まだ", "vẫn chưa"),
        vocab("半分", "はんぶん", "một nửa"),
        vocab("午後", "ごご", "buổi chiều")
      ],
      grammar: [
        grammar("もう～ました", "Cho biết việc đã hoàn tất."),
        grammar("まだ～ていません", "Cho biết việc vẫn chưa hoàn tất.")
      ],
      focuses: [
        focus(
          "入力は終わりました。",
          "Phần nhập dữ liệu đã xong",
          "báo một việc đã hoàn tất",
          "Đưa chủ đề bằng は giúp trạng thái cần báo nổi bật."
        ),
        focus(
          "今、確認しています。",
          "Bây giờ tôi đang kiểm tra",
          "báo hành động đang diễn ra",
          "～ています diễn tả việc đang thực hiện."
        ),
        focus(
          "まだ終わっていません。",
          "Vẫn chưa xong",
          "báo trung thực phần chưa hoàn tất",
          "まだ kết hợp phủ định; không nói まだ終わりました."
        ),
        focus(
          "半分できました。",
          "Tôi đã làm được một nửa",
          "nêu mức tiến độ cụ thể",
          "Số lượng cụ thể hữu ích hơn もうすぐ khi báo cáo."
        ),
        focus(
          "午後三時までに終わります。",
          "Tôi sẽ xong trước 3 giờ chiều",
          "nêu thời điểm hoàn thành",
          "までに chỉ hạn chót hoàn thành, khác まで là kéo dài đến thời điểm."
        )
      ]
    },
    {
      week: 4,
      themeJa: "初歩の報連相",
      themeVi: "Hōrensō nhập môn",
      objectiveVi: "Phân biệt báo cáo, liên lạc và trao đổi khi có thay đổi nhỏ.",
      scenarioJa: "納品時刻が変わったため、新入社員が先輩へ早めに知らせます。",
      scenarioVi: "Giờ giao hàng thay đổi nên nhân viên mới cần báo sớm cho tiền bối.",
      problemVi: "thời gian thay đổi có thể ảnh hưởng công việc tiếp theo.",
      desiredOutcomeVi: "tiền bối nhận thông tin và quyết định có cần điều chỉnh lịch hay không.",
      relationship: "senior-junior",
      stimulusType: "internal_chat",
      businessTopic: "horenso",
      skillTags: ["report", "contact", "consult"],
      vocabulary: [
        vocab("報告", "ほうこく", "báo cáo"),
        vocab("連絡", "れんらく", "liên lạc"),
        vocab("相談", "そうだん", "trao đổi xin ý kiến"),
        vocab("変更", "へんこう", "thay đổi"),
        vocab("納品", "のうひん", "giao hàng"),
        vocab("時間", "じかん", "thời gian")
      ],
      grammar: [
        grammar("～になりました", "Thông báo một trạng thái mới sau thay đổi."),
        grammar("～てもいいですか", "Xin phép hoặc hỏi có thể làm gì.")
      ],
      focuses: [
        focus(
          "ご報告があります。",
          "Tôi có việc cần báo cáo",
          "mở đầu một báo cáo ngắn",
          "Báo hiệu loại trao đổi để người nghe chuyển sự chú ý."
        ),
        focus(
          "納品は四時になりました。",
          "Giờ giao hàng đổi thành 4 giờ",
          "thông báo thay đổi đã xác định",
          "Nêu chủ đề rồi nêu thời điểm mới, tránh kể vòng."
        ),
        focus(
          "担当者に連絡しました。",
          "Tôi đã liên lạc người phụ trách",
          "báo hành động liên lạc đã làm",
          "に đánh dấu người nhận liên lạc."
        ),
        focus(
          "少し相談してもいいですか。",
          "Tôi có thể trao đổi một chút không ạ",
          "xin thời gian để hỏi ý kiến",
          "Câu mở mềm trước khi nêu vấn đề cần quyết định."
        ),
        focus(
          "次はどうしますか。",
          "Tiếp theo chúng ta làm thế nào ạ",
          "hỏi bước xử lý tiếp theo",
          "Dùng khi thẩm quyền quyết định thuộc tiền bối."
        )
      ]
    },
    {
      week: 5,
      themeJa: "電話の受け方",
      themeVi: "Nhận điện thoại công việc",
      objectiveVi: "Chào qua điện thoại, hỏi tên, xin chờ và ghi lời nhắn đơn giản.",
      scenarioJa: "取引先から電話があり、担当者は席を外しています。",
      scenarioVi: "Đối tác gọi đến khi người phụ trách đang rời chỗ.",
      problemVi: "người học phải giữ cuộc gọi và lấy đủ thông tin.",
      desiredOutcomeVi: "người gọi biết tình trạng và để lại tên, số điện thoại hoặc lời nhắn.",
      relationship: "company-partner",
      stimulusType: "telephone",
      businessTopic: "business-phone",
      skillTags: ["telephone", "message-taking", "identity"],
      vocabulary: [
        vocab("電話", "でんわ", "điện thoại"),
        vocab("担当者", "たんとうしゃ", "người phụ trách"),
        vocab("席", "せき", "chỗ ngồi"),
        vocab("名前", "なまえ", "tên"),
        vocab("番号", "ばんごう", "số"),
        vocab("伝言", "でんごん", "lời nhắn")
      ],
      grammar: [
        grammar("～をお願いします", "Yêu cầu được gặp một người."),
        grammar("～ています", "Mô tả trạng thái hiện tại.")
      ],
      focuses: [
        focus(
          "はい、ABC会社です。",
          "Vâng, đây là công ty ABC",
          "mở đầu cuộc gọi đến",
          "Qua điện thoại không thấy mặt nên cần nói tên công ty rõ."
        ),
        focus(
          "お名前をお願いします。",
          "Xin cho biết tên",
          "hỏi tên người gọi",
          "をお願いします là cách yêu cầu ngắn; cấp cao hơn sẽ dùng お伺いしても."
        ),
        focus(
          "少々お待ちください。",
          "Xin chờ một chút",
          "xin người gọi giữ máy",
          "少々 trang trọng hơn ちょっと trong điện thoại công việc."
        ),
        focus(
          "田中は席を外しています。",
          "Anh Tanaka hiện rời chỗ",
          "thông báo người phụ trách vắng mặt",
          "Nói người trong công ty mình không thêm さん khi nói với bên ngoài."
        ),
        focus(
          "伝言をお願いします。",
          "Xin để lại lời nhắn",
          "đề nghị ghi nhận lời nhắn",
          "Cần xác nhận lại tên và nội dung sau khi nghe."
        )
      ]
    },
    {
      week: 6,
      themeJa: "短いメール",
      themeVi: "Email công việc ngắn",
      objectiveVi: "Đọc và viết email ngắn có tiêu đề, mục đích, thời gian và lời kết.",
      scenarioJa: "新入社員が先輩へ研修時間を確認するメールを送ります。",
      scenarioVi: "Nhân viên mới gửi email hỏi tiền bối về giờ đào tạo.",
      problemVi: "lịch có hai mốc thời gian và email phải nêu rõ mốc cần xác nhận.",
      desiredOutcomeVi: "người nhận trả lời đúng thời gian mà không phải hỏi lại.",
      relationship: "senior-junior",
      stimulusType: "email",
      businessTopic: "business-email",
      skillTags: ["email", "subject-line", "schedule-confirmation"],
      vocabulary: [
        vocab("件名", "けんめい", "tiêu đề"),
        vocab("研修", "けんしゅう", "đào tạo"),
        vocab("開始", "かいし", "bắt đầu"),
        vocab("確認", "かくにん", "xác nhận"),
        vocab("返信", "へんしん", "hồi âm"),
        vocab("明日", "あした", "ngày mai")
      ],
      grammar: [
        grammar("～について", "Nêu chủ đề của email hoặc trao đổi."),
        grammar("～で合っていますか", "Hỏi thông tin có chính xác không.")
      ],
      focuses: [
        focus(
          "件名：明日の研修について",
          "Tiêu đề: Về buổi đào tạo ngày mai",
          "viết tiêu đề chỉ rõ chủ đề",
          "Tiêu đề cụ thể giúp người nhận phân loại email nhanh."
        ),
        focus(
          "研修の時間を確認します。",
          "Tôi xin xác nhận giờ đào tạo",
          "nêu mục đích email",
          "Đặt mục đích ở đầu thay vì kể bối cảnh dài."
        ),
        focus(
          "九時開始で合っていますか。",
          "Bắt đầu lúc 9 giờ có đúng không ạ",
          "xác nhận mốc giờ cụ thể",
          "で合っていますか kiểm tra thông tin người viết đang hiểu."
        ),
        focus(
          "ご返信をお願いします。",
          "Xin vui lòng hồi âm",
          "đề nghị phản hồi",
          "Nên dùng khi thực sự cần câu trả lời, không thêm vào mọi email."
        ),
        focus(
          "どうぞよろしくお願いします。",
          "Rất mong anh/chị giúp đỡ",
          "kết email ngắn lịch sự",
          "Lời kết phổ biến, nhưng phần trước vẫn phải nêu yêu cầu rõ."
        )
      ]
    },
    {
      week: 7,
      themeJa: "会議の基本",
      themeVi: "Cơ bản trong cuộc họp",
      objectiveVi: "Vào họp đúng cách, nghe ý kiến và phát biểu đồng ý hoặc hỏi lại ngắn gọn.",
      scenarioJa: "部署の短い朝会で、今日の作業順を決めます。",
      scenarioVi: "Trong cuộc họp sáng ngắn, phòng ban quyết định thứ tự công việc hôm nay.",
      problemVi: "người học cần tham gia nhưng chưa đủ từ để phát biểu dài.",
      desiredOutcomeVi: "người học thể hiện đã nghe, đồng ý hoặc xin giải thích đúng lúc.",
      relationship: "manager-staff",
      stimulusType: "meeting",
      businessTopic: "meeting-basics",
      skillTags: ["meeting", "agreement", "question"],
      vocabulary: [
        vocab("会議", "かいぎ", "cuộc họp"),
        vocab("意見", "いけん", "ý kiến"),
        vocab("賛成", "さんせい", "tán thành"),
        vocab("質問", "しつもん", "câu hỏi"),
        vocab("順番", "じゅんばん", "thứ tự"),
        vocab("説明", "せつめい", "giải thích")
      ],
      grammar: [
        grammar("～と思います", "Nói ý kiến cá nhân một cách mềm."),
        grammar("～はどうですか", "Hỏi đề xuất hoặc đánh giá về một phương án.")
      ],
      focuses: [
        focus(
          "会議を始めます。",
          "Chúng ta bắt đầu cuộc họp",
          "nhận biết câu mở họp",
          "Câu điều phối ngắn, người tham dự dừng việc riêng và chú ý."
        ),
        focus(
          "私もそう思います。",
          "Tôi cũng nghĩ vậy",
          "thể hiện đồng ý",
          "そう thay cho nội dung vừa nghe, tránh lặp cả câu."
        ),
        focus(
          "この順番はどうですか。",
          "Thứ tự này thế nào ạ",
          "hỏi ý kiến về phương án",
          "どうですか mở không gian trả lời hơn いいですか."
        ),
        focus(
          "質問があります。",
          "Tôi có câu hỏi",
          "xin lượt để hỏi",
          "Nói câu báo hiệu trước khi đặt câu hỏi giúp không ngắt lời thô."
        ),
        focus(
          "もう少し説明してください。",
          "Xin giải thích thêm một chút",
          "xin làm rõ nội dung",
          "もう少し giới hạn yêu cầu và nghe mềm hơn chỉ nói わかりません."
        )
      ]
    },
    {
      week: 8,
      themeJa: "予定と締切",
      themeVi: "Lịch và deadline",
      objectiveVi: "Hỏi lịch trống, đề xuất giờ và xác nhận hạn hoàn thành đơn giản.",
      scenarioJa: "先輩と新入社員が面談の時間と資料の締切を決めます。",
      scenarioVi: "Tiền bối và nhân viên mới thống nhất giờ trao đổi và hạn tài liệu.",
      problemVi: "lịch đề xuất trùng một việc khác và cần đổi giờ.",
      desiredOutcomeVi: "hai bên chốt được giờ mới và hạn nộp cụ thể.",
      relationship: "senior-junior",
      stimulusType: "internal_chat",
      businessTopic: "scheduling",
      skillTags: ["schedule", "deadline", "reschedule"],
      vocabulary: [
        vocab("予定", "よてい", "lịch dự kiến"),
        vocab("締切", "しめきり", "hạn chót"),
        vocab("都合", "つごう", "sự thuận tiện"),
        vocab("変更", "へんこう", "thay đổi"),
        vocab("今週", "こんしゅう", "tuần này"),
        vocab("間に合う", "まにあう", "kịp")
      ],
      grammar: [
        grammar("～は空いていますか", "Hỏi một khoảng thời gian có trống không."),
        grammar("～までに", "Nêu hạn hoàn thành trước một mốc.")
      ],
      focuses: [
        focus(
          "火曜日は空いていますか。",
          "Thứ Ba anh/chị có trống không",
          "hỏi lịch trống",
          "Nêu ngày trước để người nghe tra lịch nhanh."
        ),
        focus(
          "三時はどうですか。",
          "3 giờ thì thế nào ạ",
          "đề xuất giờ gặp",
          "は đưa thời điểm thành phương án để đối phương đánh giá."
        ),
        focus(
          "その時間は予定があります。",
          "Giờ đó tôi có lịch rồi",
          "báo xung đột lịch",
          "Nêu sự thật trước rồi nên đưa phương án khác."
        ),
        focus(
          "四時に変更できますか。",
          "Có thể đổi sang 4 giờ không ạ",
          "đề nghị đổi giờ",
          "変更できますか hỏi khả năng, lịch sự hơn câu mệnh lệnh."
        ),
        focus(
          "金曜日までに出します。",
          "Tôi sẽ nộp trước thứ Sáu",
          "cam kết hạn hoàn thành",
          "までに đi với động từ hoàn tất như 出す."
        )
      ]
    },
    {
      week: 9,
      themeJa: "小さな問題",
      themeVi: "Giải thích sự cố nhỏ",
      objectiveVi: "Báo một lỗi đơn giản, nêu ảnh hưởng và xin hỗ trợ mà không che giấu.",
      scenarioJa: "プリンターが止まり、会議資料を印刷できません。",
      scenarioVi: "Máy in dừng nên không thể in tài liệu họp.",
      problemVi: "cuộc họp sắp bắt đầu và người học không tự sửa được máy.",
      desiredOutcomeVi: "tiền bối biết lỗi, ảnh hưởng và hỗ trợ chọn cách in khác.",
      relationship: "senior-junior",
      stimulusType: "dialogue",
      businessTopic: "incident-reporting",
      skillTags: ["problem", "impact", "help-request"],
      vocabulary: [
        vocab("問題", "もんだい", "vấn đề"),
        vocab("故障", "こしょう", "hỏng hóc"),
        vocab("印刷", "いんさつ", "in ấn"),
        vocab("止まる", "とまる", "dừng"),
        vocab("使えない", "つかえない", "không dùng được"),
        vocab("手伝う", "てつだう", "giúp đỡ")
      ],
      grammar: [
        grammar("～できません", "Nói không thể thực hiện một hành động."),
        grammar("～てもらえますか", "Nhờ người khác hỗ trợ.")
      ],
      focuses: [
        focus(
          "問題があります。",
          "Có một vấn đề",
          "báo hiệu sự cố ngay",
          "Mở đầu trực tiếp giúp người nghe chú ý mức ưu tiên."
        ),
        focus(
          "プリンターが止まりました。",
          "Máy in đã dừng",
          "nêu hiện tượng quan sát được",
          "Không đoán nguyên nhân nếu chưa kiểm tra."
        ),
        focus(
          "資料を印刷できません。",
          "Tôi không in được tài liệu",
          "nêu ảnh hưởng đến công việc",
          "Phân biệt hiện tượng máy dừng và ảnh hưởng không in được."
        ),
        focus(
          "見てもらえますか。",
          "Anh/chị xem giúp được không ạ",
          "xin hỗ trợ kiểm tra",
          "～てもらえますか là lời nhờ, không phải ra lệnh."
        ),
        focus(
          "別のプリンターを使います。",
          "Tôi sẽ dùng máy in khác",
          "đưa phương án tạm thời",
          "Báo hành động thay thế để người nghe biết tiến độ vẫn được bảo vệ."
        )
      ]
    },
    {
      week: 10,
      themeJa: "お客様への対応",
      themeVi: "Phản hồi khách hàng cơ bản",
      objectiveVi: "Chào khách, xin lỗi vì chờ, xác nhận yêu cầu và gọi người phụ trách.",
      scenarioJa: "受付に来客があり、約束した担当者を待っています。",
      scenarioVi: "Khách đến quầy lễ tân và đang chờ người phụ trách đã hẹn.",
      problemVi: "người phụ trách đến muộn vài phút và khách chưa biết lý do.",
      desiredOutcomeVi: "khách được đón tiếp, biết cần chờ và cảm thấy yêu cầu được ghi nhận.",
      relationship: "employee-customer",
      stimulusType: "dialogue",
      businessTopic: "customer-service",
      skillTags: ["reception", "apology", "customer-confirmation"],
      vocabulary: [
        vocab("お客様", "おきゃくさま", "khách hàng"),
        vocab("受付", "うけつけ", "lễ tân"),
        vocab("約束", "やくそく", "cuộc hẹn"),
        vocab("担当", "たんとう", "phụ trách"),
        vocab("待つ", "まつ", "chờ"),
        vocab("申し訳ありません", "もうしわけありません", "thành thật xin lỗi")
      ],
      grammar: [
        grammar("～でございます", "Dạng lịch sự trang trọng của です khi tiếp khách."),
        grammar("～を呼びます", "Nói sẽ gọi một người.")
      ],
      focuses: [
        focus(
          "いらっしゃいませ。",
          "Xin chào quý khách",
          "đón khách đến",
          "Là lời chào phục vụ; không chờ khách chào trước."
        ),
        focus(
          "お名前をお願いします。",
          "Xin cho biết quý danh",
          "xác nhận tên khách",
          "Giai đoạn J5 dùng mẫu ngắn; cần giọng nói mềm."
        ),
        focus(
          "少々お待ちください。",
          "Xin quý khách chờ một chút",
          "xin khách chờ",
          "Chỉ dùng khi đã biết sẽ xử lý gì tiếp theo."
        ),
        focus(
          "担当者を呼びます。",
          "Tôi sẽ gọi người phụ trách",
          "nêu hành động tiếp theo",
          "Giúp khách biết yêu cầu không bị bỏ quên."
        ),
        focus(
          "お待たせして、申し訳ありません。",
          "Xin lỗi vì đã để quý khách chờ",
          "xin lỗi về thời gian chờ",
          "Nêu đúng điều gây bất tiện; tránh chỉ nói すみません quá nhẹ."
        )
      ]
    },
    {
      week: 11,
      themeJa: "簡単な提案",
      themeVi: "Đề xuất đơn giản",
      objectiveVi: "Đưa một đề xuất nhỏ, hỏi ý kiến và chọn phương án sau khi nghe phản hồi.",
      scenarioJa: "チームで資料の見せ方を二つの案から選びます。",
      scenarioVi: "Nhóm chọn một trong hai cách trình bày tài liệu.",
      problemVi: "mỗi phương án có ưu điểm khác nhau và cần thống nhất nhanh.",
      desiredOutcomeVi: "người học đưa đề xuất có lý do ngắn và xác nhận quyết định chung.",
      relationship: "colleague-colleague",
      stimulusType: "meeting",
      businessTopic: "basic-proposal",
      skillTags: ["proposal", "reason", "decision"],
      vocabulary: [
        vocab("提案", "ていあん", "đề xuất"),
        vocab("案", "あん", "phương án"),
        vocab("簡単", "かんたん", "đơn giản"),
        vocab("見やすい", "みやすい", "dễ nhìn"),
        vocab("選ぶ", "えらぶ", "chọn"),
        vocab("決める", "きめる", "quyết định")
      ],
      grammar: [
        grammar("～のほうがいいです", "So sánh và đề xuất phương án tốt hơn."),
        grammar("～から", "Nêu lý do đơn giản.")
      ],
      focuses: [
        focus(
          "一つ提案があります。",
          "Tôi có một đề xuất",
          "xin đưa đề xuất",
          "Báo hiệu trước giúp đồng nghiệp chuyển sang nghe phương án."
        ),
        focus(
          "青い案はどうですか。",
          "Phương án màu xanh thế nào",
          "đưa một phương án để thảo luận",
          "どうですか mời phản hồi, không áp đặt."
        ),
        focus(
          "こちらのほうが見やすいです。",
          "Phương án này dễ nhìn hơn",
          "nêu lợi ích của đề xuất",
          "ほうが thể hiện so sánh giữa các lựa chọn đã biết."
        ),
        focus(
          "簡単ですから、早くできます。",
          "Vì đơn giản nên có thể làm nhanh",
          "nêu lý do và tác động",
          "から nối lý do; trong họp cao hơn sẽ cần cách mềm hơn."
        ),
        focus(
          "では、この案に決めます。",
          "Vậy chúng ta quyết định phương án này",
          "xác nhận quyết định",
          "では đánh dấu chuyển từ thảo luận sang kết luận."
        )
      ]
    },
    {
      week: 12,
      themeJa: "J5総合実務",
      themeVi: "Tổng hợp thực hành J5",
      objectiveVi: "Kết hợp chào hỏi, nhận việc, báo tiến độ, xử lý lỗi và kết thúc trao đổi.",
      scenarioJa: "新入社員が来客用資料を準備し、遅れを報告して受付へ届けます。",
      scenarioVi: "Nhân viên mới chuẩn bị tài liệu cho khách, báo việc chậm và giao đến lễ tân.",
      problemVi: "tài liệu thiếu một trang trong khi khách sắp đến.",
      desiredOutcomeVi: "người học báo sớm, xin hỗ trợ và hoàn thành việc đón khách.",
      relationship: "manager-staff",
      stimulusType: "memo",
      businessTopic: "integrated-workflow",
      skillTags: ["integrated", "horenso", "customer-service"],
      vocabulary: [
        vocab("準備", "じゅんび", "chuẩn bị"),
        vocab("来客", "らいきゃく", "khách đến"),
        vocab("不足", "ふそく", "thiếu"),
        vocab("確認", "かくにん", "xác nhận"),
        vocab("届ける", "とどける", "giao đến"),
        vocab("完了", "かんりょう", "hoàn tất")
      ],
      grammar: [
        grammar("～てから", "Làm hành động sau khi hoàn thành hành động trước."),
        grammar("～までに", "Hoàn thành trước một thời hạn.")
      ],
      focuses: [
        focus(
          "来客用の資料を準備します。",
          "Tôi sẽ chuẩn bị tài liệu cho khách",
          "xác nhận nhiệm vụ tổng hợp",
          "Nêu đối tượng sử dụng bằng 用 để tránh lấy nhầm tài liệu."
        ),
        focus(
          "一ページ足りません。",
          "Thiếu một trang",
          "báo thiếu sót cụ thể",
          "Số lượng cụ thể giúp người nghe quyết định nhanh."
        ),
        focus(
          "先輩に確認してから印刷します。",
          "Tôi sẽ xác nhận tiền bối rồi mới in",
          "nêu đúng thứ tự xử lý",
          "～てから làm rõ hành động nào phải xảy ra trước."
        ),
        focus(
          "十時までに受付へ届けます。",
          "Tôi sẽ giao đến lễ tân trước 10 giờ",
          "cam kết nơi và hạn giao",
          "Một cam kết tốt gồm thời điểm và điểm đến."
        ),
        focus(
          "準備が終わりました。",
          "Việc chuẩn bị đã hoàn tất",
          "báo kết quả cuối cùng",
          "Kết thúc vòng hōrensō bằng báo cáo hoàn tất, không để cấp trên tự đoán."
        )
      ]
    }
  ]
};
