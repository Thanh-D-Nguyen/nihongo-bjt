import type { LevelBlueprint } from "../../types.js";
import { focus, grammar, vocab } from "../../shared/helpers.js";
import { defineWeek } from "../../shared/week-factory.js";

export const J1PLUS_BLUEPRINT: LevelBlueprint = {
  level: "J1+",
  difficulty: "executive",
  register:
    "executive Japanese: hàm ý, governance, xung đột lợi ích, bất định và trách nhiệm thể chế",
  speakerRoleJa: "事業本部長",
  counterpartRoleJa: "経営会議議長",
  acknowledgementJa: "承知いたしました。利害関係者への影響と中長期的な含意を整理して付議します。",
  closingJa: "格別のご理解とご支援を賜りますよう、謹んでお願い申し上げます。",
  weeks: [
    defineWeek({
      week: 1,
      themeJa: "含意とメンツの調整",
      themeVi: "Điều chỉnh hàm ý và thể diện",
      objectiveVi:
        "Đọc tín hiệu gián tiếp, bất đồng quyền lực và bảo toàn thể diện khi cần thay đổi quyết định.",
      scenarioJa:
        "経営会議で社長が支持した海外投資案に重大な前提誤りが見つかり、本部長が再考を促します。",
      scenarioVi:
        "Phát hiện giả định sai lớn trong phương án đầu tư nước ngoài được CEO ủng hộ và tổng giám đốc khối phải thúc đẩy xem xét lại.",
      problemVi:
        "phản đối trực diện có thể làm người đề xuất mất thể diện, nhưng im lặng gây quyết định sai.",
      desiredOutcomeVi:
        "mở lại quyết định dựa dữ kiện mới, giữ accountability tập thể và không biến tranh luận thành đối đầu cá nhân.",
      vocabulary: [
        vocab("含意", "がんい", "hàm ý"),
        vocab("面子", "めんつ", "thể diện"),
        vocab("前提誤り", "ぜんていあやまり", "sai giả định"),
        vocab("再考", "さいこう", "xem xét lại"),
        vocab("軌道修正", "きどうしゅうせい", "điều chỉnh hướng"),
        vocab("異議", "いぎ", "phản đối chính thức")
      ],
      grammar: [
        grammar("～と申し上げざるを得ません", "Buộc phải nêu nhận định khó một cách trang trọng."),
        grammar("～を再度俎上に載せる", "Đưa vấn đề trở lại bàn nghị sự.")
      ],
      focuses: [
        focus(
          "新たな事実を踏まえると、前提を再検証すべきと申し上げざるを得ません。",
          "Xét dữ kiện mới, buộc phải đề nghị kiểm chứng lại giả định",
          "mở lại quyết định bằng bằng chứng",
          "Đặt 新たな事実 làm lý do, không quy quyết định trước là thiếu năng lực."
        ),
        focus(
          "当初判断の妥当性とは別に、現時点の最善を議論したいと存じます。",
          "Tách tính hợp lý quyết định ban đầu khỏi lựa chọn tốt nhất hiện tại",
          "bảo toàn thể diện và chuyển thời điểm",
          "Tách ex ante và ex post giúp người quyết định cũ không phải tự phủ nhận."
        ),
        focus(
          "反対ではなく、下方シナリオへの備えを問うものです。",
          "Đây không phải phản đối mà là hỏi chuẩn bị cho kịch bản xấu",
          "reframe bất đồng",
          "Không dùng reframe để che phản đối; vẫn phải nêu consequence rõ."
        ),
        focus(
          "いったん条件付き承認に戻すことをご提案します。",
          "Đề xuất quay về phê duyệt có điều kiện",
          "tạo lối sửa quyết định",
          "いったん cho phép điều chỉnh mà không tuyên bố thất bại hoàn toàn."
        ),
        focus(
          "判断変更の理由は経営会議の総意として説明します。",
          "Giải thích lý do đổi là đồng thuận của hội nghị",
          "chia sẻ accountability",
          "Tránh để một cá nhân bị gắn là người thắng/thua trong điều chỉnh."
        )
      ]
    }),
    defineWeek({
      week: 2,
      themeJa: "相反する経営指示",
      themeVi: "Chỉ thị điều hành mâu thuẫn",
      objectiveVi: "Chuyển mục tiêu mâu thuẫn thành frontier, decision rights và exception policy.",
      scenarioJa:
        "取締役会から『成長投資を加速しつつ固定費を一〇％削減せよ』との方針が示されます。",
      scenarioVi: "Hội đồng yêu cầu vừa tăng đầu tư tăng trưởng vừa giảm 10% chi phí cố định.",
      problemVi: "các phòng hiểu khác nhau và có nguy cơ cắt năng lực tạo tăng trưởng.",
      desiredOutcomeVi: "làm rõ vùng bảo vệ, danh mục cần dừng và thẩm quyền phê duyệt ngoại lệ.",
      vocabulary: [
        vocab("相反", "そうはん", "mâu thuẫn"),
        vocab("経営方針", "けいえいほうしん", "định hướng điều hành"),
        vocab("固定費", "こていひ", "chi phí cố định"),
        vocab("投資余力", "とうしよりょく", "dư địa đầu tư"),
        vocab("聖域", "せいいき", "vùng bất khả xâm phạm"),
        vocab("例外承認", "れいがいしょうにん", "duyệt ngoại lệ")
      ],
      grammar: [
        grammar("～を両立させるには", "Nêu điều kiện để đạt hai mục tiêu."),
        grammar("～にほかなりません", "Nhấn mạnh bản chất/kết luận mạnh.")
      ],
      focuses: [
        focus(
          "両方を一律に追えば、成長基盤を毀損しかねません。",
          "Theo đuổi đồng loạt cả hai có thể làm hỏng nền tăng trưởng",
          "nêu nghịch lý thực thi",
          "かねません cảnh báo hệ quả có xác suất đáng kể."
        ),
        focus(
          "削減対象は将来収益への寄与で峻別します。",
          "Phân loại đối tượng cắt theo đóng góp doanh thu tương lai",
          "đặt nguyên tắc phân loại",
          "峻別 mạnh, yêu cầu tiêu chí có thể audit."
        ),
        focus(
          "成長領域を聖域化するのではなく、検証期限を設けます。",
          "Không biến vùng tăng trưởng thành vùng miễn cắt, mà đặt hạn kiểm chứng",
          "cân bằng bảo vệ và accountability",
          "Bảo vệ có thời hạn tránh dự án gắn nhãn chiến lược vĩnh viễn."
        ),
        focus(
          "撤退案件から生じる余力を重点投資へ振り向けます。",
          "Chuyển dư địa từ dự án rút sang đầu tư trọng điểm",
          "liên kết cắt và tăng trưởng",
          "Cho thấy hai chỉ thị là tái phân bổ, không phải hai ngân sách độc lập."
        ),
        focus(
          "例外案件はCFOと事業責任者の共同承認とします。",
          "Ngoại lệ cần CFO và chủ kinh doanh cùng duyệt",
          "thiết kế decision rights",
          "Joint approval cân tài chính và chiến lược."
        )
      ]
    }),
    defineWeek({
      week: 3,
      themeJa: "不確実性を織り込む報告",
      themeVi: "Báo cáo tích hợp bất định",
      objectiveVi:
        "Trình bày range, probability, confidence, leading indicator và decision sensitivity.",
      scenarioJa: "新規事業の五か年計画を投資委員会へ説明しますが、市場データは限定的です。",
      scenarioVi: "Trình kế hoạch năm năm cho ủy ban đầu tư khi dữ liệu thị trường còn hạn chế.",
      problemVi:
        "một con số forecast tạo cảm giác chắc chắn giả, còn range quá rộng không giúp quyết định.",
      desiredOutcomeVi:
        "ủy ban thấy base/upside/downside, xác suất, chỉ báo cập nhật và quyết định nào nhạy nhất.",
      vocabulary: [
        vocab("確率分布", "かくりつぶんぷ", "phân bố xác suất"),
        vocab("信頼区間", "しんらいくかん", "khoảng tin cậy"),
        vocab("先行指標", "せんこうしひょう", "chỉ báo dẫn"),
        vocab("感応度分析", "かんのうどぶんせき", "phân tích độ nhạy"),
        vocab("ベースケース", "ベースケース", "kịch bản cơ sở"),
        vocab("確証バイアス", "かくしょうバイアス", "thiên kiến xác nhận")
      ],
      grammar: [
        grammar("～と見るのが妥当です", "Nêu đánh giá hợp lý sau phân tích."),
        grammar("～次第では、～もあり得ます", "Nêu khả năng phụ thuộc điều kiện.")
      ],
      focuses: [
        focus(
          "単一予測ではなく、三つのシナリオでお示しします。",
          "Trình ba kịch bản thay vì một forecast",
          "biểu diễn bất định có cấu trúc",
          "Scenario phải khác giả định, không chỉ thay số đầu ra."
        ),
        focus(
          "ベースケースの実現確率は五〇％と見ています。",
          "Xác suất kịch bản cơ sở là 50%",
          "nêu probability judgment",
          "と見ています chịu trách nhiệm cho assessment và mời challenge."
        ),
        focus(
          "顧客獲得単価が収益性を最も左右します。",
          "Chi phí lấy khách ảnh hưởng lợi nhuận nhất",
          "nêu sensitivity driver",
          "Tập trung biến thay đổi decision thay vì tất cả giả định."
        ),
        focus(
          "先行指標が閾値を下回れば投資を凍結します。",
          "Nếu chỉ báo xuống dưới ngưỡng sẽ đóng băng đầu tư",
          "đặt trigger cập nhật quyết định",
          "Precommitment giảm confirmation bias sau khi đã đầu tư."
        ),
        focus(
          "確度の低さ自体を割引率に織り込んでおります。",
          "Đã đưa độ chắc thấp vào discount rate",
          "nối bất định với định giá",
          "Tránh vừa giảm dòng tiền vừa tăng discount cho cùng một rủi ro hai lần."
        )
      ]
    }),
    defineWeek({
      week: 4,
      themeJa: "重要性とガバナンス報告",
      themeVi: "Materiality và báo cáo quản trị",
      objectiveVi: "Đánh giá materiality định lượng/định tính và chọn tuyến báo cáo độc lập.",
      scenarioJa:
        "子会社で売上計上時期の操作を示唆する内部通報があり、監査委員会への報告要否を判断します。",
      scenarioVi:
        "Có tố cáo nội bộ về gợi ý thao túng thời điểm ghi doanh thu tại công ty con và cần quyết định báo ủy ban kiểm toán.",
      problemVi:
        "số tiền ban đầu dưới ngưỡng tài chính nhưng liên quan đạo đức quản lý và khả năng lan rộng.",
      desiredOutcomeVi:
        "bảo vệ người tố cáo, giữ độc lập điều tra và báo đúng governance trước khi quản lý địa phương can thiệp.",
      vocabulary: [
        vocab("重要性", "じゅうようせい", "trọng yếu"),
        vocab("内部通報", "ないぶつうほう", "tố cáo nội bộ"),
        vocab("売上計上", "うりあげけいじょう", "ghi nhận doanh thu"),
        vocab("監査委員会", "かんさいいんかい", "ủy ban kiểm toán"),
        vocab("調査独立性", "ちょうさどくりつせい", "độc lập điều tra"),
        vocab("報復防止", "ほうふくぼうし", "ngăn trả đũa")
      ],
      grammar: [
        grammar("～の多寡にかかわらず", "Bất kể mức nhiều ít."),
        grammar("～を損なうおそれがある", "Có nguy cơ làm tổn hại giá trị/hệ thống.")
      ],
      focuses: [
        focus(
          "金額の多寡にかかわらず、経営者関与の疑いは重大です。",
          "Bất kể số tiền, nghi ngờ quản lý liên quan là nghiêm trọng",
          "nêu materiality định tính",
          "Governance risk có thể trọng yếu dù số ban đầu nhỏ."
        ),
        focus(
          "現地経営陣から独立した調査体制を組成します。",
          "Lập điều tra độc lập với quản lý địa phương",
          "bảo vệ độc lập điều tra",
          "Không giao người có thể liên quan quyền xác định phạm vi."
        ),
        focus(
          "通報者の匿名性と報復防止を最優先します。",
          "Ưu tiên ẩn danh và chống trả đũa",
          "bảo vệ speak-up system",
          "Mất niềm tin kênh tố cáo gây rủi ro dài hạn lớn hơn case đơn lẻ."
        ),
        focus(
          "監査委員長へ直ちに予備報告を行います。",
          "Báo sơ bộ ngay cho chủ tịch ủy ban kiểm toán",
          "đưa thông tin lên governance độc lập",
          "予備報告 cho phép hành động trước khi sự thật hoàn chỉnh."
        ),
        focus(
          "調査範囲の変更は委員会承認事項とします。",
          "Mọi đổi phạm vi điều tra cần ủy ban duyệt",
          "ngăn thu hẹp điều tra không minh bạch",
          "Decision right về scope phải nằm ngoài management bị điều tra."
        )
      ]
    }),
    defineWeek({
      week: 5,
      themeJa: "圧力下の対外交渉",
      themeVi: "Thương lượng đối ngoại dưới áp lực",
      objectiveVi: "Xử lý ultimatum, im lặng, neo giá và đe dọa quan hệ mà không phản ứng cảm xúc.",
      scenarioJa:
        "独占的な供給業者が障害復旧中に四〇％の値上げを要求し、応じなければ供給停止すると通告します。",
      scenarioVi:
        "Nhà cung cấp độc quyền đòi tăng 40% khi đang phục hồi sự cố và dọa ngừng cung ứng.",
      problemVi: "ngắn hạn không có nguồn thay, nhưng chấp nhận neo giá tạo lệ thuộc dài hạn.",
      desiredOutcomeVi:
        "ổn định cung ứng tạm thời, tách emergency khỏi hợp đồng dài hạn và xây BATNA.",
      vocabulary: [
        vocab("最後通牒", "さいごつうちょう", "tối hậu thư"),
        vocab("交渉力", "こうしょうりょく", "sức mạnh thương lượng"),
        vocab("代替調達", "だいたいちょうたつ", "nguồn thay thế"),
        vocab("暫定合意", "ざんていごうい", "thỏa thuận tạm"),
        vocab("優越的地位", "ゆうえつてきちい", "vị thế vượt trội"),
        vocab("アンカリング", "アンカリング", "neo giá")
      ],
      grammar: [
        grammar("～を切り離して協議する", "Tách hai vấn đề để thương lượng riêng."),
        grammar("～を受け入れる余地はありません", "Nêu ranh giới cứng không chấp nhận.")
      ],
      focuses: [
        focus(
          "復旧協力と長期価格改定は切り離して協議すべきです。",
          "Cần tách hỗ trợ phục hồi và tăng giá dài hạn",
          "chống gộp vấn đề dưới áp lực",
          "Tách timeframe ngăn emergency bị dùng làm leverage vĩnh viễn."
        ),
        focus(
          "供給停止を前提とした一方的条件は受け入れられません。",
          "Không chấp nhận điều kiện một phía dựa trên đe dọa ngừng cung",
          "đặt ranh giới hành vi",
          "Phản đối process mà không chấm dứt khả năng thỏa thuận."
        ),
        focus(
          "七日間の暫定単価と供給保証を提案します。",
          "Đề xuất đơn giá tạm bảy ngày kèm bảo đảm cung",
          "ổn định ngắn hạn",
          "Time-boxed bridge tạo thời gian xây lựa chọn."
        ),
        focus(
          "原価根拠は第三者指標で検証させてください。",
          "Xin kiểm chứng căn cứ chi phí bằng chỉ số bên thứ ba",
          "đưa neo về dữ liệu",
          "Chỉ số độc lập giảm tranh luận vị thế."
        ),
        focus(
          "同時に代替調達を発動し、依存度を引き下げます。",
          "Đồng thời kích hoạt nguồn thay để giảm lệ thuộc",
          "cải thiện BATNA",
          "Không công bố bluff; BATNA phải được thực thi thật."
        )
      ]
    }),
    defineWeek({
      week: 6,
      themeJa: "取締役会向け政策文書",
      themeVi: "Văn bản chính sách cho hội đồng",
      objectiveVi:
        "Soạn policy memo cân nguyên tắc, ngoại lệ, control, accountability và review cadence.",
      scenarioJa: "生成AIの社内利用方針を取締役会へ上程し、生産性と機密リスクを両立させます。",
      scenarioVi: "Trình chính sách dùng GenAI nội bộ để cân năng suất và rủi ro bảo mật.",
      problemVi:
        "cấm toàn bộ đẩy sử dụng ngầm, cho tự do có thể làm lộ dữ liệu và vi phạm bản quyền.",
      desiredOutcomeVi:
        "hội đồng duyệt risk-tier, dữ liệu cấm, công cụ được phép, exception và cơ chế review.",
      vocabulary: [
        vocab("利用方針", "りようほうしん", "chính sách sử dụng"),
        vocab("機密区分", "きみつくぶん", "phân loại mật"),
        vocab("シャドー利用", "シャドーりよう", "sử dụng ngầm"),
        vocab("例外手続き", "れいがいてつづき", "thủ tục ngoại lệ"),
        vocab("人間による監督", "にんげんによるかんとく", "giám sát con người"),
        vocab("定期見直し", "ていきみなおし", "rà soát định kỳ")
      ],
      grammar: [
        grammar("～を一律に禁ずるものではない", "Làm rõ chính sách không cấm đồng loạt."),
        grammar("～を条件として認める", "Cho phép có điều kiện.")
      ],
      focuses: [
        focus(
          "本方針は生成AIの利用を一律に禁ずるものではありません。",
          "Chính sách không cấm đồng loạt GenAI",
          "nêu mục đích điều tiết",
          "Mở đầu ngăn policy bị đọc như cấm công nghệ."
        ),
        focus(
          "顧客機密と個人情報の入力は例外なく禁止します。",
          "Cấm không ngoại lệ nhập dữ liệu khách và cá nhân",
          "đặt red line dữ liệu",
          "Một số boundary phải đơn giản để thực thi."
        ),
        focus(
          "低リスク業務は承認済み環境に限り利用を認めます。",
          "Cho phép việc rủi ro thấp chỉ trong môi trường duyệt",
          "định nghĩa safe path",
          "Cho lựa chọn hợp pháp giảm shadow use."
        ),
        focus(
          "対外成果物には人間による検証と責任者承認を必須とします。",
          "Đầu ra đối ngoại bắt buộc kiểm chứng người và owner duyệt",
          "giữ accountability",
          "AI không trở thành chủ thể chịu trách nhiệm."
        ),
        focus(
          "技術変化を踏まえ、四半期ごとに方針を見直します。",
          "Rà chính sách hàng quý theo thay đổi công nghệ",
          "thiết kế policy thích ứng",
          "Review cadence tránh policy nhanh lỗi thời."
        )
      ]
    }),
    defineWeek({
      week: 7,
      themeJa: "利害対立のファシリテーション",
      themeVi: "Điều phối xung đột lợi ích",
      objectiveVi:
        "Làm rõ interest, quyền phủ quyết, tiêu chí chung và quy trình quyết định công bằng.",
      scenarioJa: "営業・製造・財務が大型特注案件をめぐり、受注可否で真っ向から対立しています。",
      scenarioVi: "Kinh doanh, sản xuất và tài chính đối đầu về việc nhận đơn hàng tùy chỉnh lớn.",
      problemVi: "doanh thu hấp dẫn, công suất căng và điều khoản thanh toán làm dòng tiền âm.",
      desiredOutcomeVi:
        "các bên ngừng tranh vị thế, thống nhất tiêu chí doanh nghiệp và tạo điều kiện nhận có kiểm soát.",
      vocabulary: [
        vocab("利害対立", "りがいたいりつ", "xung đột lợi ích"),
        vocab("拒否権", "きょひけん", "quyền phủ quyết"),
        vocab("共通利益", "きょうつうりえき", "lợi ích chung"),
        vocab("評価基準", "ひょうかきじゅん", "tiêu chí đánh giá"),
        vocab("手続的公正", "てつづきてきこうせい", "công bằng thủ tục"),
        vocab("条件付き受注", "じょうけんつきじゅちゅう", "nhận đơn có điều kiện")
      ],
      grammar: [
        grammar("～の是非を論じる前に", "Trước khi tranh đúng/sai, làm rõ điều kiện."),
        grammar("～に照らして判断する", "Đánh giá theo tiêu chí/quy tắc.")
      ],
      focuses: [
        focus(
          "受注の是非を論じる前に、各部門の制約を可視化します。",
          "Trước khi tranh nhận hay không, làm rõ ràng buộc từng phòng",
          "chuyển vị thế thành dữ kiện",
          "制約 dễ giải hơn lập trường 賛成／反対."
        ),
        focus(
          "共通利益は利益ある成長と供給信頼の両立です。",
          "Lợi ích chung là tăng trưởng có lợi nhuận và tin cậy cung ứng",
          "định nghĩa objective chung",
          "Cả hai tiêu chí ngăn tối ưu cục bộ."
        ),
        focus(
          "安全と法令に関する拒否権は製造責任者にあります。",
          "Quản lý sản xuất có quyền phủ quyết về an toàn/pháp luật",
          "làm rõ non-negotiable decision right",
          "Veto giới hạn theo domain, không mở rộng sang mọi điều kiện thương mại."
        ),
        focus(
          "粗利、キャッシュ、供給余力の三基準で評価します。",
          "Đánh giá theo biên, tiền mặt và năng lực cung",
          "thống nhất scorecard",
          "Tiêu chí được thống nhất trước khi xem kết quả giảm thiên kiến."
        ),
        focus(
          "前受金と納期分割を条件に受注する案で合意します。",
          "Đồng ý nhận nếu có trả trước và chia giao",
          "tạo giải pháp tích hợp",
          "Điều kiện xử lý constraint tài chính và công suất cùng lúc."
        )
      ]
    }),
    defineWeek({
      week: 8,
      themeJa: "シナリオ別資源配分",
      themeVi: "Phân bổ nguồn lực theo kịch bản",
      objectiveVi:
        "Giữ option value bằng staged bets, trigger và reallocation rule trong bất định cao.",
      scenarioJa: "為替・規制・需要が不透明な三地域へ、限られた成長投資を配分します。",
      scenarioVi:
        "Phân đầu tư tăng trưởng hạn chế cho ba khu vực có bất định tỷ giá, pháp lý và nhu cầu.",
      problemVi: "commit lớn tối ưu nếu đúng nhưng khó đảo; chia đều làm thiếu quy mô ở mọi nơi.",
      desiredOutcomeVi: "xây core commitment, option bets và rule chuyển vốn theo chỉ báo thực.",
      vocabulary: [
        vocab("選択権価値", "せんたくけんかち", "giá trị quyền chọn"),
        vocab("段階投資", "だんかいとうし", "đầu tư theo giai đoạn"),
        vocab("再配分ルール", "さいはいぶんルール", "quy tắc phân bổ lại"),
        vocab("先行指標", "せんこうしひょう", "chỉ báo dẫn"),
        vocab("不可逆投資", "ふかぎゃくとうし", "đầu tư khó đảo"),
        vocab("打ち切り基準", "うちきりきじゅん", "tiêu chí dừng")
      ],
      grammar: [
        grammar("～を温存する", "Giữ lại nguồn lực/quyền lựa chọn."),
        grammar("～に応じて機動的に", "Linh hoạt theo tín hiệu/điều kiện.")
      ],
      focuses: [
        focus(
          "不可逆投資を抑え、選択権を温存します。",
          "Hạn chế đầu tư khó đảo và giữ option",
          "bảo vệ linh hoạt",
          "Không đồng nghĩa không quyết; vẫn cần core bet đủ học."
        ),
        focus(
          "各地域に同額を配るのではなく、仮説ごとに投資します。",
          "Không chia đều theo vùng mà đầu tư theo giả thuyết",
          "tránh fairness giả",
          "Nguồn lực gắn learning question thay vì địa lý đơn thuần."
        ),
        focus(
          "規制承認を先行指標として第二段階を発動します。",
          "Dùng duyệt pháp lý làm trigger giai đoạn hai",
          "gắn vốn với tín hiệu",
          "Trigger ngoài kiểm soát cần kịch bản thời gian."
        ),
        focus(
          "需要指標が閾値を下回れば三か月で打ち切ります。",
          "Nếu nhu cầu dưới ngưỡng sẽ dừng sau ba tháng",
          "precommit tiêu chí dừng",
          "Dừng nhanh bảo vệ vốn cho option khác."
        ),
        focus(
          "四半期ごとに成果と情報価値で再配分します。",
          "Tái phân bổ hàng quý theo kết quả và giá trị thông tin",
          "tạo cadence danh mục",
          "Dự án học được điều quan trọng có thể đáng giữ dù doanh thu sớm thấp."
        )
      ]
    }),
    defineWeek({
      week: 9,
      themeJa: "サイバー危機と開示",
      themeVi: "Khủng hoảng mạng và công bố",
      objectiveVi: "Cân containment, bằng chứng, nghĩa vụ công bố, giao tiếp khách và continuity.",
      scenarioJa: "ランサムウェア攻撃で基幹システムが停止し、情報流出の有無は未確定です。",
      scenarioVi: "Ransomware làm dừng hệ thống lõi và chưa xác định có rò dữ liệu.",
      problemVi:
        "khôi phục nhanh có thể phá bằng chứng; trì hoãn thông báo có thể vi phạm nghĩa vụ.",
      desiredOutcomeVi:
        "command thống nhất, legal clock, segmented recovery và thông điệp trung thực theo mức biết.",
      vocabulary: [
        vocab("ランサムウェア", "ランサムウェア", "mã độc tống tiền"),
        vocab("封じ込め", "ふうじこめ", "cô lập"),
        vocab("フォレンジック", "フォレンジック", "điều tra số"),
        vocab("開示義務", "かいじぎむ", "nghĩa vụ công bố"),
        vocab("事業継続", "じぎょうけいぞく", "duy trì kinh doanh"),
        vocab("身代金", "みのしろきん", "tiền chuộc")
      ],
      grammar: [
        grammar("～を予断なく調査する", "Điều tra không kết luận trước."),
        grammar("～を損なわない範囲で", "Hành động trong phạm vi không làm hại mục tiêu khác.")
      ],
      focuses: [
        focus(
          "被害拡大を防ぐため、感染区画を直ちに隔離します。",
          "Cô lập vùng nhiễm ngay để ngăn mở rộng",
          "ưu tiên containment",
          "隔離 có thể ảnh hưởng vận hành nên phạm vi cần do command phê duyệt."
        ),
        focus(
          "流出の有無は未確定であり、予断なく調査中です。",
          "Chưa xác định rò dữ liệu và đang điều tra không định kiến",
          "truyền đạt mức biết chính xác",
          "Không nói 流出なし khi mới chưa thấy bằng chứng."
        ),
        focus(
          "証拠保全を損なわない範囲で復旧を進めます。",
          "Khôi phục trong phạm vi không hại bằng chứng",
          "cân recovery và forensics",
          "Hai workstream cần chỉ huy chung để tránh overwrite."
        ),
        focus(
          "開示期限を法務と確認し、暫定報告を準備します。",
          "Xác nhận hạn công bố với pháp chế và chuẩn bị báo sơ bộ",
          "quản lý legal clock",
          "Tách deadline pháp lý khỏi khi điều tra hoàn tất."
        ),
        focus(
          "身代金の支払いは制裁・倫理・復旧可能性を総合判断します。",
          "Quyết định tiền chuộc dựa sanction, đạo đức và khả năng phục hồi",
          "đưa quyết định cực nhạy về đúng governance",
          "Không để đội kỹ thuật tự quyết vì áp lực thời gian."
        )
      ]
    }),
    defineWeek({
      week: 10,
      themeJa: "多主体への謝罪と説明",
      themeVi: "Xin lỗi và giải trình đa stakeholder",
      objectiveVi: "Điều chỉnh thông điệp nhất quán cho khách, nhân viên, regulator và công chúng.",
      scenarioJa: "製品安全問題で自主回収を決定し、顧客・販売店・当局・従業員へ同時説明します。",
      scenarioVi:
        "Quyết định thu hồi tự nguyện vì an toàn sản phẩm và giải thích đồng thời cho khách, đại lý, cơ quan, nhân viên.",
      problemVi:
        "mỗi bên cần chi tiết khác nhưng mâu thuẫn thông điệp sẽ phá niềm tin và tạo rủi ro pháp lý.",
      desiredOutcomeVi:
        "một nguồn sự thật, hành động bảo vệ rõ, acknowledge uncertainty và cadence cập nhật.",
      vocabulary: [
        vocab("自主回収", "じしゅかいしゅう", "thu hồi tự nguyện"),
        vocab("製品安全", "せいひんあんぜん", "an toàn sản phẩm"),
        vocab("当局報告", "とうきょくほうこく", "báo cơ quan"),
        vocab("ステークホルダー", "ステークホルダー", "bên liên quan"),
        vocab("一貫性", "いっかんせい", "tính nhất quán"),
        vocab("風評", "ふうひょう", "dư luận bất lợi")
      ],
      grammar: [
        grammar("～を最優先に決定した", "Nêu giá trị ưu tiên dẫn đến quyết định."),
        grammar("～については判明次第", "Hứa cập nhật khi thông tin được xác định.")
      ],
      focuses: [
        focus(
          "お客様の安全を最優先に、自主回収を決定いたしました。",
          "Ưu tiên an toàn khách, chúng tôi quyết định thu hồi",
          "nêu giá trị và hành động",
          "Không mở bằng bảo vệ thương hiệu hoặc giảm nhẹ sự cố."
        ),
        focus(
          "多大なご不安とご不便を招き、深くお詫び申し上げます。",
          "Thành thật xin lỗi vì gây lo lắng và bất tiện lớn",
          "acknowledge tác động cảm xúc/thực tế",
          "Nêu cả 不安 và 不便 vì safety issue ảnh hưởng hai mặt."
        ),
        focus(
          "対象ロットと返金手続きは共通窓口でご案内します。",
          "Thông báo lô và hoàn tiền qua đầu mối chung",
          "đưa hành động rõ cho khách/đại lý",
          "Common source ngăn đại lý tự tạo hướng dẫn khác."
        ),
        focus(
          "原因は調査中であり、判明次第公表します。",
          "Nguyên nhân đang điều tra và sẽ công bố khi rõ",
          "thừa nhận bất định",
          "Không lấp khoảng trống bằng giả thuyết trong thông cáo."
        ),
        focus(
          "当局報告と社内説明を同一の事実基盤で更新します。",
          "Cập nhật báo cơ quan và nội bộ từ cùng fact base",
          "giữ nhất quán đa stakeholder",
          "Thông điệp khác độ chi tiết nhưng không khác sự thật."
        )
      ]
    }),
    defineWeek({
      week: 11,
      themeJa: "越境M&A交渉",
      themeVi: "Thương lượng M&A xuyên biên giới",
      objectiveVi:
        "Xử lý khác biệt văn hóa, valuation gap, representations, earn-out và integration risk.",
      scenarioJa:
        "海外企業の買収交渉で、将来成長の評価と創業者の経営関与をめぐり隔たりがあります。",
      scenarioVi:
        "Đàm phán mua công ty nước ngoài có khoảng cách về định giá tăng trưởng và vai trò nhà sáng lập.",
      problemVi:
        "tăng giá trả ngay chuyển toàn bộ rủi ro cho bên mua; ép rời founder làm mất khách và nhân tài.",
      desiredOutcomeVi:
        "biến valuation gap thành earn-out đo được và thiết kế governance chuyển tiếp bảo vệ hai bên.",
      vocabulary: [
        vocab("企業価値評価", "きぎょうかちひょうか", "định giá doanh nghiệp"),
        vocab("表明保証", "ひょうめいほしょう", "representations & warranties"),
        vocab("アーンアウト", "アーンアウト", "earn-out"),
        vocab("経営統合", "けいえいとうごう", "tích hợp quản trị"),
        vocab("偶発債務", "ぐうはつさいむ", "nợ tiềm tàng"),
        vocab("文化的差異", "ぶんかてきさい", "khác biệt văn hóa")
      ],
      grammar: [
        grammar("～に連動させる", "Gắn giá/điều kiện với chỉ số."),
        grammar("～を担保する仕組み", "Cơ chế bảo đảm một mục tiêu.")
      ],
      focuses: [
        focus(
          "評価の隔たりは将来成長の見方に起因しています。",
          "Khoảng cách định giá do cách nhìn tăng trưởng tương lai",
          "xác định source of disagreement",
          "Tách mô hình giá trị khỏi cảm giác bên nào tham lam."
        ),
        focus(
          "追加対価を売上と利益の双方に連動させます。",
          "Gắn khoản trả thêm vào cả doanh thu và lợi nhuận",
          "thiết kế earn-out chống gaming",
          "Dùng hai chỉ số cân tăng trưởng và chất lượng tăng trưởng."
        ),
        focus(
          "創業者には二年間の経営関与をお願いしたいと考えます。",
          "Đề nghị founder tham gia quản lý hai năm",
          "bảo vệ chuyển giao quan hệ",
          "Time-bound role giảm lo mất quyền vĩnh viễn của bên mua."
        ),
        focus(
          "重要事項には共同承認を設け、段階的に権限移管します。",
          "Đặt đồng duyệt việc quan trọng và chuyển quyền dần",
          "thiết kế governance chuyển tiếp",
          "Joint approval cần sunset để không deadlock lâu dài."
        ),
        focus(
          "偶発債務は表明保証保険とエスクローで担保します。",
          "Bảo vệ nợ tiềm tàng bằng bảo hiểm và escrow",
          "phân bổ tail risk",
          "Công cụ tài chính giảm tranh luận niềm tin giữa hai bên."
        )
      ]
    }),
    defineWeek({
      week: 12,
      themeJa: "J1+統合経営シミュレーション",
      themeVi: "Mô phỏng điều hành tích hợp J1+",
      objectiveVi:
        "Điều hành một decision cycle gồm tín hiệu yếu, khủng hoảng, hội đồng, công bố và tái phân bổ.",
      scenarioJa:
        "主力事業の品質不正疑義、サイバー攻撃、買収交渉が同日に重なり、経営会議を指揮します。",
      scenarioVi:
        "Nghi ngờ gian lận chất lượng, tấn công mạng và đàm phán mua bán xảy ra cùng ngày, cần chỉ huy hội nghị điều hành.",
      problemVi:
        "mỗi sự việc có owner khác nhưng cùng tranh nguồn lực, có liên hệ công bố và rủi ro danh tiếng.",
      desiredOutcomeVi:
        "phân loại materiality, đặt command, giữ bằng chứng, bảo vệ người, dừng quyết định khó đảo và thiết kế cadence board.",
      vocabulary: [
        vocab("複合危機", "ふくごうきき", "khủng hoảng kép"),
        vocab("全社対策", "ぜんしゃたいさく", "ứng phó toàn công ty"),
        vocab("重要事象", "じゅうようじしょう", "sự kiện trọng yếu"),
        vocab("意思決定凍結", "いしけっていとうけつ", "đóng băng quyết định"),
        vocab("統合指揮", "とうごうしき", "chỉ huy tích hợp"),
        vocab("取締役監督", "とりしまりやくかんとく", "giám sát hội đồng")
      ],
      grammar: [
        grammar("～を横断的に統括する", "Điều phối xuyên nhiều workstream."),
        grammar("～が担保されるまで", "Cho đến khi một điều kiện bảo đảm được đáp ứng.")
      ],
      focuses: [
        focus(
          "三事象を別件として扱わず、全社リスクとして統括します。",
          "Không xử lý riêng mà quản trị như rủi ro toàn công ty",
          "nhận diện tương tác hệ thống",
          "Cùng tranh reputational capital và nguồn lực điều tra."
        ),
        focus(
          "人命・法令・証拠保全を他の判断に優先します。",
          "Ưu tiên con người, pháp luật và bằng chứng",
          "đặt hierarchy quyết định",
          "Nguyên tắc này giúp xử lý khi các workstream giành ưu tiên."
        ),
        focus(
          "買収契約は情報の完全性が担保されるまで凍結します。",
          "Đóng băng hợp đồng mua đến khi bảo đảm đầy đủ thông tin",
          "bảo vệ quyết định khó đảo",
          "Material events có thể đổi valuation và disclosure của deal."
        ),
        focus(
          "各対策本部の事実ログを統合し、開示判断を一本化します。",
          "Tích hợp fact log và thống nhất quyết định công bố",
          "tạo single source of truth",
          "Không nhất thiết gom đội chuyên môn; gom fact/governance."
        ),
        focus(
          "取締役会には四時間ごとに判断事項と残余リスクを報告します。",
          "Báo hội đồng mỗi bốn giờ về quyết định và residual risk",
          "thiết kế board cadence",
          "Báo những gì cần giám sát/quyết, không đổ toàn bộ log vận hành."
        )
      ]
    })
  ]
};
