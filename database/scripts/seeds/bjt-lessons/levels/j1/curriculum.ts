import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";
import { defineWeek } from "../../shared/week-factory.js";

export const J1_BLUEPRINT: LevelBlueprint = {
  level: "J1",
  difficulty: "advanced",
  register: "ẩn ý, quyền lực, kính ngữ đối ngoại và lập luận dựa trên rủi ro/giá trị",
  speakerRoleJa: "部長代理",
  counterpartRoleJa: "執行役員",
  acknowledgementJa: "承知いたしました。論点とリスクを整理したうえで、判断材料をご提示します。",
  closingJa: "何とぞご高配を賜りますようお願い申し上げます。",
  weeks: [
    defineWeek({
      week: 1,
      themeJa: "権限と心理的安全性",
      themeVi: "Quyền lực và an toàn tâm lý",
      objectiveVi:
        "Duy trì quyền quản lý mà vẫn tạo không gian cho thông tin bất lợi và phản biện.",
      scenarioJa: "部長代理が着任し、経験豊富な課長と若手社員に意思決定方針を説明します。",
      scenarioVi:
        "Phó trưởng bộ phận mới nhận chức giải thích cách ra quyết định với quản lý kỳ cựu và nhân viên trẻ.",
      problemVi: "nhân viên có xu hướng chỉ báo tin tốt vì sợ bị đánh giá năng lực.",
      desiredOutcomeVi:
        "đội hiểu quyền quyết định, quyền phản biện và cách báo bad news không bị trừng phạt.",
      vocabulary: [
        vocab("心理的安全性", "しんりてきあんぜんせい", "an toàn tâm lý"),
        vocab("権限委譲", "けんげんいじょう", "ủy quyền"),
        vocab("異論", "いろん", "ý kiến khác"),
        vocab("説明責任", "せつめいせきにん", "trách nhiệm giải trình"),
        vocab("萎縮", "いしゅく", "co lại vì sợ"),
        vocab("建設的", "けんせつてき", "mang tính xây dựng")
      ],
      grammar: [
        grammar("～を厭わない", "Không ngại thực hiện việc khó/cần thiết."),
        grammar("～に越したことはない", "Tốt nhất là; nêu lựa chọn ưu tiên nhưng không tuyệt đối.")
      ],
      focuses: [
        focus(
          "悪い情報ほど早く共有してください。",
          "Thông tin xấu càng cần chia sẻ sớm",
          "đảo incentive báo cáo",
          "ほど nhấn mức ưu tiên của thông tin bất lợi."
        ),
        focus(
          "私の案に異論があれば遠慮なく述べてください。",
          "Nếu có ý kiến khác phương án của tôi cứ nói thẳng",
          "cho phép phản biện quyền lực",
          "Lời mời chỉ đáng tin khi lãnh đạo không trừng phạt ý kiến đầu tiên."
        ),
        focus(
          "判断は私が引き受け、根拠は皆で検証します。",
          "Tôi nhận trách nhiệm quyết định, cả đội kiểm chứng căn cứ",
          "tách accountability và thẩm tra",
          "引き受ける giảm việc nhân viên né phản biện vì sợ gánh kết quả."
        ),
        focus(
          "現場判断で進めてよい範囲を明文化します。",
          "Sẽ văn bản hóa phạm vi hiện trường tự quyết",
          "thiết kế quyền tự chủ",
          "明文化 tránh ủy quyền miệng thay đổi theo tình huống."
        ),
        focus(
          "懸念を表明した人が不利益を受けないようにします。",
          "Bảo đảm người nêu lo ngại không chịu bất lợi",
          "bảo vệ người báo rủi ro",
          "Cam kết này là nền tảng compliance, không phải khẩu hiệu."
        )
      ]
    }),
    defineWeek({
      week: 2,
      themeJa: "成果基準による委任",
      themeVi: "Giao việc theo kết quả",
      objectiveVi: "Ủy quyền outcome, guardrail và escalation trigger mà không micromanage.",
      scenarioJa: "部長代理が新規市場調査を課長へ委任し、経営会議向けの提言を求めます。",
      scenarioVi:
        "Phó trưởng bộ phận giao quản lý nghiên cứu thị trường mới để đề xuất cho họp điều hành.",
      problemVi: "yêu cầu mở nhưng quyết định đầu tư phụ thuộc chất lượng giả định và dữ liệu.",
      desiredOutcomeVi:
        "người nhận hiểu outcome, quyền chọn phương pháp, guardrail ngân sách và điểm kiểm tra.",
      vocabulary: [
        vocab("成果基準", "せいかきじゅん", "tiêu chí kết quả"),
        vocab("委任", "いにん", "ủy nhiệm"),
        vocab("裁量", "さいりょう", "quyền tự quyết"),
        vocab("ガードレール", "ガードレール", "giới hạn bảo vệ"),
        vocab("中間報告", "ちゅうかんほうこく", "báo cáo giữa kỳ"),
        vocab("撤退条件", "てったいじょうけん", "điều kiện rút")
      ],
      grammar: [
        grammar("～に一任する", "Giao toàn quyền trong phạm vi xác định."),
        grammar("～を逸脱しない限り", "Cho phép tự do khi không vượt guardrail.")
      ],
      focuses: [
        focus(
          "調査手法はあなたの裁量に一任します。",
          "Phương pháp nghiên cứu giao theo quyền tự quyết của anh/chị",
          "ủy quyền phương pháp",
          "一任 chỉ phù hợp khi outcome và guardrail đã rõ."
        ),
        focus(
          "結論よりも前提の妥当性を重視します。",
          "Coi trọng tính hợp lý giả định hơn kết luận",
          "đặt tiêu chí chất lượng",
          "Ngăn người nhận chỉ tìm dữ liệu ủng hộ kết luận mong muốn."
        ),
        focus(
          "予算上限を逸脱しない限り、外部調査も可能です。",
          "Nếu không vượt trần ngân sách có thể thuê nghiên cứu ngoài",
          "nêu guardrail và quyền lựa chọn",
          "Hai vế cùng tồn tại: tự chủ và giới hạn."
        ),
        focus(
          "重大な反証が出た時点で報告してください。",
          "Báo ngay khi có bằng chứng phản bác quan trọng",
          "đặt escalation trigger",
          "Không chờ báo cáo định kỳ khi giả định cốt lõi bị phá."
        ),
        focus(
          "二週間後に仮説と未解決論点を確認します。",
          "Sau hai tuần sẽ kiểm tra giả thuyết và điểm chưa giải",
          "thiết kế checkpoint học hỏi",
          "Checkpoint xem cả điều chưa biết, không chỉ tiến độ công việc."
        )
      ]
    }),
    defineWeek({
      week: 3,
      themeJa: "経営向け業績説明",
      themeVi: "Giải trình kết quả cho lãnh đạo",
      objectiveVi:
        "Chuyển dữ liệu thành narrative về driver, variance, forecast và quyết định cần xin.",
      scenarioJa: "利益率が計画を下回り、執行役員会で価格・原価・商品構成の影響を説明します。",
      scenarioVi:
        "Biên lợi nhuận thấp hơn kế hoạch và cần giải thích ảnh hưởng giá, chi phí, mix sản phẩm trong họp điều hành.",
      problemVi: "doanh thu đạt nhưng mix lợi nhuận thấp và chi phí logistics tăng bất thường.",
      desiredOutcomeVi:
        "lãnh đạo hiểu variance có tính tạm thời hay cấu trúc và duyệt hành động ưu tiên.",
      vocabulary: [
        vocab("利益率", "りえきりつ", "biên lợi nhuận"),
        vocab("計画差", "けいかくさ", "chênh kế hoạch"),
        vocab("商品構成", "しょうひんこうせい", "mix sản phẩm"),
        vocab("構造要因", "こうぞうよういん", "yếu tố cấu trúc"),
        vocab("一過性", "いっかせい", "tạm thời"),
        vocab("感応度", "かんのうど", "độ nhạy")
      ],
      grammar: [
        grammar("～に起因する", "Nêu nguyên nhân có quan hệ rõ."),
        grammar("～を押し下げています", "Nêu yếu tố làm giảm chỉ số.")
      ],
      focuses: [
        focus(
          "売上は計画どおりですが、利益率は二ポイント下回りました。",
          "Doanh thu đúng kế hoạch nhưng biên thấp hai điểm",
          "mở bằng variance trọng yếu",
          "Đặt actual cạnh plan và lượng hóa khoảng cách."
        ),
        focus(
          "低採算商品の構成比上昇が主因です。",
          "Nguyên nhân chính là tỷ trọng sản phẩm lợi nhuận thấp tăng",
          "giải thích driver mix",
          "Phân biệt doanh số tăng và chất lượng doanh số."
        ),
        focus(
          "物流費増は一過性ではなく構造要因と見ています。",
          "Chi phí logistics tăng là cấu trúc, không tạm thời",
          "phân loại tính bền vững",
          "と見ています thể hiện đánh giá quản lý có thể bị chất vấn."
        ),
        focus(
          "価格を一％改定すると利益率は〇・六ポイント改善します。",
          "Tăng giá 1% cải thiện biên 0,6 điểm",
          "nêu độ nhạy phương án",
          "Liên kết hành động với tác động định lượng."
        ),
        focus(
          "商品構成の見直しと段階的な価格改定をご承認ください。",
          "Xin duyệt điều chỉnh mix và tăng giá theo giai đoạn",
          "xin quyết định cụ thể",
          "Kết luận cần nêu rõ điều gì cần hội nghị phê duyệt."
        )
      ]
    }),
    defineWeek({
      week: 4,
      themeJa: "弱い兆候の報連相",
      themeVi: "Hōrensō với tín hiệu yếu",
      objectiveVi:
        "Escalate dấu hiệu chưa đủ bằng chứng mà không gây báo động giả hoặc trì hoãn nguy hiểm.",
      scenarioJa: "複数の退職面談で同じ管理職への不満が示され、組織リスクとして扱うか検討します。",
      scenarioVi:
        "Nhiều phỏng vấn nghỉ việc nhắc bất mãn với cùng quản lý và cần cân nhắc rủi ro tổ chức.",
      problemVi: "mẫu nhỏ và thông tin nhạy cảm, nhưng chờ dữ liệu chắc có thể làm mất người tiếp.",
      desiredOutcomeVi:
        "bảo mật người cung cấp, xác định ngưỡng điều tra và đưa biện pháp không định kiến.",
      vocabulary: [
        vocab("弱い兆候", "よわいちょうこう", "tín hiệu yếu"),
        vocab("退職面談", "たいしょくめんだん", "phỏng vấn nghỉ việc"),
        vocab("組織リスク", "そしきリスク", "rủi ro tổ chức"),
        vocab("守秘", "しゅひ", "bảo mật"),
        vocab("予断", "よだん", "định kiến trước"),
        vocab("事実確認", "じじつかくにん", "xác minh sự thật")
      ],
      grammar: [
        grammar("～と断定する段階ではない", "Nói chưa đủ mức kết luận."),
        grammar("～を看過するわけにはいかない", "Nói không thể bỏ qua vì trách nhiệm/rủi ro.")
      ],
      focuses: [
        focus(
          "現時点でハラスメントと断定する段階ではありません。",
          "Hiện chưa ở mức kết luận quấy rối",
          "giữ ranh giới bằng chứng",
          "Không dán nhãn trước điều tra, nhưng không phủ nhận phản ánh."
        ),
        focus(
          "ただし、同様の訴えが続く兆候は看過できません。",
          "Tuy nhiên không thể bỏ qua dấu hiệu phản ánh tương tự",
          "nêu lý do hành động sớm",
          "ただし cân bằng thận trọng và trách nhiệm."
        ),
        focus(
          "情報提供者が特定されない形で傾向を共有します。",
          "Chia sẻ xu hướng theo cách không định danh người cung cấp",
          "bảo vệ nguồn thông tin",
          "Bảo mật là điều kiện để còn nhận tín hiệu thật."
        ),
        focus(
          "予断を持たず、人事と事実確認を進めます。",
          "Phối hợp HR xác minh không định kiến",
          "đặt phương pháp điều tra công bằng",
          "予断を持たず bảo vệ cả người phản ánh và người bị phản ánh."
        ),
        focus(
          "追加事象が出た場合は監査部へ上申します。",
          "Nếu có thêm sự việc sẽ trình bộ phận kiểm toán",
          "đặt ngưỡng escalation tiếp",
          "Ngưỡng rõ giúp không tùy tiện theo cảm xúc."
        )
      ]
    }),
    defineWeek({
      week: 5,
      themeJa: "機密性の高い電話",
      themeVi: "Điện thoại có tính bảo mật cao",
      objectiveVi: "Xác thực, giới hạn tiết lộ và chuyển kênh khi xử lý yêu cầu nhạy cảm.",
      scenarioJa: "記者を名乗る人物から未公表の事業撤退について確認の電話があります。",
      scenarioVi: "Người tự nhận là phóng viên gọi hỏi việc rút kinh doanh chưa công bố.",
      problemVi: "chỉ xác nhận hay phủ nhận cũng có thể làm lộ thông tin trọng yếu.",
      desiredOutcomeVi:
        "không rò rỉ, ghi nhận danh tính/yêu cầu và chuyển người phát ngôn được ủy quyền.",
      vocabulary: [
        vocab("未公表情報", "みこうひょうじょうほう", "thông tin chưa công bố"),
        vocab("取材", "しゅざい", "phỏng vấn báo chí"),
        vocab("広報窓口", "こうほうまどぐち", "đầu mối truyền thông"),
        vocab("本人確認", "ほんにんかくにん", "xác minh danh tính"),
        vocab("回答権限", "かいとうけんげん", "quyền trả lời"),
        vocab("ノーコメント", "ノーコメント", "không bình luận")
      ],
      grammar: [
        grammar("～についてはお答えいたしかねます", "Từ chối trả lời chủ đề nhạy cảm."),
        grammar("～を通じてお問い合わせください", "Chuyển yêu cầu qua kênh chính thức.")
      ],
      focuses: [
        focus(
          "恐れ入りますが、ご所属とお名前を確認させてください。",
          "Xin phép xác nhận cơ quan và quý danh",
          "xác thực người gọi",
          "Xác minh trước khi thảo luận bất kỳ nội dung nhạy cảm nào."
        ),
        focus(
          "未公表事項についてはお答えいたしかねます。",
          "Chúng tôi không thể trả lời vấn đề chưa công bố",
          "giữ ranh giới tiết lộ",
          "Không xác nhận tiền đề câu hỏi là đúng hay sai."
        ),
        focus(
          "私には回答権限がございません。",
          "Tôi không có thẩm quyền trả lời",
          "nêu giới hạn vai trò",
          "Giới hạn thẩm quyền đáng tin hơn tranh luận với người gọi."
        ),
        focus(
          "広報窓口を通じてお問い合わせください。",
          "Xin liên hệ qua đầu mối truyền thông",
          "chuyển đúng kênh",
          "Kênh chính thức bảo đảm thông điệp nhất quán và lưu dấu."
        ),
        focus(
          "お問い合わせ内容は広報責任者へ共有いたします。",
          "Nội dung hỏi sẽ được chia sẻ người phụ trách PR",
          "cam kết handoff nội bộ",
          "Chỉ chia sẻ nội dung cần thiết, không lan truyền tin chưa công bố."
        )
      ]
    }),
    defineWeek({
      week: 6,
      themeJa: "役員向け依頼文書",
      themeVi: "Văn bản xin quyết định cấp điều hành",
      objectiveVi: "Soạn executive memo ngắn nêu decision, options, recommendation và risk.",
      scenarioJa: "設備投資の追加予算について執行役員の決裁を求めるメモを作成します。",
      scenarioVi: "Soạn memo xin điều hành duyệt thêm ngân sách đầu tư thiết bị.",
      problemVi: "thiết bị cũ có rủi ro dừng máy, nhưng đầu tư làm vượt ngân sách năm.",
      desiredOutcomeVi: "người duyệt thấy ngay số tiền, lý do, lựa chọn và hệ quả trì hoãn.",
      vocabulary: [
        vocab("稟議", "りんぎ", "trình duyệt"),
        vocab("追加予算", "ついかよさん", "ngân sách bổ sung"),
        vocab("投資対効果", "とうしたいこうか", "hiệu quả đầu tư"),
        vocab("決裁", "けっさい", "phê duyệt"),
        vocab("代替選択肢", "だいたいせんたくし", "lựa chọn thay thế"),
        vocab("操業停止", "そうぎょうていし", "dừng vận hành")
      ],
      grammar: [
        grammar("～をご決裁賜りたく", "Xin được phê duyệt rất trang trọng trong văn bản."),
        grammar("～に鑑み", "Xét đến hoàn cảnh/yếu tố quan trọng.")
      ],
      focuses: [
        focus(
          "設備更新費三千万円の追加予算をご決裁賜りたく存じます。",
          "Xin phê duyệt thêm 30 triệu yên cập nhật thiết bị",
          "nêu decision ngay đầu",
          "Văn bản cho lãnh đạo phải thấy hành động và con số trước bối cảnh."
        ),
        focus(
          "故障頻度の上昇に鑑み、今期更新を推奨します。",
          "Xét tần suất hỏng tăng, khuyến nghị thay trong kỳ này",
          "đưa recommendation có căn cứ",
          "に鑑み dùng cho yếu tố nghiêm trọng cần cân nhắc."
        ),
        focus(
          "投資回収期間は二・八年です。",
          "Thời gian hoàn vốn là 2,8 năm",
          "nêu business case",
          "Con số cần kèm giả định trong phụ lục, nhưng memo nêu headline."
        ),
        focus(
          "延期した場合、最大五日の操業停止リスクがあります。",
          "Nếu hoãn có rủi ro dừng tối đa năm ngày",
          "nêu downside của không hành động",
          "So sánh chi phí đầu tư với expected loss, không chỉ sợ hãi."
        ),
        focus(
          "代替案としてリース契約も比較しております。",
          "Cũng đã so sánh phương án thuê",
          "chứng minh đã xem lựa chọn",
          "Người duyệt cần biết recommendation không phải lựa chọn duy nhất chưa kiểm tra."
        )
      ]
    }),
    defineWeek({
      week: 7,
      themeJa: "戦略会議の論点設計",
      themeVi: "Thiết kế luận điểm họp chiến lược",
      objectiveVi: "Khung hóa tranh luận, làm lộ giả định và ngăn đồng thuận giả.",
      scenarioJa: "成熟市場から成長市場へ資源を移す戦略について役員と部門長が議論します。",
      scenarioVi:
        "Điều hành và trưởng bộ phận bàn chuyển nguồn lực từ thị trường trưởng thành sang thị trường tăng trưởng.",
      problemVi: "mọi người đồng ý định hướng chung nhưng khác nhau về tốc độ và mức rủi ro.",
      desiredOutcomeVi:
        "cuộc họp tách được lựa chọn chiến lược, giả định then chốt và thử nghiệm trước cam kết lớn.",
      vocabulary: [
        vocab("論点設計", "ろんてんせっけい", "thiết kế luận điểm"),
        vocab("資源配分", "しげんはいぶん", "phân bổ nguồn lực"),
        vocab("成熟市場", "せいじゅくしじょう", "thị trường trưởng thành"),
        vocab("成長仮説", "せいちょうかせつ", "giả thuyết tăng trưởng"),
        vocab("同調圧力", "どうちょうあつりょく", "áp lực đồng thuận"),
        vocab("反証", "はんしょう", "bằng chứng phản bác")
      ],
      grammar: [
        grammar("～を議論の出発点としたい", "Đề xuất điểm bắt đầu của tranh luận."),
        grammar("～とは限りません", "Bác bỏ suy luận tuyệt đối.")
      ],
      focuses: [
        focus(
          "方向性への賛否ではなく、移行速度を論点としたいと思います。",
          "Không bàn đồng ý hướng đi mà bàn tốc độ chuyển",
          "định nghĩa luận điểm thực",
          "Tách đồng thuận khẩu hiệu khỏi quyết định phân bổ."
        ),
        focus(
          "市場成長が収益成長につながるとは限りません。",
          "Thị trường tăng không nhất thiết dẫn tới lợi nhuận tăng",
          "thách thức giả định",
          "とは限らない tạo không gian kiểm chứng mà không phủ định cơ hội."
        ),
        focus(
          "最も不確実な仮説は顧客獲得コストです。",
          "Giả thuyết bất định nhất là chi phí lấy khách",
          "xác định unknown quan trọng",
          "Tập trung biến quyết định outcome thay vì tranh luận mọi số."
        ),
        focus(
          "反対意見を先に伺いたいと思います。",
          "Tôi muốn nghe ý kiến phản đối trước",
          "giảm áp lực đồng thuận",
          "Mời phản biện trước khi lãnh đạo bộc lộ lựa chọn ưu tiên."
        ),
        focus(
          "投資の一〇％で仮説検証を行い、次回判断します。",
          "Dùng 10% đầu tư để kiểm chứng rồi quyết định tiếp",
          "thiết kế staged commitment",
          "Giữ option value khi bất định cao."
        )
      ]
    }),
    defineWeek({
      week: 8,
      themeJa: "事業ポートフォリオ管理",
      themeVi: "Quản lý danh mục dự án",
      objectiveVi: "Phân bổ nguồn lực theo giá trị, rủi ro và chi phí cơ hội toàn danh mục.",
      scenarioJa: "五つの開発案件が予算削減の対象となり、継続・縮小・中止を判断します。",
      scenarioVi:
        "Năm dự án phát triển bị cắt ngân sách và cần quyết định tiếp tục, thu hẹp hoặc dừng.",
      problemVi: "mỗi owner bảo vệ dự án mình, trong khi tổng nguồn lực giảm 20%.",
      desiredOutcomeVi: "so sánh cùng tiêu chí, tính sunk cost đúng và đưa danh mục cân bằng.",
      vocabulary: [
        vocab("事業ポートフォリオ", "じぎょうポートフォリオ", "danh mục kinh doanh"),
        vocab("機会費用", "きかいひよう", "chi phí cơ hội"),
        vocab("埋没費用", "まいぼつひよう", "chi phí chìm"),
        vocab("継続基準", "けいぞくきじゅん", "tiêu chí tiếp tục"),
        vocab("資源制約", "しげんせいやく", "ràng buộc nguồn lực"),
        vocab("選択と集中", "せんたくとしゅうちゅう", "chọn lọc và tập trung")
      ],
      grammar: [
        grammar("～を度外視して", "Không tính một yếu tố trong quyết định."),
        grammar("～に資源を振り向ける", "Chuyển nguồn lực sang mục tiêu khác.")
      ],
      focuses: [
        focus(
          "全案件を同一の継続基準で評価します。",
          "Đánh giá mọi dự án bằng cùng tiêu chí",
          "giảm thiên kiến owner",
          "Cùng tiêu chí giúp so sánh danh mục, dù dữ liệu từng dự án khác."
        ),
        focus(
          "過去の投資額は意思決定から切り離します。",
          "Tách khoản đã đầu tư khỏi quyết định",
          "tránh bẫy sunk cost",
          "Quyết định dựa dòng tiền/rủi ro tương lai, không biện minh quá khứ."
        ),
        focus(
          "成長性と実行確度の二軸で配置します。",
          "Xếp theo tăng trưởng và khả năng thực thi",
          "khung hóa danh mục",
          "Hai trục tránh chỉ ưu tiên upside hoặc dự án dễ."
        ),
        focus(
          "低優先案件を停止し、中核案件へ人員を振り向けます。",
          "Dừng dự án ưu tiên thấp và chuyển người sang dự án lõi",
          "thực hiện lựa chọn nguồn lực",
          "停止 rõ hơn kéo dài mọi dự án với nguồn lực thiếu."
        ),
        focus(
          "中止案件の知見と人材を再活用します。",
          "Tái sử dụng tri thức và nhân sự dự án dừng",
          "giảm mất mát chuyển đổi",
          "Dừng dự án không đồng nghĩa phủ nhận đóng góp đã tạo."
        )
      ]
    }),
    defineWeek({
      week: 9,
      themeJa: "危機対応と指揮系統",
      themeVi: "Ứng phó khủng hoảng và chỉ huy",
      objectiveVi:
        "Thiết lập command, cadence, fact log và tiêu chí chuyển trạng thái trong khủng hoảng.",
      scenarioJa: "主要工場が自然災害で停止し、顧客供給と従業員安全への対応本部を立ち上げます。",
      scenarioVi:
        "Nhà máy chính dừng do thiên tai và lập trung tâm ứng phó cho nguồn cung và an toàn nhân viên.",
      problemVi: "thông tin thiếu, nhiều phòng tự liên hệ khách và thông điệp bắt đầu khác nhau.",
      desiredOutcomeVi:
        "ưu tiên con người, một nguồn sự thật, phân quyền quyết định và lịch cập nhật đều.",
      vocabulary: [
        vocab("対策本部", "たいさくほんぶ", "ban ứng phó"),
        vocab("指揮系統", "しきけいとう", "chuỗi chỉ huy"),
        vocab("安否確認", "あんぴかくにん", "xác nhận an toàn"),
        vocab("事実ログ", "じじつログ", "log sự thật"),
        vocab("供給継続", "きょうきゅうけいぞく", "duy trì cung ứng"),
        vocab("復旧見通し", "ふっきゅうみとおし", "dự kiến phục hồi")
      ],
      grammar: [
        grammar("～を最優先とする", "Đặt ưu tiên tuyệt đối trong bối cảnh."),
        grammar("～ごとに更新する", "Quy định cadence cập nhật.")
      ],
      focuses: [
        focus(
          "従業員の安全確認を最優先とします。",
          "Ưu tiên cao nhất là xác nhận an toàn nhân viên",
          "đặt thứ tự giá trị",
          "Trong khủng hoảng, thứ tự ưu tiên phải nói rõ trước áp lực khách hàng."
        ),
        focus(
          "対外発信は広報責任者に一本化します。",
          "Tập trung phát ngôn ngoài vào phụ trách PR",
          "ngăn thông điệp phân mảnh",
          "一本化 giữ tính nhất quán, không ngăn luồng dữ kiện nội bộ."
        ),
        focus(
          "確認済み事実と推測を分けて記録します。",
          "Ghi riêng sự thật đã xác nhận và suy đoán",
          "bảo vệ chất lượng thông tin",
          "Tách epistemic status giúp quyết định không dựa tin đồn."
        ),
        focus(
          "復旧見通しは二時間ごとに更新します。",
          "Cập nhật dự kiến phục hồi mỗi hai giờ",
          "thiết lập cadence",
          "Cadence giảm truy vấn ngẫu nhiên làm gián đoạn đội xử lý."
        ),
        focus(
          "代替供給の発動基準を在庫三日分とします。",
          "Đặt ngưỡng kích hoạt nguồn thay là tồn kho ba ngày",
          "định nghĩa trigger hành động",
          "Ngưỡng đo được giúp không chờ quyết định cảm tính mỗi lần."
        )
      ]
    }),
    defineWeek({
      week: 10,
      themeJa: "法的含意のある苦情",
      themeVi: "Khiếu nại có hàm ý pháp lý",
      objectiveVi:
        "Xin lỗi tác động mà không thừa nhận trách nhiệm chưa xác minh; bảo toàn quyền và bằng chứng.",
      scenarioJa: "顧客がシステム停止による逸失利益を主張し、損害賠償を求めています。",
      scenarioVi: "Khách yêu cầu bồi thường lợi nhuận mất do hệ thống ngừng.",
      problemVi:
        "SLA có giới hạn trách nhiệm nhưng tranh luận hợp đồng ngay sẽ làm quan hệ xấu hơn.",
      desiredOutcomeVi:
        "ghi nhận thiệt hại, bảo toàn log, phối hợp pháp chế và đưa lịch phản hồi có thẩm quyền.",
      vocabulary: [
        vocab("逸失利益", "いっしつりえき", "lợi nhuận bị mất"),
        vocab("損害賠償", "そんがいばいしょう", "bồi thường thiệt hại"),
        vocab("責任制限", "せきにんせいげん", "giới hạn trách nhiệm"),
        vocab("法的見解", "ほうてきけんかい", "ý kiến pháp lý"),
        vocab("証拠保全", "しょうこほぜん", "bảo toàn bằng chứng"),
        vocab("和解案", "わかいあん", "phương án hòa giải")
      ],
      grammar: [
        grammar(
          "～と受け止めております",
          "Ghi nhận cách đối phương nhìn nhận mà không xác nhận đúng sai."
        ),
        grammar("～を差し控えます", "Tạm không phát biểu/hành động vì cần thận trọng.")
      ],
      focuses: [
        focus(
          "重大な事業影響が生じたとのご主張を重く受け止めております。",
          "Chúng tôi nghiêm túc ghi nhận việc quý khách cho rằng có ảnh hưởng lớn",
          "ghi nhận claim không thừa nhận liability",
          "とのご主張 giữ ranh giới giữa lời khách và kết luận của công ty."
        ),
        focus(
          "現段階で責任範囲に関する回答は差し控えます。",
          "Hiện tại xin tạm chưa trả lời phạm vi trách nhiệm",
          "tránh cam kết pháp lý sớm",
          "差し控える đi kèm lý do và mốc phản hồi để không né tránh."
        ),
        focus(
          "事実関係とログを保全し、法務と確認します。",
          "Bảo toàn sự thật/log và kiểm tra với pháp chế",
          "bảo vệ điều tra",
          "Không chỉnh sửa hệ thống trước khi chụp bằng chứng cần thiết."
        ),
        focus(
          "お申し出の損失内訳をご提示いただけますか。",
          "Xin cung cấp chi tiết tổn thất",
          "lấy dữ kiện claim",
          "Yêu cầu dữ liệu không phải phủ nhận trải nghiệm khách."
        ),
        focus(
          "責任者同席のうえ、三営業日以内に正式回答します。",
          "Sẽ trả lời chính thức trong ba ngày làm việc với người có trách nhiệm",
          "cam kết quy trình có thẩm quyền",
          "正式回答 phân biệt với phản hồi ban đầu."
        )
      ]
    }),
    defineWeek({
      week: 11,
      themeJa: "契約リスクの交渉",
      themeVi: "Thương lượng rủi ro hợp đồng",
      objectiveVi: "Nhận diện phân bổ rủi ro trong indemnity, SLA, change control và termination.",
      scenarioJa: "大口顧客が無制限の損害賠償と厳格なSLAを契約条件として提示します。",
      scenarioVi: "Khách lớn đưa điều kiện bồi thường không giới hạn và SLA nghiêm ngặt.",
      problemVi: "giá trị hợp đồng hấp dẫn nhưng tail risk vượt khả năng bảo hiểm của công ty.",
      desiredOutcomeVi:
        "chuyển tranh luận từ câu chữ sang risk owner và đạt giới hạn tương xứng với giá/phạm vi.",
      vocabulary: [
        vocab("補償条項", "ほしょうじょうこう", "điều khoản bồi thường"),
        vocab("責任上限", "せきにんじょうげん", "trần trách nhiệm"),
        vocab("不可抗力", "ふかこうりょく", "bất khả kháng"),
        vocab("変更管理", "へんこうかんり", "quản lý thay đổi"),
        vocab("解除条項", "かいじょじょうこう", "điều khoản chấm dứt"),
        vocab("リスク配分", "リスクはいぶん", "phân bổ rủi ro")
      ],
      grammar: [
        grammar("～に見合う", "Tương xứng với giá trị/rủi ro."),
        grammar("～を上限とする", "Đặt trần rõ ràng.")
      ],
      focuses: [
        focus(
          "無制限責任は契約対価に見合わないと考えます。",
          "Trách nhiệm vô hạn không tương xứng giá trị hợp đồng",
          "nêu nguyên tắc phân bổ",
          "Tập trung tỷ lệ risk/reward, không nói chính sách nội bộ đơn thuần."
        ),
        focus(
          "直接損害に限定し、年間契約額を上限とする案を提示します。",
          "Đề xuất giới hạn thiệt hại trực tiếp và trần bằng giá trị năm",
          "đưa câu thay thế cụ thể",
          "Đàm phán hiệu quả cần redline có thể chấp nhận, không chỉ xóa."
        ),
        focus(
          "不可抗力と顧客起因事象はSLA対象外とします。",
          "Loại bất khả kháng và nguyên nhân từ khách khỏi SLA",
          "xác định risk owner",
          "SLA nên đo phần nhà cung cấp kiểm soát."
        ),
        focus(
          "追加要件は変更管理手続きの対象とします。",
          "Yêu cầu thêm thuộc quy trình change control",
          "ngăn scope creep",
          "Change control liên kết phạm vi, giá và lịch."
        ),
        focus(
          "重大違反には是正期間を設けたうえで解除可能とします。",
          "Vi phạm nghiêm trọng được chấm dứt sau thời gian khắc phục",
          "cân bằng quyền chấm dứt",
          "Cure period bảo vệ hai bên khỏi termination quá sớm."
        )
      ]
    }),
    defineWeek({
      week: 12,
      themeJa: "J1経営判断ケース",
      themeVi: "Case quyết định điều hành J1",
      objectiveVi:
        "Tích hợp tài chính, con người, pháp lý, khách hàng và option value trong quyết định khó hoàn tác.",
      scenarioJa: "赤字事業の撤退案を取締役会へ上程し、雇用・顧客・ブランドへの影響を説明します。",
      scenarioVi:
        "Trình hội đồng phương án rút khỏi mảng lỗ và giải thích ảnh hưởng nhân sự, khách hàng, thương hiệu.",
      problemVi:
        "tiếp tục làm mất tiền nhưng rút nhanh tạo chi phí chuyển đổi và tổn hại niềm tin.",
      desiredOutcomeVi:
        "hội đồng có scenario, điều kiện trì hoãn, kế hoạch chuyển tiếp và governance thực thi.",
      vocabulary: [
        vocab("事業撤退", "じぎょうてったい", "rút khỏi kinh doanh"),
        vocab("取締役会", "とりしまりやくかい", "hội đồng quản trị"),
        vocab("減損", "げんそん", "suy giảm giá trị"),
        vocab("移行計画", "いこうけいかく", "kế hoạch chuyển tiếp"),
        vocab("ステークホルダー", "ステークホルダー", "bên liên quan"),
        vocab("不可逆性", "ふかぎゃくせい", "tính khó đảo ngược")
      ],
      grammar: [
        grammar("～を余儀なくされる", "Bị buộc phải do hoàn cảnh."),
        grammar("～を勘案したうえで", "Sau khi cân nhắc toàn diện.")
      ],
      focuses: [
        focus(
          "現行モデルでは二年以内の黒字化は困難です。",
          "Mô hình hiện tại khó có lãi trong hai năm",
          "nêu baseline không hành động",
          "Kết luận cần dựa scenario, không dựa một quý xấu."
        ),
        focus(
          "撤退を一年延期すると追加損失は八億円です。",
          "Hoãn rút một năm gây thêm lỗ 800 triệu yên",
          "lượng hóa cost of delay",
          "Đặt thời gian và con số giúp so với chi phí chuyển tiếp."
        ),
        focus(
          "一方、即時撤退は顧客移行と雇用に重大な影響を及ぼします。",
          "Rút ngay ảnh hưởng lớn khách và việc làm",
          "nêu downside hành động nhanh",
          "Cân bằng tài chính với stakeholder, không che tác động xã hội."
        ),
        focus(
          "六か月の段階撤退と従業員再配置を提案します。",
          "Đề xuất rút theo giai đoạn sáu tháng và bố trí lại nhân viên",
          "đưa phương án chuyển tiếp",
          "Kế hoạch giảm tính không đảo ngược và bảo vệ năng lực."
        ),
        focus(
          "移行KPIを月次監督し、逸脱時は委員会へ再上程します。",
          "Giám sát KPI chuyển tiếp hàng tháng và trình lại khi lệch",
          "thiết kế governance thực thi",
          "Quyết định board cần cơ chế theo dõi, không kết thúc ở phê duyệt."
        )
      ]
    })
  ]
};
