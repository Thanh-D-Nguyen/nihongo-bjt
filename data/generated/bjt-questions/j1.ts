/**
 * BJT J1 Level Questions — 上級レベル (Advanced)
 * Score range: 530-599
 *
 * Target: Professionals who can handle complex business negotiations,
 * M&A discussions, legal affairs, investor relations, crisis management,
 * board-level communications, and sophisticated formal Japanese.
 * Contexts: board meetings, M&A negotiations, regulatory hearings,
 * press conferences, executive strategy sessions, legal contracts,
 * financial analysis, corporate governance.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J1_DATA: SeedLevelData = {
  level: "J1",
  slug: "bjt-j1-practice-v3",
  titleVi: "Đề luyện BJT J1 — Cao cấp",
  titleJa: "BJT J1 練習テスト — 上級レベル",
  sections: [
    // ======================== LC_SCENE (12) ========================
    {
      code: "LC_SCENE",
      titleVi: "Nắm bắt tình huống",
      titleJa: "場面把握問題",
      questions: [
        {
          prompt: "取締役会で議長が「本件に関しまして、反対のご意見がなければ、原案通り承認とさせていただきます」と述べています。出席者が静かに頷いています。",
          scenario: "大企業の取締役会議室。重要議案の採決場面。",
          explanationVi: "Chủ tọa phát biểu: 'Nếu không có ý kiến phản đối về vấn đề này, xin phép thông qua theo nguyên án'. Người dự họp gật đầu im lặng → đang tiến hành biểu quyết nghị quyết.",
          skillTag: "board-meeting-protocol",
          difficulty: "standard",
          options: opts(
            "新しい議案を提出しようとしています。",
            "議案の承認手続きを進めています。",
            "議長が辞任を表明しています。",
            "出席者が異議を唱えています。",
            "B"
          ),
        },
        {
          prompt: "記者会見場で広報担当者が「この度の不祥事につきまして、関係者の皆様に多大なるご迷惑をおかけしましたことを深くお詫び申し上げます」と頭を下げています。",
          scenario: "企業の記者会見場。フラッシュが光っている。",
          explanationVi: "Người phụ trách PR cúi đầu xin lỗi: 'Về vụ bê bối lần này, chúng tôi xin gửi lời xin lỗi sâu sắc đến tất cả các bên liên quan'. → Họp báo xin lỗi về scandal.",
          skillTag: "crisis-communication",
          difficulty: "standard",
          options: opts(
            "新製品の発表を行っています。",
            "不祥事に関する謝罪会見を行っています。",
            "株主総会の開会を宣言しています。",
            "業績好調の報告をしています。",
            "B"
          ),
        },
        {
          prompt: "M&Aのアドバイザーが「デューデリジェンスの結果、対象会社の簿外債務が判明いたしました。買収価格の再交渉をご提案いたします」と報告しています。",
          scenario: "投資銀行の会議室。買収側の経営陣が資料を確認している。",
          explanationVi: "Cố vấn M&A báo cáo: 'Kết quả thẩm định phát hiện nợ ngoài sổ sách của công ty mục tiêu. Đề xuất đàm phán lại giá mua'. → Đang trình bày kết quả due diligence.",
          skillTag: "ma-negotiation",
          difficulty: "hard",
          options: opts(
            "買収の最終契約を締結しようとしています。",
            "デューデリジェンスの結果報告と価格再交渉を提案しています。",
            "新規株式公開の準備をしています。",
            "対象会社の業績報告をしています。",
            "B"
          ),
        },
        {
          prompt: "IR担当者がアナリスト向けに「当期の営業利益率は前年同期比で2.3ポイント改善し、中期経営計画の目標を前倒しで達成する見込みです」と説明しています。",
          scenario: "決算説明会のプレゼンテーション会場。スクリーンにグラフが映し出されている。",
          explanationVi: "Phụ trách IR giải thích: 'Tỷ suất lợi nhuận kinh doanh kỳ này cải thiện 2.3 điểm so với cùng kỳ, dự kiến đạt mục tiêu kế hoạch trung hạn sớm hơn dự kiến'. → Thuyết trình kết quả kinh doanh.",
          skillTag: "investor-relations",
          difficulty: "standard",
          options: opts(
            "株主への配当金の減額を発表しています。",
            "決算説明会で業績の改善を報告しています。",
            "新規事業の立ち上げを提案しています。",
            "リストラ計画を説明しています。",
            "B"
          ),
        },
        {
          prompt: "弁護士が「本契約第12条の競業避止義務の範囲につきまして、地理的制限と期間の妥当性について再検討が必要かと存じます」と意見を述べています。",
          scenario: "法律事務所の会議室。契約書のドラフトが机上に広げられている。",
          explanationVi: "Luật sư phát biểu: 'Về phạm vi nghĩa vụ cấm cạnh tranh tại Điều 12, cần xem xét lại tính hợp lý của giới hạn địa lý và thời hạn'. → Đang rà soát điều khoản hợp đồng.",
          skillTag: "legal-review",
          difficulty: "hard",
          options: opts(
            "契約の署名式を行っています。",
            "契約条項の法的妥当性を検討しています。",
            "訴訟の和解交渉をしています。",
            "新しい法律の制定について議論しています。",
            "B"
          ),
        },
        {
          prompt: "社長が緊急役員会議で「本日午前中にサイバー攻撃を受け、顧客情報の一部が流出した可能性がございます。直ちに対策本部を設置します」と発言しています。",
          scenario: "本社の役員会議室。早朝の緊急招集。",
          explanationVi: "Giám đốc phát biểu tại cuộc họp khẩn: 'Sáng nay bị tấn công mạng, có khả năng một phần thông tin khách hàng bị rò rỉ. Lập tức thiết lập ban đối sách'. → Xử lý khủng hoảng an ninh mạng.",
          skillTag: "crisis-management",
          difficulty: "hard",
          options: opts(
            "定期的なセキュリティ監査の結果を報告しています。",
            "情報漏洩のインシデント対応を開始しています。",
            "新しいITシステムの導入を提案しています。",
            "従業員のセキュリティ研修を企画しています。",
            "B"
          ),
        },
        {
          prompt: "監査法人のパートナーが「前期の会計処理について重要な虚偽表示のリスクが認められるため、追加的な監査手続を実施させていただきます」と通告しています。",
          scenario: "クライアント企業のCFO室。監査報告の場面。",
          explanationVi: "Đối tác kiểm toán thông báo: 'Do phát hiện rủi ro sai sót trọng yếu trong xử lý kế toán kỳ trước, chúng tôi sẽ thực hiện thêm thủ tục kiểm toán'. → Thông báo kiểm toán bổ sung.",
          skillTag: "audit-communication",
          difficulty: "hard",
          options: opts(
            "監査が問題なく終了したことを報告しています。",
            "会計上の問題により追加監査の必要性を伝えています。",
            "来期の監査契約の更新を提案しています。",
            "新しい会計基準の適用について説明しています。",
            "B"
          ),
        },
        {
          prompt: "労働組合の代表が経営側に「春闘の要求書を提出いたします。ベースアップ3.5%、一時金5.0ヶ月を要求いたします」と述べています。",
          scenario: "労使交渉の会議室。組合側と経営側が対面で着席。",
          explanationVi: "Đại diện công đoàn trình bày: 'Xin nộp yêu cầu đàm phán lương xuân. Yêu cầu tăng lương cơ bản 3.5%, thưởng 5.0 tháng'. → Đàm phán lương xuân (shuntō).",
          skillTag: "labor-negotiation",
          difficulty: "standard",
          options: opts(
            "経営側が賃上げを提案しています。",
            "組合が春闘の賃上げ要求を提出しています。",
            "従業員の解雇通知を行っています。",
            "福利厚生の見直しを報告しています。",
            "B"
          ),
        },
        {
          prompt: "ファンドマネージャーが「当社のポートフォリオにおけるESG投資比率を現行の15%から30%に引き上げることを、運用委員会に上申いたします」と提案しています。",
          scenario: "資産運用会社の運用会議。ESGスコアのデータが表示されている。",
          explanationVi: "Quản lý quỹ đề xuất: 'Xin đề nghị lên ủy ban vận hành về việc nâng tỷ lệ đầu tư ESG từ 15% hiện tại lên 30%'. → Đề xuất thay đổi chiến lược đầu tư.",
          skillTag: "investment-strategy",
          difficulty: "standard",
          options: opts(
            "ESG投資からの撤退を報告しています。",
            "ESG投資比率の引き上げを提案しています。",
            "顧客への運用報告を行っています。",
            "新しいファンドの設立を発表しています。",
            "B"
          ),
        },
        {
          prompt: "社外取締役が「コーポレートガバナンス・コードの改訂に伴い、取締役会の実効性評価の開示方法について議論すべきと考えます」と発言しています。",
          scenario: "指名・報酬委員会の会議。コーポレートガバナンス報告書の草案を確認中。",
          explanationVi: "Giám đốc bên ngoài phát biểu: 'Theo sửa đổi Bộ quy tắc quản trị, cần thảo luận phương pháp công bố đánh giá hiệu quả hội đồng quản trị'. → Thảo luận về quản trị doanh nghiệp.",
          skillTag: "corporate-governance",
          difficulty: "hard",
          options: opts(
            "取締役の報酬引き上げを要求しています。",
            "ガバナンス・コード対応の議論を提起しています。",
            "取締役会の解散を提案しています。",
            "新しい社外取締役の選任を推薦しています。",
            "B"
          ),
        },
        {
          prompt: "事業再生コンサルタントが「スポンサー候補3社からの入札を比較した結果、A社の提案が事業継続性と従業員の雇用維持の観点から最適と判断いたします」と報告しています。",
          scenario: "再生支援協議会の会議室。入札比較表が配布されている。",
          explanationVi: "Tư vấn tái cơ cấu báo cáo: 'So sánh đấu thầu từ 3 ứng viên tài trợ, đánh giá đề xuất công ty A là tối ưu về tính liên tục kinh doanh và duy trì việc làm'. → Báo cáo kết quả đánh giá nhà tài trợ.",
          skillTag: "business-restructuring",
          difficulty: "hard",
          options: opts(
            "3社すべてとの提携を提案しています。",
            "事業再生スポンサーの選定結果を報告しています。",
            "会社の清算手続きを開始しています。",
            "新規事業への投資を決定しています。",
            "B"
          ),
        },
        {
          prompt: "知的財産部長が「競合他社の新製品が当社の特許権を侵害している可能性が高く、差止請求の準備を進めるべきと考えます」と経営会議で報告しています。",
          scenario: "本社経営会議室。特許侵害の分析資料が投影されている。",
          explanationVi: "Trưởng phòng sở hữu trí tuệ báo cáo: 'Sản phẩm mới của đối thủ có khả năng cao xâm phạm bằng sáng chế, nên tiến hành chuẩn bị yêu cầu cấm'. → Báo cáo vi phạm bằng sáng chế.",
          skillTag: "intellectual-property",
          difficulty: "standard",
          options: opts(
            "特許のライセンス供与を提案しています。",
            "特許侵害への法的対応を提案しています。",
            "新しい特許の出願を報告しています。",
            "競合他社との提携を検討しています。",
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
          prompt: "「この案件につきましては、社内のコンセンサスを得た上で、改めてご回答申し上げたいと存じます。」",
          scenario: "取引先との交渉の場。相手からの提案に対して。",
          explanationVi: "Phát biểu: 'Về vấn đề này, sau khi đạt được sự đồng thuận nội bộ, chúng tôi muốn trả lời lại'. → Đang trì hoãn trả lời để tham vấn nội bộ.",
          skillTag: "negotiation-tactics",
          difficulty: "standard",
          options: opts(
            "提案をその場で承諾しています。",
            "社内合意を得てから回答すると伝えています。",
            "提案を明確に拒否しています。",
            "別の会社を紹介しています。",
            "B"
          ),
        },
        {
          prompt: "「恐れ入りますが、弊社としましては、御社のご提示額では到底採算が合いかねます。再考いただけますと幸いに存じます。」",
          scenario: "価格交渉の場面。サプライヤーとの会議。",
          explanationVi: "'Xin lỗi nhưng với giá quý công ty đề xuất, bên chúng tôi hoàn toàn không thể có lãi. Rất mong được xem xét lại'. → Từ chối gián tiếp giá đề xuất.",
          skillTag: "price-negotiation",
          difficulty: "standard",
          options: opts(
            "提示額を受け入れています。",
            "価格の再検討を丁寧に要求しています。",
            "取引の中止を宣言しています。",
            "支払い条件の変更を提案しています。",
            "B"
          ),
        },
        {
          prompt: "「申し訳ございませんが、守秘義務の関係上、その件に関するコメントは差し控えさせていただきます。」",
          scenario: "記者からの質問に対するIR担当者の回答。",
          explanationVi: "'Rất xin lỗi, do nghĩa vụ bảo mật, xin phép không bình luận về vấn đề đó'. → Từ chối trả lời vì lý do bảo mật.",
          skillTag: "confidentiality-protocol",
          difficulty: "standard",
          options: opts(
            "質問に詳しく回答しています。",
            "守秘義務を理由にコメントを控えています。",
            "別の質問をするよう促しています。",
            "後日文書で回答すると約束しています。",
            "B"
          ),
        },
        {
          prompt: "「ご提案の方向性には概ね賛同いたしますが、実行のタイムラインについてはもう少し現実的な見直しが必要ではないかと考えております。」",
          scenario: "経営戦略会議。新規プロジェクトの計画について。",
          explanationVi: "'Về cơ bản đồng ý với hướng đề xuất, nhưng cho rằng timeline thực hiện cần xem xét lại thực tế hơn'. → Đồng ý có điều kiện về phương hướng.",
          skillTag: "conditional-agreement",
          difficulty: "standard",
          options: opts(
            "提案を全面的に支持しています。",
            "方向性には賛同するがスケジュール見直しを求めています。",
            "提案を完全に否定しています。",
            "代替案を提示しています。",
            "B"
          ),
        },
        {
          prompt: "「率直に申し上げますと、現状のままでは来期の事業継続が極めて困難な状況にあると認識しております。抜本的な構造改革が不可避です。」",
          scenario: "経営再建の臨時取締役会。財務担当役員の発言。",
          explanationVi: "'Nói thẳng, trong tình trạng hiện tại, nhận thức rằng việc tiếp tục kinh doanh kỳ sau là cực kỳ khó khăn. Cải cách cơ cấu triệt để là không thể tránh'. → Cảnh báo tình hình tài chính nghiêm trọng.",
          skillTag: "crisis-assessment",
          difficulty: "hard",
          options: opts(
            "来期の成長戦略を楽観的に報告しています。",
            "事業継続の危機と構造改革の必要性を訴えています。",
            "リストラの完了を報告しています。",
            "新規融資の獲得を発表しています。",
            "B"
          ),
        },
        {
          prompt: "「本件につきましては、法令遵守の観点から、外部の専門家による第三者委員会を設置し、事実関係の調査を行うことが適切かと存じます。」",
          scenario: "コンプライアンス委員会。不正疑惑に対する対応協議。",
          explanationVi: "'Về vấn đề này, từ góc độ tuân thủ pháp luật, cho rằng nên thiết lập ủy ban bên thứ ba gồm chuyên gia bên ngoài để điều tra sự thật'. → Đề xuất điều tra độc lập.",
          skillTag: "compliance-protocol",
          difficulty: "hard",
          options: opts(
            "社内調査で十分だと主張しています。",
            "第三者委員会による外部調査を提案しています。",
            "問題の隠蔽を指示しています。",
            "当事者の即時解雇を要求しています。",
            "B"
          ),
        },
        {
          prompt: "「大変僭越ではございますが、今回のTOBに関しましては、少数株主の利益保護の観点が十分とは言えないのではないかと懸念しております。」",
          scenario: "特別委員会での社外取締役の発言。公開買付けの審議中。",
          explanationVi: "'Xin phép nói thẳng, về TOB lần này, e rằng quan điểm bảo vệ lợi ích cổ đông thiểu số chưa đầy đủ'. → Bày tỏ lo ngại về bảo vệ cổ đông thiểu số.",
          skillTag: "shareholder-protection",
          difficulty: "hard",
          options: opts(
            "TOBの即時実行を支持しています。",
            "少数株主保護の不十分さへの懸念を示しています。",
            "TOBの撤回を要求しています。",
            "買収価格の引き上げを確約しています。",
            "B"
          ),
        },
        {
          prompt: "「今般の業務提携につきましては、相互の強みを活かしたシナジー効果が見込まれますものの、文化的統合のリスクについても慎重な検討が求められます。」",
          scenario: "経営企画部の報告。海外企業との業務提携検討。",
          explanationVi: "'Về liên minh kinh doanh lần này, dù kỳ vọng hiệu ứng cộng hưởng từ thế mạnh hai bên, cũng cần cân nhắc thận trọng rủi ro hội nhập văn hóa'. → Đánh giá cân bằng cơ hội và rủi ro.",
          skillTag: "strategic-analysis",
          difficulty: "standard",
          options: opts(
            "提携のメリットのみを強調しています。",
            "シナジー効果と文化統合リスクの両面を指摘しています。",
            "提携の中止を提言しています。",
            "自社単独での事業展開を主張しています。",
            "B"
          ),
        },
        {
          prompt: "「ステークホルダーの皆様への説明責任を果たすべく、今回の決定に至った経緯と根拠を速やかに開示することが肝要かと存じます。」",
          scenario: "広報戦略会議。重大な経営判断後の情報開示について。",
          explanationVi: "'Để thực hiện trách nhiệm giải trình với các bên liên quan, cho rằng cần nhanh chóng công bố quá trình và căn cứ dẫn đến quyết định lần này'. → Nhấn mạnh minh bạch thông tin.",
          skillTag: "accountability-disclosure",
          difficulty: "standard",
          options: opts(
            "情報を当面非公開にすることを提案しています。",
            "説明責任のため迅速な情報開示を主張しています。",
            "メディア対応を拒否しています。",
            "責任者の処分を要求しています。",
            "B"
          ),
        },
        {
          prompt: "「いささか唐突なお話で恐縮ですが、御社の技術力と弊社の販売網を融合させた合弁事業の可能性について、忌憚のないご意見を賜りたく存じます。」",
          scenario: "トップ会談。業界大手2社の社長が会食の席で。",
          explanationVi: "'Xin lỗi vì đột ngột, nhưng muốn xin ý kiến thẳng thắn về khả năng liên doanh kết hợp công nghệ quý công ty và mạng lưới bán hàng bên chúng tôi'. → Đề xuất liên doanh.",
          skillTag: "partnership-proposal",
          difficulty: "standard",
          options: opts(
            "競合排除の協定を提案しています。",
            "合弁事業の可能性について意見を求めています。",
            "相手企業の買収意図を伝えています。",
            "技術供与契約を要求しています。",
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
          prompt: "取締役会で3名の役員がM&A案件について議論しています。A：「買収価格は市場価値の1.3倍で適正です」B：「しかしシナジー効果の試算が楽観的すぎます」C：「のれんの減損リスクも考慮すべきです」。議長は次にどうすべきですか。",
          scenario: "M&A案件の取締役会審議。賛否が分かれている。",
          explanationVi: "3 giám đốc tranh luận: A cho giá hợp lý, B cho tính toán cộng hưởng quá lạc quan, C lo rủi ro giảm giá trị thương hiệu. Chủ tọa nên yêu cầu phân tích bổ sung trước khi quyết định.",
          skillTag: "integrated-board-discussion",
          difficulty: "hard",
          options: opts(
            "即座に買収を承認する。",
            "シナジー効果と減損リスクの追加分析を指示する。",
            "買収を中止する。",
            "買収価格を一方的に引き下げる。",
            "B"
          ),
        },
        {
          prompt: "危機管理会議で法務、広報、技術の各部門長が報告しています。法務：「個人情報保護法に基づく報告義務があります」広報：「記者会見は48時間以内が望ましい」技術：「影響範囲の特定にはあと24時間必要です」。最優先すべき対応は何ですか。",
          scenario: "データ漏洩インシデントの緊急対応会議。",
          explanationVi: "Trưởng pháp vụ: có nghĩa vụ báo cáo theo luật. PR: họp báo trong 48h. Kỹ thuật: cần thêm 24h xác định phạm vi. Ưu tiên: báo cáo theo luật song song với xác định phạm vi.",
          skillTag: "crisis-priority-assessment",
          difficulty: "hard",
          options: opts(
            "記者会見を直ちに開く。",
            "法的報告義務を履行しつつ技術調査を並行で進める。",
            "影響範囲が判明するまですべてを保留する。",
            "顧客に個別に連絡する。",
            "B"
          ),
        },
        {
          prompt: "株主総会で株主から3つの質問が出されました。①役員報酬の妥当性、②政策保有株式の縮減計画、③気候変動対応の具体策。議長として最も適切な対応順序はどれですか。",
          scenario: "定時株主総会。質疑応答の時間。",
          explanationVi: "Cổ đông đặt 3 câu hỏi: ①lương giám đốc, ②kế hoạch giảm cổ phiếu chính sách, ③biện pháp biến đổi khí hậu. Chủ tọa nên trả lời theo thứ tự chất vấn.",
          skillTag: "shareholder-meeting-protocol",
          difficulty: "standard",
          options: opts(
            "重要度の高い質問のみ選択的に回答する。",
            "質問の順序に従い、各担当役員が回答する。",
            "すべての質問を書面回答に回す。",
            "株主の質問を制限し議事を進行する。",
            "B"
          ),
        },
        {
          prompt: "海外子会社の再編会議で、CFOが「為替ヘッジのコストが利益を圧迫している」、COOが「現地の規制強化で事業継続が困難」、法務が「撤退には現地労働法の制約がある」と報告しています。経営判断として適切なのはどれですか。",
          scenario: "海外事業再編の経営会議。複合的な課題。",
          explanationVi: "CFO: chi phí hedge tỷ giá ăn lợi nhuận. COO: quy định địa phương gây khó khăn. Pháp vụ: rút lui bị ràng buộc luật lao động. → Cần đánh giá tổng hợp các phương án.",
          skillTag: "complex-decision-making",
          difficulty: "hard",
          options: opts(
            "直ちに撤退を決定する。",
            "各課題を踏まえた複数のシナリオを策定し比較検討する。",
            "為替ヘッジを中止してコストを削減する。",
            "現地規制を無視して事業を継続する。",
            "B"
          ),
        },
        {
          prompt: "IR説明会でアナリストから「御社の自己資本利益率が業界平均を下回っている理由」を質問されました。CFOの回答として最も適切なのはどれですか。",
          scenario: "機関投資家向けIR説明会。業績についての質疑。",
          explanationVi: "Analyst hỏi lý do ROE dưới trung bình ngành. CFO nên giải thích nguyên nhân cụ thể và kế hoạch cải thiện.",
          skillTag: "ir-communication",
          difficulty: "standard",
          options: opts(
            "「他社との比較は適切ではありません」と回答を拒否する。",
            "要因分析を示した上で中期的な改善計画を説明する。",
            "「来期には必ず改善します」と根拠なく断言する。",
            "質問を無視して次の議題に移る。",
            "B"
          ),
        },
        {
          prompt: "買収後のPMI会議で、人事部長が「統合後の組織文化の衝突が深刻化しています」、営業部長が「顧客の離反率が想定の2倍です」と報告しています。最優先すべき対策はどれですか。",
          scenario: "買収後6ヶ月のPMI（統合後経営）会議。",
          explanationVi: "Trưởng HR: xung đột văn hóa tổ chức nghiêm trọng. Trưởng kinh doanh: tỷ lệ mất khách gấp đôi dự kiến. Ưu tiên: xử lý mất khách (ảnh hưởng doanh thu trực tiếp) đồng thời giải quyết văn hóa.",
          skillTag: "pmi-management",
          difficulty: "hard",
          options: opts(
            "組織文化の統合を完全に諦める。",
            "顧客維持策を緊急実施しつつ文化統合プログラムを強化する。",
            "買収先の従業員を全員入れ替える。",
            "さらなる買収で問題を希薄化する。",
            "B"
          ),
        },
        {
          prompt: "社外取締役から「現在のCEO後継者計画は不十分ではないか」との指摘を受けました。指名委員会の委員長として適切な対応はどれですか。",
          scenario: "指名委員会。CEO後継者計画の見直し議論。",
          explanationVi: "Giám đốc bên ngoài chỉ ra kế hoạch kế nhiệm CEO chưa đầy đủ. Chủ tịch ủy ban bổ nhiệm nên nghiêm túc tiếp thu và đề xuất cải thiện.",
          skillTag: "succession-planning",
          difficulty: "standard",
          options: opts(
            "指摘を受け流して現状維持とする。",
            "指摘を真摯に受け止め後継者計画の再整備を提案する。",
            "CEO本人に後継者を指名させる。",
            "社外取締役を委員会から除外する。",
            "B"
          ),
        },
        {
          prompt: "規制当局からの立入検査通知を受け、コンプライアンス委員会で対応を協議しています。法務部長：「全面的な協力が基本方針」総務部長：「文書保全命令を直ちに発出すべき」経営企画：「事業への影響を最小化したい」。最優先の対応はどれですか。",
          scenario: "規制当局の立入検査への対応会議。",
          explanationVi: "Pháp vụ: hợp tác toàn diện. Tổng vụ: ra lệnh bảo toàn tài liệu. Kinh doanh: giảm thiểu ảnh hưởng. Ưu tiên: bảo toàn tài liệu ngay lập tức (nghĩa vụ pháp lý).",
          skillTag: "regulatory-compliance",
          difficulty: "hard",
          options: opts(
            "事業影響の最小化を最優先にする。",
            "文書保全命令を直ちに発出し全面協力の体制を整える。",
            "検査に対して異議申立てを行う。",
            "関連文書を精査してから対応を決める。",
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
          prompt: "以下の社内通知と音声説明を踏まえ、従業員が取るべき行動として最も適切なものを選んでください。\n\n【社内通知】当社は本日付で東京証券取引所プライム市場への市場区分変更の承認を受けました。これに伴い、インサイダー取引規制の対象範囲が拡大します。",
          scenario: "上場市場区分変更に伴うコンプライアンス対応。人事部長が音声で追加説明。",
          explanationVi: "Thông báo nội bộ về chuyển sàn niêm yết Prime. Phạm vi quy định giao dịch nội gián mở rộng. Nhân viên cần tuân thủ quy định mới về giao dịch.",
          skillTag: "compliance-situation",
          difficulty: "standard",
          options: opts(
            "保有株式を直ちにすべて売却する。",
            "新たなインサイダー取引規制の研修を受け取引制限を確認する。",
            "市場区分変更は自分に関係ないと判断する。",
            "知人に株式購入を推奨する。",
            "B"
          ),
        },
        {
          prompt: "以下の取締役会資料と議長の発言を踏まえ、社外監査役として適切な対応を選んでください。\n\n【資料】関連当事者取引：子会社A社への業務委託契約（年間3億円）。A社代表取締役は当社代表取締役の親族。\n【議長】「本件は慣例に従い原案通り承認としたい。」",
          scenario: "取締役会での関連当事者取引の承認議案。利益相反の疑い。",
          explanationVi: "Tài liệu: giao dịch bên liên quan 3 tỷ yên với công ty con do người thân đại diện. Chủ tọa muốn thông qua theo thường lệ. Giám sát viên bên ngoài cần yêu cầu kiểm tra tính công bằng.",
          skillTag: "conflict-of-interest",
          difficulty: "hard",
          options: opts(
            "議長の提案に従い承認する。",
            "利益相反の観点から取引条件の公正性の確認を求める。",
            "取引の存在自体を否定する。",
            "監査役を辞任する。",
            "B"
          ),
        },
        {
          prompt: "以下のIR資料と電話会議の内容を踏まえ、アナリストの質問に対するIR担当者の最適な回答を選んでください。\n\n【IR資料】当期純利益：前年比▲15%。要因：為替差損（30億円）、構造改革費用（20億円）。\n【アナリスト】「来期のガイダンスについてお聞かせください。」",
          scenario: "決算電話会議。業績悪化の説明とガイダンス要求。",
          explanationVi: "Lợi nhuận giảm 15% do tổn thất tỷ giá và chi phí tái cơ cấu. Analyst hỏi về hướng dẫn kỳ tới. IR nên phân biệt yếu tố tạm thời và giải thích triển vọng.",
          skillTag: "ir-guidance",
          difficulty: "standard",
          options: opts(
            "「来期は必ず回復します」と断言する。",
            "一過性要因と構造的改善の見通しを分けて説明する。",
            "「ガイダンスは出せません」と回答を拒否する。",
            "為替差損の詳細のみを繰り返し説明する。",
            "B"
          ),
        },
        {
          prompt: "以下の人事部通知とCEOのビデオメッセージを踏まえ、事業部長として最も適切な対応を選んでください。\n\n【通知】経営効率化に伴い、全社で15%の人員削減を実施。各事業部で対象者リストを2週間以内に提出のこと。\n【CEO】「痛みを伴う決断ですが、会社の存続のために必要です。」",
          scenario: "大規模リストラの指示。事業部長としての対応。",
          explanationVi: "Thông báo cắt giảm 15% nhân sự toàn công ty. CEO: 'Quyết định đau đớn nhưng cần thiết'. Trưởng bộ phận cần đánh giá khách quan dựa trên năng lực và nhu cầu kinh doanh.",
          skillTag: "restructuring-execution",
          difficulty: "hard",
          options: opts(
            "個人的な好みで対象者を選定する。",
            "業務上の必要性と客観的基準に基づき公正に選定する。",
            "人員削減を拒否して辞表を提出する。",
            "全員に均等に給与カットを提案する。",
            "B"
          ),
        },
        {
          prompt: "以下の監査報告書と監査法人からの口頭説明を踏まえ、監査委員会として適切な対応を選んでください。\n\n【監査報告書抜粋】継続企業の前提に関する重要な不確実性が認められる。\n【口頭説明】「資金繰りの改善が見込めない場合、意見不表明とせざるを得ません。」",
          scenario: "監査委員会。ゴーイングコンサーンの疑義。",
          explanationVi: "Báo cáo kiểm toán: có bất định trọng yếu về hoạt động liên tục. Giải thích: nếu dòng tiền không cải thiện, có thể không đưa ra ý kiến. Ủy ban kiểm toán cần yêu cầu kinh doanh trình kế hoạch cải thiện.",
          skillTag: "going-concern",
          difficulty: "hard",
          options: opts(
            "監査法人を変更する。",
            "経営陣に資金繰り改善計画の策定と提示を求める。",
            "ゴーイングコンサーンの注記を削除するよう要求する。",
            "問題を次期に先送りする。",
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
          prompt: "以下の財務諸表の抜粋と、CFOの説明を踏まえ、最も適切な分析を選んでください。\n\n【連結貸借対照表】有利子負債：2,800億円、自己資本：1,200億円、D/Eレシオ：2.33倍\n【CFO説明】「財務健全性の回復を最優先課題とし、3年以内にD/Eレシオを1.0倍以下に改善する計画です。」",
          scenario: "決算説明会。財務改善計画の説明。",
          explanationVi: "D/E ratio 2.33 lần (cao). CFO cam kết giảm xuống dưới 1.0 trong 3 năm. → Công ty đang có đòn bẩy tài chính cao và cần giảm nợ đáng kể.",
          skillTag: "financial-analysis",
          difficulty: "standard",
          options: opts(
            "現在の財務状態は極めて健全である。",
            "有利子負債が自己資本を大幅に上回り、財務レバレッジの改善が急務である。",
            "D/Eレシオ2.33倍は業界標準で問題ない。",
            "自己資本の増加のみで改善が可能である。",
            "B"
          ),
        },
        {
          prompt: "以下のM&Aタームシートの主要条件と、法務アドバイザーの指摘を踏まえ、買収側として最も注意すべき点を選んでください。\n\n【タームシート】買収価格：500億円、表明保証：標準的、補償上限：買収価格の20%、エスクロー：なし、MAC条項：あり（ただし定義が狭い）\n【法務指摘】「MAC条項の定義範囲と補償条件に懸念があります。」",
          scenario: "M&Aのタームシート検討会議。",
          explanationVi: "Giá 500 tỷ, bồi thường tối đa 20%, không có escrow, MAC clause hẹp. Luật sư lo ngại. → Rủi ro: nếu xảy ra biến động lớn nhưng không nằm trong định nghĩa MAC, không thể hủy giao dịch.",
          skillTag: "ma-term-analysis",
          difficulty: "hard",
          options: opts(
            "買収価格が高すぎることが最大の問題である。",
            "MAC条項の定義が狭くエスクローがないため、リスクヘッジが不十分である。",
            "表明保証が標準的であるため問題ない。",
            "補償上限20%は十分に保守的である。",
            "B"
          ),
        },
        {
          prompt: "以下のコーポレートガバナンス報告書の抜粋と、IR担当の補足説明を踏まえ、機関投資家が最も懸念する可能性が高い点を選んでください。\n\n【報告書】取締役会構成：社内8名、社外3名（うち独立2名）。取締役会議長：代表取締役社長が兼務。政策保有株式：50銘柄（時価総額800億円）。\n【IR補足】「独立社外取締役の比率引き上げを検討中です。」",
          scenario: "機関投資家とのエンゲージメント会議の準備。",
          explanationVi: "Hội đồng: 8 nội bộ, 3 bên ngoài (2 độc lập). Chủ tịch kiêm CEO. Cổ phiếu chính sách: 50 mã (800 tỷ). Nhà đầu tư sẽ lo: tỷ lệ độc lập thấp + CEO kiêm chủ tịch + cổ phiếu chính sách nhiều.",
          skillTag: "governance-analysis",
          difficulty: "standard",
          options: opts(
            "取締役の総数が少なすぎること。",
            "独立社外取締役比率の低さ、議長兼務、政策保有株式の規模。",
            "社外取締役が3名もいて多すぎること。",
            "IR担当が検討中と回答したこと。",
            "B"
          ),
        },
        {
          prompt: "以下の規制当局からの業務改善命令書と、コンプライアンス部長の対応方針説明を踏まえ、最も適切な初動対応を選んでください。\n\n【命令書要旨】反社会的勢力との取引遮断体制の不備。3ヶ月以内に改善計画を提出のこと。業務の一部停止命令あり。\n【部長説明】「改善計画の策定チームを直ちに発足させます。」",
          scenario: "規制当局からの業務改善命令への対応会議。",
          explanationVi: "Lệnh cải thiện: thiếu sót trong hệ thống cắt đứt giao dịch với tổ chức chống xã hội. Nộp kế hoạch trong 3 tháng. Một phần nghiệp vụ bị đình chỉ. → Cần tuân thủ ngay lệnh đình chỉ và lập nhóm cải thiện.",
          skillTag: "regulatory-response",
          difficulty: "hard",
          options: opts(
            "命令に対して行政訴訟を提起する。",
            "業務停止命令を即時遵守し改善計画策定チームを発足する。",
            "反社チェック体制は問題ないと主張する。",
            "3ヶ月の期限延長を申請する。",
            "B"
          ),
        },
        {
          prompt: "以下のIRプレゼンテーション資料と質疑応答を踏まえ、中期経営計画の実現可能性に関する最も適切な評価を選んでください。\n\n【中期計画目標】3年後の売上高：現行比150%、営業利益率：現行8%→15%、海外売上比率：現行20%→40%。\n【CEO説明】「M&Aと有機成長の両輪で達成を目指します。具体的なM&A案件は現在精査中です。」",
          scenario: "中期経営計画の発表会。アナリスト向け。",
          explanationVi: "Mục tiêu 3 năm: doanh thu x1.5, biên lợi nhuận 8%→15%, hải ngoại 20%→40%. CEO: kết hợp M&A và tăng trưởng hữu cơ, M&A đang xem xét. → Mục tiêu tham vọng nhưng M&A chưa cụ thể, rủi ro thực thi cao.",
          skillTag: "strategic-plan-evaluation",
          difficulty: "standard",
          options: opts(
            "すべての目標が保守的で容易に達成可能である。",
            "目標は野心的だがM&A案件が未確定のため実行リスクが高い。",
            "有機成長のみで全目標が達成可能である。",
            "営業利益率の改善は売上成長と無関係に実現できる。",
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
          prompt: "以下の取締役会議事録案と議長の口頭補足を踏まえ、議事録の記載として最も不適切なものを選んでください。\n\n【議事録案】第3号議案：代表取締役の利益相反取引承認の件。出席取締役8名中7名の賛成で承認。なお、利害関係を有する田中取締役は議決に参加していない。\n【議長補足】「田中取締役には事前に退室いただきました。」",
          scenario: "取締役会議事録の確認作業。法務部によるレビュー。",
          explanationVi: "Nghị quyết giao dịch lợi ích xung đột. 7/8 người tán thành, Tanaka không tham gia biểu quyết. Chủ tọa: Tanaka đã rời phòng trước. Cần ghi rõ Tanaka rời phòng (không chỉ không tham gia biểu quyết).",
          skillTag: "corporate-minutes-review",
          difficulty: "hard",
          options: opts(
            "田中取締役が退室した旨の記載がないこと。",
            "賛成者数が正確に記録されていること。",
            "利害関係取締役の特定が記載されていること。",
            "議案番号が付されていること。",
            "A"
          ),
        },
        {
          prompt: "以下の会社分割計画書の概要と弁護士の説明を踏まえ、債権者保護手続として必要な対応を選んでください。\n\n【計画書概要】吸収分割により製造事業を新設子会社に承継。分割会社に債務の重畳的引受けなし。\n【弁護士説明】「重畳的債務引受がない場合、分割会社の債権者に異議申述の機会を付与する必要があります。」",
          scenario: "会社分割の法務手続き確認会議。",
          explanationVi: "Kế hoạch chia tách: chuyển sản xuất sang công ty con mới, không có nhận nợ chồng. Luật sư: cần cho chủ nợ cơ hội phản đối. → Cần công cáo và thông báo riêng cho chủ nợ.",
          skillTag: "corporate-restructuring-legal",
          difficulty: "hard",
          options: opts(
            "債権者への個別催告と官報公告を実施する。",
            "債権者への通知は不要である。",
            "株主総会の承認のみで手続は完了する。",
            "債権者に分割後の配当を保証する。",
            "A"
          ),
        },
        {
          prompt: "以下の有価証券報告書の「事業等のリスク」記載と経営企画部の説明を踏まえ、リスク開示として最も改善が必要な点を選んでください。\n\n【リスク記載例】「為替変動により業績に影響を受ける可能性があります。」「訴訟により損失が生じる可能性があります。」\n【経営企画説明】「金融庁から、リスク情報の記載の充実が求められています。」",
          scenario: "有価証券報告書のリスク開示改善検討会議。",
          explanationVi: "Mô tả rủi ro chung chung: 'biến động tỷ giá có thể ảnh hưởng', 'kiện tụng có thể gây tổn thất'. FSA yêu cầu chi tiết hơn. → Thiếu mức độ ảnh hưởng cụ thể và biện pháp đối phó.",
          skillTag: "risk-disclosure",
          difficulty: "standard",
          options: opts(
            "リスクの種類が多すぎること。",
            "リスクの記載が定型的で具体的な影響度や対応策が示されていないこと。",
            "為替リスクを開示していること。",
            "訴訟リスクに言及していること。",
            "B"
          ),
        },
        {
          prompt: "以下の内部通報報告書と通報窓口担当者の説明を踏まえ、通報者保護の観点から最も問題のある対応を選んでください。\n\n【報告書】通報内容：上司による経費の不正請求。通報者：経理部の匿名職員。調査状況：上司に事情聴取を実施済み。\n【担当者説明】「調査の過程で、通報が経理部から出たことが被通報者に推測される状況が生じています。」",
          scenario: "内部通報制度の運用検証会議。",
          explanationVi: "Báo cáo nội bộ ẩn danh từ phòng kế toán. Trong quá trình điều tra, người bị tố cáo có thể suy ra nguồn tố cáo. → Vấn đề: bảo vệ người tố cáo bị tổn hại.",
          skillTag: "whistleblower-protection",
          difficulty: "hard",
          options: opts(
            "匿名性の確保に適切に配慮していること。",
            "調査過程で通報者が特定され得る状況を生じさせたこと。",
            "上司への事情聴取を実施したこと。",
            "通報内容を報告書にまとめたこと。",
            "B"
          ),
        },
        {
          prompt: "以下の株式公開買付届出書の抜粋とアドバイザーの説明を踏まえ、対象会社の独立委員会が検討すべき最も重要な論点を選んでください。\n\n【届出書】買付価格：1株2,500円（直近終値2,000円に対し25%プレミアム）。買付期間：法定最低の20営業日。全株取得を目的とするが、下限は議決権の3分の2。\n【アドバイザー】「プレミアムは平均的ですが、買付期間と強圧性に留意が必要です。」",
          scenario: "敵対的TOBに対する対象会社の独立委員会。",
          explanationVi: "TOB: premium 25%, thời hạn tối thiểu 20 ngày, mục tiêu toàn bộ nhưng ngưỡng 2/3. Cố vấn: lưu ý thời hạn ngắn và tính áp đặt. Ủy ban độc lập cần đánh giá: áp lực lên cổ đông do thời hạn ngắn + ngưỡng 2/3.",
          skillTag: "takeover-defense",
          difficulty: "hard",
          options: opts(
            "25%のプレミアムが過大であること。",
            "買付期間の短さと二段階構造の強圧性が株主に不利益をもたらす可能性。",
            "全株取得目的であること。",
            "届出書の形式的要件。",
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
          prompt: "取締役会における「善管注意義務」とは何を指しますか。",
          scenario: null,
          explanationVi: "'Thiện quản chú ý nghĩa vụ' (善管注意義務) = nghĩa vụ chú ý của người quản lý thiện lương - nghĩa vụ của giám đốc phải thực hiện nhiệm vụ với sự chú ý của người quản lý lương thiện.",
          skillTag: "legal-terminology",
          difficulty: "standard",
          options: opts(
            "株主への利益配当の義務",
            "善良な管理者として相当の注意を払って職務を遂行する義務",
            "従業員の福利厚生を保証する義務",
            "競合他社との競争を避ける義務",
            "B"
          ),
        },
        {
          prompt: "「本件については、瑕疵担保責任の___を売主に求めることとする。」空欄に入る最も適切な語句はどれですか。",
          scenario: null,
          explanationVi: "Về vấn đề này, yêu cầu bên bán chịu trách nhiệm bảo đảm khuyết tật. 'Khế ước trách nhiệm' → chịu (負担) là phù hợp nhất trong ngữ cảnh pháp lý.",
          skillTag: "legal-collocation",
          difficulty: "standard",
          options: opts(
            "実行",
            "負担",
            "発揮",
            "駆使",
            "B"
          ),
        },
        {
          prompt: "「当社は、コーポレートガバナンス・コードの各原則を___している。」最も適切な表現はどれですか。",
          scenario: null,
          explanationVi: "Công ty chúng tôi ___ các nguyên tắc của Bộ quy tắc quản trị. 'Tuân thủ' (遵守) là cách diễn đạt phù hợp nhất.",
          skillTag: "governance-vocabulary",
          difficulty: "easy",
          options: opts(
            "遵守",
            "適応",
            "指導",
            "模倣",
            "A"
          ),
        },
        {
          prompt: "M&Aにおける「のれん」とは何を意味しますか。",
          scenario: null,
          explanationVi: "'のれん' (goodwill) trong M&A là phần chênh lệch giữa giá mua và giá trị tài sản ròng của công ty mục tiêu, phản ánh giá trị vô hình như thương hiệu, khách hàng.",
          skillTag: "ma-terminology",
          difficulty: "standard",
          options: opts(
            "買収先の有形固定資産の総額",
            "買収価格と純資産公正価値の差額であり、超過収益力を表す",
            "買収に伴う手数料の総額",
            "買収先の売上高の予測値",
            "B"
          ),
        },
        {
          prompt: "「株主総会において、定款変更には出席株主の議決権の___以上の賛成が必要である。」空欄に入る正しい数値はどれですか。",
          scenario: null,
          explanationVi: "Sửa đổi điều lệ tại đại hội cổ đông cần 2/3 trở lên số phiếu biểu quyết của cổ đông có mặt (nghị quyết đặc biệt).",
          skillTag: "corporate-law",
          difficulty: "standard",
          options: opts(
            "過半数",
            "3分の2",
            "4分の3",
            "全員一致",
            "B"
          ),
        },
        {
          prompt: "「忌憚のないご意見を___いただければ幸いです。」最も適切な敬語表現はどれですか。",
          scenario: null,
          explanationVi: "'Rất mong được nhận ý kiến thẳng thắn'. 賜る (tamawaru) = kính ngữ của もらう, phù hợp nhất trong bối cảnh yêu cầu ý kiến từ cấp trên/đối tác.",
          skillTag: "advanced-keigo",
          difficulty: "standard",
          options: opts(
            "くれて",
            "もらって",
            "いただいて",
            "賜り",
            "D"
          ),
        },
        {
          prompt: "「本契約に定めなき事項については、___誠意をもって協議し解決するものとする。」空欄に入る最も適切な表現はどれですか。",
          scenario: null,
          explanationVi: "Các vấn đề không quy định trong hợp đồng này, hai bên sẽ hiệp thương giải quyết với thành ý. '甲乙' (bên A bên B) là cách viết hợp đồng chuẩn.",
          skillTag: "contract-language",
          difficulty: "easy",
          options: opts(
            "当事者が",
            "甲乙",
            "会社が",
            "関係者が",
            "B"
          ),
        },
        {
          prompt: "「表明保証違反が___した場合、相手方は損害賠償を請求できるものとする。」空欄に入る最も適切な動詞はどれですか。",
          scenario: null,
          explanationVi: "Khi vi phạm cam đoan bảo đảm được ___ (phát hiện/判明), bên kia có thể yêu cầu bồi thường. '判明' (phát hiện/trở nên rõ ràng) phù hợp nhất.",
          skillTag: "legal-verb-usage",
          difficulty: "standard",
          options: opts(
            "発生",
            "判明",
            "到達",
            "出現",
            "B"
          ),
        },
        {
          prompt: "「デューデリジェンス」の正しい説明はどれですか。",
          scenario: null,
          explanationVi: "Due Diligence = quá trình thẩm định toàn diện (tài chính, pháp lý, kinh doanh, thuế) trước M&A/đầu tư để đánh giá rủi ro và giá trị.",
          skillTag: "ma-process",
          difficulty: "easy",
          options: opts(
            "買収後の統合プロセス",
            "買収前に対象企業の財務・法務・事業を精査する調査プロセス",
            "株式公開の準備手続き",
            "企業間の価格交渉プロセス",
            "B"
          ),
        },
        {
          prompt: "「弊社___、本件に関するご提案を検討させていただいた結果、誠に遺憾ながらお受けいたしかねるとの結論に至りました。」空欄に入る最も適切な表現はどれですか。",
          scenario: null,
          explanationVi: "'Bên chúng tôi (としましては), sau khi xem xét đề xuất, rất tiếc phải kết luận không thể chấp nhận'. 'としましては' = lập trường của chúng tôi.",
          skillTag: "business-correspondence",
          difficulty: "standard",
          options: opts(
            "において",
            "としましては",
            "によると",
            "をもって",
            "B"
          ),
        },
        {
          prompt: "「少数株主の___を害することのないよう、公正な手続を確保する。」空欄に入る最も適切な語はどれですか。",
          scenario: null,
          explanationVi: "Đảm bảo thủ tục công bằng để không tổn hại ___ của cổ đông thiểu số. '利益' (lợi ích) là phù hợp nhất.",
          skillTag: "governance-vocabulary",
          difficulty: "easy",
          options: opts(
            "利益",
            "意見",
            "感情",
            "立場",
            "A"
          ),
        },
        {
          prompt: "「取締役の___行為により会社に損害が生じた場合、株主は代表訴訟を提起できる。」空欄に入る最も適切な語はどれですか。",
          scenario: null,
          explanationVi: "Khi hành vi ___ của giám đốc gây thiệt hại cho công ty, cổ đông có thể khởi kiện đại diện. '任務懈怠' (lơ là nhiệm vụ) là thuật ngữ pháp lý chính xác.",
          skillTag: "corporate-law-vocabulary",
          difficulty: "hard",
          options: opts(
            "営業",
            "任務懈怠",
            "競業",
            "就任",
            "B"
          ),
        },
        {
          prompt: "「本案件は、利益相反取引に___するため、取締役会の事前承認を要する。」空欄に入る最も適切な動詞はどれですか。",
          scenario: null,
          explanationVi: "Vụ này ___ (thuộc về/tương ứng) giao dịch lợi ích xung đột, nên cần phê duyệt trước của HĐQT. '該当' (thuộc về, tương ứng) là đúng.",
          skillTag: "legal-verb",
          difficulty: "standard",
          options: opts(
            "参加",
            "該当",
            "関与",
            "依存",
            "B"
          ),
        },
        {
          prompt: "「経営の透明性を確保するため、___の原則に基づく情報開示を行う。」空欄に入る最も適切な表現はどれですか。",
          scenario: null,
          explanationVi: "Để đảm bảo tính minh bạch quản lý, công bố thông tin dựa trên nguyên tắc ___. 'Comply or Explain' = tuân thủ hoặc giải thích, nguyên tắc cốt lõi của governance code.",
          skillTag: "governance-principle",
          difficulty: "hard",
          options: opts(
            "コンプライ・オア・エクスプレイン",
            "ベスト・プラクティス",
            "フェア・ディスクロージャー",
            "セーフ・ハーバー",
            "A"
          ),
        },
        {
          prompt: "「当該取引の___性について、独立した第三者による評価を取得した。」空欄に入る最も適切な語はどれですか。",
          scenario: null,
          explanationVi: "Đã nhận đánh giá từ bên thứ ba độc lập về tính ___ của giao dịch. '公正' (công bằng/fairness) là thuật ngữ chuẩn trong đánh giá giao dịch.",
          skillTag: "transaction-fairness",
          difficulty: "standard",
          options: opts(
            "合法",
            "公正",
            "必要",
            "効率",
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
          prompt: "以下のメールの意図として最も適切なものを選んでください。\n\n「平素より格別のお引き立てを賜り厚く御礼申し上げます。さて、先般ご提示いたしました条件につきまして、社内で慎重に検討いたしました結果、現時点では御社のご期待に沿いかねるとの結論に至りました。何卒ご理解賜りますようお願い申し上げます。」",
          scenario: null,
          explanationVi: "Email cảm ơn, sau đó nói rằng sau khi xem xét kỹ, không thể đáp ứng kỳ vọng ở thời điểm hiện tại. → Từ chối lịch sự nhưng để mở khả năng tương lai.",
          skillTag: "formal-refusal-comprehension",
          difficulty: "standard",
          options: opts(
            "今後の取引拡大を提案している。",
            "丁寧に断りつつ将来の可能性を完全には否定していない。",
            "即座に契約を締結する意向を示している。",
            "条件の変更を要求している。",
            "B"
          ),
        },
        {
          prompt: "以下の文書における「遺憾ながら」の最も正確なニュアンスはどれですか。\n\n「誠に遺憾ながら、当該従業員の行為は就業規則に照らし懲戒事由に該当するものと判断せざるを得ません。」",
          scenario: null,
          explanationVi: "'Rất đáng tiếc nhưng' - thể hiện rằng tuy không muốn nhưng buộc phải đưa ra quyết định kỷ luật dựa trên quy chế.",
          skillTag: "nuanced-expression",
          difficulty: "standard",
          options: opts(
            "相手を非難する意図",
            "残念だが避けられない判断であることを示す表現",
            "自社の過失を認める表現",
            "問題を軽視する表現",
            "B"
          ),
        },
        {
          prompt: "以下の取締役会議事録の記載において、「異議なく承認可決された」と「全員一致で承認可決された」の違いとして最も正確なものを選んでください。",
          scenario: null,
          explanationVi: "'Không có phản đối → thông qua' vs 'Nhất trí toàn bộ → thông qua': cách đầu cho phép khả năng có người bỏ phiếu trắng, cách sau xác nhận mọi người đều tán thành.",
          skillTag: "minute-language-precision",
          difficulty: "hard",
          options: opts(
            "両者は全く同じ意味である。",
            "前者は棄権者がいる可能性を含み、後者は全員が積極的に賛成したことを示す。",
            "前者の方がより強い合意を示す。",
            "後者は議長の判断のみで決定されたことを示す。",
            "B"
          ),
        },
        {
          prompt: "以下のプレスリリースにおける「当社といたしましては」の機能として最も適切なものを選んでください。\n\n「報道されている事実関係につきましては現在確認中です。当社といたしましては、事実関係が確認でき次第、適切に対応してまいる所存です。」",
          scenario: null,
          explanationVi: "'Về phía công ty chúng tôi' - chức năng: xác lập lập trường chính thức của công ty, phân biệt với báo chí/bên ngoài.",
          skillTag: "corporate-communication-style",
          difficulty: "standard",
          options: opts(
            "謝罪の意を込めている。",
            "会社の公式な立場を明確にし、主体的な対応姿勢を示している。",
            "責任を回避しようとしている。",
            "他社との比較をしている。",
            "B"
          ),
        },
        {
          prompt: "以下の法律文書における「ものとする」の法的効力として最も正確なものを選んでください。\n\n「乙は、甲の事前の書面による承諾なくして、本契約上の権利義務を第三者に譲渡してはならないものとする。」",
          scenario: null,
          explanationVi: "'ものとする' trong văn bản pháp lý = quy định nghĩa vụ/cấm đoán có tính ràng buộc pháp lý, tương đương 'shall not'.",
          skillTag: "legal-expression",
          difficulty: "standard",
          options: opts(
            "推奨事項であり法的拘束力はない。",
            "法的に拘束力のある義務規定を示す表現である。",
            "当事者の努力目標を示す表現である。",
            "条件付きの許可を与える表現である。",
            "B"
          ),
        },
        {
          prompt: "以下のIRレターにおける「足元」の意味として最も適切なものを選んでください。\n\n「足元の業績は堅調に推移しておりますが、地政学リスクの高まりを踏まえ、通期見通しについては慎重な姿勢を維持してまいります。」",
          scenario: null,
          explanationVi: "'Ashimoto' (足元) = hiện tại/gần đây nhất. Nghiệp tích hiện tại ổn định, nhưng do rủi ro địa chính trị, duy trì thận trọng với triển vọng cả năm.",
          skillTag: "business-idiom",
          difficulty: "easy",
          options: opts(
            "将来の長期的な見通し",
            "直近の現時点における状況",
            "過去の実績",
            "競合他社の動向",
            "B"
          ),
        },
        {
          prompt: "以下の通知文における「何卒ご了承賜りますよう」の最も正確な機能を選んでください。\n\n「諸般の事情により、本年度の株主優待制度を廃止することといたしました。何卒ご了承賜りますようお願い申し上げます。」",
          scenario: null,
          explanationVi: "'Xin vui lòng thông cảm/chấp nhận cho' - chức năng: xin sự chấp nhận của đối phương về quyết định đã được đưa ra (không phải xin phép).",
          skillTag: "formal-notice-language",
          difficulty: "standard",
          options: opts(
            "意見を求めている。",
            "既に決定した事項への理解と受容を丁重に求めている。",
            "承認を得ようとしている。",
            "交渉の余地を示している。",
            "B"
          ),
        },
        {
          prompt: "以下のビジネスメールにおける「ご査収ください」と「ご確認ください」の使い分けとして最も正確なものを選んでください。",
          scenario: null,
          explanationVi: "'ご査収' = nhận và kiểm tra kỹ (dùng khi gửi tài liệu chính thức cần đối phương kiểm tra nội dung). 'ご確認' = xác nhận (dùng rộng hơn, mức độ kiểm tra thấp hơn).",
          skillTag: "email-formality-levels",
          difficulty: "standard",
          options: opts(
            "両者は完全に同義で互換可能である。",
            "「ご査収」は正式な書類の受領と内容精査を求め、「ご確認」はより広い確認行為に用いる。",
            "「ご確認」の方がより丁寧である。",
            "「ご査収」はカジュアルな場面で使用する。",
            "B"
          ),
        },
        {
          prompt: "以下の文書における「所存でございます」の用法として最も適切なものを選んでください。\n\n「今後は再発防止策を徹底し、信頼回復に全力で取り組んでまいる所存でございます。」",
          scenario: null,
          explanationVi: "'所存でございます' = 'dự định/quyết tâm' - thể hiện ý chí mạnh mẽ của người nói/tổ chức về hành động tương lai, kính ngữ cấp cao nhất.",
          skillTag: "keigo-intention-expression",
          difficulty: "standard",
          options: opts(
            "相手に依頼している。",
            "話者の強い決意と今後の方針を最上級の敬語で表明している。",
            "事実を報告している。",
            "相手の意見を求めている。",
            "B"
          ),
        },
        {
          prompt: "以下の契約書の文言における「みなす」と「推定する」の法的な違いとして最も正確なものを選んでください。\n\n(1)「期限内に異議がない場合は承認したものとみなす。」\n(2)「期限内に異議がない場合は承認したものと推定する。」",
          scenario: null,
          explanationVi: "'みなす' (coi là) = quy định pháp lý không thể bác bỏ (irrebuttable presumption). '推定する' (suy đoán) = có thể bác bỏ bằng chứng cứ ngược lại (rebuttable presumption).",
          skillTag: "legal-distinction",
          difficulty: "hard",
          options: opts(
            "両者は同じ法的効力を持つ。",
            "「みなす」は反証を許さない確定的擬制、「推定する」は反証により覆る余地がある。",
            "「推定する」の方が法的拘束力が強い。",
            "「みなす」は当事者の合意が必要だが「推定する」は不要。",
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
          prompt: "以下の文章を読んで、筆者の主張として最も適切なものを選んでください。\n\n「日本企業のコーポレートガバナンス改革は、形式面では着実に進展している。社外取締役の導入率は上場企業の99%に達し、指名委員会等設置会社も増加している。しかし、取締役会の実効性という観点からは、依然として課題が山積している。形式的な独立性を満たしても、実質的な経営監督機能が発揮されなければ、改革の真の目的は達成されない。」",
          scenario: null,
          explanationVi: "Tác giả cho rằng: cải cách quản trị đạt tiến bộ về hình thức (99% có giám đốc bên ngoài) nhưng hiệu quả thực chất (giám sát kinh doanh) vẫn còn nhiều thách thức.",
          skillTag: "governance-essay-comprehension",
          difficulty: "standard",
          options: opts(
            "日本のガバナンス改革は完全に成功した。",
            "形式的進展は見られるが実質的な経営監督機能の強化が不十分である。",
            "社外取締役の導入は不要である。",
            "指名委員会等設置会社が最善のガバナンス形態である。",
            "B"
          ),
        },
        {
          prompt: "以下の文章を読んで、「アクティビスト株主」に対する筆者の見解として最も適切なものを選んでください。\n\n「アクティビスト株主の存在は、日本の資本市場に新たなダイナミズムをもたらしている。彼らの株主提案は、時に過度に短期的な利益追求と批判されるが、一方で、経営の緊張感を維持し、資本効率の改善を促す触媒としての機能も無視できない。重要なのは、すべてのアクティビストを画一的に評価するのではなく、個々の提案の合理性を客観的に検証することであろう。」",
          scenario: null,
          explanationVi: "Tác giả: activist có cả mặt tốt (thúc đẩy hiệu quả vốn) và xấu (ngắn hạn). Quan trọng là đánh giá từng đề xuất khách quan, không đánh đồng.",
          skillTag: "balanced-argument-comprehension",
          difficulty: "standard",
          options: opts(
            "アクティビスト株主は排除すべきである。",
            "個々の提案を客観的に評価すべきで、画一的に肯定も否定もすべきでない。",
            "アクティビスト株主の提案はすべて受け入れるべきである。",
            "アクティビスト株主は資本市場に有害である。",
            "B"
          ),
        },
        {
          prompt: "以下の社内文書を読んで、この決定の法的根拠として最も適切なものを選んでください。\n\n「当社は、X社による当社株式の公開買付けに対し、買収防衛策を発動することを決定しました。本決定は、独立委員会の勧告に基づき、当社の企業価値ひいては株主共同の利益を著しく毀損するおそれがあると判断したものです。」",
          scenario: null,
          explanationVi: "Quyết định phát động biện pháp phòng thủ mua lại dựa trên khuyến nghị ủy ban độc lập, vì lo ngại gây thiệt hại nghiêm trọng cho giá trị doanh nghiệp và lợi ích chung cổ đông.",
          skillTag: "takeover-defense-legal",
          difficulty: "hard",
          options: opts(
            "取締役の保身のため。",
            "独立委員会の勧告と株主共同の利益保護。",
            "X社との個人的な対立。",
            "規制当局からの指示。",
            "B"
          ),
        },
        {
          prompt: "以下の文章を読んで、ESG投資に関する筆者の立場として最も適切なものを選んでください。\n\n「ESG投資は単なるトレンドではなく、長期的な企業価値の持続可能性を評価する不可欠なフレームワークとなりつつある。ただし、ESGスコアの算定方法が評価機関によって大きく異なる現状は、投資家に混乱をもたらしている。標準化への取り組みが急務であると同時に、個別企業のESGへの取り組みを定量的に評価する手法の精緻化も求められている。」",
          scenario: null,
          explanationVi: "Tác giả: ESG quan trọng và không phải trend, nhưng cần chuẩn hóa phương pháp đánh giá vì hiện tại các tổ chức đánh giá khác nhau gây nhầm lẫn.",
          skillTag: "esg-analysis",
          difficulty: "standard",
          options: opts(
            "ESG投資は一時的な流行に過ぎない。",
            "ESG投資は重要だが評価手法の標準化と精緻化が急務である。",
            "ESGスコアの違いは問題にならない。",
            "ESG投資はリターンを犠牲にする。",
            "B"
          ),
        },
        {
          prompt: "以下の契約書条項を読んで、「チェンジ・オブ・コントロール条項」の趣旨として最も適切なものを選んでください。\n\n「甲の支配株主に変動が生じた場合（直接・間接を問わず議決権の過半数を取得する第三者が出現した場合を含む）、乙は書面による通知をもって、本契約を解除することができるものとする。」",
          scenario: null,
          explanationVi: "Điều khoản Change of Control: khi cổ đông kiểm soát thay đổi (bên thứ ba nắm quá bán phiếu), bên kia có quyền chấm dứt hợp đồng. Mục đích: bảo vệ đối tác khỏi thay đổi bất ngờ về chủ sở hữu.",
          skillTag: "contract-clause-analysis",
          difficulty: "standard",
          options: opts(
            "甲の経営陣の交代を防止する。",
            "甲の支配権変動時に乙に契約離脱の選択肢を与え、予期しないパートナー変更から保護する。",
            "甲の株式取得を禁止する。",
            "乙に甲の株式を取得する権利を与える。",
            "B"
          ),
        },
        {
          prompt: "以下の金融庁ガイドラインの抜粋を読んで、「顧客本位の業務運営」の本質として最も適切なものを選んでください。\n\n「金融事業者は、顧客の最善の利益を図るべきであり、手数料等の収入を得ることが顧客の利益を犠牲にしてはならない。また、利益相反の適切な管理と、重要な情報の分かりやすい提供が求められる。プリンシプルベースのアプローチにより、形式的なルール遵守を超えた実質的な顧客保護を目指す。」",
          scenario: null,
          explanationVi: "Nguyên tắc kinh doanh vì khách hàng: lợi ích khách hàng trên hết, không hy sinh lợi ích khách vì phí, quản lý xung đột lợi ích, cung cấp thông tin dễ hiểu. Dựa trên nguyên tắc (principle-based) chứ không chỉ tuân thủ quy tắc.",
          skillTag: "regulatory-principle",
          difficulty: "standard",
          options: opts(
            "ルール遵守の形式化を推進すること。",
            "顧客利益を最優先とし、形式を超えた実質的保護をプリンシプルベースで実現すること。",
            "手数料収入の最大化を図ること。",
            "情報開示を最小限にすること。",
            "B"
          ),
        },
        {
          prompt: "以下の文章を読んで、日本の「スチュワードシップ・コード」の目的として最も適切なものを選んでください。\n\n「機関投資家は、投資先企業の持続的成長を促し、顧客・受益者の中長期的な投資リターンの拡大を図るため、投資先企業との建設的な対話（エンゲージメント）を行うべきである。議決権行使は、単に賛否を表明するのみならず、企業価値向上のための対話の一環として位置づけられる。」",
          scenario: null,
          explanationVi: "Stewardship Code: nhà đầu tư tổ chức nên đối thoại xây dựng với công ty đầu tư để thúc đẩy tăng trưởng bền vững, tối đa hóa lợi nhuận trung dài hạn cho khách hàng/người thụ hưởng.",
          skillTag: "stewardship-code",
          difficulty: "standard",
          options: opts(
            "機関投資家の短期利益の最大化。",
            "建設的対話を通じて投資先の持続的成長と受益者の中長期リターン拡大を図ること。",
            "投資先企業の経営権を取得すること。",
            "議決権行使を形式的に実施すること。",
            "B"
          ),
        },
        {
          prompt: "以下の危機管理マニュアルの記載を読んで、初動対応の最重要原則として最も適切なものを選んでください。\n\n「重大インシデント発生時の初動対応においては、以下の優先順位を厳守すること。第一に人命の安全確保、第二に被害の拡大防止、第三に事実関係の把握と正確な情報伝達、第四にステークホルダーへの適時適切な情報開示。なお、不確実な情報に基づく推測的発言は厳に慎むこと。」",
          scenario: null,
          explanationVi: "Sổ tay quản lý khủng hoảng: ưu tiên (1) an toàn mạng người, (2) ngăn mở rộng thiệt hại, (3) nắm sự thật và truyền đạt chính xác, (4) công bố cho stakeholders. Không phát ngôn suy đoán.",
          skillTag: "crisis-protocol",
          difficulty: "easy",
          options: opts(
            "メディア対応を最優先にする。",
            "人命の安全確保を最優先とし、正確な事実に基づいた段階的対応を行う。",
            "責任者の特定を最優先にする。",
            "法的責任の回避を最優先にする。",
            "B"
          ),
        },
        {
          prompt: "以下の文章を読んで、「二重代表訴訟制度」の意義として最も適切なものを選んでください。\n\n「平成26年会社法改正により導入された多重代表訴訟（二重代表訴訟）制度は、完全親会社の株主が、完全子会社の取締役等の責任を追及することを可能にした。これにより、企業グループ全体のガバナンスの実効性が向上し、子会社経営者に対する規律付けが強化されることが期待されている。」",
          scenario: null,
          explanationVi: "Chế độ kiện đại diện kép (2014): cổ đông công ty mẹ có thể kiện giám đốc công ty con. Ý nghĩa: tăng cường quản trị toàn nhóm, kỷ luật quản lý công ty con.",
          skillTag: "corporate-law-comprehension",
          difficulty: "hard",
          options: opts(
            "親会社取締役の責任を軽減すること。",
            "親会社株主による子会社取締役への責任追及を可能にしグループガバナンスを強化すること。",
            "子会社の独立性を制限すること。",
            "株主の議決権を拡大すること。",
            "B"
          ),
        },
        {
          prompt: "以下の文章を読んで、「フェア・ディスクロージャー・ルール」の核心的要請として最も適切なものを選んでください。\n\n「金融商品取引法に基づくフェア・ディスクロージャー・ルールは、上場企業等が未公表の重要情報を特定の第三者に提供した場合、速やかに当該情報を公表することを義務付けている。本制度の趣旨は、情報の非対称性を解消し、すべての投資家に公平な投資判断の機会を保証することにある。」",
          scenario: null,
          explanationVi: "Fair Disclosure Rule: khi cung cấp thông tin quan trọng chưa công bố cho bên thứ ba cụ thể, phải công bố ngay cho tất cả. Mục đích: loại bỏ bất đối xứng thông tin, đảm bảo công bằng cho mọi nhà đầu tư.",
          skillTag: "securities-regulation",
          difficulty: "standard",
          options: opts(
            "企業の情報開示を制限すること。",
            "情報の非対称性を解消し全投資家に公平な情報アクセスを保証すること。",
            "アナリストとの対話を禁止すること。",
            "内部者取引を合法化すること。",
            "B"
          ),
        },
      ],
    },
  ],
};
