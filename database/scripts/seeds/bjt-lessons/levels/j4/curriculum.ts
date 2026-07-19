import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";
import { defineWeek } from "../../shared/week-factory.js";

export const J4_BLUEPRINT: LevelBlueprint = {
  level: "J4",
  difficulty: "elementary",
  register: "です／ます nhất quán, biết xin phép và xác nhận phạm vi công việc",
  speakerRoleJa: "若手社員",
  counterpartRoleJa: "主任",
  acknowledgementJa: "承知しました。確認します。",
  closingJa: "ご確認をお願いします。",
  weeks: [
    defineWeek({
      week: 1,
      themeJa: "配属後の関係づくり",
      themeVi: "Xây dựng quan hệ sau khi nhận bộ phận",
      objectiveVi: "Giới thiệu kinh nghiệm, hỏi vai trò và nhờ hướng dẫn đúng mức.",
      scenarioJa: "配属された若手社員が主任とチームメンバーへ担当経験を説明します。",
      scenarioVi:
        "Nhân viên trẻ vừa được phân bộ phận giải thích kinh nghiệm với trưởng nhóm và đồng đội.",
      problemVi: "người nói chưa rõ phạm vi phụ trách và không muốn tỏ ra thụ động.",
      desiredOutcomeVi:
        "cả nhóm hiểu năng lực hiện tại và thống nhất ai sẽ hướng dẫn công việc đầu tiên.",
      vocabulary: [
        vocab("配属", "はいぞく", "phân về bộ phận"),
        vocab("経験", "けいけん", "kinh nghiệm"),
        vocab("担当", "たんとう", "phụ trách"),
        vocab("業務", "ぎょうむ", "nghiệp vụ"),
        vocab("指導", "しどう", "hướng dẫn"),
        vocab("慣れる", "なれる", "làm quen")
      ],
      grammar: [
        grammar("～たことがあります", "Nói kinh nghiệm đã từng có."),
        grammar("～ことになりました", "Nói quyết định hoặc sự sắp xếp đã được xác định.")
      ],
      focuses: [
        focus(
          "営業部に配属されました。",
          "Tôi được phân về phòng kinh doanh",
          "nói vị trí vừa được sắp xếp",
          "ことになりました nhấn vào quyết định của tổ chức, không phải tự chọn."
        ),
        focus(
          "接客をしたことがあります。",
          "Tôi từng làm dịch vụ khách hàng",
          "nói kinh nghiệm liên quan",
          "Chỉ nêu kinh nghiệm có ích cho nhiệm vụ sắp nhận."
        ),
        focus(
          "この業務を担当します。",
          "Tôi sẽ phụ trách nghiệp vụ này",
          "xác nhận phạm vi phụ trách",
          "担当する thể hiện trách nhiệm rõ hơn 手伝う."
        ),
        focus(
          "わからないときは伺います。",
          "Khi chưa hiểu tôi sẽ hỏi",
          "cam kết hỏi đúng lúc",
          "伺う ở đây là khiêm nhường ngữ cơ bản cho hỏi cấp trên."
        ),
        focus(
          "早く仕事に慣れたいです。",
          "Tôi muốn sớm quen công việc",
          "bày tỏ động lực thực tế",
          "たいです phù hợp vì nói mong muốn của chính người nói."
        )
      ]
    }),
    defineWeek({
      week: 2,
      themeJa: "指示の条件確認",
      themeVi: "Xác nhận điều kiện của chỉ thị",
      objectiveVi: "Xác nhận mục tiêu, định dạng, số lượng và thời hạn trước khi bắt đầu.",
      scenarioJa: "主任が若手社員に顧客リストの更新と印刷を依頼します。",
      scenarioVi: "Trưởng nhóm yêu cầu nhân viên trẻ cập nhật và in danh sách khách hàng.",
      problemVi: "file có hai phiên bản và chưa rõ cần in bản nào, bao nhiêu bộ.",
      desiredOutcomeVi: "nhân viên nhắc lại đúng phiên bản, số lượng, hạn và nơi bàn giao.",
      vocabulary: [
        vocab("最新版", "さいしんばん", "bản mới nhất"),
        vocab("形式", "けいしき", "định dạng"),
        vocab("部数", "ぶすう", "số bản"),
        vocab("期限", "きげん", "thời hạn"),
        vocab("更新", "こうしん", "cập nhật"),
        vocab("共有", "きょうゆう", "chia sẻ")
      ],
      grammar: [
        grammar("～ばいいですか", "Hỏi nên làm thế nào để đáp ứng yêu cầu."),
        grammar("～ということですか", "Diễn giải lại để xác nhận cách hiểu.")
      ],
      focuses: [
        focus(
          "最新版を使えばいいですか。",
          "Tôi dùng bản mới nhất là được ạ",
          "xác nhận phiên bản",
          "ばいいですか hỏi phương án cần chọn, không tự quyết khi dữ liệu chưa rõ."
        ),
        focus(
          "PDFで保存するということですか。",
          "Ý là lưu dạng PDF đúng không ạ",
          "diễn giải lại định dạng",
          "ということですか kiểm tra cách hiểu của mình."
        ),
        focus(
          "何部印刷しますか。",
          "Tôi in bao nhiêu bản ạ",
          "hỏi số lượng đầu ra",
          "Dùng trợ số từ 部 cho tài liệu đóng bộ."
        ),
        focus(
          "今日中に終わらせます。",
          "Tôi sẽ hoàn thành trong hôm nay",
          "xác nhận hạn xử lý",
          "今日中 là trước khi ngày làm việc kết thúc."
        ),
        focus(
          "終わったら共有します。",
          "Xong tôi sẽ chia sẻ",
          "xác nhận hành động sau hoàn tất",
          "たら thể hiện trình tự sau khi điều kiện hoàn thành xảy ra."
        )
      ]
    }),
    defineWeek({
      week: 3,
      themeJa: "進捗と遅れ",
      themeVi: "Tiến độ và chậm trễ",
      objectiveVi: "Báo tỷ lệ hoàn thành, nguyên nhân ngắn và thời gian khôi phục.",
      scenarioJa: "データ確認に時間がかかり、予定より入力作業が遅れています。",
      scenarioVi: "Việc kiểm tra dữ liệu mất thời gian khiến nhập liệu chậm hơn dự kiến.",
      problemVi: "deadline chưa bị lỡ nhưng phần dự phòng đang giảm nhanh.",
      desiredOutcomeVi: "trưởng nhóm biết mức chậm, nguyên nhân và kế hoạch hoàn thành mới.",
      vocabulary: [
        vocab("進捗", "しんちょく", "tiến độ"),
        vocab("予定", "よてい", "dự kiến"),
        vocab("遅れる", "おくれる", "chậm"),
        vocab("原因", "げんいん", "nguyên nhân"),
        vocab("七割", "ななわり", "70%"),
        vocab("見込み", "みこみ", "dự kiến khả năng")
      ],
      grammar: [
        grammar("～より", "So sánh với mốc hoặc kế hoạch."),
        grammar("～そうです", "Nêu phán đoán dựa trên tình hình hiện tại.")
      ],
      focuses: [
        focus(
          "作業は七割まで進みました。",
          "Công việc đã tiến đến 70%",
          "báo mức tiến độ định lượng",
          "Tỷ lệ cụ thể giúp cấp trên đánh giá thay vì nói だいたい."
        ),
        focus(
          "予定より一時間遅れています。",
          "Đang chậm một giờ so với dự kiến",
          "nêu độ lệch kế hoạch",
          "Dùng より để chỉ mốc so sánh."
        ),
        focus(
          "確認に時間がかかっています。",
          "Việc kiểm tra đang mất thời gian",
          "nêu nguyên nhân trực tiếp",
          "Không đổ lỗi cho người khác khi chưa xác minh."
        ),
        focus(
          "五時には終わりそうです。",
          "Có vẻ sẽ xong vào khoảng 5 giờ",
          "nêu dự báo hoàn thành",
          "そうです là dự báo, không phải cam kết chắc chắn."
        ),
        focus(
          "遅れる場合は連絡します。",
          "Nếu chậm tôi sẽ liên lạc",
          "cam kết cảnh báo sớm",
          "場合は đặt điều kiện và hành động liên lạc rõ."
        )
      ]
    }),
    defineWeek({
      week: 4,
      themeJa: "相談のタイミング",
      themeVi: "Thời điểm trao đổi trong hōrensō",
      objectiveVi: "Biết khi nào tự xử lý, khi nào báo và khi nào xin quyết định.",
      scenarioJa: "顧客データに重複があり、若手社員が削除前に主任へ相談します。",
      scenarioVi: "Dữ liệu khách bị trùng và nhân viên trẻ hỏi trưởng nhóm trước khi xóa.",
      problemVi: "xóa nhầm có thể mất lịch sử giao dịch nhưng giữ nguyên sẽ sai báo cáo.",
      desiredOutcomeVi: "trưởng nhóm nhận đủ bằng chứng và quyết định cách xử lý an toàn.",
      vocabulary: [
        vocab("重複", "ちょうふく", "trùng lặp"),
        vocab("削除", "さくじょ", "xóa"),
        vocab("履歴", "りれき", "lịch sử"),
        vocab("判断", "はんだん", "phán đoán"),
        vocab("念のため", "ねんのため", "để chắc chắn"),
        vocab("対応", "たいおう", "xử lý")
      ],
      grammar: [
        grammar("～前に", "Làm việc gì trước một hành động khác."),
        grammar("～ほうがいいですか", "Hỏi phương án nào nên chọn.")
      ],
      focuses: [
        focus(
          "相談したいことがあります。",
          "Tôi có việc muốn trao đổi",
          "xin mở cuộc trao đổi",
          "Báo trước giúp cấp trên phân bổ sự chú ý."
        ),
        focus(
          "同じデータが二件あります。",
          "Có hai bản dữ liệu giống nhau",
          "nêu sự thật quan sát được",
          "Tách dữ kiện khỏi suy đoán về nguyên nhân."
        ),
        focus(
          "削除する前に確認しました。",
          "Tôi đã xác nhận trước khi xóa",
          "báo biện pháp phòng ngừa",
          "前に cho thấy đã dừng trước hành động khó hoàn tác."
        ),
        focus(
          "どちらを残したほうがいいですか。",
          "Nên giữ bản nào ạ",
          "xin quyết định về phương án",
          "ほうがいいですか phù hợp khi có lựa chọn cụ thể."
        ),
        focus(
          "判断が決まったら対応します。",
          "Khi có quyết định tôi sẽ xử lý",
          "xác nhận chưa tự ý thay đổi",
          "Đợi quyết định không có nghĩa thụ động nếu đã chuẩn bị dữ kiện."
        )
      ]
    }),
    defineWeek({
      week: 5,
      themeJa: "電話の取り次ぎ",
      themeVi: "Chuyển tiếp điện thoại",
      objectiveVi: "Xác nhận công ty, tên, mục đích và đề nghị gọi lại chính xác.",
      scenarioJa: "仕入先から納期確認の電話があり、担当者は会議中です。",
      scenarioVi: "Nhà cung cấp gọi hỏi hạn giao khi người phụ trách đang họp.",
      problemVi: "người gọi cần câu trả lời trong ngày và không thể chờ máy lâu.",
      desiredOutcomeVi: "nhân viên ghi đủ thông tin và cam kết thời điểm gọi lại hợp lý.",
      vocabulary: [
        vocab("取り次ぐ", "とりつぐ", "chuyển máy"),
        vocab("仕入先", "しいれさき", "nhà cung cấp"),
        vocab("納期", "のうき", "hạn giao"),
        vocab("会議中", "かいぎちゅう", "đang họp"),
        vocab("折り返す", "おりかえす", "gọi lại"),
        vocab("用件", "ようけん", "nội dung cần trao đổi")
      ],
      grammar: [
        grammar("～中です", "Nêu ai đó đang trong một hoạt động."),
        grammar("～たら、～ます", "Nêu hành động sẽ làm sau khi điều kiện hoàn tất.")
      ],
      focuses: [
        focus(
          "いつもお世話になっております。",
          "Cảm ơn quý công ty luôn hỗ trợ",
          "đáp lời chào giao dịch",
          "Là lời chào quan hệ công việc, không dịch sát thành đang được chăm sóc."
        ),
        focus(
          "ご用件を伺います。",
          "Tôi xin nghe nội dung cần trao đổi",
          "hỏi mục đích cuộc gọi",
          "伺う hạ mình khi hỏi bên ngoài."
        ),
        focus(
          "担当者は会議中です。",
          "Người phụ trách đang họp",
          "thông báo trạng thái vắng",
          "Nêu lý do đủ dùng, không chia sẻ lịch nội bộ quá chi tiết."
        ),
        focus(
          "戻りましたら、折り返します。",
          "Khi quay lại chúng tôi sẽ gọi lại",
          "đề nghị phương án gọi lại",
          "Cần lấy số điện thoại nếu hệ thống chưa có."
        ),
        focus(
          "電話番号を確認させてください。",
          "Cho phép tôi xác nhận số điện thoại",
          "xác nhận kênh liên lạc",
          "させてください xin phép thực hiện hành động cần thiết."
        )
      ]
    }),
    defineWeek({
      week: 6,
      themeJa: "依頼メール",
      themeVi: "Email yêu cầu",
      objectiveVi: "Viết email yêu cầu ngắn có lý do, hạn và tệp đính kèm.",
      scenarioJa: "他部署へ在庫表の確認を依頼し、翌朝までの返信をお願いします。",
      scenarioVi: "Nhờ phòng ban khác kiểm tra bảng tồn kho và phản hồi trước sáng hôm sau.",
      problemVi: "file gửi kèm có số liệu mới nhưng người nhận có thể mở nhầm bản cũ.",
      desiredOutcomeVi: "người nhận hiểu tệp nào cần kiểm tra, phạm vi và hạn phản hồi.",
      vocabulary: [
        vocab("依頼", "いらい", "yêu cầu"),
        vocab("添付", "てんぷ", "đính kèm"),
        vocab("在庫", "ざいこ", "tồn kho"),
        vocab("返信", "へんしん", "hồi âm"),
        vocab("修正", "しゅうせい", "chỉnh sửa"),
        vocab("明朝", "みょうちょう", "sáng mai")
      ],
      grammar: [
        grammar("～ていただけますか", "Nhờ ai làm việc gì lịch sự."),
        grammar("～までに", "Đặt hạn hoàn thành.")
      ],
      focuses: [
        focus(
          "在庫表を添付しました。",
          "Tôi đã đính kèm bảng tồn kho",
          "chỉ rõ tài liệu gửi kèm",
          "Nêu tên tệp trong thân email để người nhận đối chiếu."
        ),
        focus(
          "数字を確認していただけますか。",
          "Anh/chị kiểm tra số liệu giúp được không",
          "đưa yêu cầu lịch sự",
          "ていただけますか phù hợp nhờ phòng ban khác."
        ),
        focus(
          "赤いセルが対象です。",
          "Các ô màu đỏ là đối tượng cần xử lý",
          "giới hạn phạm vi công việc",
          "Định nghĩa phạm vi giảm thời gian trao đổi lại."
        ),
        focus(
          "明日の十時までにお願いします。",
          "Xin hoàn thành trước 10 giờ mai",
          "nêu deadline yêu cầu",
          "Hạn cần có ngày và giờ khi công việc gấp."
        ),
        focus(
          "不明な点はご連絡ください。",
          "Nếu có điểm chưa rõ xin hãy liên lạc",
          "mở kênh làm rõ",
          "Cho phép hỏi lại giúp tránh người nhận tự đoán."
        )
      ]
    }),
    defineWeek({
      week: 7,
      themeJa: "短い会議発言",
      themeVi: "Phát biểu ngắn trong họp",
      objectiveVi: "Xin lượt, nêu ý kiến có lý do, đồng ý một phần và xác nhận kết luận.",
      scenarioJa: "販促チラシの配布方法について部署内で意見を出します。",
      scenarioVi: "Phòng ban thảo luận cách phát tờ quảng cáo.",
      problemVi: "phương án rẻ hơn mất nhiều thời gian, phương án nhanh hơn tốn ngân sách.",
      desiredOutcomeVi: "nhóm nghe đủ hai mặt và thống nhất tiêu chí ưu tiên.",
      vocabulary: [
        vocab("発言", "はつげん", "phát biểu"),
        vocab("意見", "いけん", "ý kiến"),
        vocab("賛成", "さんせい", "tán thành"),
        vocab("反対", "はんたい", "phản đối"),
        vocab("費用", "ひよう", "chi phí"),
        vocab("方法", "ほうほう", "phương pháp")
      ],
      grammar: [
        grammar("～と思います", "Nêu nhận định cá nhân mềm."),
        grammar("～ですが", "Nêu đối lập hoặc mở lời phản biện mềm.")
      ],
      focuses: [
        focus(
          "少し発言してもいいですか。",
          "Tôi có thể phát biểu một chút không",
          "xin lượt phát biểu",
          "Xin lượt giúp không cắt ngang người đang nói."
        ),
        focus(
          "私は郵送がいいと思います。",
          "Tôi nghĩ gửi bưu điện tốt",
          "nêu phương án ưu tiên",
          "と思います đánh dấu đây là ý kiến, không phải quyết định."
        ),
        focus(
          "費用は高いですが、早いです。",
          "Chi phí cao nhưng nhanh",
          "nêu đánh đổi",
          "ですが nối nhược điểm và lợi ích một cách cân bằng."
        ),
        focus(
          "その点には賛成です。",
          "Tôi đồng ý ở điểm đó",
          "đồng ý có giới hạn",
          "その点 tránh bị hiểu là đồng ý toàn bộ đề xuất."
        ),
        focus(
          "速さを優先するということですね。",
          "Tức là ưu tiên tốc độ đúng không",
          "xác nhận tiêu chí kết luận",
          "Tóm tắt tiêu chí trước khi chuyển sang quyết định."
        )
      ]
    }),
    defineWeek({
      week: 8,
      themeJa: "予定の再調整",
      themeVi: "Điều chỉnh lại kế hoạch",
      objectiveVi: "Nêu xung đột lịch, xin đổi hẹn và xác nhận ảnh hưởng tới deadline.",
      scenarioJa: "顧客訪問と社内研修が重なり、同僚と担当時間を入れ替えます。",
      scenarioVi:
        "Lịch thăm khách trùng đào tạo nội bộ nên hai đồng nghiệp đổi thời gian phụ trách.",
      problemVi: "đổi ca có thể làm chậm chuẩn bị tài liệu cho cuộc gặp.",
      desiredOutcomeVi:
        "hai người chốt lịch thay thế và ai chịu trách nhiệm chuẩn bị phần còn lại.",
      vocabulary: [
        vocab("重なる", "かさなる", "trùng nhau"),
        vocab("調整", "ちょうせい", "điều chỉnh"),
        vocab("入れ替える", "いれかえる", "đổi chỗ"),
        vocab("訪問", "ほうもん", "thăm"),
        vocab("都合", "つごう", "thuận tiện"),
        vocab("影響", "えいきょう", "ảnh hưởng")
      ],
      grammar: [
        grammar("～ので", "Nêu lý do mềm, mang tính giải thích."),
        grammar("～てもらえませんか", "Nhờ người khác hỗ trợ một cách mềm.")
      ],
      focuses: [
        focus(
          "予定が重なってしまいました。",
          "Lịch bị trùng mất rồi",
          "báo xung đột ngoài ý muốn",
          "てしまいました thể hiện sự cố không mong muốn nhưng không thay lời chịu trách nhiệm."
        ),
        focus(
          "時間を調整できませんか。",
          "Chúng ta có thể điều chỉnh giờ không",
          "mở thương lượng lịch",
          "Hỏi khả năng trước khi áp đặt giờ mới."
        ),
        focus(
          "午後と入れ替えてもらえませんか。",
          "Anh/chị đổi với ca chiều giúp được không",
          "đề nghị phương án đổi cụ thể",
          "Đề nghị cần nêu phương án thay thế rõ."
        ),
        focus(
          "資料は先に準備します。",
          "Tôi sẽ chuẩn bị tài liệu trước",
          "giảm ảnh hưởng do đổi lịch",
          "先に cho thấy đã nghĩ đến phụ thuộc công việc."
        ),
        focus(
          "変更後の予定を共有します。",
          "Tôi sẽ chia sẻ lịch sau thay đổi",
          "xác nhận cập nhật nguồn thông tin chung",
          "Chỉ thỏa thuận miệng dễ gây lệch lịch với người thứ ba."
        )
      ]
    }),
    defineWeek({
      week: 9,
      themeJa: "ミスの一次報告",
      themeVi: "Báo cáo ban đầu về lỗi",
      objectiveVi: "Nêu lỗi, phạm vi ảnh hưởng, xử lý tạm và xin chỉ đạo.",
      scenarioJa: "見積書に古い単価を入力し、送信直前に誤りへ気づきました。",
      scenarioVi: "Bảng báo giá dùng đơn giá cũ và lỗi được phát hiện ngay trước khi gửi.",
      problemVi: "nếu gửi sẽ ảnh hưởng niềm tin, nhưng deadline trả báo giá sắp đến.",
      desiredOutcomeVi: "trưởng nhóm biết lỗi chưa ra ngoài và phê duyệt cách sửa nhanh.",
      vocabulary: [
        vocab("誤り", "あやまり", "sai sót"),
        vocab("単価", "たんか", "đơn giá"),
        vocab("見積書", "みつもりしょ", "báo giá"),
        vocab("影響", "えいきょう", "ảnh hưởng"),
        vocab("差し替える", "さしかえる", "thay bản"),
        vocab("再確認", "さいかくにん", "kiểm tra lại")
      ],
      grammar: [
        grammar("～てしまいました", "Nói sự việc đáng tiếc đã xảy ra."),
        grammar("～前です", "Xác định hành động chưa xảy ra.")
      ],
      focuses: [
        focus(
          "入力に誤りがありました。",
          "Có lỗi trong phần nhập liệu",
          "báo lỗi ngắn gọn",
          "Mở đầu bằng dữ kiện, không giấu lỗi trong câu dài."
        ),
        focus(
          "古い単価を使ってしまいました。",
          "Tôi đã lỡ dùng đơn giá cũ",
          "nêu hành động gây lỗi",
          "てしまいました thể hiện đáng tiếc; vẫn cần nêu trách nhiệm xử lý."
        ),
        focus(
          "まだ送信前です。",
          "Hiện vẫn chưa gửi",
          "nêu phạm vi ảnh hưởng",
          "Thông tin này quyết định mức khẩn cấp và cách phục hồi."
        ),
        focus(
          "正しい表に差し替えます。",
          "Tôi sẽ thay bằng bảng đúng",
          "đề xuất xử lý tạm",
          "Không chỉ báo lỗi; cần nêu bước khắc phục có thể làm ngay."
        ),
        focus(
          "送る前に再確認をお願いします。",
          "Xin kiểm tra lại trước khi gửi",
          "xin lớp kiểm soát thứ hai",
          "Với dữ liệu giá, xác nhận chéo hợp lý hơn tự gửi gấp."
        )
      ]
    }),
    defineWeek({
      week: 10,
      themeJa: "お客様の不満",
      themeVi: "Bất mãn của khách hàng",
      objectiveVi: "Lắng nghe, xin lỗi đúng việc, xác nhận yêu cầu và hẹn phản hồi.",
      scenarioJa: "注文品の到着が一日遅れ、顧客から電話で問い合わせがあります。",
      scenarioVi: "Đơn hàng đến chậm một ngày và khách gọi hỏi.",
      problemVi: "nhân viên chưa biết nguyên nhân cuối cùng nhưng khách cần lịch giao mới.",
      desiredOutcomeVi:
        "khách được ghi nhận bất tiện và nhận cam kết kiểm tra trong thời gian cụ thể.",
      vocabulary: [
        vocab("到着", "とうちゃく", "đến nơi"),
        vocab("遅延", "ちえん", "chậm trễ"),
        vocab("注文品", "ちゅうもんひん", "hàng đã đặt"),
        vocab("状況", "じょうきょう", "tình hình"),
        vocab("確認", "かくにん", "xác nhận"),
        vocab("折り返し", "おりかえし", "gọi lại")
      ],
      grammar: [
        grammar("～て申し訳ありません", "Xin lỗi về một hành động hoặc tình trạng cụ thể."),
        grammar("～以内に", "Cam kết trong một khoảng thời gian.")
      ],
      focuses: [
        focus(
          "ご不便をおかけして申し訳ありません。",
          "Xin lỗi đã gây bất tiện",
          "xin lỗi đúng tác động",
          "Xin lỗi về bất tiện trước khi giải thích nguyên nhân."
        ),
        focus(
          "注文番号を確認させてください。",
          "Cho phép tôi xác nhận mã đơn",
          "lấy dữ liệu để kiểm tra",
          "させてください cho biết hành động cần thiết để xử lý."
        ),
        focus(
          "現在の状況を調べます。",
          "Tôi sẽ kiểm tra tình hình hiện tại",
          "nêu hành động điều tra",
          "Không đoán lịch giao khi chưa có thông tin."
        ),
        focus(
          "一時間以内にご連絡します。",
          "Tôi sẽ liên lạc trong một giờ",
          "cam kết thời gian phản hồi",
          "以内に đặt giới hạn đo được; phải thực hiện đúng."
        ),
        focus(
          "ご希望の時間を伺います。",
          "Tôi xin hỏi thời gian quý khách mong muốn",
          "xác nhận nhu cầu phục hồi",
          "Hiểu nhu cầu giúp đề xuất phương án bồi hoàn phù hợp."
        )
      ]
    }),
    defineWeek({
      week: 11,
      themeJa: "小さな改善提案",
      themeVi: "Đề xuất cải tiến nhỏ",
      objectiveVi: "Mô tả vấn đề lặp lại, đề xuất thay đổi và so sánh lợi ích đơn giản.",
      scenarioJa: "紙の申請書を毎日転記しており、入力ミスが起きています。",
      scenarioVi: "Biểu mẫu giấy được nhập lại mỗi ngày và gây lỗi đánh máy.",
      problemVi: "cách hiện tại quen thuộc nhưng mất thời gian và khó kiểm tra lịch sử.",
      desiredOutcomeVi: "nhóm đồng ý thử biểu mẫu điện tử trong phạm vi nhỏ.",
      vocabulary: [
        vocab("改善", "かいぜん", "cải tiến"),
        vocab("申請書", "しんせいしょ", "đơn đăng ký"),
        vocab("転記", "てんき", "chép lại"),
        vocab("入力ミス", "にゅうりょくミス", "lỗi nhập"),
        vocab("試す", "ためす", "thử"),
        vocab("効率", "こうりつ", "hiệu suất")
      ],
      grammar: [
        grammar("～ようにする", "Tạo thành quy tắc hoặc thói quen mới."),
        grammar("～たらどうですか", "Đưa đề xuất để đối phương cân nhắc.")
      ],
      focuses: [
        focus(
          "改善案があります。",
          "Tôi có phương án cải tiến",
          "mở đề xuất cải tiến",
          "Dùng 案 cho phương án có thể thảo luận, chưa phải quyết định."
        ),
        focus(
          "入力を一回にしたらどうですか。",
          "Nếu chỉ nhập một lần thì sao",
          "đề xuất thay đổi quy trình",
          "たらどうですか mở để nhóm đánh giá."
        ),
        focus(
          "ミスを減らすことができます。",
          "Có thể giảm lỗi",
          "nêu lợi ích đo được",
          "Nêu kết quả cụ thể thay vì chỉ nói 便利です."
        ),
        focus(
          "まず一週間試しましょう。",
          "Trước hết hãy thử một tuần",
          "đề xuất thử nghiệm nhỏ",
          "まず giới hạn cam kết và giảm rủi ro thay đổi."
        ),
        focus(
          "結果を比べてから決めます。",
          "So sánh kết quả rồi mới quyết định",
          "đặt tiêu chí ra quyết định",
          "Tránh quyết định theo cảm giác trước khi có dữ liệu thử."
        )
      ]
    }),
    defineWeek({
      week: 12,
      themeJa: "J4業務サイクル",
      themeVi: "Chu trình công việc J4",
      objectiveVi: "Kết hợp nhận yêu cầu, email, tiến độ, sự cố và phản hồi khách.",
      scenarioJa: "若手社員が在庫確認を依頼され、遅れを報告し、顧客へ回答を準備します。",
      scenarioVi: "Nhân viên trẻ nhận việc kiểm tồn, báo chậm và chuẩn bị trả lời khách.",
      problemVi: "số liệu hai kho chưa khớp trong khi khách chờ xác nhận giao hàng.",
      desiredOutcomeVi:
        "nhân viên xác nhận dữ kiện, báo cấp trên và hẹn khách bằng thông tin không suy đoán.",
      vocabulary: [
        vocab("在庫差異", "ざいこさい", "chênh lệch tồn kho"),
        vocab("回答", "かいとう", "câu trả lời"),
        vocab("照合", "しょうごう", "đối chiếu"),
        vocab("保留", "ほりゅう", "tạm giữ"),
        vocab("確定", "かくてい", "xác định"),
        vocab("引き継ぐ", "ひきつぐ", "bàn giao")
      ],
      grammar: [
        grammar("～てから、～", "Xác định thứ tự hành động."),
        grammar("～場合は", "Nêu xử lý khi một điều kiện xảy ra.")
      ],
      focuses: [
        focus(
          "二つの在庫表を照合します。",
          "Tôi sẽ đối chiếu hai bảng tồn",
          "xác định bước kiểm tra đầu tiên",
          "Đối chiếu nguồn trước khi kết luận số nào đúng."
        ),
        focus(
          "数字が合わないため、確認中です。",
          "Do số không khớp nên đang kiểm tra",
          "báo trạng thái và lý do",
          "ため rõ nguyên nhân trong báo cáo ngắn."
        ),
        focus(
          "回答は一度保留にします。",
          "Tạm thời tôi sẽ hoãn trả lời",
          "tránh cung cấp thông tin chưa chắc",
          "保留 cần đi kèm thời điểm phản hồi tiếp theo."
        ),
        focus(
          "確定したらお客様へ連絡します。",
          "Khi xác định xong tôi sẽ liên hệ khách",
          "nêu điều kiện phản hồi",
          "Không hứa nội dung khi dữ kiện chưa ổn định."
        ),
        focus(
          "経緯をまとめて引き継ぎます。",
          "Tôi sẽ tóm tắt diễn biến để bàn giao",
          "bàn giao đầy đủ",
          "経緯 giúp người nhận hiểu đã kiểm tra gì và còn gì chưa xong."
        )
      ]
    })
  ]
};
