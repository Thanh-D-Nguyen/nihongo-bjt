/**
 * BJT J2 Level Questions — 中上級レベル (Upper-Intermediate)
 * Score range: 420-529
 *
 * Target: Learners who can handle complex business situations including
 * negotiations, complaint handling, contracts, budget management,
 * overseas trading, advanced keigo (尊敬語/謙譲語 distinction),
 * and abstract business concepts.
 * Contexts: client negotiations, complaint resolution, hiring interviews,
 * contract discussions, budget planning, market analysis, strategy meetings.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J2_DATA: SeedLevelData = {
  level: "J2",
  slug: "bjt-j2-practice-v3",
  titleVi: "Đề luyện BJT J2 — Trung cao cấp",
  titleJa: "BJT J2 練習テスト — 中上級レベル",
  sections: [
    // ======================== LC_SCENE (12) ========================
    {
      code: "LC_SCENE",
      titleVi: "Nắm bắt tình huống",
      titleJa: "場面把握問題",
      questions: [
        {
          prompt: "取引先の部長が「御社の提案書を拝見しましたが、コスト面でもう少しご検討いただけないでしょうか」と言っています。営業担当が資料を広げています。",
          scenario: "取引先の応接室。商談中、双方がテーブルを挟んで座っている。",
          explanationVi: "Trưởng phòng đối tác nói 'Tôi đã xem bản đề xuất của quý công ty, nhưng về mặt chi phí có thể xem xét thêm không?'. Đây là cảnh đàm phán giá trong thương mại.",
          skillTag: "negotiation-comprehension",
          difficulty: "standard",
          options: opts(
            "取引先が提案を全面的に受け入れています。",
            "取引先がコスト面で再検討を求めています。",
            "営業担当が契約書にサインしています。",
            "取引先が別の会社に発注しようとしています。",
            "B"
          ),
        },
        {
          prompt: "顧客が「先月納品された製品に不具合が見つかりまして、早急に対応していただきたいのですが」と電話で話しています。品質管理部の担当者がメモを取っています。",
          scenario: "オフィスの品質管理部。担当者が電話対応中。",
          explanationVi: "Khách hàng gọi điện phàn nàn 'Sản phẩm giao tháng trước phát hiện lỗi, muốn được xử lý gấp'. Nhân viên quản lý chất lượng đang ghi chép.",
          skillTag: "complaint-handling",
          difficulty: "standard",
          options: opts(
            "顧客が新規注文の相談をしています。",
            "品質管理部が製品検査をしています。",
            "顧客が製品の不具合について苦情を伝えています。",
            "担当者が納品スケジュールを確認しています。",
            "C"
          ),
        },
        {
          prompt: "面接官が「これまでのご経験の中で、最も困難だったプロジェクトについてお聞かせいただけますか」と聞いています。応募者がスーツ姿で椅子に座っています。",
          scenario: "会議室での採用面接。面接官2名と応募者1名。",
          explanationVi: "Người phỏng vấn hỏi 'Xin hãy cho biết về dự án khó khăn nhất trong kinh nghiệm của bạn'. Đây là cảnh phỏng vấn tuyển dụng.",
          skillTag: "interview-comprehension",
          difficulty: "easy",
          options: opts(
            "応募者が退職の挨拶をしています。",
            "面接官が応募者の経験について質問しています。",
            "応募者が給与交渉をしています。",
            "面接官が会社案内をしています。",
            "B"
          ),
        },
        {
          prompt: "経理部長が「今期の予算配分について、各部門からの要望を踏まえて再度調整が必要です」と発言しています。ホワイトボードに予算表が書かれています。",
          scenario: "経営会議室。役員と各部門長が出席している。",
          explanationVi: "Trưởng phòng kế toán nói 'Cần điều chỉnh lại phân bổ ngân sách kỳ này dựa trên yêu cầu của các phòng ban'. Đây là cuộc họp ngân sách.",
          skillTag: "budget-management",
          difficulty: "standard",
          options: opts(
            "経理部長が決算報告をしています。",
            "予算配分の再調整について議論しています。",
            "各部門が予算を削減しています。",
            "経理部長が新規採用を提案しています。",
            "B"
          ),
        },
        {
          prompt: "弁護士が「本契約の第7条について、免責条項の範囲を明確にする必要がございます」と説明しています。両社の代表が契約書を見ています。",
          scenario: "法律事務所の会議室。契約締結前の最終確認。",
          explanationVi: "Luật sư giải thích 'Cần làm rõ phạm vi điều khoản miễn trừ trách nhiệm ở Điều 7 của hợp đồng này'. Hai bên đang xem xét hợp đồng.",
          skillTag: "contract-review",
          difficulty: "hard",
          options: opts(
            "弁護士が訴訟の準備をしています。",
            "契約書の免責条項について確認・説明しています。",
            "両社が契約を解除しようとしています。",
            "弁護士が会社設立の手続きをしています。",
            "B"
          ),
        },
        {
          prompt: "海外営業部の課長が「現地パートナーとの合弁事業について、リスク分担の条件を詰める段階に入りました」と報告しています。",
          scenario: "本社の国際事業部会議。スクリーンに海外市場データが映されている。",
          explanationVi: "Trưởng khoa kinh doanh quốc tế báo cáo 'Đã đến giai đoạn thương lượng chi tiết điều kiện phân chia rủi ro với đối tác liên doanh tại địa phương'.",
          skillTag: "overseas-business",
          difficulty: "hard",
          options: opts(
            "海外パートナーとの契約が完了しました。",
            "合弁事業のリスク分担条件の交渉段階に入っています。",
            "海外営業部が撤退を検討しています。",
            "現地パートナーが契約を拒否しています。",
            "B"
          ),
        },
        {
          prompt: "人事部長が「今回の組織再編に伴い、一部の部署統合について社員への説明会を実施いたします」と述べています。",
          scenario: "経営層向けの事前説明会。人事部長がプレゼンテーション中。",
          explanationVi: "Trưởng phòng nhân sự thông báo 'Liên quan đến việc tái cơ cấu tổ chức lần này, sẽ tổ chức buổi giải thích cho nhân viên về việc sáp nhập một số phòng ban'.",
          skillTag: "organizational-restructuring",
          difficulty: "standard",
          options: opts(
            "人事部長が新入社員研修を案内しています。",
            "組織再編に伴う部署統合の説明会を告知しています。",
            "人事部長が個別面談のスケジュールを発表しています。",
            "全社員が異動の辞令を受けています。",
            "B"
          ),
        },
        {
          prompt: "工場長が「今回のリコール対象製品について、出荷停止と全品回収の手配を至急お願いします」と指示しています。",
          scenario: "工場の緊急対策会議室。品質管理と物流の担当者が集まっている。",
          explanationVi: "Giám đốc nhà máy chỉ thị 'Về sản phẩm bị thu hồi lần này, xin hãy khẩn trương sắp xếp dừng xuất hàng và thu hồi toàn bộ'.",
          skillTag: "crisis-management",
          difficulty: "hard",
          options: opts(
            "工場長が増産を指示しています。",
            "リコール対象製品の出荷停止と回収を指示しています。",
            "工場が新製品のラインを稼働させています。",
            "物流担当が通常の出荷準備をしています。",
            "B"
          ),
        },
        {
          prompt: "広報部長が「来週のプレスリリースに先立ち、想定される質問への回答を準備しておいてください」と部下に伝えています。",
          scenario: "広報部のオフィス。新サービス発表前の準備ミーティング。",
          explanationVi: "Trưởng phòng PR nói với cấp dưới 'Trước buổi họp báo tuần tới, hãy chuẩn bị câu trả lời cho các câu hỏi dự kiến'.",
          skillTag: "press-preparation",
          difficulty: "standard",
          options: opts(
            "広報部長がプレスリリースを取り消しています。",
            "プレスリリース前の想定問答の準備を指示しています。",
            "記者会見が始まっています。",
            "広報部長が取材を断っています。",
            "B"
          ),
        },
        {
          prompt: "監査役が「前年度の会計処理について、いくつか確認させていただきたい点がございます」と経理担当者に伝えています。",
          scenario: "監査室。帳簿と財務資料がテーブルに広がっている。",
          explanationVi: "Giám sát viên nói với nhân viên kế toán 'Có một vài điểm tôi muốn xác nhận về xử lý kế toán năm trước'.",
          skillTag: "audit-process",
          difficulty: "standard",
          options: opts(
            "監査役が不正を告発しています。",
            "前年度の会計処理について確認・質問しています。",
            "経理担当者が退職手続きをしています。",
            "監査が完了し、問題がないと報告しています。",
            "B"
          ),
        },
        {
          prompt: "マーケティング部長が「競合他社の新製品が発売されたことを受け、当社の販売戦略を見直す必要があります」と述べています。",
          scenario: "マーケティング戦略会議。競合分析レポートがスクリーンに映されている。",
          explanationVi: "Trưởng phòng marketing nói 'Do đối thủ ra sản phẩm mới, chúng ta cần xem xét lại chiến lược bán hàng của công ty'.",
          skillTag: "competitive-strategy",
          difficulty: "standard",
          options: opts(
            "マーケティング部長が新製品の開発を提案しています。",
            "競合の新製品発売を受けて販売戦略の見直しを提案しています。",
            "競合他社との業務提携を発表しています。",
            "マーケティング予算の削減を報告しています。",
            "B"
          ),
        },
        {
          prompt: "社長が「海外子会社の業績悪化に伴い、現地経営陣との緊急協議を行うため、来週出張いたします」と役員会で説明しています。",
          scenario: "本社の役員会議室。四半期業績報告の場面。",
          explanationVi: "Giám đốc giải thích tại cuộc họp ban giám đốc 'Do kết quả kinh doanh của công ty con ở nước ngoài xấu đi, tôi sẽ đi công tác tuần tới để họp khẩn cấp với ban lãnh đạo tại chỗ'.",
          skillTag: "executive-communication",
          difficulty: "hard",
          options: opts(
            "社長が海外子会社の設立を発表しています。",
            "海外子会社の業績悪化を受けて緊急出張を説明しています。",
            "社長が退任を発表しています。",
            "海外子会社が黒字転換したと報告しています。",
            "B"
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
          prompt: "「本件につきましては、社内で十分に検討した上で、改めてご回答申し上げます。」",
          scenario: "取引先との打ち合わせで、相手の要望に対して即答できない場面。",
          explanationVi: "Người nói dùng kính ngữ (謙譲語: 申し上げます) để nói 'Về vấn đề này, sau khi thảo luận kỹ nội bộ, chúng tôi sẽ trả lời lại'. Đây là cách trì hoãn trả lời lịch sự.",
          skillTag: "keigo-comprehension",
          difficulty: "standard",
          options: opts(
            "相手の要望をその場で断っています。",
            "社内検討後に改めて回答すると伝えています。",
            "契約の締結を急いでいます。",
            "相手に追加資料を求めています。",
            "B"
          ),
        },
        {
          prompt: "「誠に恐れ入りますが、予算の都合上、ご要望の仕様での対応は難しい状況でございます。」",
          scenario: "見積もり依頼に対する回答の電話。",
          explanationVi: "Người nói lịch sự từ chối: 'Rất xin lỗi nhưng do giới hạn ngân sách, việc đáp ứng theo thông số yêu cầu là khó khăn'. Đây là cách từ chối gián tiếp trong kinh doanh Nhật.",
          skillTag: "indirect-refusal",
          difficulty: "standard",
          options: opts(
            "予算内で仕様変更に対応できると伝えています。",
            "予算の制約により要望通りの対応が困難だと伝えています。",
            "追加予算の承認を求めています。",
            "仕様について質問しています。",
            "B"
          ),
        },
        {
          prompt: "「先日ご提出いただいた企画書、大変興味深く拝読いたしました。ぜひ次回の役員会で取り上げさせていただければと存じます。」",
          scenario: "上司が部下の企画書について評価している場面。",
          explanationVi: "Người nói (cấp trên) dùng kính ngữ khiêm nhường (拝読) để nói 'Bản kế hoạch trình lên rất thú vị, tôi muốn đưa ra cuộc họp ban giám đốc lần tới'. Thể hiện đánh giá tích cực.",
          skillTag: "keigo-comprehension",
          difficulty: "easy",
          options: opts(
            "企画書を却下しています。",
            "企画書を高く評価し、役員会で検討したいと伝えています。",
            "企画書の修正を要求しています。",
            "企画書の提出期限を延長しています。",
            "B"
          ),
        },
        {
          prompt: "「今回の件でお客様にご迷惑をおかけしたことは事実ですので、再発防止策を含めた書面での回答をお約束いたします。」",
          scenario: "クレーム対応後、社内報告の場面。",
          explanationVi: "Người nói thừa nhận 'Việc gây phiền phức cho khách hàng là sự thật, nên tôi hứa sẽ trả lời bằng văn bản bao gồm biện pháp phòng ngừa tái phát'.",
          skillTag: "complaint-resolution",
          difficulty: "standard",
          options: opts(
            "お客様の苦情を否定しています。",
            "迷惑をかけた事実を認め、書面での再発防止策回答を約束しています。",
            "お客様に口頭での謝罪のみで済ませています。",
            "担当者の処分を発表しています。",
            "B"
          ),
        },
        {
          prompt: "「御社との取引は長年にわたり良好な関係を築いてまいりましたが、昨今の原材料費高騰に伴い、価格改定のお願いをせざるを得ない状況です。」",
          scenario: "サプライヤーが取引先に値上げを伝える場面。",
          explanationVi: "Nhà cung cấp nói 'Mối quan hệ giao dịch với quý công ty đã tốt đẹp nhiều năm, nhưng do giá nguyên liệu tăng gần đây, chúng tôi buộc phải đề nghị điều chỉnh giá'.",
          skillTag: "price-negotiation",
          difficulty: "hard",
          options: opts(
            "取引関係を終了すると伝えています。",
            "原材料費高騰を理由に値上げの必要性を丁寧に伝えています。",
            "取引量の拡大を提案しています。",
            "品質改善の報告をしています。",
            "B"
          ),
        },
        {
          prompt: "「率直に申し上げますと、このスケジュールでは品質を担保することが困難です。納期を2週間延長していただくか、仕様を縮小するか、ご判断いただけますでしょうか。」",
          scenario: "プロジェクトマネージャーがクライアントに状況を説明する場面。",
          explanationVi: "PM nói thẳng 'Với lịch trình này khó đảm bảo chất lượng. Xin hãy quyết định giữa gia hạn 2 tuần hoặc giảm phạm vi'. Đây là cách đưa ra lựa chọn cho đối tác.",
          skillTag: "project-negotiation",
          difficulty: "hard",
          options: opts(
            "プロジェクトの中止を提案しています。",
            "品質担保のため、納期延長か仕様縮小の判断を求めています。",
            "追加人員の投入を報告しています。",
            "スケジュール通りに完了できると約束しています。",
            "B"
          ),
        },
        {
          prompt: "「ご多忙のところ恐縮ですが、来月の株主総会に向けた資料の最終確認を、今週中にお願いできればと存じます。」",
          scenario: "秘書が役員に資料確認を依頼する場面。",
          explanationVi: "Thư ký lịch sự yêu cầu giám đốc 'Biết ngài bận, nhưng mong có thể xác nhận cuối cùng tài liệu cho đại hội cổ đông tháng tới trong tuần này'.",
          skillTag: "polite-request",
          difficulty: "easy",
          options: opts(
            "株主総会の延期を伝えています。",
            "株主総会資料の最終確認を今週中に依頼しています。",
            "役員の出張スケジュールを確認しています。",
            "株主からの質問を報告しています。",
            "B"
          ),
        },
        {
          prompt: "「前回のご指摘を踏まえまして、セキュリティ面の強化策を盛り込んだ改訂版をお持ちいたしました。ご査収のほどよろしくお願いいたします。」",
          scenario: "IT企業の営業がクライアントに修正提案を持参した場面。",
          explanationVi: "Nhân viên kinh doanh IT nói 'Dựa trên góp ý lần trước, tôi đã mang bản sửa đổi có bổ sung biện pháp tăng cường bảo mật. Xin vui lòng xem xét'.",
          skillTag: "proposal-revision",
          difficulty: "standard",
          options: opts(
            "セキュリティ上の問題が発生したと報告しています。",
            "前回の指摘を反映したセキュリティ強化版の提案書を提出しています。",
            "システムの運用停止を提案しています。",
            "セキュリティ監査の日程を調整しています。",
            "B"
          ),
        },
        {
          prompt: "「当初の見込みより市場の反応が芳しくないため、マーケティング予算の配分を見直し、デジタル施策に重点を移すことを提案いたします。」",
          scenario: "四半期マーケティング報告会議。",
          explanationVi: "Người nói đề xuất 'Do phản ứng thị trường không tốt như dự kiến ban đầu, tôi đề xuất xem xét lại phân bổ ngân sách marketing và chuyển trọng tâm sang các giải pháp số'.",
          skillTag: "strategy-proposal",
          difficulty: "standard",
          options: opts(
            "マーケティング活動を全面停止する提案です。",
            "市場反応が悪いため予算配分をデジタルに移す提案です。",
            "デジタル施策の成果を報告しています。",
            "マーケティング予算の増額を要求しています。",
            "B"
          ),
        },
        {
          prompt: "「本件は法的リスクを伴う案件でございますので、顧問弁護士の見解を伺った上で最終判断を下したいと考えております。」",
          scenario: "取締役会での新規事業に関する議論。",
          explanationVi: "Người nói cho biết 'Vụ việc này có rủi ro pháp lý nên muốn nghe ý kiến luật sư cố vấn trước khi đưa ra quyết định cuối cùng'. Thể hiện sự thận trọng trong quyết định kinh doanh.",
          skillTag: "legal-risk-assessment",
          difficulty: "hard",
          options: opts(
            "法的問題が発生し、訴訟が始まっています。",
            "法的リスクがあるため、顧問弁護士の見解を得てから判断すると伝えています。",
            "顧問弁護士を解任すると発表しています。",
            "法的リスクはないと判断しています。",
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
          prompt: "会議の録音：「では、今期の海外売上について報告します。東南アジア市場は前年比15%増と好調でしたが、欧州市場は為替の影響もあり5%減となりました。総合すると、海外売上全体では前年比3%増です。来期は欧州市場のテコ入れ策として、現地代理店との連携強化を計画しています。」この報告の主な内容として正しいものはどれですか。",
          scenario: "経営報告会議の録音。海外事業部長が発表中。",
          explanationVi: "Báo cáo nêu: ĐNA tăng 15%, Châu Âu giảm 5% do tỷ giá, tổng thể tăng 3%. Kỳ tới sẽ tăng cường liên kết với đại lý địa phương ở Châu Âu.",
          skillTag: "report-comprehension",
          difficulty: "standard",
          options: opts(
            "海外売上が全地域で減少したという報告です。",
            "東南アジアは好調だが欧州は減少、全体では微増という報告です。",
            "欧州市場からの撤退を提案しています。",
            "来期の海外事業を縮小する計画を発表しています。",
            "B"
          ),
        },
        {
          prompt: "社内研修の講師：「コンプライアンス違反は個人の問題にとどまらず、企業全体の信用失墜につながります。特に内部通報制度の整備は、問題を早期に発見し、組織的な隠蔽を防ぐ上で不可欠です。皆さんには、疑問を感じた際には躊躇なく通報窓口を利用していただきたいと思います。」講師が最も伝えたいことは何ですか。",
          scenario: "全社コンプライアンス研修。講師がスライドを使って説明中。",
          explanationVi: "Giảng viên muốn truyền đạt: Vi phạm tuân thủ ảnh hưởng cả công ty, hệ thống tố giác nội bộ là cần thiết, và nhân viên nên sử dụng kênh tố giác khi có nghi vấn.",
          skillTag: "compliance-understanding",
          difficulty: "standard",
          options: opts(
            "コンプライアンス違反は個人の責任だけで済むということです。",
            "内部通報制度を躊躇なく利用することの重要性を伝えています。",
            "通報窓口の利用者が処分されると警告しています。",
            "コンプライアンス研修の受講は任意だと伝えています。",
            "B"
          ),
        },
        {
          prompt: "取引先との電話会議：「今回の仕様変更については、当初の契約範囲外となりますので、追加費用が発生いたします。概算で200万円程度を見込んでおりますが、正式な見積書は来週中にお送りいたします。なお、この変更により、全体のスケジュールも2週間ほど後ろ倒しになる見通しです。」この発言から分かることは何ですか。",
          scenario: "IT開発プロジェクトの進捗会議。ベンダー側が説明。",
          explanationVi: "Bên nhà cung cấp giải thích: Thay đổi thông số nằm ngoài phạm vi hợp đồng ban đầu, phát sinh thêm khoảng 200 vạn yên, báo giá chính thức tuần tới, lịch trình sẽ trễ 2 tuần.",
          skillTag: "change-management",
          difficulty: "hard",
          options: opts(
            "仕様変更は契約範囲内で追加費用なしです。",
            "仕様変更は契約範囲外で追加費用と遅延が発生します。",
            "プロジェクト全体が中止になります。",
            "見積書はすでに提出済みです。",
            "B"
          ),
        },
        {
          prompt: "新製品発表会のスピーチ：「弊社は創業以来、品質第一を掲げてまいりましたが、本製品においても妥協のない品質管理を徹底しております。独自開発の素材を採用し、従来品と比較して耐久性を40%向上させました。価格は従来品の1.2倍となりますが、ライフサイクルコストで考えれば十分にメリットを感じていただけるものと確信しております。」この発言の要点として正しいものはどれですか。",
          scenario: "新製品発表会場。開発部長がプレゼンテーション中。",
          explanationVi: "Phát biểu nhấn mạnh: chất lượng không thỏa hiệp, vật liệu tự phát triển, độ bền tăng 40%, giá gấp 1.2 lần nhưng xét chi phí vòng đời thì có lợi.",
          skillTag: "product-presentation",
          difficulty: "standard",
          options: opts(
            "従来品より安価で高品質な製品を発表しています。",
            "耐久性40%向上だが価格1.2倍、ライフサイクルコストでメリットがあると説明しています。",
            "従来品の生産を中止すると発表しています。",
            "品質問題により製品の回収を告知しています。",
            "B"
          ),
        },
        {
          prompt: "人事部の説明：「来年度より、テレワーク制度を正式に導入いたします。週3日までの在宅勤務が可能となりますが、チームミーティングのある日は出社を原則といたします。また、在宅勤務手当として月額5,000円を支給いたします。詳細は来月配布予定の就業規則改定版をご確認ください。」この制度について正しい説明はどれですか。",
          scenario: "全社説明会。人事部がスライドで新制度を説明中。",
          explanationVi: "Chế độ mới: làm việc từ xa tối đa 3 ngày/tuần, ngày họp nhóm phải đến công ty, phụ cấp 5000 yên/tháng, chi tiết trong bản sửa đổi quy chế tháng tới.",
          skillTag: "policy-comprehension",
          difficulty: "easy",
          options: opts(
            "完全在宅勤務が認められます。",
            "週3日まで在宅可能で、会議日は出社、月5,000円手当支給です。",
            "テレワークは管理職のみが対象です。",
            "在宅勤務手当は支給されません。",
            "B"
          ),
        },
        {
          prompt: "経営コンサルタントの提言：「御社の課題は、意思決定のスピードにあると考えます。現在、承認プロセスに平均10日かかっていますが、競合他社は3日で意思決定しています。権限委譲を進め、部長決裁で完結する範囲を拡大することを提案します。ただし、ガバナンスを維持するため、事後報告制度を併せて整備する必要があります。」コンサルタントの提案の核心は何ですか。",
          scenario: "経営改革ミーティング。外部コンサルタントが報告書を説明中。",
          explanationVi: "Tư vấn đề xuất: Vấn đề là tốc độ quyết định (10 ngày vs đối thủ 3 ngày). Giải pháp: mở rộng phân quyền cho trưởng phòng, kèm hệ thống báo cáo sau để duy trì quản trị.",
          skillTag: "consulting-comprehension",
          difficulty: "hard",
          options: opts(
            "承認プロセスをすべて廃止することです。",
            "権限委譲を進めて意思決定を速くし、事後報告でガバナンスを維持することです。",
            "すべての決定を社長決裁にすることです。",
            "競合他社の意思決定プロセスをそのまま導入することです。",
            "B"
          ),
        },
        {
          prompt: "労働組合の代表：「今回の賃上げ交渉において、我々はベースアップ3%を要求しておりますが、経営側は1.5%の回答にとどまっています。物価上昇率が2.8%である現状を踏まえると、実質的な賃金低下を意味します。次回の交渉では、少なくとも物価上昇率に見合う水準への引き上げを強く求めてまいります。」この発言から分かる状況はどれですか。",
          scenario: "労使交渉の報告会。組合代表が組合員に説明中。",
          explanationVi: "Đại diện công đoàn báo cáo: yêu cầu tăng lương cơ bản 3%, ban giám đốc chỉ đáp ứng 1.5%, trong khi lạm phát 2.8% tức lương thực tế giảm. Lần tới sẽ yêu cầu ít nhất bằng tốc độ lạm phát.",
          skillTag: "labor-negotiation",
          difficulty: "hard",
          options: opts(
            "経営側が3%の賃上げに合意しました。",
            "組合は3%要求に対し経営側は1.5%回答で、物価上昇率を下回る状況です。",
            "組合がストライキを開始すると宣言しています。",
            "賃上げ交渉が妥結したと報告しています。",
            "B"
          ),
        },
        {
          prompt: "取締役会での発言：「M&Aの対象企業について、デューデリジェンスの結果を報告します。財務面では問題ありませんが、知的財産権に関して複数の係争案件が確認されました。買収価格の再交渉、または条件付き買収（エスクロー口座の設定）を検討すべきと判断いたします。」この報告の結論として正しいものはどれですか。",
          scenario: "取締役会でM&A担当役員が報告中。",
          explanationVi: "Báo cáo kết quả thẩm định: tài chính không vấn đề, nhưng có nhiều tranh chấp sở hữu trí tuệ. Đề xuất đàm phán lại giá hoặc mua có điều kiện (tài khoản ký quỹ).",
          skillTag: "ma-due-diligence",
          difficulty: "hard",
          options: opts(
            "買収を中止すべきだと報告しています。",
            "財務は問題ないが知財リスクがあり、価格再交渉か条件付き買収を提案しています。",
            "買収を即座に実行すべきだと報告しています。",
            "対象企業の財務に重大な問題があると報告しています。",
            "B"
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
          prompt: "画面に表示されたメール：「件名：契約更新のご確認　本文：山本様、現行契約の満了日が来月15日に迫っております。更新条件について変更がある場合は、今月末までにお知らせください。ご連絡がない場合は、現行条件で自動更新とさせていただきます。」音声：「山本さん、このメール見た？契約条件、来期から支払いサイトを60日から45日に変更してもらいたいんだけど、今月中に返事しないとそのまま更新されちゃうよ。」山本さんが取るべき行動は何ですか。",
          scenario: "オフィスで上司が山本さんにメールの対応を指示。",
          explanationVi: "Thượng cấp muốn thay đổi điều kiện thanh toán từ 60 ngày sang 45 ngày. Nếu không phản hồi trong tháng này thì tự động gia hạn theo điều kiện cũ. Vậy cần liên lạc sớm.",
          skillTag: "contract-management",
          difficulty: "standard",
          options: opts(
            "来月15日まで何もしない。",
            "今月末までに支払いサイト変更の連絡をする。",
            "契約を解除する連絡をする。",
            "自動更新されるのを待つ。",
            "B"
          ),
        },
        {
          prompt: "画面に表示された組織図：営業本部の下に「第一営業部」「第二営業部」「海外営業部」がある。音声：「来月の組織改編で、第一営業部と第二営業部を統合して『国内営業部』にします。海外営業部はそのままですが、名称を『グローバル事業部』に変更します。統合後の国内営業部長は現第一営業部長の佐藤さんが就任予定です。」改編後の組織として正しいものはどれですか。",
          scenario: "人事部からの組織改編説明会。",
          explanationVi: "Sau cải tổ: Phòng kinh doanh 1 + 2 sáp nhập thành 'Phòng kinh doanh nội địa' (trưởng phòng Sato). Phòng kinh doanh quốc tế đổi tên thành 'Bộ phận kinh doanh toàn cầu'.",
          skillTag: "organizational-comprehension",
          difficulty: "standard",
          options: opts(
            "営業本部の下に「国内営業部」と「グローバル事業部」の2部門になる。",
            "営業本部の下に3部門がそのまま残る。",
            "海外営業部が廃止される。",
            "第二営業部長が統合後の部長に就任する。",
            "A"
          ),
        },
        {
          prompt: "画面に表示された出張精算規程の抜粋：「日当：国内出張5,000円/日、海外出張10,000円/日。宿泊費上限：国内15,000円/泊、海外25,000円/泊。超過分は事前承認必要。」音声：「田中さん、来週のシンガポール出張3泊4日の精算書なんだけど、ホテル代が1泊28,000円になってるよ。規程では25,000円が上限だから、超過分の3,000円×3泊分は事前承認取ってないと自己負担になるけど、承認書ある？」田中さんの状況として正しいものはどれですか。",
          scenario: "経理部で出張精算の確認中。",
          explanationVi: "Quy định: khách sạn nước ngoài tối đa 25,000 yên/đêm. Tanaka ở 28,000 yên/đêm x 3 đêm. Phần vượt 3,000 yên x 3 = 9,000 yên cần có phê duyệt trước, không thì tự trả.",
          skillTag: "expense-policy",
          difficulty: "standard",
          options: opts(
            "宿泊費が規程内なので問題ない。",
            "1泊3,000円×3泊分の超過があり、事前承認がないと自己負担になる。",
            "日当の金額が間違っている。",
            "出張自体が承認されていない。",
            "B"
          ),
        },
        {
          prompt: "画面に表示されたプロジェクト進捗表：タスクA（完了）、タスクB（進行中・遅延2日）、タスクC（未着手・Bの完了待ち）、タスクD（進行中・予定通り）。音声：「今のままだとタスクBの遅れがタスクCに波及して、最終納期に影響が出ます。タスクBに追加リソースを投入するか、タスクCの作業範囲を縮小するか、どちらかで対応する必要があります。」正しい状況理解はどれですか。",
          scenario: "週次プロジェクト進捗会議。PM が説明中。",
          explanationVi: "Task B trễ 2 ngày, Task C phụ thuộc vào B nên cũng sẽ trễ. Cần tăng nguồn lực cho B hoặc giảm phạm vi C để không ảnh hưởng deadline cuối.",
          skillTag: "project-management",
          difficulty: "standard",
          options: opts(
            "すべてのタスクが予定通りに進んでいる。",
            "タスクBの遅延がCに波及し、追加リソースか範囲縮小の対応が必要。",
            "タスクDが遅延の原因になっている。",
            "タスクAをやり直す必要がある。",
            "B"
          ),
        },
        {
          prompt: "画面に表示された取引先からの書面：「貴社製品型番X-200について、先月の出荷分のうち5%に規格外の不良が確認されました。原因究明と対策報告を2週間以内に求めます。なお、次回出荷分については品質確認完了まで受入を保留いたします。」音声：「品質管理部の鈴木さん、この件すぐ対応してほしい。まず不良の原因を特定して、2週間以内に報告書を作成。それから出荷再開の条件を先方と詰めて。」鈴木さんが対応すべき事項として正しいものはどれですか。",
          scenario: "品質管理部のオフィス。部長が鈴木さんに対応を指示。",
          explanationVi: "Suzuki cần: (1) xác định nguyên nhân lỗi, (2) viết báo cáo trong 2 tuần, (3) thương lượng điều kiện tái xuất hàng với đối tác.",
          skillTag: "quality-management",
          difficulty: "hard",
          options: opts(
            "不良品を廃棄するだけでよい。",
            "原因特定、2週間以内の報告書作成、出荷再開条件の交渉が必要。",
            "取引先に謝罪の電話をするだけでよい。",
            "製品の生産を全面停止する。",
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
          prompt: "【資料】四半期売上比較表：\n第1Q: 国内8,500万円、海外3,200万円\n第2Q: 国内9,100万円、海外2,800万円\n第3Q: 国内8,800万円、海外3,500万円\n第4Q: 国内9,500万円、海外4,100万円\n\n音声：「この表を見ると、国内は安定的に推移していますが、海外は第2Qに一度落ち込んだ後、回復傾向にありますね。特に第4Qの海外売上は過去最高を記録しています。」資料と音声から正しいものはどれですか。",
          scenario: "年度末の売上報告ミーティング。",
          explanationVi: "Nội địa ổn định (8500→9100→8800→9500). Quốc tế giảm Q2 (2800) rồi phục hồi, Q4 đạt cao nhất (4100).",
          skillTag: "data-analysis",
          difficulty: "standard",
          options: opts(
            "海外売上は年間を通じて減少し続けています。",
            "海外は第2Qに落ち込んだ後回復し、第4Qが過去最高です。",
            "国内売上は大きく変動しています。",
            "第3Qの海外売上が最も高いです。",
            "B"
          ),
        },
        {
          prompt: "【資料】新規事業投資計画書：\n投資額：2億円\n回収期間：3年（予定）\n年間見込み売上：1億2,000万円（3年目以降）\n損益分岐点：年間売上8,000万円\n主なリスク：技術変化、競合参入、規制変更\n\n音声：「この計画で気になるのは、損益分岐点が8,000万円で、3年目の見込み売上が1億2,000万円ということは、余裕が4,000万円しかありません。リスク要因を考慮すると、もう少し保守的なシナリオも検討すべきではないでしょうか。」発言者の主な懸念は何ですか。",
          scenario: "投資審査委員会。委員が質問中。",
          explanationVi: "Người phát biểu lo ngại: doanh thu dự kiến 12000 vạn - điểm hòa vốn 8000 vạn = chênh lệch chỉ 4000 vạn, xét rủi ro thì cần xem xét kịch bản thận trọng hơn.",
          skillTag: "investment-analysis",
          difficulty: "hard",
          options: opts(
            "投資額が大きすぎることです。",
            "損益分岐点と見込み売上の差が小さく、リスクに対する余裕が不十分なことです。",
            "回収期間が長すぎることです。",
            "技術的に実現不可能だと指摘しています。",
            "B"
          ),
        },
        {
          prompt: "【資料】従業員満足度調査結果：\n総合満足度：3.2/5.0（前年3.5）\n項目別：給与 2.8、福利厚生 3.5、人間関係 3.8、成長機会 2.5、ワークライフバランス 3.0\n自由回答（抜粋）：「キャリアパスが不明確」「研修機会が少ない」「残業が多い」\n\n音声：「総合満足度が0.3ポイント下がっています。特に『成長機会』が2.5と最も低く、自由回答でもキャリアや研修に関する不満が目立ちます。離職率上昇との相関も見られますので、人材開発プログラムの拡充を優先施策として提案します。」最も優先すべき施策はどれですか。",
          scenario: "人事部の年次レビュー会議。",
          explanationVi: "Điểm thấp nhất là 'cơ hội phát triển' (2.5), ý kiến tự do cũng nêu thiếu đào tạo và lộ trình sự nghiệp không rõ. Đề xuất ưu tiên mở rộng chương trình phát triển nhân sự.",
          skillTag: "hr-analysis",
          difficulty: "standard",
          options: opts(
            "給与の引き上げです。",
            "人材開発プログラムの拡充です。",
            "福利厚生の改善です。",
            "オフィス環境の整備です。",
            "B"
          ),
        },
        {
          prompt: "【資料】貿易書類（インボイス）：\n輸出者：株式会社ABC（東京）\n輸入者：XYZ Trading Co.（バンコク）\n品目：工業用精密部品　型番P-5500\n数量：2,000個\n単価：USD 45.00\n総額：USD 90,000\n貿易条件：CIF Bangkok\n支払条件：L/C at sight\n\n音声：「このインボイスなんですが、先方から『数量を3,000個に変更したい』と連絡がありました。L/Cの金額変更が必要になりますので、銀行にアメンドの手続きをお願いしてください。新しい総額はUSD 135,000になります。」対応として必要な手続きは何ですか。",
          scenario: "貿易部のオフィス。上司が担当者に指示。",
          explanationVi: "Đối tác muốn tăng số lượng từ 2000 lên 3000, tổng từ 90,000 USD lên 135,000 USD. Cần yêu cầu ngân hàng sửa đổi (amend) L/C.",
          skillTag: "trade-documentation",
          difficulty: "hard",
          options: opts(
            "新しいインボイスを作成するだけでよい。",
            "L/Cの金額変更（アメンド）の手続きを銀行に依頼する。",
            "支払条件をT/Tに変更する。",
            "輸出を中止する手続きをする。",
            "B"
          ),
        },
        {
          prompt: "【資料】社内規程（抜粋）：\n「決裁権限規程 第5条：以下の金額区分に従い決裁権限を定める。\n100万円未満：課長決裁\n100万円以上500万円未満：部長決裁\n500万円以上1,000万円未満：本部長決裁\n1,000万円以上：取締役会決議」\n\n音声：「今回のシステム改修費が見積もりで780万円来ているんだけど、これだと本部長決裁が必要だね。ただ、年度内に完了させたいから、来週の本部長面談で説明できるように資料を整えておいて。」この案件の決裁に必要な手続きはどれですか。",
          scenario: "IT部門のオフィス。課長が担当者に指示中。",
          explanationVi: "Chi phí 780 vạn yên thuộc phạm vi 500-1000 vạn yên → cần phê duyệt của bản bộ trưởng (本部長). Cần chuẩn bị tài liệu cho cuộc họp tuần tới.",
          skillTag: "approval-process",
          difficulty: "standard",
          options: opts(
            "課長の決裁で承認できる。",
            "本部長の決裁が必要で、来週の面談で説明する。",
            "取締役会の決議が必要。",
            "部長の決裁で十分である。",
            "B"
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
          prompt: "【資料1】取引先A社からのメール：「貴社との基本契約について、来期より支払条件を「月末締め翌月末払い」から「月末締め翌々月末払い」に変更をお願いしたく存じます。」\n【資料2】社内方針：「支払サイト延長要請への対応：原則として応じない。ただし、年間取引額5億円以上の重要顧客については、与信審査の上、個別対応可。」\n\n音声：「A社との年間取引額を確認したところ6億2,000万円でした。与信情報にも問題はありません。ただし、当社のキャッシュフローへの影響も考慮し、段階的な移行を提案してはどうでしょうか。」最も適切な対応はどれですか。",
          scenario: "営業部と経理部の合同会議。A社の支払条件変更について協議中。",
          explanationVi: "A社 muốn kéo dài thời hạn thanh toán. Doanh thu 6.2 tỷ yên > 5 tỷ yên (tiêu chuẩn), tín dụng OK. Đề xuất chuyển đổi từng bước để giảm ảnh hưởng dòng tiền.",
          skillTag: "payment-negotiation",
          difficulty: "hard",
          options: opts(
            "原則通り、A社の要請を拒否する。",
            "A社は重要顧客の基準を満たすため、段階的移行を提案する。",
            "全面的にA社の要請を受け入れる。",
            "A社との取引を縮小する。",
            "B"
          ),
        },
        {
          prompt: "【資料1】競合分析レポート：「競合B社が当社主力製品と同等性能の製品を20%安い価格で発売。市場シェア：当社35%→30%に低下。」\n【資料2】顧客アンケート結果：「当社製品の優位点：アフターサービス(85%)、信頼性(78%)、技術サポート(72%)。改善要望：価格(65%)、納期(45%)。」\n\n音声：「単純な値下げ競争に入ると利益率が大幅に悪化します。むしろ、顧客が評価しているサービス面を強化し、保守契約を含めたトータルコストで訴求する戦略に切り替えるべきだと考えます。」提案されている戦略はどれですか。",
          scenario: "経営戦略会議。マーケティング部長が提案中。",
          explanationVi: "Không cạnh tranh giá (sẽ giảm lợi nhuận). Thay vào đó, tăng cường dịch vụ hậu mãi (điểm mạnh được khách đánh giá cao) và bán theo tổng chi phí bao gồm hợp đồng bảo trì.",
          skillTag: "competitive-strategy",
          difficulty: "hard",
          options: opts(
            "競合と同じ価格に値下げする戦略です。",
            "サービス面を強化し、保守契約含むトータルコストで訴求する戦略です。",
            "市場から撤退する戦略です。",
            "製品の性能を大幅に向上させる戦略です。",
            "B"
          ),
        },
        {
          prompt: "【資料1】社内メモ：「来期の新卒採用計画：営業職15名、技術職20名、管理部門5名。合計40名。」\n【資料2】直近の離職率データ：「入社3年以内離職率：営業職40%、技術職15%、管理部門10%。」\n\n音声：「採用計画を見ると営業が15名ですが、離職率40%を考えると3年後には9名しか残らない計算です。そもそも定着率を改善しない限り、採用を増やしても根本的な解決にはなりません。OJT制度の見直しとメンター制度の導入を先に検討すべきです。」発言者が最も重視していることは何ですか。",
          scenario: "人事部と各部門長の採用戦略会議。",
          explanationVi: "Người phát biểu nhấn mạnh: nếu tỷ lệ nghỉ việc 40% thì 3 năm sau chỉ còn 9/15 người. Cần cải thiện tỷ lệ ở lại trước (sửa OJT, thêm mentor) thay vì chỉ tăng tuyển dụng.",
          skillTag: "retention-strategy",
          difficulty: "standard",
          options: opts(
            "営業職の採用人数を増やすことです。",
            "採用増より先に離職率を下げる施策（OJT見直し・メンター制度）を優先することです。",
            "営業職の採用を中止することです。",
            "技術職の離職率改善です。",
            "B"
          ),
        },
        {
          prompt: "【資料1】海外拠点月次報告：「ベトナム工場：稼働率95%、不良率0.8%、人件費前年比+12%」\n【資料2】本社方針：「海外拠点は稼働率90%以上維持、不良率1%以下、人件費上昇は年10%以内を目標」\n\n音声：「ベトナム工場は稼働率・不良率ともに目標をクリアしていますが、人件費上昇が12%と目標の10%を超えています。現地の最低賃金引き上げの影響ですが、このトレンドが続くと3年後には当初の投資回収計算が崩れます。自動化投資の前倒しを検討すべき時期に来ています。」報告者が提起している課題は何ですか。",
          scenario: "海外事業本部の月次レビュー。",
          explanationVi: "Nhà máy VN đạt mục tiêu vận hành và tỷ lệ lỗi, nhưng nhân công tăng 12% > mục tiêu 10%. Nếu tiếp tục sẽ phá vỡ tính toán hoàn vốn. Đề xuất đẩy nhanh đầu tư tự động hóa.",
          skillTag: "overseas-operations",
          difficulty: "hard",
          options: opts(
            "ベトナム工場の品質問題です。",
            "人件費上昇が目標超過し、投資回収に影響するため自動化前倒しが必要です。",
            "稼働率が目標を下回っていることです。",
            "ベトナム工場の閉鎖を提案しています。",
            "B"
          ),
        },
        {
          prompt: "【資料1】事業計画書：「新規ECサイト立ち上げ。初期投資3,000万円。月間目標売上：半年後500万円、1年後1,500万円、2年後3,000万円。」\n【資料2】実績報告（6か月経過）：「月間売上：280万円。会員登録数：計画比60%。リピート率：8%（目標15%）」\n\n音声：「半年経過時点で売上が計画の56%、会員数60%、リピート率が目標の半分程度です。特にリピート率の低さが問題です。新規獲得に予算を使い続けるよりも、既存会員のLTV向上施策、具体的にはポイント制度やレコメンド機能の強化に予算を振り向けるべきだと考えます。」提案の核心はどれですか。",
          scenario: "EC事業の半期レビュー会議。",
          explanationVi: "Kết quả 6 tháng kém kế hoạch, đặc biệt tỷ lệ mua lại thấp (8% vs mục tiêu 15%). Đề xuất chuyển ngân sách từ thu hút khách mới sang nâng LTV khách hiện tại (điểm thưởng, gợi ý sản phẩm).",
          skillTag: "ecommerce-strategy",
          difficulty: "standard",
          options: opts(
            "ECサイトを閉鎖すべきだという提案です。",
            "新規獲得よりリピート率向上（LTV施策）に予算を移すべきという提案です。",
            "初期投資を追加で3,000万円増やすべきという提案です。",
            "計画通りに進んでいるので変更不要という報告です。",
            "B"
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
          prompt: "市場環境の変化（　　）、当社の事業戦略を抜本的に見直す必要がある。",
          scenario: null,
          explanationVi: "「に伴い」= kèm theo, đi kèm với. Dùng khi một sự thay đổi dẫn đến hệ quả khác. 'Do thay đổi môi trường thị trường, cần xem xét lại chiến lược kinh doanh'.",
          skillTag: "grammar-ni-tomonai",
          difficulty: "standard",
          options: opts(
            "に伴い",
            "にもかかわらず",
            "に反して",
            "に先立ち",
            "A"
          ),
        },
        {
          prompt: "前回の調査結果（　　）、新たな改善策を策定いたしました。",
          scenario: null,
          explanationVi: "「を踏まえて」= dựa trên, căn cứ vào. 'Dựa trên kết quả khảo sát lần trước, đã xây dựng biện pháp cải thiện mới'.",
          skillTag: "grammar-wo-fumaete",
          difficulty: "standard",
          options: opts(
            "をめぐって",
            "を踏まえて",
            "をもって",
            "を問わず",
            "B"
          ),
        },
        {
          prompt: "本規約（　　）、個人情報の取り扱いについて以下の通り定める。",
          scenario: null,
          explanationVi: "「に基づき」= dựa theo, căn cứ theo (quy định/luật). 'Căn cứ theo quy ước này, quy định về xử lý thông tin cá nhân như sau'.",
          skillTag: "grammar-ni-motozuki",
          difficulty: "easy",
          options: opts(
            "に際して",
            "に応じて",
            "に基づき",
            "にわたり",
            "C"
          ),
        },
        {
          prompt: "社長が本日の会議に（　　）のは、海外出張中のためです。",
          scenario: null,
          explanationVi: "「ご欠席になる」là tôn kính ngữ (尊敬語) của「欠席する」. 'Việc giám đốc vắng mặt tại cuộc họp hôm nay là do đang đi công tác nước ngoài'.",
          skillTag: "keigo-sonkeigo",
          difficulty: "standard",
          options: opts(
            "欠席される",
            "ご欠席になる",
            "欠席いたす",
            "欠席なさる",
            "B"
          ),
        },
        {
          prompt: "弊社の新製品について、ぜひ一度ご（　　）いただければ幸いです。",
          scenario: null,
          explanationVi: "「ご検討いただく」là kính ngữ khiêm nhường (謙譲語) biểu thị sự nhờ vả lịch sự. 'Nếu quý vị có thể xem xét sản phẩm mới của chúng tôi thì thật vinh hạnh'.",
          skillTag: "keigo-kenjougo",
          difficulty: "easy",
          options: opts(
            "検討して",
            "検討",
            "検討なさ",
            "検討され",
            "B"
          ),
        },
        {
          prompt: "度重なるご迷惑をおかけしましたこと、心より（　　）申し上げます。",
          scenario: null,
          explanationVi: "「お詫び申し上げます」là cách xin lỗi rất trang trọng trong kinh doanh. 'Xin chân thành xin lỗi về việc đã gây phiền phức nhiều lần'.",
          skillTag: "formal-apology",
          difficulty: "easy",
          options: opts(
            "お祝い",
            "お見舞い",
            "お詫び",
            "お喜び",
            "C"
          ),
        },
        {
          prompt: "新規参入企業の増加（　　）、価格競争が一層激化している。",
          scenario: null,
          explanationVi: "「に伴い」= kèm theo. 'Kèm theo sự gia tăng doanh nghiệp mới tham gia, cạnh tranh giá ngày càng gay gắt'.",
          skillTag: "grammar-ni-tomonai",
          difficulty: "standard",
          options: opts(
            "にもかかわらず",
            "に伴い",
            "に先立ち",
            "に至り",
            "B"
          ),
        },
        {
          prompt: "契約締結（　　）、双方の法務部門による最終確認を行うものとする。",
          scenario: null,
          explanationVi: "「に先立ち」= trước khi. 'Trước khi ký kết hợp đồng, bộ phận pháp chế hai bên sẽ tiến hành xác nhận cuối cùng'.",
          skillTag: "grammar-ni-sakidachi",
          difficulty: "standard",
          options: opts(
            "に先立ち",
            "に際して",
            "に至り",
            "に伴い",
            "A"
          ),
        },
        {
          prompt: "この件については、部長に直接（　　）のがよろしいかと思います。",
          scenario: null,
          explanationVi: "「お伺いする」là kính ngữ khiêm nhường của「聞く」. 'Về việc này, tôi nghĩ nên hỏi trực tiếp trưởng phòng'.",
          skillTag: "keigo-kenjougo",
          difficulty: "standard",
          options: opts(
            "聞かれる",
            "お聞きする",
            "お伺いする",
            "聞いてあげる",
            "C"
          ),
        },
        {
          prompt: "経済のグローバル化が進む（　　）、異文化理解の重要性が高まっている。",
          scenario: null,
          explanationVi: "「につれて」= theo đà, cùng với việc. 'Theo đà toàn cầu hóa kinh tế tiến triển, tầm quan trọng của hiểu biết đa văn hóa ngày càng tăng'.",
          skillTag: "grammar-ni-tsurete",
          difficulty: "standard",
          options: opts(
            "につれて",
            "に関して",
            "に対して",
            "について",
            "A"
          ),
        },
        {
          prompt: "いかなる理由（　　）、契約期間中の一方的な解約は認められない。",
          scenario: null,
          explanationVi: "「であれ」(=であっても)= dù là...đi nữa. 'Dù với lý do gì đi nữa, việc đơn phương hủy hợp đồng trong thời hạn là không được chấp nhận'.",
          skillTag: "grammar-deare",
          difficulty: "hard",
          options: opts(
            "であれ",
            "であり",
            "であると",
            "であるが",
            "A"
          ),
        },
        {
          prompt: "お忙しいところ（　　）が、ご署名をお願いできますでしょうか。",
          scenario: null,
          explanationVi: "「恐れ入ります」= xin lỗi đã làm phiền (rất lịch sự). 'Biết ngài bận, xin lỗi nhưng có thể nhờ ký tên được không ạ?'",
          skillTag: "polite-expression",
          difficulty: "easy",
          options: opts(
            "すみません",
            "恐れ入ります",
            "失礼します",
            "ごめんなさい",
            "B"
          ),
        },
        {
          prompt: "本サービスは、利用規約に同意した者（　　）利用可能とする。",
          scenario: null,
          explanationVi: "「に限り」= chỉ giới hạn cho. 'Dịch vụ này chỉ có thể sử dụng bởi người đã đồng ý điều khoản sử dụng'.",
          skillTag: "grammar-ni-kagiri",
          difficulty: "standard",
          options: opts(
            "に限り",
            "に際し",
            "に応じ",
            "に伴い",
            "A"
          ),
        },
        {
          prompt: "景気回復の兆しが見え始めた（　　）、依然として予断を許さない状況である。",
          scenario: null,
          explanationVi: "「とはいえ」= tuy nhiên, mặc dù vậy. 'Mặc dù đã bắt đầu thấy dấu hiệu phục hồi kinh tế, tình hình vẫn chưa thể lạc quan'.",
          skillTag: "grammar-tohaie",
          difficulty: "hard",
          options: opts(
            "とはいえ",
            "としても",
            "とすれば",
            "となると",
            "A"
          ),
        },
        {
          prompt: "当プロジェクトの成否は、関係各部署の連携（　　）と言っても過言ではない。",
          scenario: null,
          explanationVi: "「いかんにかかっている」= tùy thuộc vào. 'Có thể nói không quá rằng thành bại dự án phụ thuộc vào sự phối hợp của các phòng ban liên quan'.",
          skillTag: "grammar-ikan",
          difficulty: "hard",
          options: opts(
            "次第だ",
            "いかんにかかっている",
            "のみだ",
            "しだいだ",
            "B"
          ),
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
          prompt: "次のメールを読んで、差出人の意図として最も適切なものを選びなさい。\n\n「件名：納期のご相談\n\n平素よりお世話になっております。\nご発注いただいた型番R-300の件でご連絡いたします。\n当初の納期3月15日に向けて製造を進めておりましたが、一部原材料の調達に想定以上の時間を要しており、現時点で5営業日程度の遅延が見込まれます。\n大変恐縮ではございますが、納期を3月22日に変更させていただくことは可能でしょうか。\n代替案として、数量の一部（70%）を3月15日に先行納品し、残り30%を3月22日に追加納品する分納も可能でございます。\nご検討のほど、何卒よろしくお願い申し上げます。」",
          scenario: null,
          explanationVi: "Người gửi thông báo chậm trễ 5 ngày do nguyên liệu, đề xuất 2 phương án: hoãn toàn bộ đến 22/3 hoặc giao 70% đúng hạn 15/3 + 30% ngày 22/3.",
          skillTag: "email-intent",
          difficulty: "standard",
          options: opts(
            "納品を全面的にキャンセルしたいと伝えています。",
            "納期遅延を報告し、全量遅延か分納の2案から選択を求めています。",
            "原材料費の値上げを通知しています。",
            "追加注文を依頼しています。",
            "B"
          ),
        },
        {
          prompt: "次の社内通知を読んで、社員が対応すべきことを選びなさい。\n\n「情報セキュリティに関する重要なお知らせ\n\n全社員各位\n\nこのたび、社内システムへの不正アクセスの試みが検知されました。現時点で情報漏洩は確認されておりませんが、予防措置として以下を実施してください。\n1. 本日中にパスワードを変更すること（12文字以上、英数字記号混在）\n2. 不審なメールを受信した場合は開封せず、IT部門に転送すること\n3. 個人端末からの業務システムへのアクセスを一時停止すること\n\nなお、本件の詳細は調査完了後に改めてご報告いたします。」",
          scenario: null,
          explanationVi: "Thông báo: phát hiện cố gắng truy cập trái phép, chưa rò rỉ dữ liệu. Cần làm: (1) đổi mật khẩu hôm nay, (2) chuyển email đáng ngờ cho IT, (3) tạm dừng truy cập từ thiết bị cá nhân.",
          skillTag: "security-notice",
          difficulty: "standard",
          options: opts(
            "情報漏洩が発生したため、業務を全面停止する。",
            "パスワード変更、不審メールの報告、個人端末アクセス停止を行う。",
            "全社員がIT部門に出向いて対面で報告する。",
            "調査完了まで通常通り業務を続ける。",
            "B"
          ),
        },
        {
          prompt: "次の取引先への書面を読んで、その目的として最も適切なものを選びなさい。\n\n「拝啓　時下ますますご清栄のこととお喜び申し上げます。\nさて、弊社では来年度よりサステナビリティ方針を強化し、サプライチェーン全体での環境負荷低減に取り組んでまいります。つきましては、貴社におかれましても、以下の事項についてご協力を賜りたく存じます。\n1. 温室効果ガス排出量の年次報告\n2. 環境マネジメントシステム（ISO14001等）の認証取得への取り組み\n3. 梱包材のリサイクル素材比率50%以上の達成\nご負担をおかけいたしますが、持続可能な社会の実現に向け、何卒ご理解とご協力をお願い申し上げます。　敬具」",
          scenario: null,
          explanationVi: "Thư yêu cầu đối tác hợp tác về bền vững: (1) báo cáo khí thải, (2) lấy chứng nhận ISO14001, (3) tỷ lệ vật liệu tái chế bao bì 50%+.",
          skillTag: "formal-correspondence",
          difficulty: "hard",
          options: opts(
            "取引先に環境違反を通告しています。",
            "サプライチェーンの環境対策への協力を求めています。",
            "取引条件の変更を通知しています。",
            "環境認証の取得完了を報告しています。",
            "B"
          ),
        },
        {
          prompt: "次の社内報の記事を読んで、筆者が伝えたい主旨を選びなさい。\n\n「ダイバーシティ推進室だより\n\n当社の女性管理職比率は現在12%で、業界平均の18%を下回っています。しかし、数値目標の達成だけを目的化してはなりません。重要なのは、性別に関わらず実力と成果に基づいて公正に評価される仕組みを整えることです。今後は、無意識バイアス研修の全管理職受講義務化、育児・介護との両立支援策の拡充、メンタリングプログラムの導入を進めてまいります。」",
          scenario: null,
          explanationVi: "Bài viết nhấn mạnh: tỷ lệ nữ quản lý 12% < trung bình ngành 18%, nhưng quan trọng không phải con số mà là hệ thống đánh giá công bằng. Sẽ triển khai: đào tạo thiên kiến vô thức, hỗ trợ cân bằng, chương trình cố vấn.",
          skillTag: "diversity-policy",
          difficulty: "standard",
          options: opts(
            "女性管理職比率の数値目標達成のみを最優先すべきだと主張しています。",
            "数値だけでなく公正な評価制度の構築が本質であると伝えています。",
            "ダイバーシティ推進を中止すべきだと提言しています。",
            "業界平均を達成したと報告しています。",
            "B"
          ),
        },
        {
          prompt: "次の契約書の一条項を読んで、その意味として正しいものを選びなさい。\n\n「第12条（秘密保持義務）\n甲及び乙は、本契約の履行に関して知り得た相手方の技術上又は営業上の情報であって、相手方が秘密である旨を書面で指定したものを、第三者に開示又は漏洩してはならない。ただし、以下の各号に該当する場合はこの限りではない。\n(1) 開示を受けた時点で既に公知であったもの\n(2) 開示を受けた後、自己の責めに帰すべからざる事由により公知となったもの\n(3) 法令又は裁判所の命令に基づき開示が求められたもの」",
          scenario: null,
          explanationVi: "Điều khoản bảo mật: hai bên không được tiết lộ thông tin được chỉ định bằng văn bản là bí mật. Ngoại trừ: đã công khai, trở thành công khai không do lỗi mình, hoặc theo yêu cầu pháp luật/tòa án.",
          skillTag: "contract-language",
          difficulty: "hard",
          options: opts(
            "すべての情報が秘密保持の対象です。",
            "書面で秘密指定された情報は第三者に開示不可、ただし既知情報や法的要求は例外です。",
            "秘密情報は5年後に自動的に公開されます。",
            "口頭で伝えた情報も秘密保持の対象です。",
            "B"
          ),
        },
        {
          prompt: "次の社長メッセージを読んで、その趣旨として最も適切なものを選びなさい。\n\n「社員の皆さんへ\n\n今期、当社は創業以来最大の赤字を計上しました。しかし、この困難を乗り越えられないとは考えておりません。過去にも当社は幾多の危機を経験し、そのたびに自らを変革して成長してまいりました。今回も全社一丸となって構造改革に取り組み、来期中の黒字転換を必ず実現いたします。短期的には痛みを伴う施策もございますが、中長期的な成長基盤を築くための投資と捉えていただきたいと存じます。」",
          scenario: null,
          explanationVi: "Tổng giám đốc thừa nhận lỗ lớn nhất lịch sử nhưng tin tưởng sẽ vượt qua, nhấn mạnh đoàn kết cải cách để chuyển lãi kỳ tới, biện pháp ngắn hạn có đau nhưng là nền tảng dài hạn.",
          skillTag: "leadership-message",
          difficulty: "standard",
          options: opts(
            "会社を清算すると発表しています。",
            "最大の赤字を認めつつ、構造改革で来期黒字転換を目指すと表明しています。",
            "全社員の給与カットを通告しています。",
            "赤字の責任を取って辞任すると発表しています。",
            "B"
          ),
        },
        {
          prompt: "次の報告書の文章を読んで、筆者の立場として正しいものを選びなさい。\n\n「AI導入による業務効率化の効果は否定できないものの、現段階では以下の課題を解決しない限り全社展開は時期尚早であると考える。第一に、個人情報保護に関する社内ガイドラインが未整備である。第二に、AIの判断結果に対する最終責任の所在が不明確である。第三に、導入コストに見合うROIが実証されていない。段階的な試験運用と、上記課題への対応を並行して進めることを提案する。」",
          scenario: null,
          explanationVi: "Tác giả thừa nhận lợi ích AI nhưng cho rằng triển khai toàn công ty còn sớm do: (1) thiếu hướng dẫn bảo vệ dữ liệu, (2) trách nhiệm không rõ, (3) ROI chưa chứng minh. Đề xuất thử nghiệm từng bước.",
          skillTag: "critical-analysis",
          difficulty: "hard",
          options: opts(
            "AI導入に全面反対しています。",
            "AI導入の効果は認めるが、課題解決まで全社展開は時期尚早だと主張しています。",
            "即座に全社展開すべきだと主張しています。",
            "AI導入のコストは問題ないと結論づけています。",
            "B"
          ),
        },
        {
          prompt: "次のビジネスメールの文末表現の意図として正しいものを選びなさい。\n\n「…以上の点について、ご検討いただけますと幸いです。なお、本件につきましては〇月〇日までにご回答をいただきたく、何卒よろしくお願い申し上げます。ご不明な点がございましたら、お気軽にお問い合わせくださいませ。」",
          scenario: null,
          explanationVi: "Cuối email: (1) nhờ xem xét, (2) yêu cầu trả lời trước ngày X (gián tiếp đặt deadline), (3) liên hệ nếu có thắc mắc. Đây là cách đặt thời hạn lịch sự.",
          skillTag: "email-convention",
          difficulty: "easy",
          options: opts(
            "返答は不要だと伝えています。",
            "期限を設けて回答を丁寧に求めています。",
            "相手に決定権がないと伝えています。",
            "取引を終了すると通告しています。",
            "B"
          ),
        },
        {
          prompt: "次の議事録の記載を読んで、決定事項として正しいものを選びなさい。\n\n「議題3：新オフィス移転について\n討議内容：移転候補3物件について比較検討。A物件は駅近だがコスト高、B物件はコスト最安だが築30年、C物件はコストと立地のバランスが良いが入居可能時期が4月以降。\n決定事項：C物件を第一候補とし、入居時期について貸主と交渉する。交渉が不調の場合はA物件を第二候補とする。次回会議までに交渉結果を報告のこと。」",
          scenario: null,
          explanationVi: "Quyết định: C là ứng viên số 1 (cân bằng chi phí-vị trí nhưng vào ở từ tháng 4), thương lượng thời gian với chủ nhà. Nếu không được thì chuyển sang A. Báo cáo kết quả cuộc họp tới.",
          skillTag: "minutes-comprehension",
          difficulty: "standard",
          options: opts(
            "A物件に即決定した。",
            "C物件を第一候補とし、入居時期の交渉を行う。不調ならA物件。",
            "B物件に決定した。",
            "移転計画を白紙に戻した。",
            "B"
          ),
        },
        {
          prompt: "次の文章の下線部「遺憾ながら」の使い方として正しい意味を選びなさい。\n\n「弊社としましては最善を尽くしてまいりましたが、___遺憾ながら___今回のご要望にはお応えいたしかねます。何卒ご了承くださいますようお願い申し上げます。」",
          scenario: null,
          explanationVi: "「遺憾ながら」= rất tiếc, đáng tiếc (rất trang trọng). Dùng để từ chối một cách lịch sự nhất trong kinh doanh. 'Rất đáng tiếc nhưng không thể đáp ứng yêu cầu lần này'.",
          skillTag: "formal-refusal",
          difficulty: "standard",
          options: opts(
            "怒りを表しています。",
            "残念に思いながらも断る丁寧な表現です。",
            "相手を非難しています。",
            "将来の取引を約束しています。",
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
          prompt: "【文書1】プレスリリース：「当社は本日、株式会社DEF社との資本業務提携を締結したことをお知らせいたします。DEF社の保有するAI技術と当社の製造ノウハウを融合し、次世代スマート工場の実現を目指します。当社はDEF社の株式15%を取得し、取締役1名を派遣いたします。」\n\n【文書2】社内Q&A：「Q: 今回の提携で当社の組織に変更はありますか？ A: 新たに『DX推進室』を設置し、DEF社との共同プロジェクトを統括します。既存部署への直接的な影響は当面ありません。」\n\nこの提携について正しいものはどれですか。",
          scenario: null,
          explanationVi: "Liên minh vốn-kinh doanh với DEF: mua 15% cổ phần, cử 1 giám đốc, thành lập 'Phòng DX' để quản lý dự án chung, nhà máy thông minh thế hệ mới, tổ chức hiện tại không ảnh hưởng ngay.",
          skillTag: "alliance-comprehension",
          difficulty: "standard",
          options: opts(
            "DEF社を完全買収しました。",
            "DEF社株式15%取得、DX推進室設置、既存部署への直接影響はなし。",
            "DEF社が当社の株式を取得しました。",
            "全社組織が大幅に変更されます。",
            "B"
          ),
        },
        {
          prompt: "【文書1】顧客からのクレームメール：「3月5日に届いた商品（注文番号K-2045）の梱包が著しく損傷しており、中の商品にも傷があります。写真を添付します。代替品の早急な発送と、今回の件に対する正式な説明を求めます。」\n\n【文書2】社内対応マニュアル（抜粋）：「配送事故による商品破損の場合：1. 24時間以内に顧客に謝罪連絡 2. 代替品を翌営業日に発送 3. 配送業者に事故報告書を提出 4. 3営業日以内に顧客へ書面回答」\n\nマニュアルに従った正しい対応手順はどれですか。",
          scenario: null,
          explanationVi: "Theo quy trình: (1) xin lỗi trong 24h, (2) gửi hàng thay thế ngày làm việc tiếp, (3) báo cáo sự cố cho hãng vận chuyển, (4) trả lời bằng văn bản trong 3 ngày.",
          skillTag: "complaint-procedure",
          difficulty: "standard",
          options: opts(
            "代替品のみ発送すれば完了です。",
            "24時間以内に謝罪、翌営業日に代替品発送、配送業者に報告、3営業日以内に書面回答。",
            "配送業者に全責任を負わせ、顧客には配送業者に連絡するよう伝える。",
            "商品代金を返金するだけでよい。",
            "B"
          ),
        },
        {
          prompt: "【文書1】社内研修案内：「管理職向け ハラスメント防止研修　日時：4月15日 14:00-17:00　対象：課長職以上全員（必須）　内容：①法改正のポイント ②事例分析 ③相談対応ロールプレイ」\n\n【文書2】人事部メール：「本研修は法令改正に基づく義務研修です。欠席の場合は5月開催の代替日程（5/10または5/20）に必ず受講してください。未受講者は人事評価に影響する場合があります。」\n\n正しい理解はどれですか。",
          scenario: null,
          explanationVi: "Đào tạo phòng chống quấy rối là bắt buộc cho quản lý (trưởng khoa trở lên). Vắng 15/4 thì phải dự 10/5 hoặc 20/5. Không tham gia có thể ảnh hưởng đánh giá nhân sự.",
          skillTag: "policy-compliance",
          difficulty: "easy",
          options: opts(
            "研修は任意参加です。",
            "課長職以上は必須で、欠席なら代替日に受講しないと評価に影響する。",
            "全社員が対象です。",
            "オンラインでの代替受講が可能です。",
            "B"
          ),
        },
        {
          prompt: "【文書1】取締役会議事録（抜粋）：「議題：中期経営計画の策定方針　決議：2027年度までに営業利益率を現在の5%から10%に引き上げることを目標とする。重点施策：①高付加価値製品へのシフト ②固定費20%削減 ③海外売上比率を30%から45%に拡大」\n\n【文書2】社長インタビュー記事：「単なるコスト削減ではなく、成長投資と効率化を両立させます。海外展開ではM&Aも選択肢に入れています。」\n\n中期経営計画の方針として正しいものはどれですか。",
          scenario: null,
          explanationVi: "Kế hoạch trung hạn: lợi nhuận 5%→10%, sản phẩm giá trị cao, giảm chi phí cố định 20%, doanh thu nước ngoài 30%→45%. Tổng giám đốc nhấn mạnh cân bằng đầu tư tăng trưởng và hiệu quả, M&A cũng là lựa chọn.",
          skillTag: "strategy-comprehension",
          difficulty: "hard",
          options: opts(
            "コスト削減のみに集中する計画です。",
            "利益率倍増を目指し、高付加価値シフト・固定費削減・海外拡大を重点とする計画です。",
            "海外事業を縮小する方針です。",
            "現状維持の方針を確認しました。",
            "B"
          ),
        },
        {
          prompt: "【文書1】労働基準監督署からの指導書：「貴事業場において、月80時間を超える時間外労働を行った労働者が複数確認されました。労働基準法第36条に基づく協定の範囲を超えており、直ちに改善措置を講じ、1か月以内に改善報告書を提出してください。」\n\n【文書2】社内対応計画：「①残業上限アラートシステムの導入 ②業務分担の見直し ③60時間超過者への面談義務化 ④管理職研修の実施」\n\n会社が置かれている状況と対応として正しいものはどれですか。",
          scenario: null,
          explanationVi: "Bị nhắc nhở vi phạm giờ làm thêm >80h/tháng, vượt quá hiệp định 36. Phải cải thiện và nộp báo cáo trong 1 tháng. Đối sách: hệ thống cảnh báo, phân bổ lại công việc, phỏng vấn người quá 60h, đào tạo quản lý.",
          skillTag: "labor-compliance",
          difficulty: "hard",
          options: opts(
            "残業時間に問題はなく、確認のみが求められています。",
            "月80時間超の違法残業を指摘され、1か月以内に改善報告が必要です。",
            "労働基準監督署から表彰を受けています。",
            "従業員全員を解雇する指導を受けています。",
            "B"
          ),
        },
        {
          prompt: "【文書1】不動産会社からの提案書：「オフィス移転候補：品川エリア　面積300坪　賃料月額450万円（共益費込）　契約期間5年　フリーレント3か月　原状回復義務あり」\n\n【文書2】社内検討メモ：「現オフィス賃料380万円/月だが、面積不足で来年には増床が必要。品川案は賃料+70万だが、フリーレントを考慮すると5年トータルでは現状より有利。ただし、移転費用約2,000万円と原状回復費用1,500万円（退去時）の初期・最終負担を考慮のこと。」\n\nこの案件の判断材料として正しいものはどれですか。",
          scenario: null,
          explanationVi: "So sánh: hiện tại 380 vạn/tháng nhưng sắp thiếu diện tích. Phương án mới 450 vạn/tháng nhưng free-rent 3 tháng, 5 năm tổng có lợi hơn. Cần tính thêm chi phí dọn 2000 vạn + phục hồi 1500 vạn.",
          skillTag: "cost-analysis",
          difficulty: "standard",
          options: opts(
            "品川案は現オフィスより5年間で確実に不利です。",
            "品川案は月額+70万だが、フリーレント考慮で5年トータル有利。ただし移転費・原状回復費要考慮。",
            "現オフィスの面積は十分で移転の必要はありません。",
            "品川案には原状回復義務がありません。",
            "B"
          ),
        },
        {
          prompt: "【文書1】取引先銀行からの通知：「金利改定のお知らせ　貴社ご融資（融資番号F-8820）につきまして、変動金利条項に基づき、来月より適用金利を年1.2%から年1.5%に改定いたします。」\n\n【文書2】経理部試算メモ：「融資残高3億円、金利0.3%上昇分の年間追加利息負担：90万円。現在のキャッシュフローでは吸収可能だが、追加融資を検討中の新工場計画のコスト試算を見直す必要あり。」\n\n正しい状況理解はどれですか。",
          scenario: null,
          explanationVi: "Lãi suất tăng 0.3% (1.2→1.5%), dư nợ 3 tỷ → thêm 90 vạn yên/năm. Dòng tiền hiện tại chịu được nhưng cần xem lại tính toán kế hoạch nhà máy mới nếu vay thêm.",
          skillTag: "financial-analysis",
          difficulty: "standard",
          options: opts(
            "金利上昇で即座に経営危機に陥ります。",
            "年90万円の追加負担は吸収可能だが、新工場計画の試算見直しが必要。",
            "金利が下がったため有利になりました。",
            "融資が即座に全額返済を求められています。",
            "B"
          ),
        },
        {
          prompt: "【文書1】株主総会招集通知（議案）：「第4号議案：取締役報酬制度の改定の件　現行の固定報酬制に加え、業績連動報酬（賞与）及び株式報酬を導入する。業績連動部分は連結営業利益の達成率に応じて0%～150%の範囲で変動する。」\n\n【文書2】IR説明資料：「本改定の趣旨：経営陣と株主の利益一致を図り、中長期的な企業価値向上へのインセンティブを高める。なお、報酬総額の上限は年間5億円とする。」\n\n報酬制度改定の目的として正しいものはどれですか。",
          scenario: null,
          explanationVi: "Cải cách lương giám đốc: thêm thưởng theo hiệu quả (0-150% theo lợi nhuận) và cổ phiếu. Mục đích: đồng nhất lợi ích ban giám đốc và cổ đông, khuyến khích tăng giá trị dài hạn. Giới hạn 5 tỷ yên/năm.",
          skillTag: "corporate-governance",
          difficulty: "hard",
          options: opts(
            "取締役の報酬を削減するためです。",
            "経営陣と株主の利益を一致させ、企業価値向上のインセンティブを高めるためです。",
            "取締役全員を交代させるためです。",
            "固定報酬を廃止するためです。",
            "B"
          ),
        },
        {
          prompt: "【文書1】特許侵害警告書（要旨）：「貴社製品『SmartX-200』は、弊社が保有する特許第○○○号の請求項1および3を侵害していると判断されます。2週間以内に製造販売の中止と、損害賠償について協議に応じるよう求めます。」\n\n【文書2】社内法務部の見解：「当該特許の有効性について争う余地あり。また、当社製品の技術的構成が特許の権利範囲に属するか精査が必要。顧問弁護士と対応方針を早急に決定すること。回答期限まで2週間。」\n\n会社が取るべき次の行動として正しいものはどれですか。",
          scenario: null,
          explanationVi: "Nhận thư cảnh cáo vi phạm bằng sáng chế. Phòng pháp chế nhận thấy có thể tranh cãi hiệu lực bằng sáng chế và cần xem xét kỹ phạm vi. Cần họp với luật sư cố vấn quyết định phương hướng trong 2 tuần.",
          skillTag: "ip-dispute",
          difficulty: "hard",
          options: opts(
            "警告書を無視して製造を続ける。",
            "顧問弁護士と特許の有効性・権利範囲を精査し、2週間以内に対応方針を決定する。",
            "直ちに製造販売を中止し、損害賠償金を支払う。",
            "相手方の特許を買い取る交渉を始める。",
            "B"
          ),
        },
        {
          prompt: "【文書1】事業撤退検討報告書：「事業部C：3期連続赤字（累計損失4.5億円）。市場縮小傾向。黒字転換見込みなし。撤退推奨。」\n\n【文書2】事業部C部長の反論メモ：「来期に予定される規制緩和により市場拡大が見込まれる。新規顧客開拓もすでに3社との商談が進行中。追加投資6,000万円と1年の猶予をいただければ黒字化は可能と確信。」\n\n【文書3】CFOコメント：「事業部Cへの追加投資余力は存在するが、機会費用を考慮すべき。他事業への振り向けによるリターンの方が確実性が高い。」\n\nこの件についての論点整理として正しいものはどれですか。",
          scenario: null,
          explanationVi: "Tranh luận: báo cáo đề nghị rút lui (lỗ 3 kỳ liên tiếp, thị trường thu hẹp). Trưởng bộ phận phản đối (quy chế sắp nới lỏng, đang đàm phán 3 khách mới, cần 6000 vạn + 1 năm). CFO cân nhắc chi phí cơ hội (đầu tư chỗ khác chắc chắn hơn).",
          skillTag: "strategic-decision",
          difficulty: "hard",
          options: opts(
            "全員が撤退に賛成しています。",
            "撤退推奨vs継続希望が対立し、CFOは機会費用の観点から他事業優先を示唆しています。",
            "事業部Cは黒字で問題ありません。",
            "追加投資が全員から支持されています。",
            "B"
          ),
        },
      ],
    },
  ],
};
