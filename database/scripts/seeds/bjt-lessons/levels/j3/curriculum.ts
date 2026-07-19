import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";
import { defineWeek } from "../../shared/week-factory.js";

export const J3_BLUEPRINT: LevelBlueprint = {
  level: "J3",
  difficulty: "intermediate",
  register: "teineigo ổn định, kính ngữ nền tảng và diễn đạt lý do/ảnh hưởng có cấu trúc",
  speakerRoleJa: "担当者",
  counterpartRoleJa: "課長",
  acknowledgementJa: "承知しました。確認のうえ、改めてご連絡します。",
  closingJa: "お手数ですが、ご確認のほどお願いいたします。",
  weeks: [
    defineWeek({
      week: 1,
      themeJa: "職場の距離感",
      themeVi: "Khoảng cách quan hệ nơi làm việc",
      objectiveVi:
        "Điều chỉnh cách xưng hô và tự định vị khi làm việc với cấp trên, đồng nghiệp, đối tác.",
      scenarioJa: "異動した担当者が新しい課長と協力会社へ自分の役割を説明します。",
      scenarioVi:
        "Nhân viên vừa chuyển bộ phận giải thích vai trò với trưởng phòng mới và công ty hợp tác.",
      problemVi: "cùng một nội dung phải nói khác nhau giữa nội bộ và bên ngoài.",
      desiredOutcomeVi:
        "người nghe hiểu trách nhiệm của người nói mà không thấy tự cao hoặc quá xa cách.",
      vocabulary: [
        vocab("異動", "いどう", "chuyển bộ phận"),
        vocab("役割", "やくわり", "vai trò"),
        vocab("前任者", "ぜんにんしゃ", "người tiền nhiệm"),
        vocab("引き継ぎ", "ひきつぎ", "bàn giao"),
        vocab("窓口", "まどぐち", "đầu mối"),
        vocab("協力会社", "きょうりょくがいしゃ", "công ty hợp tác")
      ],
      grammar: [
        grammar("～を担当しております", "Khiêm nhường thông báo phạm vi mình phụ trách."),
        grammar(
          "～ことになっております",
          "Nêu sự sắp xếp/quy định đã xác định một cách trang trọng."
        )
      ],
      focuses: [
        focus(
          "今月から本件を担当しております。",
          "Từ tháng này tôi phụ trách vụ việc này",
          "tự định vị với đối tác",
          "しております hạ hành động của mình và phù hợp kênh đối ngoại."
        ),
        focus(
          "前任の佐藤から引き継ぎました。",
          "Tôi đã nhận bàn giao từ anh Sato",
          "nêu tính liên tục của đầu mối",
          "Khi nói ngoài công ty không gắn さん cho người nội bộ."
        ),
        focus(
          "今後は私が窓口になります。",
          "Từ nay tôi sẽ là đầu mối",
          "làm rõ kênh liên hệ",
          "窓口 giúp đối phương biết ai chịu trách nhiệm điều phối."
        ),
        focus(
          "社内では営業部と連携します。",
          "Trong công ty tôi sẽ phối hợp phòng kinh doanh",
          "nêu quan hệ phối hợp",
          "連携する mạnh hơn 相談する vì bao gồm phối hợp hành động."
        ),
        focus(
          "不明点があればお知らせください。",
          "Nếu có điểm chưa rõ xin hãy cho biết",
          "mở kênh làm rõ",
          "あれば tránh giả định đối phương chắc chắn có thắc mắc."
        )
      ]
    }),
    defineWeek({
      week: 2,
      themeJa: "曖昧な指示の具体化",
      themeVi: "Cụ thể hóa chỉ thị mơ hồ",
      objectiveVi: "Tách chỉ thị thành mục tiêu, ưu tiên, tiêu chí hoàn thành và quyền quyết định.",
      scenarioJa: "課長から『なるべく早く資料を整えて』と言われ、担当者が条件を確認します。",
      scenarioVi:
        "Trưởng phòng nói 'chuẩn bị tài liệu càng sớm càng tốt' và nhân viên cần làm rõ điều kiện.",
      problemVi: "cụm từ 'càng sớm càng tốt' chưa cho biết ưu tiên so với việc đang làm.",
      desiredOutcomeVi:
        "hai bên thống nhất deadline, người đọc mục tiêu và mức chất lượng chấp nhận được.",
      vocabulary: [
        vocab("優先順位", "ゆうせんじゅんい", "thứ tự ưu tiên"),
        vocab("完成基準", "かんせいきじゅん", "tiêu chí hoàn thành"),
        vocab("対象者", "たいしょうしゃ", "đối tượng"),
        vocab("概要", "がいよう", "tổng quan"),
        vocab("詳細", "しょうさい", "chi tiết"),
        vocab("裁量", "さいりょう", "quyền tự quyết")
      ],
      grammar: [
        grammar("～という理解でよろしいですか", "Xác nhận lại cách hiểu một cách lịch sự."),
        grammar("～を優先して", "Chỉ rõ việc cần ưu tiên.")
      ],
      focuses: [
        focus(
          "今日中という理解でよろしいですか。",
          "Tôi hiểu là trong hôm nay, có đúng không ạ",
          "xác nhận deadline ẩn",
          "という理解で xác nhận cách diễn giải mà không đổ lỗi chỉ thị mơ hồ."
        ),
        focus(
          "現在の作業より優先しますか。",
          "Có ưu tiên hơn công việc hiện tại không ạ",
          "xác nhận xung đột ưu tiên",
          "Đặt hai công việc cạnh nhau giúp cấp trên quyết định cụ thể."
        ),
        focus(
          "部長向けの概要でよろしいでしょうか。",
          "Bản tổng quan dành cho trưởng bộ phận đúng không ạ",
          "xác nhận người đọc và độ sâu",
          "Người đọc quyết định lượng chi tiết và từ ngữ."
        ),
        focus(
          "数字は確定値だけを載せますか。",
          "Chỉ đưa số đã chốt phải không ạ",
          "xác nhận tiêu chuẩn dữ liệu",
          "Phân biệt số tạm và số chính thức tránh báo cáo sai."
        ),
        focus(
          "構成はこちらで決めてもよろしいですか。",
          "Tôi tự quyết bố cục có được không ạ",
          "xác nhận quyền tự quyết",
          "てもよろしいですか xin phép trong phạm vi chưa được chỉ rõ."
        )
      ]
    }),
    defineWeek({
      week: 3,
      themeJa: "根拠付き進捗報告",
      themeVi: "Báo tiến độ có căn cứ",
      objectiveVi:
        "Báo trạng thái, sai lệch, nguyên nhân và forecast bằng dữ kiện kiểm chứng được.",
      scenarioJa: "月次集計で二店舗のデータが未提出のため、進捗会議で見込みを報告します。",
      scenarioVi:
        "Hai cửa hàng chưa nộp dữ liệu nên nhân viên báo forecast trong họp tiến độ tháng.",
      problemVi: "tỷ lệ hoàn thành cao nhưng phần thiếu có thể làm thay đổi kết luận doanh số.",
      desiredOutcomeVi:
        "quản lý phân biệt dữ liệu đã chốt với giả định và quyết định có dời báo cáo hay không.",
      vocabulary: [
        vocab("集計", "しゅうけい", "tổng hợp số liệu"),
        vocab("未提出", "みていしゅつ", "chưa nộp"),
        vocab("確定値", "かくていち", "số đã chốt"),
        vocab("暫定値", "ざんていち", "số tạm"),
        vocab("見通し", "みとおし", "triển vọng"),
        vocab("変動", "へんどう", "biến động")
      ],
      grammar: [
        grammar("～を除いて", "Nêu ngoại lệ không nằm trong phạm vi."),
        grammar("～見込みです", "Nêu dự báo có cơ sở.")
      ],
      focuses: [
        focus(
          "二店舗を除いて集計済みです。",
          "Đã tổng hợp xong trừ hai cửa hàng",
          "báo phạm vi hoàn thành",
          "Ngoại lệ được nêu ngay để tránh hiểu nhầm 100%."
        ),
        focus(
          "現時点の進捗は八十五％です。",
          "Tiến độ hiện tại là 85%",
          "định lượng trạng thái",
          "現時点 giới hạn tính đúng của con số theo thời điểm."
        ),
        focus(
          "未提出分で結果が変動する可能性があります。",
          "Phần chưa nộp có thể làm kết quả biến động",
          "nêu rủi ro còn lại",
          "可能性 tránh khẳng định quá mức khi chưa có dữ liệu."
        ),
        focus(
          "明日の正午には確定する見込みです。",
          "Dự kiến sẽ chốt vào trưa mai",
          "đưa forecast có thời điểm",
          "見込み cần dựa trên thông tin đã xác nhận với cửa hàng."
        ),
        focus(
          "暫定版を先に共有いたします。",
          "Tôi sẽ chia sẻ bản tạm trước",
          "đề xuất đầu ra trung gian",
          "Gắn nhãn 暫定版 rõ để không bị dùng như số chính thức."
        )
      ]
    }),
    defineWeek({
      week: 4,
      themeJa: "報連相の判断基準",
      themeVi: "Ngưỡng quyết định trong hōrensō",
      objectiveVi: "Chọn mức báo cáo phù hợp theo ảnh hưởng, độ khẩn và khả năng hoàn tác.",
      scenarioJa: "キャンペーン価格の設定差異を発見し、公開前に関係者へ連絡します。",
      scenarioVi: "Phát hiện lệch cấu hình giá chiến dịch và liên lạc các bên trước khi công khai.",
      problemVi: "lỗi chưa tới khách nhưng thời điểm mở bán chỉ còn hai giờ.",
      desiredOutcomeVi:
        "đúng người được cảnh báo, quyền xuất bản được tạm giữ và phương án sửa được phê duyệt.",
      vocabulary: [
        vocab("設定差異", "せっていさい", "sai lệch cấu hình"),
        vocab("公開", "こうかい", "công khai"),
        vocab("影響範囲", "えいきょうはんい", "phạm vi ảnh hưởng"),
        vocab("緊急度", "きんきゅうど", "độ khẩn"),
        vocab("承認", "しょうにん", "phê duyệt"),
        vocab("保留", "ほりゅう", "tạm hoãn")
      ],
      grammar: [
        grammar("～恐れがあります", "Nêu nguy cơ theo cách thận trọng."),
        grammar("～次第", "Ngay khi có kết quả/điều kiện thì thực hiện hành động.")
      ],
      focuses: [
        focus(
          "公開価格に差異を確認しました。",
          "Tôi đã xác nhận có sai lệch giá công khai",
          "báo phát hiện có bằng chứng",
          "確認しました cho biết đã kiểm tra, không chỉ cảm thấy có lỗi."
        ),
        focus(
          "このままでは誤表示になる恐れがあります。",
          "Nếu để vậy có nguy cơ hiển thị sai",
          "nêu ảnh hưởng nếu không hành động",
          "恐れがあります phù hợp cảnh báo rủi ro chưa xảy ra."
        ),
        focus(
          "公開作業を一時保留にしてください。",
          "Xin tạm hoãn việc công khai",
          "đề nghị hành động bảo vệ",
          "Nêu rõ 一時 để tránh hiểu là hủy toàn bộ chiến dịch."
        ),
        focus(
          "営業とシステム担当へ連絡済みです。",
          "Đã liên hệ kinh doanh và phụ trách hệ thống",
          "báo các bên đã được thông tin",
          "Liệt kê bên liên quan tránh người nghe phải hỏi lại."
        ),
        focus(
          "承認が取れ次第、修正を反映します。",
          "Ngay khi được duyệt sẽ áp dụng sửa",
          "nêu điều kiện tiếp tục",
          "次第 thể hiện hành động sẽ diễn ra ngay sau điều kiện."
        )
      ]
    }),
    defineWeek({
      week: 5,
      themeJa: "敬語での電話対応",
      themeVi: "Điện thoại với kính ngữ",
      objectiveVi: "Dùng kính ngữ nền tảng khi xác nhận danh tính, chuyển máy và ghi lời nhắn.",
      scenarioJa: "重要顧客から契約更新について電話があり、担当課長は外出中です。",
      scenarioVi:
        "Khách hàng quan trọng gọi về gia hạn hợp đồng khi trưởng phòng phụ trách đang ra ngoài.",
      problemVi: "nội dung có tính bảo mật và người nhận cuộc gọi không được tự trả lời.",
      desiredOutcomeVi:
        "xác minh đủ người gọi, bảo vệ thông tin và sắp xếp gọi lại đúng thẩm quyền.",
      vocabulary: [
        vocab("契約更新", "けいやくこうしん", "gia hạn hợp đồng"),
        vocab("外出", "がいしゅつ", "ra ngoài"),
        vocab("戻り予定", "もどりよてい", "dự kiến quay lại"),
        vocab("差し支え", "さしつかえ", "trở ngại"),
        vocab("会社名", "かいしゃめい", "tên công ty"),
        vocab("折り返し", "おりかえし", "gọi lại")
      ],
      grammar: [
        grammar("お～いたします", "Mẫu khiêm nhường cho hành động của phía mình."),
        grammar("～ていらっしゃいますか", "Dạng tôn kính hỏi trạng thái của đối phương.")
      ],
      focuses: [
        focus(
          "いつも大変お世話になっております。",
          "Cảm ơn quý công ty luôn hỗ trợ",
          "đáp lời chào quan hệ lâu dài",
          "大変 tăng mức trân trọng nhưng không cần lặp trong mọi lượt."
        ),
        focus(
          "会社名とお名前を伺ってもよろしいでしょうか。",
          "Tôi xin phép hỏi tên công ty và quý danh",
          "xác minh người gọi",
          "Hai thông tin giúp tránh chuyển nhầm cuộc gọi nhạy cảm."
        ),
        focus(
          "山田はただいま外出しております。",
          "Anh Yamada hiện đang ra ngoài",
          "thông báo người nội bộ vắng",
          "Không dùng 山田さん hoặc いらっしゃいます khi nói người công ty mình."
        ),
        focus(
          "差し支えなければ、ご用件を承ります。",
          "Nếu tiện, tôi xin ghi nhận nội dung",
          "xin nội dung không gây áp lực",
          "差し支えなければ cho phép người gọi không tiết lộ chi tiết."
        ),
        focus(
          "戻り次第、折り返すよう申し伝えます。",
          "Tôi sẽ nhắn gọi lại ngay khi anh ấy về",
          "cam kết chuyển lời đúng",
          "申し伝えます là khiêm nhường cho việc truyền đạt trong công ty mình."
        )
      ]
    }),
    defineWeek({
      week: 6,
      themeJa: "要点のある業務メール",
      themeVi: "Email công việc có trọng điểm",
      objectiveVi: "Viết email có mục đích, bối cảnh, yêu cầu, deadline và điều kiện phản hồi.",
      scenarioJa: "取引先へ仕様確認を依頼し、製造開始前に回答を求めます。",
      scenarioVi: "Yêu cầu đối tác xác nhận đặc tả trước khi bắt đầu sản xuất.",
      problemVi: "hai mục đặc tả có cách hiểu khác nhau và việc trì hoãn ảnh hưởng lịch sản xuất.",
      desiredOutcomeVi: "đối tác biết chính xác hai điểm cần quyết định và hạn trả lời có lý do.",
      vocabulary: [
        vocab("仕様", "しよう", "đặc tả"),
        vocab("該当箇所", "がいとうかしょ", "phần liên quan"),
        vocab("認識", "にんしき", "cách hiểu"),
        vocab("製造開始", "せいぞうかいし", "bắt đầu sản xuất"),
        vocab("回答期限", "かいとうきげん", "hạn trả lời"),
        vocab("添付資料", "てんぷしりょう", "tài liệu đính kèm")
      ],
      grammar: [
        grammar("～につきまして", "Dạng trang trọng nêu chủ đề."),
        grammar("～いただけますと幸いです", "Đưa yêu cầu mềm trong email.")
      ],
      focuses: [
        focus(
          "仕様書の二点につきまして確認をお願いいたします。",
          "Xin xác nhận hai điểm trong đặc tả",
          "nêu mục đích và phạm vi",
          "Số lượng điểm giúp người nhận ước lượng việc cần làm."
        ),
        focus(
          "当社の認識を赤字で記載しております。",
          "Chúng tôi ghi cách hiểu bằng chữ đỏ",
          "chỉ vị trí thông tin cần so sánh",
          "しております là khiêm nhường cho hành động phía mình."
        ),
        focus(
          "該当箇所をご確認いただけますでしょうか。",
          "Quý công ty có thể xác nhận phần liên quan không",
          "đưa yêu cầu chính",
          "Câu hỏi lịch sự nhưng vẫn rõ hành động cần làm."
        ),
        focus(
          "製造準備の都合上、金曜日までにお願いいたします。",
          "Do chuẩn bị sản xuất, xin phản hồi trước thứ Sáu",
          "giải thích deadline",
          "都合上 nêu lý do nghiệp vụ, tránh tạo cảm giác hạn tùy tiện."
        ),
        focus(
          "認識が異なる場合は修正案をお知らせください。",
          "Nếu cách hiểu khác xin cho biết phương án sửa",
          "định nghĩa phản hồi khi không đồng ý",
          "Cho đối tác biết không chỉ trả lời có/không mà có thể đề xuất sửa."
        )
      ]
    }),
    defineWeek({
      week: 7,
      themeJa: "会議での合意形成",
      themeVi: "Tạo đồng thuận trong họp",
      objectiveVi: "Nêu ý kiến, hỏi căn cứ, phản biện một phần và tóm tắt điểm đã thống nhất.",
      scenarioJa: "新しい問い合わせ対応時間を短縮する案について部門会議で検討します。",
      scenarioVi: "Họp bộ phận xem xét phương án rút ngắn thời gian phản hồi yêu cầu.",
      problemVi: "rút ngắn thời gian có lợi cho khách nhưng tăng tải ngoài giờ.",
      desiredOutcomeVi: "nhóm thống nhất mục tiêu thử nghiệm và điều kiện bảo vệ nhân sự.",
      vocabulary: [
        vocab("合意", "ごうい", "đồng thuận"),
        vocab("根拠", "こんきょ", "căn cứ"),
        vocab("対応時間", "たいおうじかん", "thời gian phản hồi"),
        vocab("負担", "ふたん", "gánh nặng"),
        vocab("条件", "じょうけん", "điều kiện"),
        vocab("試行", "しこう", "thử nghiệm")
      ],
      grammar: [
        grammar("～点は理解できますが", "Công nhận một điểm trước khi phản biện."),
        grammar("～のではないでしょうか", "Nêu nhận định/đề xuất mềm.")
      ],
      focuses: [
        focus(
          "顧客満足の点では賛成です。",
          "Xét về hài lòng khách hàng tôi đồng ý",
          "xác định phạm vi đồng ý",
          "点では giới hạn tiêu chí, không đồng ý toàn bộ."
        ),
        focus(
          "短縮効果の根拠を教えていただけますか。",
          "Xin cho biết căn cứ của hiệu quả rút ngắn",
          "hỏi bằng chứng",
          "Hỏi căn cứ của phương án chứ không phủ nhận người đề xuất."
        ),
        focus(
          "効果は理解できますが、夜間対応が増えます。",
          "Tôi hiểu hiệu quả nhưng phản hồi ban đêm sẽ tăng",
          "nêu rủi ro cân bằng",
          "Công nhận trước giúp phản biện tập trung vào hệ quả."
        ),
        focus(
          "まず一部の顧客で試すのではないでしょうか。",
          "Có lẽ nên thử với một nhóm khách trước",
          "đề xuất phạm vi thử",
          "のではないでしょうか mềm nhưng vẫn đưa phương án rõ."
        ),
        focus(
          "試行期間は一か月で合意しました。",
          "Đã thống nhất thời gian thử là một tháng",
          "tóm tắt quyết định",
          "Ghi rõ phạm vi và thời gian để tránh mỗi người hiểu khác."
        )
      ]
    }),
    defineWeek({
      week: 8,
      themeJa: "依存関係のある計画",
      themeVi: "Kế hoạch có phụ thuộc",
      objectiveVi: "Điều chỉnh lịch dựa trên phụ thuộc, nguồn lực và đường găng đơn giản.",
      scenarioJa: "ウェブ更新は原稿承認と画像制作に依存しており、公開日を再計画します。",
      scenarioVi:
        "Cập nhật web phụ thuộc phê duyệt nội dung và sản xuất ảnh nên cần lập lại ngày công khai.",
      problemVi: "ảnh có thể đúng hạn nhưng nội dung chưa được pháp chế xem xét.",
      desiredOutcomeVi: "đội xác định đường găng, owner và mốc kiểm tra trước ngày công khai.",
      vocabulary: [
        vocab("依存関係", "いぞんかんけい", "quan hệ phụ thuộc"),
        vocab("承認", "しょうにん", "phê duyệt"),
        vocab("公開日", "こうかいび", "ngày công khai"),
        vocab("前倒し", "まえだおし", "đẩy sớm"),
        vocab("後ろ倒し", "うしろだおし", "lùi lại"),
        vocab("担当", "たんとう", "người phụ trách")
      ],
      grammar: [
        grammar("～ない限り", "Nếu điều kiện chưa được đáp ứng thì không thể tiến hành."),
        grammar("～に合わせて", "Điều chỉnh theo một mốc hoặc điều kiện.")
      ],
      focuses: [
        focus(
          "原稿が承認されない限り、公開できません。",
          "Nếu nội dung chưa duyệt thì không thể công khai",
          "nêu phụ thuộc bắt buộc",
          "ない限り chỉ điều kiện gate, không phải trì hoãn tùy ý."
        ),
        focus(
          "画像制作を二日前倒しします。",
          "Đẩy việc làm ảnh sớm hai ngày",
          "điều chỉnh phần có thể kiểm soát",
          "前倒し cần nêu số ngày cụ thể."
        ),
        focus(
          "法務確認に合わせて日程を組み直します。",
          "Sắp lại lịch theo kiểm tra pháp chế",
          "lập lại lịch theo gate",
          "合わせて cho biết mốc quyết định kế hoạch."
        ),
        focus(
          "各作業の担当者を明確にします。",
          "Làm rõ owner từng công việc",
          "xác định trách nhiệm",
          "担当者 rõ hơn chủ ngữ mơ hồ みんな."
        ),
        focus(
          "水曜日に中間確認を設定します。",
          "Đặt kiểm tra giữa kỳ vào thứ Tư",
          "tạo checkpoint sớm",
          "Mốc giữa kỳ phát hiện trễ trước ngày công khai."
        )
      ]
    }),
    defineWeek({
      week: 9,
      themeJa: "原因と影響の切り分け",
      themeVi: "Tách nguyên nhân và ảnh hưởng sự cố",
      objectiveVi:
        "Phân biệt hiện tượng, nguyên nhân giả định, phạm vi ảnh hưởng và hành động cô lập.",
      scenarioJa: "受注システムで一部の注文が二重登録され、担当者が一次調査を報告します。",
      scenarioVi:
        "Một số đơn bị ghi nhận hai lần trong hệ thống đặt hàng và nhân viên báo điều tra ban đầu.",
      problemVi: "chưa biết lỗi do thao tác hay hệ thống, nhưng kho có thể xuất hàng trùng.",
      desiredOutcomeVi:
        "dừng ảnh hưởng tiếp tục, xác định phạm vi và bảo toàn bằng chứng để điều tra.",
      vocabulary: [
        vocab("二重登録", "にじゅうとうろく", "đăng ký trùng"),
        vocab("事象", "じしょう", "hiện tượng"),
        vocab("仮説", "かせつ", "giả thuyết"),
        vocab("影響件数", "えいきょうけんすう", "số trường hợp ảnh hưởng"),
        vocab("切り分け", "きりわけ", "phân tách điều tra"),
        vocab("出荷停止", "しゅっかていし", "dừng xuất hàng")
      ],
      grammar: [
        grammar("～可能性があります", "Nêu giả thuyết chưa được xác nhận."),
        grammar("～に限られています", "Giới hạn phạm vi đã biết.")
      ],
      focuses: [
        focus(
          "同じ注文が二重に登録される事象を確認しました。",
          "Đã xác nhận hiện tượng cùng đơn bị đăng ký trùng",
          "mô tả hiện tượng tái hiện",
          "Dùng 事象, không gọi nguyên nhân khi chưa điều tra."
        ),
        focus(
          "現在の影響は五件に限られています。",
          "Ảnh hưởng hiện tại giới hạn ở năm trường hợp",
          "nêu phạm vi đã biết",
          "現在 để mở khả năng phạm vi thay đổi sau điều tra."
        ),
        focus(
          "通信の再送が原因の可能性があります。",
          "Có khả năng do gửi lại dữ liệu truyền",
          "nêu giả thuyết có điều kiện",
          "可能性 giữ ranh giới giữa giả thuyết và kết luận."
        ),
        focus(
          "対象注文の出荷を一時停止しました。",
          "Đã tạm dừng xuất các đơn liên quan",
          "báo hành động cô lập",
          "Chỉ dừng 対象注文 để giảm tác động vận hành."
        ),
        focus(
          "操作履歴を確認して切り分けます。",
          "Tôi sẽ kiểm tra log thao tác để phân tách nguyên nhân",
          "nêu bước điều tra tiếp",
          "Nêu nguồn bằng chứng thay vì chỉ nói 調べます."
        )
      ]
    }),
    defineWeek({
      week: 10,
      themeJa: "苦情の初動",
      themeVi: "Xử lý ban đầu khiếu nại",
      objectiveVi:
        "Tiếp nhận cảm xúc, xác nhận dữ kiện, tránh biện minh và hẹn phương án phục hồi.",
      scenarioJa: "顧客が請求額の誤りを指摘し、強い口調で即時訂正を求めています。",
      scenarioVi: "Khách chỉ ra sai hóa đơn và yêu cầu sửa ngay với giọng mạnh.",
      problemVi: "nguyên nhân có thể từ dữ liệu khách cung cấp nhưng chưa được xác minh.",
      desiredOutcomeVi: "hạ nhiệt, chốt dữ kiện và đưa thời điểm phản hồi có trách nhiệm.",
      vocabulary: [
        vocab("請求額", "せいきゅうがく", "số tiền hóa đơn"),
        vocab("訂正", "ていせい", "chỉnh chính thức"),
        vocab("経緯", "けいい", "diễn biến"),
        vocab("ご指摘", "ごしてき", "điểm quý khách chỉ ra"),
        vocab("確認事項", "かくにんじこう", "nội dung cần xác nhận"),
        vocab("責任者", "せきにんしゃ", "người chịu trách nhiệm")
      ],
      grammar: [
        grammar("～とのこと", "Dẫn lại thông tin từ đối phương trung tính."),
        grammar("～次第ご連絡します", "Hứa liên lạc ngay khi có kết quả.")
      ],
      focuses: [
        focus(
          "このたびはご迷惑をおかけし、申し訳ございません。",
          "Thành thật xin lỗi vì đã gây phiền",
          "thừa nhận tác động trước",
          "Xin lỗi bất tiện không đồng nghĩa nhận nguyên nhân pháp lý chưa xác minh."
        ),
        focus(
          "ご指摘の内容を確認させてください。",
          "Cho phép tôi xác nhận nội dung quý khách nêu",
          "chuyển từ cảm xúc sang dữ kiện",
          "させてください xin quyền đặt câu hỏi cần thiết."
        ),
        focus(
          "請求書では数量が十個とのことですね。",
          "Theo hóa đơn số lượng là mười đúng không",
          "nhắc lại dữ kiện",
          "とのことですね xác nhận lời khách mà chưa kết luận hệ thống sai."
        ),
        focus(
          "経緯を確認し、責任者へ報告します。",
          "Tôi sẽ kiểm tra diễn biến và báo người chịu trách nhiệm",
          "nêu quy trình xử lý",
          "Khách cần biết vấn đề được nâng đúng thẩm quyền."
        ),
        focus(
          "本日中に確認結果をご連絡します。",
          "Trong hôm nay tôi sẽ báo kết quả xác nhận",
          "cam kết mốc phản hồi",
          "Cam kết kết quả xác nhận, không hứa hoàn tiền khi chưa được duyệt."
        )
      ]
    }),
    defineWeek({
      week: 11,
      themeJa: "比較を伴う提案",
      themeVi: "Đề xuất có so sánh",
      objectiveVi: "So sánh chi phí, thời gian, rủi ro và đưa khuyến nghị có điều kiện.",
      scenarioJa: "配送会社を二社から選ぶため、担当者が料金と遅延実績を比較します。",
      scenarioVi: "Nhân viên so sánh giá và lịch sử chậm của hai hãng vận chuyển để lựa chọn.",
      problemVi: "hãng rẻ hơn có tỷ lệ chậm cao, hãng ổn định yêu cầu hợp đồng dài.",
      desiredOutcomeVi: "quản lý hiểu trade-off và duyệt thử nghiệm có tiêu chí đánh giá.",
      vocabulary: [
        vocab("配送会社", "はいそうがいしゃ", "hãng vận chuyển"),
        vocab("実績", "じっせき", "kết quả thực tế"),
        vocab("遅延率", "ちえんりつ", "tỷ lệ chậm"),
        vocab("契約期間", "けいやくきかん", "thời hạn hợp đồng"),
        vocab("比較", "ひかく", "so sánh"),
        vocab("推奨", "すいしょう", "khuyến nghị")
      ],
      grammar: [
        grammar("～一方で", "Nêu mặt đối lập của cùng phương án."),
        grammar("～を踏まえると", "Đưa kết luận dựa trên dữ kiện.")
      ],
      focuses: [
        focus(
          "A社は安い一方で、遅延率が高いです。",
          "Hãng A rẻ nhưng tỷ lệ chậm cao",
          "nêu trade-off cùng phương án",
          "一方で cân bằng hai mặt, tránh chỉ chọn số giá."
        ),
        focus(
          "B社は実績が安定しています。",
          "Kết quả của hãng B ổn định",
          "nêu bằng chứng chất lượng",
          "実績 cần gắn dữ liệu quá khứ chứ không chỉ cảm nhận."
        ),
        focus(
          "契約期間はB社のほうが長いです。",
          "Thời hạn hợp đồng hãng B dài hơn",
          "nêu chi phí cam kết",
          "Không bỏ qua điều kiện khó hoàn tác khi so sánh."
        ),
        focus(
          "遅延実績を踏まえると、B社を推奨します。",
          "Xét lịch sử chậm, tôi khuyến nghị hãng B",
          "đưa khuyến nghị có căn cứ",
          "踏まえると liên kết dữ kiện và kết luận."
        ),
        focus(
          "まず三か月の試行契約を交渉します。",
          "Trước hết sẽ thương lượng hợp đồng thử ba tháng",
          "giảm rủi ro quyết định",
          "Đề xuất điều kiện trung gian thay vì chấp nhận lựa chọn nhị phân."
        )
      ]
    }),
    defineWeek({
      week: 12,
      themeJa: "J3統合ケース",
      themeVi: "Case tích hợp J3",
      objectiveVi: "Đọc email, họp, báo rủi ro và đề xuất quyết định trong một chuỗi công việc.",
      scenarioJa: "新商品の発売準備で仕様遅延、価格差異、顧客問い合わせが同時に発生します。",
      scenarioVi:
        "Chuẩn bị ra mắt sản phẩm gặp đồng thời trễ đặc tả, lệch giá và câu hỏi khách hàng.",
      problemVi: "các vấn đề liên kết và một câu trả lời vội có thể tạo thông tin không nhất quán.",
      desiredOutcomeVi:
        "nhóm ưu tiên rủi ro, khóa thông tin chưa xác nhận và phân owner cho từng hành động.",
      vocabulary: [
        vocab("発売準備", "はつばいじゅんび", "chuẩn bị ra mắt"),
        vocab("整合性", "せいごうせい", "tính nhất quán"),
        vocab("優先課題", "ゆうせんかだい", "vấn đề ưu tiên"),
        vocab("暫定対応", "ざんていたいおう", "xử lý tạm"),
        vocab("責任分担", "せきにんぶんたん", "phân trách nhiệm"),
        vocab("判断材料", "はんだんざいりょう", "căn cứ quyết định")
      ],
      grammar: [
        grammar("～に伴い", "Nêu hệ quả đi kèm một thay đổi/sự kiện."),
        grammar("～を踏まえて", "Thực hiện hành động dựa trên dữ kiện.")
      ],
      focuses: [
        focus(
          "仕様遅延に伴い、発売日への影響を確認します。",
          "Do trễ đặc tả, sẽ xác nhận ảnh hưởng ngày ra mắt",
          "liên kết vấn đề với mốc kinh doanh",
          "に伴い chỉ hệ quả trực tiếp cần đánh giá."
        ),
        focus(
          "未確定の価格は顧客へ案内しません。",
          "Không thông báo giá chưa chốt cho khách",
          "đặt ranh giới thông tin",
          "Ngăn thông tin không nhất quán trước khi tìm câu trả lời nhanh."
        ),
        focus(
          "問い合わせには確認中と回答します。",
          "Sẽ trả lời khách là đang xác nhận",
          "đưa phản hồi tạm trung thực",
          "Không im lặng nhưng cũng không suy đoán."
        ),
        focus(
          "課題ごとに担当者と期限を決めます。",
          "Quyết định owner và hạn cho từng vấn đề",
          "phân trách nhiệm hành động",
          "課題ごとに tránh một owner mơ hồ cho cả chuỗi."
        ),
        focus(
          "確認結果を踏まえて発売可否を判断します。",
          "Dựa kết quả xác nhận sẽ quyết định có ra mắt hay không",
          "đặt điều kiện quyết định cuối",
          "Tách thu thập căn cứ khỏi quyết định go/no-go."
        )
      ]
    })
  ]
};
