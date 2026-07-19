import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";
import { defineWeek } from "../../shared/week-factory.js";

export const J2_BLUEPRINT: LevelBlueprint = {
  level: "J2",
  difficulty: "upper-intermediate",
  register: "kính ngữ chính xác, nói giảm nhẹ, quản lý giả định và ảnh hưởng liên phòng ban",
  speakerRoleJa: "プロジェクトリーダー",
  counterpartRoleJa: "部門長",
  acknowledgementJa: "承知しました。影響範囲を確認したうえで対応方針をご連絡します。",
  closingJa: "ご検討のうえ、ご判断いただけますと幸いです。",
  weeks: [
    defineWeek({
      week: 1,
      themeJa: "部門間の立場調整",
      themeVi: "Điều chỉnh vị thế giữa các phòng ban",
      objectiveVi:
        "Tự định vị quyền hạn, trách nhiệm và điểm cần phối hợp trong quan hệ ngang cấp.",
      scenarioJa: "新任リーダーが開発・営業・品質保証の責任者へプロジェクト体制を説明します。",
      scenarioVi: "Trưởng dự án mới giải thích cơ cấu với phụ trách phát triển, kinh doanh và QA.",
      problemVi: "quyền quyết định bị phân tán và mỗi phòng đang kỳ vọng người khác điều phối.",
      desiredOutcomeVi: "các bên hiểu owner quyết định, đầu mối liên lạc và cơ chế xử lý bất đồng.",
      vocabulary: [
        vocab("推進体制", "すいしんたいせい", "cơ cấu triển khai"),
        vocab("権限", "けんげん", "quyền hạn"),
        vocab("責任範囲", "せきにんはんい", "phạm vi trách nhiệm"),
        vocab("部門横断", "ぶもんおうだん", "liên phòng ban"),
        vocab("意思決定", "いしけってい", "ra quyết định"),
        vocab("調整役", "ちょうせいやく", "vai trò điều phối")
      ],
      grammar: [
        grammar("～を担う", "Đảm nhiệm một trách nhiệm cụ thể."),
        grammar("～において", "Nêu phạm vi/bối cảnh trang trọng.")
      ],
      focuses: [
        focus(
          "全体調整は私が担います。",
          "Tôi đảm nhiệm điều phối tổng thể",
          "xác lập owner điều phối",
          "担う nêu trách nhiệm có trọng lượng, khác đơn thuần 手伝う."
        ),
        focus(
          "技術判断は開発部に委ねます。",
          "Quyết định kỹ thuật giao cho phòng phát triển",
          "xác lập quyền chuyên môn",
          "委ねる chỉ ủy quyền có chủ đích, không phải né trách nhiệm."
        ),
        focus(
          "顧客影響については営業と協議します。",
          "Về ảnh hưởng khách hàng sẽ bàn với kinh doanh",
          "định nghĩa điểm phối hợp",
          "については giới hạn chủ đề cần đồng quyết định."
        ),
        focus(
          "意見が分かれた場合は私が論点を整理します。",
          "Khi ý kiến khác nhau tôi sẽ sắp xếp luận điểm",
          "nêu cơ chế xử lý bất đồng",
          "Không hứa tự quyết; trước hết làm rõ luận điểm."
        ),
        focus(
          "決定事項は当日中に共有します。",
          "Nội dung quyết định sẽ được chia sẻ trong ngày",
          "cam kết nhịp thông tin",
          "Mốc chia sẻ ngăn phòng ban làm theo phiên bản cũ."
        )
      ]
    }),
    defineWeek({
      week: 2,
      themeJa: "前提を含む指示",
      themeVi: "Chỉ thị có giả định",
      objectiveVi: "Làm rõ điều kiện ngầm, ngoại lệ, tiêu chí ưu tiên và thẩm quyền thay đổi.",
      scenarioJa: "部門長が『品質を落とさず納期を一週間短縮してほしい』と指示します。",
      scenarioVi: "Trưởng bộ phận yêu cầu rút một tuần mà không giảm chất lượng.",
      problemVi: "ba biến số phạm vi, nguồn lực và thời gian không thể giữ nguyên đồng thời.",
      desiredOutcomeVi:
        "lãnh đạo chọn giả định có thể thay đổi và định nghĩa tiêu chí không được vi phạm.",
      vocabulary: [
        vocab("前提条件", "ぜんていじょうけん", "điều kiện tiền đề"),
        vocab("制約", "せいやく", "ràng buộc"),
        vocab("優先度", "ゆうせんど", "độ ưu tiên"),
        vocab("品質基準", "ひんしつきじゅん", "tiêu chuẩn chất lượng"),
        vocab("追加要員", "ついかよういん", "nhân lực bổ sung"),
        vocab("対象範囲", "たいしょうはんい", "phạm vi đối tượng")
      ],
      grammar: [
        grammar("～を前提とすると", "Đưa suy luận dựa trên một giả định."),
        grammar("～ざるを得ません", "Nêu lựa chọn bắt buộc do điều kiện.")
      ],
      focuses: [
        focus(
          "品質基準を維持する前提でよろしいでしょうか。",
          "Giữ nguyên tiêu chuẩn chất lượng là tiền đề đúng không ạ",
          "khóa điều kiện không đổi",
          "Xác nhận không dùng 品質 như khái niệm mơ hồ."
        ),
        focus(
          "現行要員では範囲を絞らざるを得ません。",
          "Với nhân lực hiện tại buộc phải thu hẹp phạm vi",
          "nêu hệ quả của ràng buộc",
          "ざるを得ない cho thấy hệ quả logic, không phải từ chối cảm tính."
        ),
        focus(
          "追加要員の投入は可能でしょうか。",
          "Có thể bổ sung nhân lực không ạ",
          "hỏi biến số nguồn lực",
          "Đưa phương án cụ thể để lãnh đạo đánh đổi."
        ),
        focus(
          "必須機能を優先する認識で合っていますか。",
          "Tôi hiểu là ưu tiên chức năng bắt buộc đúng không",
          "xác nhận tiêu chí ưu tiên",
          "認識で合っていますか làm rõ logic chọn phạm vi."
        ),
        focus(
          "変更権限の範囲をご指示ください。",
          "Xin chỉ rõ phạm vi quyền thay đổi",
          "xác nhận thẩm quyền",
          "Rút lịch thường cần quyết định nhanh; quyền hạn phải rõ trước."
        )
      ]
    }),
    defineWeek({
      week: 3,
      themeJa: "KPIと予測の報告",
      themeVi: "Báo cáo KPI và dự báo",
      objectiveVi: "Phân biệt actual, target, forecast và độ bất định khi trình bày số liệu.",
      scenarioJa: "四半期売上が目標未達の見込みとなり、部門長会議で要因と対策を報告します。",
      scenarioVi:
        "Doanh số quý dự kiến không đạt nên báo nguyên nhân và biện pháp trong họp lãnh đạo.",
      problemVi: "doanh số hiện tại tăng nhưng pipeline cuối quý có xác suất thấp hơn kế hoạch.",
      desiredOutcomeVi:
        "lãnh đạo hiểu khoảng cách mục tiêu, giả định forecast và hành động bù đắp.",
      vocabulary: [
        vocab("実績", "じっせき", "thực tế"),
        vocab("目標値", "もくひょうち", "mục tiêu"),
        vocab("着地見込み", "ちゃくちみこみ", "forecast cuối kỳ"),
        vocab("達成率", "たっせいりつ", "tỷ lệ đạt"),
        vocab("案件確度", "あんけんかくど", "độ chắc cơ hội"),
        vocab("下振れ", "したぶれ", "thấp hơn dự báo")
      ],
      grammar: [
        grammar("～にとどまる見込みです", "Dự báo chỉ dừng ở mức nào đó."),
        grammar("～を加味すると", "Tính thêm một yếu tố vào đánh giá.")
      ],
      focuses: [
        focus(
          "現時点の達成率は八十二％です。",
          "Tỷ lệ đạt hiện tại là 82%",
          "nêu actual theo thời điểm",
          "現時点 giữ ranh giới giữa actual và forecast."
        ),
        focus(
          "着地は九十二％にとどまる見込みです。",
          "Forecast cuối kỳ dự kiến dừng ở 92%",
          "nêu forecast và khoảng thiếu",
          "にとどまる biểu đạt không đạt mức kỳ vọng."
        ),
        focus(
          "大型案件の確度低下が主因です。",
          "Nguyên nhân chính là xác suất deal lớn giảm",
          "nêu driver chính",
          "主因 không phủ nhận các yếu tố phụ; cần có dữ liệu pipeline."
        ),
        focus(
          "季節要因を加味すると下振れ幅は三％です。",
          "Tính mùa vụ, độ hụt là 3%",
          "nêu điều chỉnh giả định",
          "加味する cho biết forecast không chỉ kéo dài đường hiện tại."
        ),
        focus(
          "既存顧客への追加提案で不足分を補います。",
          "Bù phần thiếu bằng upsell khách hiện tại",
          "nêu hành động bù đắp",
          "Hành động gắn đúng driver và lượng thiếu, không nói chung chung 努力します."
        )
      ]
    }),
    defineWeek({
      week: 4,
      themeJa: "エスカレーション設計",
      themeVi: "Thiết kế escalation",
      objectiveVi: "Escalate đúng ngưỡng, đúng thẩm quyền và kèm phương án chứ không chỉ báo động.",
      scenarioJa: "個人情報を含むファイルが誤送信された疑いがあり、初動会議を招集します。",
      scenarioVi: "Nghi ngờ gửi nhầm file chứa dữ liệu cá nhân nên triệu tập họp ban đầu.",
      problemVi: "chưa xác nhận người nhận đã mở file nhưng thời gian phản ứng rất quan trọng.",
      desiredOutcomeVi:
        "cô lập sự cố, bảo toàn log, báo bảo mật/pháp chế và phân quyết định liên hệ khách.",
      vocabulary: [
        vocab("誤送信", "ごそうしん", "gửi nhầm"),
        vocab("個人情報", "こじんじょうほう", "dữ liệu cá nhân"),
        vocab("封じ込め", "ふうじこめ", "cô lập"),
        vocab("エスカレーション", "エスカレーション", "nâng cấp báo cáo"),
        vocab("証跡", "しょうせき", "dấu vết"),
        vocab("初動", "しょどう", "xử lý ban đầu")
      ],
      grammar: [
        grammar("～疑いがあります", "Nêu nghi ngờ chưa kết luận."),
        grammar("～にかかわらず", "Hành động bất kể một điều kiện.")
      ],
      focuses: [
        focus(
          "個人情報を誤送信した疑いがあります。",
          "Có nghi ngờ đã gửi nhầm dữ liệu cá nhân",
          "escalate khi chưa kết luận",
          "疑い rõ mức chắc chắn nhưng không làm giảm khẩn cấp."
        ),
        focus(
          "開封の有無にかかわらず初動を開始します。",
          "Bất kể đã mở hay chưa sẽ bắt đầu xử lý",
          "đặt ngưỡng hành động an toàn",
          "にかかわらず ngăn chờ đủ bằng chứng mới phản ứng."
        ),
        focus(
          "送信先へ削除依頼を行いました。",
          "Đã yêu cầu người nhận xóa",
          "báo hành động cô lập",
          "Nêu hành động đã làm, không khẳng định dữ liệu đã được xóa."
        ),
        focus(
          "証跡を保全し、情報管理部へ報告します。",
          "Bảo toàn dấu vết và báo bộ phận quản lý thông tin",
          "bảo vệ điều tra và nâng đúng tuyến",
          "Không chỉnh sửa log trong quá trình khắc phục."
        ),
        focus(
          "顧客連絡の要否は法務と判断します。",
          "Sẽ cùng pháp chế quyết định có liên hệ khách không",
          "đưa quyết định về đúng thẩm quyền",
          "要否 tránh tự hứa hoặc tự giấu thông tin đối ngoại."
        )
      ]
    }),
    defineWeek({
      week: 5,
      themeJa: "電話での条件交渉",
      themeVi: "Thương lượng điều kiện qua điện thoại",
      objectiveVi:
        "Nghe đề nghị, giữ quyền quyết định, tóm tắt điều kiện và hẹn phản hồi bằng văn bản.",
      scenarioJa: "仕入先が原材料高騰を理由に即時の単価改定を電話で求めています。",
      scenarioVi: "Nhà cung cấp yêu cầu tăng đơn giá ngay vì giá nguyên liệu.",
      problemVi: "đề nghị ảnh hưởng ngân sách và hợp đồng quy định báo trước một tháng.",
      desiredOutcomeVi:
        "không cam kết tại chỗ, lấy đủ căn cứ và chuyển nội dung sang quy trình phê duyệt.",
      vocabulary: [
        vocab("単価改定", "たんかかいてい", "điều chỉnh đơn giá"),
        vocab("原材料高騰", "げんざいりょうこうとう", "nguyên liệu tăng giá"),
        vocab("適用時期", "てきようじき", "thời điểm áp dụng"),
        vocab("根拠資料", "こんきょしりょう", "tài liệu căn cứ"),
        vocab("社内承認", "しゃないしょうにん", "duyệt nội bộ"),
        vocab("即答", "そくとう", "trả lời ngay")
      ],
      grammar: [
        grammar("～かねます", "Từ chối vì giới hạn vai trò/quy định một cách trang trọng."),
        grammar("～を踏まえて回答します", "Hứa trả lời sau khi xem xét căn cứ.")
      ],
      focuses: [
        focus(
          "ご事情は承知いたしました。",
          "Chúng tôi đã hiểu hoàn cảnh",
          "ghi nhận trước khi thương lượng",
          "承知 không đồng nghĩa đồng ý mức tăng."
        ),
        focus(
          "現時点では即答いたしかねます。",
          "Hiện tại chúng tôi chưa thể trả lời ngay",
          "giữ quyền phê duyệt",
          "かねます nêu giới hạn vai trò, không đóng cửa trao đổi."
        ),
        focus(
          "改定幅と適用時期を確認させてください。",
          "Cho phép xác nhận mức tăng và thời điểm áp dụng",
          "tách điều kiện cần thương lượng",
          "Hai biến số có thể đánh đổi thay vì tranh luận có/không."
        ),
        focus(
          "根拠資料をお送りいただけますでしょうか。",
          "Xin gửi tài liệu căn cứ",
          "yêu cầu bằng chứng",
          "Điện thoại nên được nối bằng tài liệu để tránh lệch ghi nhớ."
        ),
        focus(
          "社内で検討のうえ、明日中に回答します。",
          "Sau khi xem xét nội bộ sẽ trả lời trong ngày mai",
          "chốt bước và mốc phản hồi",
          "Không để câu 検討します trở thành trì hoãn vô thời hạn."
        )
      ]
    }),
    defineWeek({
      week: 6,
      themeJa: "お詫びと是正メール",
      themeVi: "Email xin lỗi và khắc phục",
      objectiveVi: "Viết email xin lỗi tách sự thật, ảnh hưởng, xử lý và phòng tái diễn.",
      scenarioJa: "納品データの項目欠落が判明し、顧客へ差し替え版を送付します。",
      scenarioVi: "Phát hiện file giao thiếu trường dữ liệu và gửi bản thay cho khách.",
      problemVi: "khách đã bắt đầu kiểm tra và phải làm lại một phần công việc.",
      desiredOutcomeVi: "khách biết bản nào đúng, ảnh hưởng gì và biện pháp ngăn tái diễn.",
      vocabulary: [
        vocab("項目欠落", "こうもくけつらく", "thiếu trường"),
        vocab("差し替え版", "さしかえばん", "bản thay thế"),
        vocab("是正措置", "ぜせいそち", "biện pháp khắc phục"),
        vocab("再発防止", "さいはつぼうし", "ngăn tái diễn"),
        vocab("ご査収", "ごさしゅう", "xin kiểm tra nhận"),
        vocab("原因調査", "げんいんちょうさ", "điều tra nguyên nhân")
      ],
      grammar: [
        grammar("～ことが判明しました", "Thông báo sự việc đã được xác định."),
        grammar("～所存です", "Nêu quyết tâm hành động trang trọng; dùng có tiết chế.")
      ],
      focuses: [
        focus(
          "納品データに項目欠落があることが判明しました。",
          "Đã xác định file giao thiếu trường dữ liệu",
          "nêu sự thật đã xác minh",
          "判明しました cho biết thông tin không còn là nghi ngờ."
        ),
        focus(
          "ご確認作業に影響を及ぼし、深くお詫び申し上げます。",
          "Thành thật xin lỗi vì ảnh hưởng việc kiểm tra",
          "xin lỗi đúng tác động",
          "Nêu phần công việc khách phải làm lại, không xin lỗi chung chung."
        ),
        focus(
          "修正版を添付いたしましたので、ご査収ください。",
          "Đã đính kèm bản sửa, xin kiểm tra nhận",
          "chỉ rõ bản thay thế",
          "Tên file và version vẫn cần nêu trong email thực tế."
        ),
        focus(
          "旧版は破棄していただけますようお願いいたします。",
          "Xin vui lòng hủy bản cũ",
          "ngăn dùng nhầm phiên bản",
          "Yêu cầu rõ hành động với dữ liệu sai."
        ),
        focus(
          "確認工程を追加し、再発防止に努めます。",
          "Sẽ thêm bước kiểm tra để ngăn tái diễn",
          "nêu biện pháp phòng ngừa",
          "Biện pháp cụ thể đáng tin hơn chỉ nói 注意します."
        )
      ]
    }),
    defineWeek({
      week: 7,
      themeJa: "反対意見の扱い",
      themeVi: "Xử lý ý kiến phản đối",
      objectiveVi: "Tách người khỏi vấn đề, khám phá lợi ích và tạo phương án kết hợp.",
      scenarioJa: "新システム導入会議で、現場責任者が移行時期に強く反対しています。",
      scenarioVi:
        "Trong họp triển khai hệ thống mới, quản lý hiện trường phản đối mạnh thời điểm chuyển đổi.",
      problemVi: "đội dự án muốn đúng kế hoạch còn hiện trường lo mùa cao điểm.",
      desiredOutcomeVi:
        "hai bên thống nhất vấn đề thật là năng lực vận hành và xây điều kiện triển khai theo giai đoạn.",
      vocabulary: [
        vocab("反対意見", "はんたいいけん", "ý kiến phản đối"),
        vocab("懸念", "けねん", "lo ngại"),
        vocab("繁忙期", "はんぼうき", "mùa cao điểm"),
        vocab("段階導入", "だんかいどうにゅう", "triển khai theo giai đoạn"),
        vocab("移行負荷", "いこうふか", "tải chuyển đổi"),
        vocab("譲歩", "じょうほ", "nhượng bộ")
      ],
      grammar: [
        grammar("～という点はもっともです", "Công nhận tính hợp lý của một điểm."),
        grammar("～という選択肢もあります", "Mở thêm phương án thay thế.")
      ],
      focuses: [
        focus(
          "繁忙期を避けたいという点はもっともです。",
          "Điểm muốn tránh mùa cao điểm là hợp lý",
          "công nhận lợi ích phía phản đối",
          "Công nhận điểm cụ thể, không cần đồng ý toàn bộ kết luận."
        ),
        focus(
          "最も懸念されているのは移行負荷でしょうか。",
          "Lo ngại lớn nhất là tải chuyển đổi phải không",
          "xác định lợi ích cốt lõi",
          "Câu hỏi kiểm tra giả thuyết thay vì gắn động cơ cho đối phương."
        ),
        focus(
          "全面導入以外の選択肢も検討しましょう。",
          "Hãy xem cả phương án ngoài triển khai toàn bộ",
          "mở rộng không gian giải pháp",
          "Tránh mắc kẹt giữa đúng lịch và hoãn hoàn toàn."
        ),
        focus(
          "一拠点で先行運用する案はいかがでしょうか。",
          "Phương án chạy trước ở một cơ sở thế nào",
          "đưa phương án kết hợp",
          "先行運用 tạo dữ liệu và giảm tải cùng lúc."
        ),
        focus(
          "結果を見て次の展開時期を判断します。",
          "Dựa kết quả sẽ quyết định đợt tiếp theo",
          "đặt quyết định theo bằng chứng",
          "Thỏa thuận trước tiêu chí đánh giá để tránh kéo dài vô hạn."
        )
      ]
    }),
    defineWeek({
      week: 8,
      themeJa: "リソースとクリティカルパス",
      themeVi: "Nguồn lực và đường găng",
      objectiveVi: "Ưu tiên công việc theo phụ thuộc và năng lực thay vì chỉ theo deadline gần.",
      scenarioJa: "複数案件が同じ設計担当者に集中し、三つの納期が競合しています。",
      scenarioVi: "Nhiều dự án cùng phụ thuộc một người thiết kế khiến ba deadline xung đột.",
      problemVi: "làm song song tất cả sẽ tăng chuyển ngữ cảnh và trễ cả ba.",
      desiredOutcomeVi:
        "lãnh đạo chọn công việc đường găng, điều chỉnh phạm vi và bổ sung nguồn lực phù hợp.",
      vocabulary: [
        vocab("要員計画", "よういんけいかく", "kế hoạch nhân lực"),
        vocab("稼働率", "かどうりつ", "tỷ lệ sử dụng"),
        vocab("クリティカルパス", "クリティカルパス", "đường găng"),
        vocab("競合", "きょうごう", "xung đột"),
        vocab("ボトルネック", "ボトルネック", "nút thắt"),
        vocab("再配分", "さいはいぶん", "phân bổ lại")
      ],
      grammar: [
        grammar("～に集中しています", "Nêu nguồn lực/tải tập trung."),
        grammar("～を優先せざるを得ません", "Nêu ưu tiên bắt buộc do ràng buộc.")
      ],
      focuses: [
        focus(
          "設計作業が一名に集中しています。",
          "Việc thiết kế tập trung vào một người",
          "xác định nút thắt nguồn lực",
          "Nêu cấu trúc tải, không đổ lỗi cá nhân làm chậm."
        ),
        focus(
          "三案件の納期が競合しています。",
          "Deadline ba dự án đang xung đột",
          "nêu vấn đề danh mục",
          "競合 cho thấy không thể tối ưu từng dự án độc lập."
        ),
        focus(
          "後工程への影響が大きい案件を優先します。",
          "Ưu tiên dự án ảnh hưởng lớn đến công đoạn sau",
          "chọn theo đường găng",
          "Tiêu chí hệ thống tốt hơn ai yêu cầu lớn tiếng hơn."
        ),
        focus(
          "定型部分は別の担当へ再配分します。",
          "Phân phần tiêu chuẩn cho người khác",
          "giảm tải bằng phân tách công việc",
          "Không phải mọi phần đều cần chuyên gia nút thắt."
        ),
        focus(
          "残る二案件は範囲か納期の調整が必要です。",
          "Hai dự án còn lại cần chỉnh phạm vi hoặc hạn",
          "làm rõ trade-off còn lại",
          "Đưa biến số cần quyết định thay vì hứa cố gắng tất cả."
        )
      ]
    }),
    defineWeek({
      week: 9,
      themeJa: "根本原因と再発防止",
      themeVi: "Nguyên nhân gốc và ngăn tái diễn",
      objectiveVi: "Đi từ sự cố qua chuỗi nguyên nhân đến control phòng ngừa có owner và chỉ số.",
      scenarioJa: "検査工程を通過した不良品が顧客へ出荷され、原因分析会議を行います。",
      scenarioVi: "Hàng lỗi vượt qua kiểm tra và đã giao khách, nhóm họp phân tích nguyên nhân.",
      problemVi:
        "lỗi thao tác là nguyên nhân gần nhưng hướng dẫn và thiết kế kiểm soát cũng có lỗ hổng.",
      desiredOutcomeVi:
        "không quy lỗi cá nhân; thiết kế biện pháp phát hiện, phòng ngừa và đo hiệu quả.",
      vocabulary: [
        vocab("根本原因", "こんぽんげんいん", "nguyên nhân gốc"),
        vocab("流出原因", "りゅうしゅつげんいん", "nguyên nhân lọt lỗi"),
        vocab("検査工程", "けんさこうてい", "công đoạn kiểm tra"),
        vocab("標準手順", "ひょうじゅんてじゅん", "quy trình chuẩn"),
        vocab("是正", "ぜせい", "khắc phục"),
        vocab("有効性", "ゆうこうせい", "tính hiệu quả")
      ],
      grammar: [
        grammar("～だけでなく", "Mở rộng nguyên nhân/đối tượng ngoài một điểm."),
        grammar("～ないように", "Thiết kế hành động để tránh kết quả xấu.")
      ],
      focuses: [
        focus(
          "作業ミスだけでなく、検査設計にも問題があります。",
          "Không chỉ lỗi thao tác mà thiết kế kiểm tra cũng có vấn đề",
          "mở rộng phân tích hệ thống",
          "だけでなく ngăn kết luận quá sớm vào cá nhân."
        ),
        focus(
          "手順書の判定基準が曖昧でした。",
          "Tiêu chí trong hướng dẫn bị mơ hồ",
          "nêu nguyên nhân quy trình",
          "Nêu điểm cụ thể có thể sửa, không nói 教育不足 chung chung."
        ),
        focus(
          "異常値を自動検知する仕組みを追加します。",
          "Thêm cơ chế phát hiện tự động giá trị bất thường",
          "đưa control phòng ngừa",
          "Tự động hóa phù hợp với lỗi có mẫu dữ liệu rõ."
        ),
        focus(
          "改訂手順で全員を再教育します。",
          "Đào tạo lại toàn bộ bằng quy trình đã sửa",
          "đồng bộ hành vi mới",
          "Đào tạo sau khi sửa tiêu chuẩn, không đào tạo lại nội dung mơ hồ."
        ),
        focus(
          "一か月後に不良率で有効性を確認します。",
          "Sau một tháng kiểm tra hiệu quả bằng tỷ lệ lỗi",
          "đặt chỉ số hậu kiểm",
          "Biện pháp chưa hoàn tất nếu không đo có giảm lỗi hay không."
        )
      ]
    }),
    defineWeek({
      week: 10,
      themeJa: "苦情からの関係回復",
      themeVi: "Khôi phục quan hệ sau khiếu nại",
      objectiveVi: "Thiết kế phục hồi cân bằng nhu cầu khách, thẩm quyền và ngăn tái diễn.",
      scenarioJa: "主要顧客で同じ納品遅延が二度発生し、取引継続を再検討すると通告されます。",
      scenarioVi: "Khách chủ chốt gặp trễ giao lần hai và nói sẽ xem xét lại hợp tác.",
      problemVi: "lời xin lỗi đơn thuần không còn đủ và bồi thường cần phê duyệt.",
      desiredOutcomeVi:
        "xác nhận thiệt hại, đưa hành động tức thời, lịch báo nguyên nhân và đề xuất phục hồi được duyệt.",
      vocabulary: [
        vocab("関係回復", "かんけいかいふく", "khôi phục quan hệ"),
        vocab("取引継続", "とりひきけいぞく", "tiếp tục giao dịch"),
        vocab("補償", "ほしょう", "bồi thường"),
        vocab("代替品", "だいたいひん", "hàng thay thế"),
        vocab("再発", "さいはつ", "tái diễn"),
        vocab("責任者説明", "せきにんしゃせつめい", "giải thích từ người chịu trách nhiệm")
      ],
      grammar: [
        grammar("～を重く受け止めております", "Thể hiện nghiêm túc tiếp nhận sự việc."),
        grammar("～させていただきたい", "Đề xuất hành động của phía mình với sự cho phép.")
      ],
      focuses: [
        focus(
          "度重なる遅延を重く受け止めております。",
          "Chúng tôi nghiêm túc tiếp nhận việc chậm lặp lại",
          "thừa nhận tính tái diễn",
          "度重なる cho thấy hiểu đây không phải sự cố đơn lẻ."
        ),
        focus(
          "まず代替品を本日中に手配いたします。",
          "Trước hết sẽ sắp hàng thay trong hôm nay",
          "đưa phục hồi tức thời",
          "まず tách hành động khẩn khỏi điều tra dài hơn."
        ),
        focus(
          "損失内容を確認のうえ、補償案をご提示します。",
          "Sau khi xác nhận thiệt hại sẽ trình phương án bồi thường",
          "giữ bồi thường theo bằng chứng và quyền hạn",
          "Không hứa mức bồi thường trước phê duyệt."
        ),
        focus(
          "原因と再発防止策は責任者から説明いたします。",
          "Người chịu trách nhiệm sẽ giải thích nguyên nhân và phòng tái diễn",
          "nâng mức trách nhiệm",
          "Phù hợp khi niềm tin đã giảm và khách cần accountability."
        ),
        focus(
          "改善状況を週次でご報告させていただきたいと存じます。",
          "Chúng tôi muốn báo cải thiện hàng tuần",
          "đề xuất cơ chế tái xây niềm tin",
          "Báo cáo định kỳ chỉ có giá trị khi có chỉ số cụ thể."
        )
      ]
    }),
    defineWeek({
      week: 11,
      themeJa: "見積・契約条件の交渉",
      themeVi: "Thương lượng báo giá và điều kiện hợp đồng",
      objectiveVi: "Tách giá, phạm vi, SLA, thanh toán và rủi ro để tạo nhượng bộ có điều kiện.",
      scenarioJa: "顧客が見積額の一五％削減を求め、同時に短納期と追加保証を希望しています。",
      scenarioVi: "Khách yêu cầu giảm giá 15% đồng thời muốn giao nhanh và bảo hành thêm.",
      problemVi: "chấp nhận mọi điều kiện làm dự án âm lợi nhuận và tăng rủi ro chất lượng.",
      desiredOutcomeVi:
        "hiểu ưu tiên thật, đưa gói lựa chọn và đổi nhượng bộ lấy cam kết tương xứng.",
      vocabulary: [
        vocab("見積条件", "みつもりじょうけん", "điều kiện báo giá"),
        vocab("値引き", "ねびき", "giảm giá"),
        vocab("保証範囲", "ほしょうはんい", "phạm vi bảo hành"),
        vocab("支払条件", "しはらいじょうけん", "điều kiện thanh toán"),
        vocab("譲歩", "じょうほ", "nhượng bộ"),
        vocab("代替案", "だいたいあん", "phương án thay thế")
      ],
      grammar: [
        grammar("～であれば", "Đặt nhượng bộ theo điều kiện."),
        grammar("～に代えて", "Thay một điều kiện bằng phương án khác.")
      ],
      focuses: [
        focus(
          "最も優先されるのは価格でしょうか、納期でしょうか。",
          "Ưu tiên nhất là giá hay thời hạn",
          "khám phá lợi ích thật",
          "Buộc lựa chọn ưu tiên thay vì nhận ba yêu cầu đồng thời."
        ),
        focus(
          "現行範囲のまま一五％の値引きは困難です。",
          "Giữ nguyên phạm vi thì khó giảm 15%",
          "nêu giới hạn có căn cứ",
          "困難です để mở điều chỉnh điều kiện, không chỉ từ chối."
        ),
        focus(
          "納期を維持する場合は保証範囲をご調整ください。",
          "Nếu giữ hạn xin điều chỉnh phạm vi bảo hành",
          "đưa trade-off có điều kiện",
          "Mỗi nhượng bộ gắn một điều kiện bù."
        ),
        focus(
          "一括払いであれば八％まで検討可能です。",
          "Nếu thanh toán một lần có thể xem xét giảm tới 8%",
          "đổi giá lấy dòng tiền",
          "であれば thể hiện đề nghị có điều kiện rõ."
        ),
        focus(
          "三つの組み合わせ案を文書でご提示します。",
          "Chúng tôi sẽ trình ba gói lựa chọn bằng văn bản",
          "chuyển thương lượng sang so sánh",
          "Gói lựa chọn giảm hiểu nhầm và giúp khách xin duyệt nội bộ."
        )
      ]
    }),
    defineWeek({
      week: 12,
      themeJa: "J2複合意思決定",
      themeVi: "Ra quyết định phức hợp J2",
      objectiveVi:
        "Tổng hợp dữ liệu, rủi ro, stakeholder và phương án để đưa khuyến nghị có điều kiện.",
      scenarioJa: "海外向け製品の発売直前に品質懸念、コスト超過、法規確認の遅れが重なります。",
      scenarioVi:
        "Trước ra mắt sản phẩm quốc tế xuất hiện lo ngại chất lượng, vượt chi phí và trễ kiểm tra pháp lý.",
      problemVi:
        "dời lịch mất cơ hội thị trường, còn ra mắt đúng lịch có rủi ro tuân thủ và thu hồi.",
      desiredOutcomeVi:
        "ban lãnh đạo nhận ma trận kịch bản, ngưỡng go/no-go và kế hoạch truyền thông.",
      vocabulary: [
        vocab("法規制", "ほうきせい", "quy định pháp luật"),
        vocab("コスト超過", "コストちょうか", "vượt chi phí"),
        vocab("市場機会", "しじょうきかい", "cơ hội thị trường"),
        vocab("回収リスク", "かいしゅうリスク", "rủi ro thu hồi"),
        vocab("判断基準", "はんだんきじゅん", "tiêu chí quyết định"),
        vocab("条件付き承認", "じょうけんつきしょうにん", "phê duyệt có điều kiện")
      ],
      grammar: [
        grammar("～を総合的に勘案すると", "Đưa kết luận sau khi cân nhắc nhiều yếu tố."),
        grammar("～ない限り、～すべきではありません", "Đặt điều kiện gate mạnh.")
      ],
      focuses: [
        focus(
          "法規確認が完了しない限り、発売すべきではありません。",
          "Nếu chưa xong pháp lý thì không nên ra mắt",
          "đặt gate tuân thủ",
          "Không đánh đổi điều kiện bắt buộc lấy cơ hội ngắn hạn."
        ),
        focus(
          "品質懸念は追加試験で三日以内に判定できます。",
          "Lo ngại chất lượng có thể đánh giá trong ba ngày bằng thử thêm",
          "định lượng thời gian giảm bất định",
          "Nêu hành động và thời gian thay vì gắn nhãn rủi ro chung."
        ),
        focus(
          "一週間延期した場合の機会損失を試算しました。",
          "Đã ước tính mất cơ hội nếu hoãn một tuần",
          "lượng hóa downside của trì hoãn",
          "So sánh cùng đơn vị hỗ trợ quyết định cân bằng."
        ),
        focus(
          "条件付き承認とし、二つの解除条件を設けます。",
          "Đề xuất duyệt có điều kiện với hai điều kiện gỡ",
          "tạo phương án trung gian có kiểm soát",
          "解除条件 phải đo được và có owner xác nhận."
        ),
        focus(
          "各リスクを総合的に勘案し、三日延期を推奨します。",
          "Cân nhắc tổng thể, khuyến nghị hoãn ba ngày",
          "đưa khuyến nghị có căn cứ",
          "Khuyến nghị chốt thời gian và lý do, không chỉ nêu lựa chọn."
        )
      ]
    })
  ]
};
