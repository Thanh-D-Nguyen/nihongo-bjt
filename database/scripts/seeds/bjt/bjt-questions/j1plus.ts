/**
 * BJT J1+ Level Questions — 最上級レベル (Expert/Native-level)
 * Score range: 600-800
 *
 * Target: Near-native professionals who handle the most complex business situations.
 * Contexts: international treaty negotiations, cross-border M&A, government regulatory
 * hearings, multinational board meetings, diplomatic receptions, executive suite conversations,
 * corporate crisis management, policy proposals, cross-cultural diplomacy.
 *
 * Language features: Maximum keigo, diplomatic/regulatory precision, implied meanings,
 * subtle cultural nuances, reading between the lines, multi-layered politeness strategies.
 */
import { SeedLevelData, opts } from "../bjt-seed-types.js";

export const J1PLUS_DATA: SeedLevelData = {
  level: "J1+",
  slug: "bjt-j1plus-practice-v3",
  titleVi: "Đề luyện BJT J1+ — Chuyên gia",
  titleJa: "BJT J1+ 練習テスト — 最上級レベル",
  sections: [
    // ======================== LC_SCENE (12) ========================
    {
      code: "LC_SCENE",
      titleVi: "Nắm bắt tình huống",
      titleJa: "場面把握問題",
      questions: [
        {
          prompt: "外務省の会議室で、条約交渉の首席代表が「本件につきましては、双方の立場を十分に踏まえた上で、次回までに文言の調整を図りたく存じます」と述べています。相手側代表団が書類に目を通しています。",
          scenario: "外務省の大会議室。日本側と相手国側の代表団が長テーブルを挟んで着席。国旗が両側に立てられている。",
          explanationVi: "Trưởng đoàn đàm phán điều ước nói 'Về vấn đề này, trên cơ sở cân nhắc đầy đủ lập trường của cả hai bên, chúng tôi mong muốn điều chỉnh ngôn từ trước cuộc họp tiếp theo'. Đây là cách ngoại giao để đề xuất hoãn quyết định mà không từ chối trực tiếp.",
          skillTag: "diplomatic-negotiation",
          difficulty: "hard",
          options: opts(
            "交渉が決裂し、代表団が退席しようとしている。",
            "首席代表が次回の協議に向けて調整の余地を残す発言をしている。",
            "相手側が条約案を正式に受諾している。",
            "首席代表が交渉の打ち切りを宣言している。",
            "B"
          ),
        },
        {
          prompt: "クロスボーダーM&Aの最終交渉で、買収側のCFOが「デューデリジェンスの結果を踏まえますと、のれんの減損リスクに関して、さらなる表明保証の追加をお願いせざるを得ない状況でございます」と発言しています。",
          scenario: "大手法律事務所の会議室。買収側・被買収側の経営陣と法務アドバイザーが資料を前に対峙。",
          explanationVi: "CFO bên mua nói rằng dựa trên kết quả due diligence, họ buộc phải yêu cầu thêm điều khoản bảo đảm về rủi ro suy giảm giá trị lợi thế thương mại. Đây là yêu cầu bổ sung điều kiện giao dịch.",
          skillTag: "ma-negotiation",
          difficulty: "hard",
          options: opts(
            "CFOが買収の中止を提案している。",
            "買収側が追加の保証条項を要求している。",
            "被買収側がのれんの評価額を引き上げている。",
            "法務アドバイザーが契約書の最終確認を行っている。",
            "B"
          ),
        },
        {
          prompt: "金融庁の公聴会で、審議官が「当該事業者におかれましては、法令遵守態勢の抜本的な見直しを強く期待するとともに、改善計画の速やかなご提出を求めるものであります」と述べています。",
          scenario: "金融庁の審議室。審議官が壇上に、事業者側の代表が証人席に着席。傍聴席に記者多数。",
          explanationVi: "Thẩm phán FSA phát biểu 'Chúng tôi kỳ vọng mạnh mẽ rằng doanh nghiệp sẽ rà soát triệt để hệ thống tuân thủ pháp luật, đồng thời yêu cầu nộp kế hoạch cải thiện sớm'. Đây thực chất là cảnh cáo hành chính nghiêm khắc.",
          skillTag: "regulatory-hearing",
          difficulty: "hard",
          options: opts(
            "審議官が事業者を称賛している。",
            "事業者が自主的に改善計画を発表している。",
            "審議官が事業者に対し実質的な行政指導を行っている。",
            "事業者が営業許可の更新を申請している。",
            "C"
          ),
        },
        {
          prompt: "多国籍企業の取締役会で、社外取締役が「株主価値の最大化という観点から申し上げますと、現経営陣のご提案には、いささか中長期的なビジョンとの整合性について疑義を呈さざるを得ません」と発言しています。",
          scenario: "本社最上階の取締役会議室。社外取締役3名を含む12名が楕円形テーブルを囲む。プロジェクター画面に経営計画資料。",
          explanationVi: "Giám đốc độc lập phát biểu 'Từ góc độ tối đa hóa giá trị cổ đông, tôi buộc phải đặt nghi vấn về sự nhất quán giữa đề xuất của ban điều hành hiện tại với tầm nhìn trung dài hạn'. Đây là phản đối lịch sự nhưng rõ ràng.",
          skillTag: "corporate-governance",
          difficulty: "hard",
          options: opts(
            "社外取締役が経営陣の提案を支持している。",
            "社外取締役が中長期ビジョンの策定を提案している。",
            "社外取締役が現経営陣の提案に対して婉曲的に異議を述べている。",
            "経営陣が株主総会の議案を説明している。",
            "C"
          ),
        },
        {
          prompt: "外交レセプションで、日本大使が相手国の商工大臣に「両国間の経済連携につきましては、双方にとって実りある成果が期待できる段階に至ったものと確信いたしております。近いうちに忌憚のないご意見を賜れれば幸いに存じます」と述べています。",
          scenario: "大使公邸のレセプションホール。正装の外交官・経済閣僚が歓談。シャンパングラスを手にした雰囲気。",
          explanationVi: "Đại sứ Nhật Bản nói với Bộ trưởng Thương mại đối tác 'Về hợp tác kinh tế song phương, tôi tin tưởng rằng đã đến giai đoạn có thể kỳ vọng thành quả cho cả hai bên. Mong sớm được nghe ý kiến thẳng thắn của ngài'. Đây là lời mời đàm phán chính thức được bọc trong ngôn ngữ ngoại giao.",
          skillTag: "diplomatic-networking",
          difficulty: "hard",
          options: opts(
            "大使が経済連携の失敗を嘆いている。",
            "大使が相手国に正式な抗議を行っている。",
            "大使が今後の経済交渉への参加を婉曲的に打診している。",
            "商工大臣が投資計画を発表している。",
            "C"
          ),
        },
        {
          prompt: "グローバル企業の経営会議で、CEOが「今般の構造改革につきましては、痛みを伴う決断ではございますが、将来世代への責任として断行する所存でございます。各部門長におかれましては、最大限のご協力を仰ぎたく存じます」と述べています。",
          scenario: "本社のエグゼクティブ会議室。CEO以下、各地域統括責任者が参加。一部はビデオ会議。",
          explanationVi: "CEO tuyên bố 'Về cuộc cải cách cơ cấu lần này, tuy là quyết định đau đớn nhưng với trách nhiệm với thế hệ tương lai, tôi quyết tâm thực hiện. Mong các trưởng bộ phận hợp tác tối đa'. Đây là thông báo quyết định cắt giảm/tái cấu trúc đã được phê duyệt.",
          skillTag: "executive-communication",
          difficulty: "hard",
          options: opts(
            "CEOが構造改革の検討開始を提案している。",
            "CEOが既に決定した構造改革の実行を宣言し協力を求めている。",
            "部門長たちが構造改革に反対意見を述べている。",
            "CEOが業績好調を報告している。",
            "B"
          ),
        },
        {
          prompt: "国際仲裁の場で、日本側の首席弁護士が「相手方のご主張は、準拠法の解釈において重大な瑕疵を含んでおり、仲裁廷におかれましても、この点につきご留意賜りたく存じます」と陳述しています。",
          scenario: "国際仲裁センターの審問室。仲裁人パネル3名が正面に、両当事者の弁護団が左右に着席。",
          explanationVi: "Luật sư trưởng phía Nhật phát biểu 'Lập luận của đối phương chứa sai sót nghiêm trọng trong giải thích luật áp dụng, kính mong hội đồng trọng tài lưu ý điểm này'. Đây là phản bác pháp lý mạnh mẽ được trình bày trong ngôn ngữ trang trọng.",
          skillTag: "legal-arbitration",
          difficulty: "hard",
          options: opts(
            "弁護士が和解案を提示している。",
            "弁護士が相手方の法的主張の誤りを仲裁廷に指摘している。",
            "仲裁廷が最終判断を下している。",
            "弁護士が証人の召喚を要請している。",
            "B"
          ),
        },
        {
          prompt: "政府の規制改革会議で、委員長が「本日の議論を総括いたしますと、規制の在り方につきましては、イノベーション促進と消費者保護の均衡点を見出すべく、引き続き慎重な検討を重ねる必要があるという点で、委員各位のご認識は概ね一致しているものと理解いたします」と述べています。",
          scenario: "内閣府の大会議室。規制改革推進会議の委員12名と事務局。",
          explanationVi: "Chủ tịch hội đồng tổng kết 'Tôi hiểu rằng các ủy viên cơ bản nhất trí rằng cần tiếp tục cân nhắc thận trọng để tìm điểm cân bằng giữa thúc đẩy đổi mới và bảo vệ người tiêu dùng'. Thực chất là kết luận chưa đạt đồng thuận, cần thảo luận thêm.",
          skillTag: "regulatory-deliberation",
          difficulty: "hard",
          options: opts(
            "委員長が規制緩和の即時実施を発表している。",
            "委員長が議論の結論が出なかったことを婉曲的に表明している。",
            "委員が規制強化に反対意見を述べている。",
            "委員長が次回の会議を中止すると発表している。",
            "B"
          ),
        },
        {
          prompt: "日系メガバンクと欧州銀行の戦略提携調印式で、日本側頭取が「本提携を契機として、グローバル金融市場における両行のプレゼンスを一層高めるとともに、お客様に対するソリューション提供力を飛躍的に向上させてまいる所存でございます」と挨拶しています。",
          scenario: "都内の高級ホテルの宴会場。調印テーブルの前に両行の頭取が立ち、後方に幹部陣。報道陣のカメラが並ぶ。",
          explanationVi: "Chủ tịch ngân hàng Nhật phát biểu tại lễ ký kết 'Nhân dịp hợp tác chiến lược này, chúng tôi quyết tâm nâng cao hơn nữa sự hiện diện của cả hai ngân hàng trên thị trường tài chính toàn cầu, đồng thời cải thiện vượt bậc năng lực cung cấp giải pháp cho khách hàng'. Đây là phát biểu chính thức tại sự kiện ký kết.",
          skillTag: "formal-ceremony",
          difficulty: "standard",
          options: opts(
            "頭取が提携の解消を発表している。",
            "頭取が戦略提携の調印式で抱負を述べている。",
            "欧州銀行側が提携条件の変更を要求している。",
            "記者が質疑応答を行っている。",
            "B"
          ),
        },
        {
          prompt: "企業の危機管理委員会で、法務担当役員が「報道対応につきましては、現時点では事実関係の確認が完了するまで、いかなるコメントも差し控えるのが賢明かと存じます。なお、当局への報告については、法定期限に十分留意の上、粛々と対応してまいります」と述べています。",
          scenario: "本社の危機管理室。役員5名が緊急招集され、法務・広報・コンプライアンスの責任者が同席。ホワイトボードにタイムライン。",
          explanationVi: "Giám đốc pháp lý nói 'Về ứng phó truyền thông, tôi cho rằng khôn ngoan nhất là không đưa ra bình luận nào cho đến khi xác minh xong sự thật. Về báo cáo với cơ quan chức năng, sẽ xử lý đúng thời hạn luật định'. Đây là chiến lược im lặng khi đối mặt khủng hoảng.",
          skillTag: "crisis-management",
          difficulty: "hard",
          options: opts(
            "法務担当が記者会見の開催を提案している。",
            "法務担当が危機時の情報統制と当局対応の方針を示している。",
            "広報部が謝罪文を発表している。",
            "役員が事態の収束を宣言している。",
            "B"
          ),
        },
        {
          prompt: "国連関連のビジネスフォーラムで、日本のESG投資担当執行役員が「サステナビリティ経営の本質は、短期的な収益圧力と長期的な社会的価値創造のジレンマを、いかにして経営の意思決定フレームワークに統合するかという点に帰着するものと考えております」と基調講演で述べています。",
          scenario: "国際会議場の大ホール。登壇者が演台に立ち、背景のスクリーンにESG関連のグラフ。各国のビジネスリーダーが聴講。",
          explanationVi: "Giám đốc điều hành ESG phát biểu 'Bản chất của kinh doanh bền vững quy về việc làm thế nào tích hợp bài toán nan giải giữa áp lực lợi nhuận ngắn hạn và sáng tạo giá trị xã hội dài hạn vào khung ra quyết định quản trị'. Đây là bài diễn thuyết chủ đề mang tính học thuật-thực tiễn.",
          skillTag: "thought-leadership",
          difficulty: "standard",
          options: opts(
            "執行役員がESG投資からの撤退を表明している。",
            "執行役員がサステナビリティ経営の本質的課題を学術的に論じている。",
            "聴衆が質問を投げかけている。",
            "執行役員が自社の業績を自慢している。",
            "B"
          ),
        },
        {
          prompt: "合併後の統合委員会で、PMI統括責任者が「人事制度の統合につきましては、両社の企業文化の差異を十分に尊重しつつ、段階的にベストプラクティスを融合させる方針で進めておりますが、一部の幹部層から強い懸念が示されている状況でございます」と報告しています。",
          scenario: "統合推進本部のオフィス。PMI責任者がプロジェクト進捗を大画面で共有。両社出身の幹部が混在して着席。",
          explanationVi: "Trưởng ban PMI báo cáo 'Về tích hợp chế độ nhân sự, chúng tôi đang tiến hành theo phương châm dung hòa từng bước các thực tiễn tốt nhất trong khi tôn trọng khác biệt văn hóa doanh nghiệp, tuy nhiên một số lãnh đạo cấp cao đang bày tỏ quan ngại mạnh'. Đây là báo cáo tiến độ với cảnh báo rủi ro.",
          skillTag: "pmi-management",
          difficulty: "hard",
          options: opts(
            "PMI責任者が統合の完了を宣言している。",
            "PMI責任者が人事統合の進捗と課題を報告している。",
            "幹部が統合に反対して辞任を表明している。",
            "PMI責任者が両社の文化が同一であると説明している。",
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
          prompt: "「今次の政策パッケージにつきましては、財政規律との整合性を担保しつつ、成長戦略の実効性を確保するという、いわば二律背反の命題に対する解を提示するものでございます。」",
          scenario: "内閣府の記者会見場。経済政策担当大臣がマイクの前に立っている。",
          explanationVi: "Bộ trưởng kinh tế phát biểu 'Gói chính sách lần này đưa ra lời giải cho mệnh đề tưởng như mâu thuẫn: đảm bảo kỷ luật tài khóa đồng thời bảo đảm tính hiệu quả của chiến lược tăng trưởng'. Ý nghĩa: chính sách cân bằng giữa hai mục tiêu đối lập.",
          skillTag: "policy-comprehension",
          difficulty: "hard",
          options: opts(
            "財政支出の削減のみを目指す政策である。",
            "財政規律と成長戦略の両立を図る政策である。",
            "成長戦略を完全に放棄する決定である。",
            "従来の政策を変更せず継続する発表である。",
            "B"
          ),
        },
        {
          prompt: "「株主の皆様には、当期の業績未達につきまして深くお詫び申し上げます。もっとも、この結果は将来の飛躍に向けた戦略的投資の帰結であり、来期以降の果実にご期待いただければ幸いに存じます。」",
          scenario: "株主総会の壇上。社長が頭を下げた後、前を向いて説明している。",
          explanationVi: "Chủ tịch xin lỗi cổ đông về kết quả kinh doanh chưa đạt mục tiêu, nhưng giải thích đó là hệ quả của đầu tư chiến lược cho tương lai và mong cổ đông kỳ vọng thành quả từ kỳ tiếp theo. Đây là kỹ thuật 'xin lỗi rồi biện minh'.",
          skillTag: "shareholder-communication",
          difficulty: "hard",
          options: opts(
            "社長が業績好調を報告している。",
            "社長が業績未達を詫びつつ戦略的投資の成果を約束している。",
            "社長が辞任を表明している。",
            "社長が株主への配当増額を発表している。",
            "B"
          ),
        },
        {
          prompt: "「法令違反の事実は断じて認められないところでありますが、社会的責任という観点から、より一層の透明性確保に向けた自主的な取り組みを進めてまいる所存であります。」",
          scenario: "企業の記者会見場。代表取締役が険しい表情でマイクに向かっている。",
          explanationVi: "CEO tuyên bố 'Hoàn toàn không thừa nhận vi phạm pháp luật, nhưng từ góc độ trách nhiệm xã hội, sẽ tự nguyện thúc đẩy minh bạch hơn nữa'. Đây là phủ nhận pháp lý kết hợp nhượng bộ về trách nhiệm xã hội — chiến thuật PR khủng hoảng điển hình.",
          skillTag: "crisis-communication",
          difficulty: "hard",
          options: opts(
            "法令違反を全面的に認めている。",
            "法令違反は否定しつつ自主的改善を約束している。",
            "第三者委員会の設置を発表している。",
            "記者の質問に対して回答を拒否している。",
            "B"
          ),
        },
        {
          prompt: "「相互補完的な関係構築こそが、真の意味でのウィンウィンをもたらすものと確信いたしております。御社の技術力と弊社のグローバルネットワークを掛け合わせることにより、これまでにない価値を市場に提供できるものと存じます。」",
          scenario: "ビジネスミーティングの場。日本企業の副社長が海外パートナー企業の代表に向かって話している。",
          explanationVi: "Phó chủ tịch nói 'Tôi tin rằng xây dựng quan hệ bổ trợ lẫn nhau mới mang lại win-win thực sự. Kết hợp năng lực công nghệ của quý công ty với mạng lưới toàn cầu của chúng tôi sẽ tạo ra giá trị chưa từng có'. Đây là đề xuất hợp tác chiến lược.",
          skillTag: "partnership-proposal",
          difficulty: "standard",
          options: opts(
            "副社長が相手企業の買収を提案している。",
            "副社長が戦略的提携の価値を論じている。",
            "副社長が競合排除の戦略を説明している。",
            "副社長が自社の技術力不足を認めている。",
            "B"
          ),
        },
        {
          prompt: "「規制当局といたしましては、市場の健全性を維持する観点から、今後、検査の頻度および深度を引き上げる方針でございます。各事業者におかれましては、ガバナンス態勢の一層の強化をお願い申し上げる次第でございます。」",
          scenario: "金融庁の定例ブリーフィング。監督局長が記者団に対して説明。",
          explanationVi: "Cục trưởng Giám sát FSA thông báo 'Từ quan điểm duy trì sự lành mạnh của thị trường, cơ quan quản lý sẽ nâng cao tần suất và chiều sâu kiểm tra. Yêu cầu các doanh nghiệp tăng cường hơn nữa hệ thống quản trị'. Đây là cảnh báo siết chặt giám sát.",
          skillTag: "regulatory-enforcement",
          difficulty: "hard",
          options: opts(
            "監督局長が規制緩和を発表している。",
            "監督局長が検査強化とガバナンス向上を求めている。",
            "監督局長が事業者を表彰している。",
            "監督局長が新規事業の許認可を説明している。",
            "B"
          ),
        },
        {
          prompt: "「異文化コミュニケーションにおいて最も留意すべきは、我々の当然視している前提が、必ずしも普遍的ではないという認識を持つことではないかと思料いたします。ハイコンテクストな日本的コミュニケーションの強みを活かしつつ、明示的な言語化の技術を磨くことが肝要かと存じます。」",
          scenario: "グローバル人材育成研修の場。元駐在員の役員が講壇に立って話している。",
          explanationVi: "Giám đốc cựu biệt phái phát biểu 'Trong giao tiếp đa văn hóa, điều quan trọng nhất là nhận thức rằng các tiền đề ta coi là hiển nhiên không nhất thiết phổ quát. Cần phát huy thế mạnh giao tiếp ngữ cảnh cao kiểu Nhật đồng thời rèn luyện kỹ năng ngôn ngữ hóa rõ ràng'. Đây là bài giảng về giao tiếp kinh doanh quốc tế.",
          skillTag: "cross-cultural-diplomacy",
          difficulty: "standard",
          options: opts(
            "日本的コミュニケーションを完全に捨てるべきだと主張している。",
            "日本的強みを活かしつつ明示的コミュニケーション力を高める必要性を説いている。",
            "外国人社員の日本語能力不足を批判している。",
            "海外駐在の廃止を提案している。",
            "B"
          ),
        },
        {
          prompt: "「本日の取締役会決議につきましては、善管注意義務の観点から、取締役各位が十分な情報に基づき合理的な判断を行ったことを、議事録上明確にしておく必要がございます。」",
          scenario: "取締役会終了直後。社外監査役が事務局担当者に指示を出している。",
          explanationVi: "Giám sát viên độc lập chỉ thị 'Về nghị quyết hội đồng hôm nay, cần ghi rõ trong biên bản rằng các giám đốc đã ra quyết định hợp lý dựa trên thông tin đầy đủ, từ góc độ nghĩa vụ chú ý thiện lương'. Đây là bảo vệ pháp lý cho quyết định của HĐQT.",
          skillTag: "corporate-governance",
          difficulty: "hard",
          options: opts(
            "監査役が取締役会の決議を無効と宣言している。",
            "監査役が善管注意義務の履行を議事録に明記するよう指示している。",
            "監査役が不正行為の調査を開始している。",
            "事務局が次回の取締役会の日程を調整している。",
            "B"
          ),
        },
        {
          prompt: "「誠に遺憾ながら、今般のデータ漏洩につきましては、組織的な隠蔽の意図は一切なく、あくまでもヒューマンエラーの連鎖に起因するものでございます。再発防止に向けて、全社を挙げて取り組む所存でございます。」",
          scenario: "緊急記者会見場。CISOと広報部長がフラッシュの中で頭を下げている。",
          explanationVi: "CISO phát biểu 'Rất đáng tiếc, về vụ rò rỉ dữ liệu lần này, hoàn toàn không có ý đồ che giấu có tổ chức, mà xuất phát từ chuỗi lỗi con người. Cam kết toàn công ty ngăn chặn tái phát'. Đây là phủ nhận tính hệ thống của sự cố và đổ cho lỗi cá nhân.",
          skillTag: "crisis-press-conference",
          difficulty: "hard",
          options: opts(
            "組織的な不正を全面的に認めている。",
            "組織的隠蔽を否定しヒューマンエラーが原因と説明している。",
            "システムベンダーに責任を転嫁している。",
            "記者の質問を一切受け付けないと宣言している。",
            "B"
          ),
        },
        {
          prompt: "「ステークホルダー・エンゲージメントの高度化を図る上で、形式的な情報開示にとどまらず、対話を通じた相互理解の深化こそが、企業価値の持続的向上に資するものと考えております。」",
          scenario: "IR担当執行役員がアナリスト向けの説明会で話している。",
          explanationVi: "Giám đốc IR phát biểu 'Để nâng cao sự tham gia của các bên liên quan, không chỉ dừng ở công bố thông tin hình thức mà đối thoại để đào sâu hiểu biết lẫn nhau mới đóng góp cho việc nâng cao bền vững giá trị doanh nghiệp'. Đây là cam kết cải thiện quan hệ nhà đầu tư.",
          skillTag: "investor-relations",
          difficulty: "standard",
          options: opts(
            "IR担当が情報開示を縮小すると発表している。",
            "IR担当がステークホルダーとの対話重視の方針を説明している。",
            "アナリストが業績予想を下方修正している。",
            "IR担当が株主還元策を発表している。",
            "B"
          ),
        },
        {
          prompt: "「国際的なサプライチェーンの分断リスクが顕在化する中、地政学的観点を経営戦略に組み込むことは、もはや選択肢ではなく必須要件であると認識を改めるべき局面に差し掛かっているものと存じます。」",
          scenario: "経営戦略審議会で、外部アドバイザーの元外交官が助言を行っている。",
          explanationVi: "Cố vấn bên ngoài (cựu ngoại giao quan) phát biểu 'Trong bối cảnh rủi ro gián đoạn chuỗi cung ứng quốc tế hiện thực hóa, đã đến lúc phải nhận thức lại rằng tích hợp quan điểm địa chính trị vào chiến lược kinh doanh không còn là lựa chọn mà là yêu cầu bắt buộc'. Đây là khuyến cáo chiến lược cấp cao.",
          skillTag: "geopolitical-strategy",
          difficulty: "hard",
          options: opts(
            "アドバイザーがサプライチェーンの問題は解消したと報告している。",
            "アドバイザーが地政学的リスクの経営戦略への統合を必須と主張している。",
            "アドバイザーが海外事業からの全面撤退を推奨している。",
            "アドバイザーが現行戦略の維持で問題ないと保証している。",
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
          prompt: "M&A交渉の最終局面。買収側A社のCFO、被買収側B社の社長、そして仲介のファイナンシャル・アドバイザーの三者が話しています。B社社長が「御社のご提示額につきましては、弊社の企業価値を十分に反映しているとは申し難い状況でございます」と述べ、A社CFOが「では、条件面で歩み寄れる余地について、率直にお聞かせいただけますでしょうか」と返答しています。ファイナンシャル・アドバイザーが調整案を提示しようとしています。この交渉の現在の状況として最も適切なものはどれですか。",
          scenario: "法律事務所の会議室。三者がそれぞれ財務資料を前に議論。ホワイトボードに買収スキーム図。",
          explanationVi: "B社 từ chối nhẹ nhàng mức giá đề xuất ('khó nói là phản ánh đầy đủ giá trị'). A社 hỏi về không gian nhượng bộ. FA chuẩn bị đưa phương án điều chỉnh. Đây là giai đoạn thương lượng giá — chưa đổ vỡ, chưa đạt thỏa thuận.",
          skillTag: "multi-party-negotiation",
          difficulty: "hard",
          options: opts(
            "交渉は既に決裂しており、B社は買収を拒否している。",
            "A社の提示額で合意が成立し、契約書の作成段階にある。",
            "買収価格について折り合いがつかず、FAが調整を試みる段階にある。",
            "B社がA社への逆買収を提案している。",
            "C"
          ),
        },
        {
          prompt: "国の審議会で、座長、産業界代表、消費者代表、学識経験者の四者が新規制について議論しています。産業界代表が「過度な規制は技術革新の芽を摘みかねない」と懸念を示し、消費者代表が「安全性の確保は大前提」と反論。学識経験者が「段階的導入と事後評価の仕組みが鍵」と提案。座長が「各委員のご意見を踏まえ、次回までに事務局で論点を整理いただきたい」とまとめています。この議論から読み取れることとして最も適切なものはどれですか。",
          scenario: "政府庁舎の審議会室。長テーブルに座長以下委員が着席。事務局が記録を取っている。",
          explanationVi: "Đại diện công nghiệp lo ngại quy định quá mức, đại diện tiêu dùng yêu cầu an toàn, học giả đề xuất áp dụng từng bước. Chủ tọa yêu cầu ban thư ký chỉnh lý luận điểm. Kết luận: chưa đạt đồng thuận, sẽ tiếp tục thảo luận.",
          skillTag: "committee-deliberation",
          difficulty: "hard",
          options: opts(
            "規制の導入が正式に決定された。",
            "立場の異なる委員間で合意形成には至っておらず、議論は継続される。",
            "産業界の意見が全面的に採用された。",
            "消費者代表が審議会を退席した。",
            "B"
          ),
        },
        {
          prompt: "経営統合に向けた協議で、A社CEO、B社社長、統合準備委員会の委員長が議論しています。A社CEOが「対等の精神を基本としつつ」と前置きした上で存続会社はA社とする案を提示。B社社長が「対等とおっしゃるのであれば、経営体制についても均衡ある配分をご検討いただきたい」と返答。委員長が「では、役員構成と事業セグメントの配分について、具体的な数字を次回ご提示いただけますか」と促しています。B社社長の真意として最も適切なものはどれですか。",
          scenario: "中立地のホテルの個室。三者が非公式に向かい合って座っている。メモ帳のみ。",
          explanationVi: "A社 nói 'trên tinh thần bình đẳng' nhưng đề xuất A社 là pháp nhân tồn tục — mâu thuẫn. B社 phản ứng: nếu bình đẳng thì phải phân bổ cân bằng vị trí quản lý. Ý thật của B社: yêu cầu quyền lực thực chất tương xứng, không chỉ bình đẳng hình thức.",
          skillTag: "merger-negotiation",
          difficulty: "hard",
          options: opts(
            "B社社長は経営統合自体に反対している。",
            "B社社長は形式的な対等ではなく実質的な権限配分を求めている。",
            "B社社長はA社CEOの提案を受け入れている。",
            "B社社長は統合を延期したいと考えている。",
            "B"
          ),
        },
        {
          prompt: "国際共同事業の運営委員会で、日本側代表、欧州側代表、事務局長が四半期レビューを行っています。日本側が「スケジュールの遵守に最善を尽くしておりますが、品質基準の確保との兼ね合いで若干の調整を要する局面がございます」と報告。欧州側が「contractual milestoneへのコミットメントは変わらないという理解でよろしいですか」と確認。事務局長が「では、リスケジュールが必要な場合の手続きを確認させてください」と切り出しています。日本側の報告の真意として最も適切なものはどれですか。",
          scenario: "ビデオ会議画面。日本側オフィス、欧州側オフィス、事務局がそれぞれ映っている。共有画面にガントチャート。",
          explanationVi: "Phía Nhật báo cáo 'đang cố gắng hết sức tuân thủ lịch trình nhưng có giai đoạn cần điều chỉnh nhẹ do cân đối với đảm bảo chất lượng'. Phía Âu hỏi xác nhận cam kết. Thư ký hỏi về quy trình thay đổi lịch. Ý thật của Nhật: đang trễ tiến độ và muốn thông báo gián tiếp.",
          skillTag: "jv-communication",
          difficulty: "hard",
          options: opts(
            "日本側はスケジュール通りに進捗していると報告している。",
            "日本側は遅延の可能性を婉曲的に伝えている。",
            "日本側は品質基準の引き下げを提案している。",
            "日本側は共同事業からの撤退を示唆している。",
            "B"
          ),
        },
        {
          prompt: "企業再建の債権者会議で、メインバンクの担当部長、スポンサー候補企業の社長、再生支援機構の担当者が協議しています。メインバンクが「追加支援の可否については、スポンサー様の事業計画の実現可能性に依拠するところが大きゅうございます」と発言。スポンサー候補が「では、我々の計画に対するデューデリジェンスの範囲と日程をご提示いただけますか」と応じ、機構担当者が「法的整理に移行する場合のタイムラインも念のため並行してご検討いただければ」と付け加えています。機構担当者の発言の意図として最も適切なものはどれですか。",
          scenario: "会議室。債権者リスト、財務諸表、再建計画書が机上に。三者とも厳しい表情。",
          explanationVi: "Cơ quan tái sinh thêm 'xin cũng cân nhắc song song timeline nếu chuyển sang xử lý pháp lý'. Ý: nhắc nhở rằng nếu tái cấu trúc tự nguyện thất bại thì có phương án B (phá sản), tạo áp lực ngầm lên các bên phải đạt thỏa thuận.",
          skillTag: "restructuring-negotiation",
          difficulty: "hard",
          options: opts(
            "機構担当者が法的整理を推奨している。",
            "機構担当者が私的整理の失敗に備え暗に圧力をかけている。",
            "機構担当者がスポンサー候補を支持している。",
            "機構担当者が債権放棄を求めている。",
            "B"
          ),
        },
        {
          prompt: "政府の経済安全保障推進会議で、議長（官房副長官）、経産省局長、防衛省審議官、民間有識者が議論しています。経産省局長が「特定技術の輸出管理強化については、産業競争力への影響を慎重に見極める必要がある」と述べ、防衛省審議官が「安全保障上の要請は産業政策に優先すべき」と主張。有識者が「技術のデュアルユース性を踏まえたきめ細かい判断基準の策定が急務」と提案。議長がこの議論を受けて取るべき行動として最も適切なものはどれですか。",
          scenario: "首相官邸の会議室。出席者はそれぞれの省庁の立場を代表して議論している。",
          explanationVi: "Kinh tế vs An ninh đối lập. Chuyên gia đề xuất tiêu chí chi tiết cho công nghệ lưỡng dụng. Chủ tọa cần tổng hợp để đưa ra hướng đi. Hành động phù hợp: chỉ thị xây dựng tiêu chí phân loại cụ thể, cân bằng cả hai mối quan ngại.",
          skillTag: "security-policy-deliberation",
          difficulty: "hard",
          options: opts(
            "経産省の立場を全面的に支持する。",
            "防衛省の主張に従い即時輸出禁止を決定する。",
            "両省の懸念を踏まえ、具体的な判断基準の策定を事務方に指示する。",
            "議論を打ち切り結論を先送りする。",
            "C"
          ),
        },
        {
          prompt: "グローバル製薬会社の倫理委員会で、チーフ・メディカル・オフィサー、法務部長、外部倫理委員が新薬の臨床試験データについて議論しています。CMOが「有効性データは統計的に有意ですが、サブグループ分析で一部の患者群に予期せぬ有害事象の傾向が認められました」と報告。法務部長が「規制当局への報告義務の範囲を確認すべき」と述べ、外部倫理委員が「被験者の安全を最優先とし、当該サブグループの試験継続可否を直ちに検討すべき」と主張しています。この議論で最も優先されるべき判断基準はどれですか。",
          scenario: "製薬会社の倫理委員会室。スクリーンに臨床試験データのグラフ。委員が深刻な表情で議論。",
          explanationVi: "CMO báo cáo dữ liệu hiệu quả tốt nhưng phân tích phân nhóm phát hiện phản ứng bất lợi ở một số bệnh nhân. Pháp lý hỏi nghĩa vụ báo cáo. Ủy viên đạo đức yêu cầu ưu tiên an toàn bệnh nhân. Tiêu chí ưu tiên: an toàn người tham gia thử nghiệm.",
          skillTag: "ethics-committee",
          difficulty: "hard",
          options: opts(
            "商業的利益を最大化する観点から試験を続行する。",
            "被験者の安全確保を最優先とし、該当群の試験継続可否を検討する。",
            "規制当局への報告を遅らせてデータを追加収集する。",
            "有効性データの統計的有意性のみで承認申請を進める。",
            "B"
          ),
        },
        {
          prompt: "国際合弁会社の役員会で、日本側派遣社長、現地側副社長、本社からの監査役が経営方針の対立について議論しています。日本側社長が「本社の方針との整合性を確保しつつ、現地の事情にも配慮したいと考えておりますが」と述べ、現地副社長が「現地市場を理解しない本社方針の一方的な押し付けには同意しかねます」と強い口調で反論。監査役が「本社としては、ガバナンスの観点から一定の統制は不可欠と考えておりますが、具体的な運営については現地の裁量を尊重する余地もあるかと存じます」と発言しています。監査役の発言の機能として最も適切なものはどれですか。",
          scenario: "合弁会社の現地オフィス。三者が緊迫した雰囲気で向かい合っている。",
          explanationVi: "Giám sát viên can thiệp: thừa nhận cả hai — bản xã cần kiểm soát quản trị nhưng có thể trao quyền tự quyết vận hành cho địa phương. Vai trò: trung gian hòa giải, tìm điểm chung giữa hai bên đối lập.",
          skillTag: "jv-governance",
          difficulty: "hard",
          options: opts(
            "監査役が日本側社長の立場を全面支持している。",
            "監査役が両者の対立を仲裁し妥協点を示唆している。",
            "監査役が現地副社長の解任を示唆している。",
            "監査役が本社への報告義務を放棄している。",
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
          prompt: "【写真：国際貿易交渉の会議室。各国の通商代表団が着席し、スクリーンにはRCEP関税撤廃スケジュールが映し出されている】\n音声：「原産地規則の累積条項につきましては、付加価値基準を40%とする現行案に対し、一部加盟国から繊維・自動車部品セクターにおける例外措置の要望が出ております。次回閣僚会合までに技術的な詰めを行いたく存じます」",
          scenario: "RCEP通商交渉の技術作業部会。各国代表団がU字型に着席、中央スクリーンに関税スケジュール表。",
          explanationVi: "Đại diện thương mại giải thích rằng về điều khoản cộng gộp của quy tắc xuất xứ, một số nước thành viên yêu cầu ngoại lệ cho ngành dệt may và linh kiện ô tô đối với ngưỡng giá trị gia tăng 40% hiện tại. Cần hoàn thiện kỹ thuật trước hội nghị bộ trưởng.",
          skillTag: "trade-negotiation",
          difficulty: "hard",
          options: opts(
            "全加盟国が関税の即時撤廃に合意している。",
            "原産地規則の付加価値基準について一部セクターの例外要望が議論されている。",
            "交渉が決裂し各国代表が退席している。",
            "最終合意文書の署名式が行われている。",
            "B"
          ),
        },
        {
          prompt: "【写真：ESG投資委員会の会議室。大画面にTCFD提言に基づくシナリオ分析結果が表示されている】\n音声：「気候変動関連財務情報開示につきまして、1.5℃シナリオ下での移行リスク評価の結果、当社のスコープ3排出量の90%を占めるサプライチェーン上流の脱炭素化が、2030年目標達成の最大のボトルネックとなることが判明いたしました」",
          scenario: "機関投資家のESG投資委員会室。運用担当者がTCFDシナリオ分析をプレゼン中。",
          explanationVi: "Báo cáo phân tích kịch bản TCFD cho thấy: dưới kịch bản 1.5°C, 90% lượng phát thải Scope 3 đến từ chuỗi cung ứng thượng nguồn, và việc khử cacbon của phần này là nút thắt lớn nhất cho mục tiêu 2030.",
          skillTag: "esg-analysis",
          difficulty: "hard",
          options: opts(
            "企業がスコープ1排出量のゼロ達成を発表している。",
            "TCFD分析でサプライチェーン上流の脱炭素化が最大の課題と報告されている。",
            "投資委員会がESG投資からの撤退を決定している。",
            "企業が2030年目標を前倒し達成したと報告している。",
            "B"
          ),
        },
        {
          prompt: "【写真：外国為替ディーリングルーム。複数のモニターに通貨ペアのチャート、ロイターの速報が流れている】\n音声：「日銀のイールドカーブ・コントロール政策の修正観測を受けまして、10年物国債利回りが急騰、ドル円は148円台後半から145円台前半まで急速に円高が進行しております。クロス円全般に売り圧力が強まっておりますが、実需のドル買いが145円近辺に控えている模様です」",
          scenario: "メガバンクの外国為替ディーリングルーム。ディーラーが複数モニターに向かい緊迫した雰囲気。",
          explanationVi: "Do đồn đoán BOJ sẽ điều chỉnh chính sách YCC, lãi suất JGB 10 năm tăng vọt, USD/JPY giảm nhanh từ 148 xuống 145 (yên tăng giá). Áp lực bán cross-yên mạnh nhưng nhu cầu mua USD thực tế đang chờ quanh 145.",
          skillTag: "forex-trading",
          difficulty: "hard",
          options: opts(
            "日銀がYCC政策の撤廃を正式に発表している。",
            "YCC修正観測を受けた急速な円高進行と市場動向が報告されている。",
            "ディーラーが円売り介入を実施している。",
            "ドル円が150円台に急騰している。",
            "B"
          ),
        },
        {
          prompt: "【写真：国際特許紛争の仲裁廷。日本企業と米国企業の代理人が証拠資料を提示している】\n音声：「本件標準必須特許のライセンス条件につきまして、FRAND宣言に基づく合理的なロイヤリティ料率の算定において、相手方が主張するトップダウン・アプローチは、特許ポートフォリオ全体の価値を過大に見積もるものであり、当方はコンパラブル・ライセンス・アプローチに基づく料率が適切であると主張いたします」",
          scenario: "ICC国際仲裁廷。日本側・米国側の知財弁護士がそれぞれのアプローチを主張。仲裁人3名が聴取中。",
          explanationVi: "Tranh chấp bằng sáng chế thiết yếu tiêu chuẩn (SEP): bên Nhật phản đối phương pháp top-down của đối thủ vì đánh giá quá cao giá trị portfolio, và chủ trương phương pháp comparable license để tính tỷ lệ royalty hợp lý theo cam kết FRAND.",
          skillTag: "ip-arbitration",
          difficulty: "hard",
          options: opts(
            "両社がクロスライセンス契約に合意している。",
            "日本側がFRANDロイヤリティの算定方法について相手方と異なるアプローチを主張している。",
            "仲裁廷が特許無効の判断を下している。",
            "米国企業が標準必須特許の放棄を宣言している。",
            "B"
          ),
        },
        {
          prompt: "【写真：バーゼル銀行監督委員会の年次会合。各国中央銀行の代表が大テーブルを囲んでいる】\n音声：「バーゼルIIIの最終化パッケージにおけるアウトプット・フロアの段階適用につきまして、内部モデル手法を採用する本邦メガバンク3行の自己資本比率への影響は、完全適用時で平均1.2%ポイントの低下が見込まれます。経過措置期間中の資本計画の見直しが急務と認識しております」",
          scenario: "金融庁国際室のブリーフィング。バーゼルIII最終化の国内影響分析が大画面に表示。",
          explanationVi: "Về output floor trong gói hoàn thiện Basel III: khi áp dụng đầy đủ, tỷ lệ vốn tự có của 3 megabank Nhật sử dụng mô hình nội bộ dự kiến giảm trung bình 1.2 điểm phần trăm. Cần rà soát kế hoạch vốn trong giai đoạn chuyển tiếp.",
          skillTag: "banking-regulation",
          difficulty: "hard",
          options: opts(
            "メガバンクがバーゼルIII完全適用で自己資本比率が上昇する。",
            "バーゼルIIIアウトプット・フロアによる邦銀への影響と資本計画見直しの必要性が報告されている。",
            "金融庁がバーゼルIII適用の免除を発表している。",
            "メガバンクが内部モデル手法の使用を中止している。",
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
          prompt: "【資料：連結損益計算書（抜粋）】\n売上高: 3,245,678百万円（前年比+4.2%）\n営業利益: 287,432百万円（前年比▲8.7%）\nEBITDA: 412,890百万円（前年比▲3.1%）\n為替差損: ▲23,456百万円\n減損損失: ▲45,670百万円（のれん減損）\n\n音声：「増収減益の主因は、海外子会社ののれん減損456億円の計上と為替差損235億円でございます。為替影響を除いた実質ベースの営業利益率は前年同水準を維持しておりますが、のれん減損の要因となった欧州事業の収益性改善が来期の最重要課題でございます」",
          scenario: "決算説明会。CFOが機関投資家・アナリストに対し連結業績を説明。",
          explanationVi: "P&L hợp nhất: doanh thu tăng 4.2% nhưng lợi nhuận kinh doanh giảm 8.7%. Nguyên nhân chính: suy giảm lợi thế thương mại 45.6 tỷ yên (châu Âu) và lỗ tỷ giá 23.4 tỷ. Nếu loại trừ ảnh hưởng tỷ giá, biên lợi nhuận thực chất ổn định. Ưu tiên hàng đầu kỳ tới: cải thiện lợi nhuận mảng châu Âu.",
          skillTag: "financial-analysis",
          difficulty: "hard",
          options: opts(
            "営業利益の減少は主に国内事業の不振による。",
            "のれん減損と為替差損が増収減益の主因であり、欧州事業の収益性改善が最重要課題である。",
            "為替差損を除いても営業利益率が大幅に悪化している。",
            "来期はのれんの追加取得により利益改善を図る方針である。",
            "B"
          ),
        },
        {
          prompt: "【資料：規制影響評価書（RIA）— 改正個人情報保護法施行規則】\n規制の目的: 越境データ移転の適正化\n影響を受ける事業者数: 約12,000社\n年間追加コスト（推計）: 中小企業 平均180万円、大企業 平均4,500万円\nベネフィット（推計）: 情報漏洩リスク低減による損害回避額 年間推計1,200億円\n経過措置: 公布後2年間（中小企業は3年間）\n\n音声：「本改正により、クラウドサービスを利用した越境データ移転について、移転先国のデータ保護水準の事前評価が義務化されます。特に中小事業者の負担軽減策として、認定団体による簡易評価スキームの導入と経過措置の1年延長を盛り込んでおります」",
          scenario: "内閣府規制改革推進会議。担当官が規制影響評価書に基づき改正内容を説明。",
          explanationVi: "RIA cho sửa đổi Quy tắc Bảo vệ Thông tin Cá nhân: bắt buộc đánh giá trước mức độ bảo vệ dữ liệu của nước đích khi chuyển dữ liệu xuyên biên giới qua cloud. Giảm gánh nặng cho SME: cơ chế đánh giá đơn giản qua tổ chức được chứng nhận + gia hạn thêm 1 năm.",
          skillTag: "regulatory-analysis",
          difficulty: "hard",
          options: opts(
            "本改正は国内データ移転のみを対象としている。",
            "越境データ移転の事前評価義務化と中小事業者向け負担軽減策が導入される。",
            "全事業者に経過措置なく即時適用される。",
            "規制影響評価の結果、改正が見送られることになった。",
            "B"
          ),
        },
        {
          prompt: "【資料：デリバティブ取引のターム・シート】\n取引種類: クロスカレンシー・スワップ（USD/JPY）\n想定元本: USD 500M / JPY 72,500M\n期間: 5年（2024/4/1 – 2029/3/31）\n固定金利: USD SOFR+85bps / JPY TONA+12bps\n元本交換: 初回・最終時に実施\n担保条件: CSA準拠、日次マージンコール、最低移転額 JPY 500M\nブレーク条項: 3年後に双方オプション行使可\n\n音声：「本取引は外貨建て社債発行に伴う為替リスクのヘッジ目的でございます。ヘッジ会計の適用要件を満たすべく、有効性評価を四半期ごとに実施いたします。なお、3年後のブレーク条項については、金利環境の変化に応じた柔軟な対応を可能とするものであり、ヘッジ関係の指定は全期間を通じて維持する方針でございます」",
          scenario: "財務部のデリバティブ審査委員会。財務担当がターム・シートに基づき取引内容を説明。",
          explanationVi: "Cross-currency swap USD/JPY: hedging rủi ro tỷ giá cho trái phiếu ngoại tệ. Kế toán hedge: đánh giá hiệu lực hàng quý. Break clause sau 3 năm cho linh hoạt nhưng vẫn duy trì chỉ định quan hệ hedge toàn kỳ hạn. Tài sản đảm bảo: theo CSA, margin call hàng ngày.",
          skillTag: "derivatives-finance",
          difficulty: "hard",
          options: opts(
            "本取引は投機目的のデリバティブ取引である。",
            "為替ヘッジ目的のクロスカレンシー・スワップであり、ヘッジ会計適用を維持する方針である。",
            "ブレーク条項により3年後に取引が自動終了する。",
            "担保条件が設定されておらず無担保取引である。",
            "B"
          ),
        },
        {
          prompt: "【資料：取締役会議事録（抜粋）— 第三者割当増資】\n発行株式数: 普通株式 15,000,000株\n発行価格: 1株あたり2,340円（前日終値比 8.2%ディスカウント）\n調達額: 351億円\n割当先: グローバル・パートナーズ・ファンドII（ケイマン籍）\n資金使途: 次世代半導体製造設備投資 250億円、研究開発費 101億円\n希薄化率: 既存株主の議決権ベース 12.8%\n\n音声：「有利発行該当性につきましては、第三者算定機関の意見書を取得しており、8.2%のディスカウントは合理的な範囲内との結論を得ております。なお、本件は既存株主の議決権希薄化率が10%を超えるため、東証の適時開示規則に基づき株主の意思確認手続きが必要となります」",
          scenario: "取締役会。社外取締役を含む出席者が第三者割当増資の適法性・妥当性を審議。",
          explanationVi: "Phát hành cổ phiếu riêng lẻ: 15 triệu cổ, giá chiết khấu 8.2% so với giá đóng cửa, huy động 35.1 tỷ yên. Pha loãng 12.8% → vượt 10% nên cần xác nhận ý chí cổ đông theo quy tắc TSE. Tổ chức định giá độc lập xác nhận mức chiết khấu hợp lý.",
          skillTag: "corporate-finance",
          difficulty: "hard",
          options: opts(
            "第三者割当は株主総会の特別決議なく自由に実施できる。",
            "希薄化率が10%超のため株主意思確認が必要であり、ディスカウント率の合理性は第三者機関が確認している。",
            "発行価格のプレミアムにより既存株主の利益が保護されている。",
            "調達資金は全額を配当に充てる予定である。",
            "B"
          ),
        },
        {
          prompt: "【資料：移転価格税制に関する事前確認（APA）申請概要】\n対象取引: 日本親会社→アジア製造子会社への無形資産使用許諾\n対象期間: 2024年度～2028年度（5年間）\n算定方法: 残余利益分割法（RPSM）\nルーティン利益: 製造子会社 営業利益率5%、販売子会社 営業利益率3%\n残余利益配分: 親会社70%、製造子会社20%、販売子会社10%\nComparables: 同業他社12社の機能・リスク分析に基づく\n\n音声：「BEPS2.0のピラー1における利益配分ルールとの整合性を確保するため、本APAではマーケティング上の無形資産に帰属する超過利益の配分比率について、従来の移転価格ガイドラインに加え、Amount Bの簡素化アプローチも考慮した算定根拠を準備しております」",
          scenario: "国税庁相互協議室でのAPA事前相談。税理士法人のパートナーが申請概要を説明。",
          explanationVi: "APA (Advance Pricing Agreement): phân bổ lợi nhuận giữa công ty mẹ Nhật và các công ty con châu Á cho sử dụng tài sản vô hình. Phương pháp RPSM: lợi nhuận thường xuyên 5%/3%, phần dư chia 70/20/10. Đảm bảo nhất quán với BEPS 2.0 Pillar 1 và Amount B.",
          skillTag: "transfer-pricing",
          difficulty: "hard",
          options: opts(
            "APAは事後的に移転価格を調整する制度である。",
            "残余利益分割法を用いてBEPS2.0との整合性を確保したAPA申請が準備されている。",
            "全利益を製造子会社に配分する方法が採用されている。",
            "本件は国内取引のみを対象としている。",
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
          prompt: "【資料1：グリーンボンド・フレームワーク（抜粋）】\n発行体: 大手電力会社A\n資金使途: 洋上風力発電所建設（適格カテゴリー：再生可能エネルギー）\nプロジェクト評価: 社内ESG委員会による適格性判断\n資金管理: 専用口座による充当資金の追跡管理\nレポーティング: 年次インパクトレポート（CO2削減量、発電量）\n外部評価: セカンドパーティ・オピニオン取得済み\n\n【資料2：第三者意見書（概要）】\n「発行体の石炭火力発電比率は依然として全体の35%を占めており、トランジション戦略の具体性に課題が残る。グリーンウォッシングリスクについて投資家は留意すべきである」\n\n音声：「本グリーンボンドの引受にあたりまして、ICMA原則との適合性は確認されておりますが、第三者意見書で指摘されているトランジション戦略の不透明さについては、発行体との追加的な対話が必要と判断いたしました。特に、石炭火力のフェードアウト・スケジュールの明確化を求めてまいります」",
          scenario: "証券会社の引受審査委員会。引受責任者がグリーンボンドの適格性を審議中。",
          explanationVi: "Green bond framework đáp ứng nguyên tắc ICMA nhưng ý kiến bên thứ ba cảnh báo: tỷ lệ nhiệt điện than 35% → chiến lược chuyển đổi chưa rõ ràng → rủi ro greenwashing. Công ty chứng khoán quyết định cần đối thoại thêm để làm rõ lộ trình loại bỏ than.",
          skillTag: "green-finance",
          difficulty: "hard",
          options: opts(
            "グリーンボンドの発行が中止された。",
            "ICMA原則適合は確認されたが、石炭火力フェードアウト計画の明確化が追加で求められている。",
            "第三者意見書がグリーンウォッシングリスクなしと結論付けた。",
            "発行体が石炭火力を既に全廃している。",
            "B"
          ),
        },
        {
          prompt: "【資料1：サプライチェーン・デューデリジェンス報告書】\nTier 1サプライヤー: 245社（うち高リスク国所在: 38社）\nTier 2サプライヤー: 1,890社（可視化率: 62%）\n人権DD実施率: Tier 1 = 100%、Tier 2 = 34%\n是正措置対象: 12社（強制労働リスク5社、児童労働リスク3社、環境汚染4社）\n\n【資料2：EU企業持続可能性デューデリジェンス指令（CSDDD）適用スケジュール】\n2027年: 従業員5,000人超・売上15億EUR超の企業\n2028年: 従業員3,000人超・売上9億EUR超の企業\n2029年: 従業員1,000人超・売上4.5億EUR超の企業\n制裁: 売上高の5%以下の課徴金\n\n音声：「当社のEU売上比率は28%、従業員数は連結で約8,200名でございますので、2027年の第一陣として適用対象となります。現状のTier 2可視化率62%は不十分であり、2026年度中に85%への引き上げが必要です。また、高リスク国の38社については、現地監査の頻度を年2回に引き上げることを提案いたします」",
          scenario: "グローバル調達本部の定例会議。サステナビリティ推進室長がCSDDD対応状況を報告。",
          explanationVi: "Công ty thuộc nhóm áp dụng CSDDD đầu tiên (2027). Tỷ lệ khả kiến Tier 2 hiện 62% → cần nâng lên 85% trước 2026. 38 nhà cung ứng ở quốc gia rủi ro cao cần kiểm toán tại chỗ 2 lần/năm. 12 nhà cung ứng đang trong diện khắc phục (lao động cưỡng bức, trẻ em, ô nhiễm).",
          skillTag: "supply-chain-compliance",
          difficulty: "hard",
          options: opts(
            "当社は2029年の第三陣としてCSDDD適用対象となる。",
            "Tier 2可視化率の引き上げと高リスク国サプライヤーの監査強化が提案されている。",
            "全Tier 2サプライヤーの人権DDが完了している。",
            "CSDDDの制裁は警告のみで課徴金は科されない。",
            "B"
          ),
        },
        {
          prompt: "【資料1：ストラクチャード・ファイナンス案件概要】\n案件名: プロジェクト・ファイナンス（LNG受入基地）\n総事業費: 4,200億円\nシニアローン: 3,150億円（レバレッジ比率75%）\nメザニン: 420億円\nエクイティ: 630億円（スポンサー出資）\nDSCR要件: 最低1.30x（P50ケース）\nテナー: 建設期間4年 + 返済期間18年\nオフテイカー: 電力会社B（20年長期売買契約）\n\n【資料2：レンダーズ・テクニカル・アドバイザー報告書（抜粋）】\n「P90ケースにおけるDSCRは1.15xまで低下し、コベナンツ抵触リスクが存在する。地震リスク評価において、設計基準を上回る地震動の超過確率が想定より高い」\n\n音声：「レンダーズTAの指摘を踏まえまして、P90ケースでのDSCR改善策として、キャッシュ・スウィープ条項の導入と、地震保険の付保限度額引き上げを条件に組み込むことを提案いたします。加えて、スポンサー・サポート契約による追加出資コミットメントも検討対象といたします」",
          scenario: "シンジケートローンのアレンジャー銀行における与信審査委員会。プロジェクトファイナンス部がリスク分析を報告。",
          explanationVi: "Project finance LNG: vốn vay senior 75%. TA của bên cho vay cảnh báo DSCR xuống 1.15x trong kịch bản P90 + rủi ro động đất cao. Đề xuất giải pháp: điều khoản cash sweep, nâng hạn mức bảo hiểm động đất, cam kết tăng vốn từ sponsor.",
          skillTag: "project-finance",
          difficulty: "hard",
          options: opts(
            "レンダーズTAがプロジェクトのリスクなしと判断した。",
            "P90ケースのDSCR低下リスクに対しキャッシュ・スウィープと保険・スポンサーサポートの追加が提案されている。",
            "プロジェクトの総事業費が削減された。",
            "オフテイカーとの売買契約が解除された。",
            "B"
          ),
        },
        {
          prompt: "【資料1：独占禁止法に基づく企業結合審査（第二次審査通知）】\n当事会社: X社（国内シェア32%）× Y社（国内シェア28%）\n市場画定: 半導体製造装置（露光装置セグメント）\n結合後シェア: 60%（HHI増分: 1,792）\n競争上の懸念: 単独効果（価格引上げ能力）、協調効果\n\n【資料2：当事会社提出の問題解消措置案】\n措置1: Y社の旧世代露光装置事業の第三者への譲渡\n措置2: 競合他社への技術ライセンス供与（5年間）\n措置3: 顧客との長期供給契約における最恵国待遇条項\n\n音声：「公取委としましては、提出された問題解消措置について、措置1の事業譲渡対象の範囲が不十分であると判断しております。具体的には、旧世代のみならず、次世代EUV露光装置の開発部門の一部も譲渡対象に含めない限り、将来市場における競争回復は期待できないと考えます。措置2の技術ライセンスについても、ライセンシーが実効的に競争できるための人的支援を含むべきであると指示いたします」",
          scenario: "公正取引委員会の審査会議。審査官が当事会社の問題解消措置案に対する評価を述べている。",
          explanationVi: "Rà soát sáp nhập giai đoạn 2: thị phần kết hợp 60%, HHI tăng 1792. JFTC đánh giá biện pháp khắc phục chưa đủ: cần bao gồm cả bộ phận R&D EUV thế hệ mới trong phần chuyển nhượng, và license công nghệ phải kèm hỗ trợ nhân sự để bên nhận thực sự cạnh tranh được.",
          skillTag: "antitrust-review",
          difficulty: "hard",
          options: opts(
            "公取委が企業結合を無条件で承認した。",
            "公取委が問題解消措置の範囲拡大を求め、次世代技術と人的支援の追加を指示している。",
            "当事会社が企業結合計画を撤回した。",
            "市場シェアがHHI基準を下回っており審査不要と判断された。",
            "B"
          ),
        },
        {
          prompt: "【資料1：国際租税条約改正議定書の主要条項】\n第7条: 恒久的施設（PE）の定義拡大（デジタルPE概念の導入）\n第12条: 使用料の源泉税率 現行15% → 改正後10%\n第13条: キャピタルゲイン課税の新規定（不動産化体株式）\n第25条: 仲裁条項の導入（MAP未解決案件の義務的仲裁）\n発効要件: 両締約国の国内批准手続き完了後90日\n\n【資料2：企業影響試算】\n対象企業: 日本親会社A（相手国に製造子会社・販売PE）\n現行税負担: 実効税率38.2%（外国税額控除適用後）\n改正後税負担: 実効税率35.7%（源泉税率引下げ・仲裁条項の二重課税排除効果）\n追加PE認定リスク: デジタルPE条項により販売ウェブサイトがPE認定される可能性\n\n音声：「本議定書の批准に際しまして、企業実務への影響として最も注意を要するのは、第7条のデジタルPE条項でございます。現行のウェブサイトを通じた受注活動が恒久的施設と認定された場合、相手国における法人税申告義務が新たに発生いたします。一方で、第25条の義務的仲裁条項の導入により、移転価格に起因する二重課税の解消が制度的に保証される点は、納税者にとって大きなメリットでございます」",
          scenario: "国際税務コンサルティング会社のクライアント・ブリーフィング。パートナーが条約改正の影響を解説。",
          explanationVi: "Nghị định thư sửa đổi hiệp định thuế: (1) mở rộng khái niệm PE sang PE kỹ thuật số → website bán hàng có thể bị coi là PE → phát sinh nghĩa vụ khai thuế tại nước đối tác; (2) thuế nguồn royalty giảm 15%→10%; (3) điều khoản trọng tài bắt buộc đảm bảo xóa bỏ đánh thuế hai lần. Thuế suất hiệu dụng giảm từ 38.2% xuống 35.7%.",
          skillTag: "international-taxation",
          difficulty: "hard",
          options: opts(
            "議定書によりすべての税負担が増加する。",
            "デジタルPE認定による新たな申告義務リスクと義務的仲裁による二重課税排除メリットの両面が指摘されている。",
            "源泉税率が15%から20%に引き上げられる。",
            "仲裁条項は任意であり利用義務はない。",
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
          prompt: "本法に基づく行政処分に対して不服がある者は、処分があったことを知った日の翌日から起算して（　　）以内に審査請求をすることができる。",
          scenario: "行政不服審査法の条文を読解する問題。",
          explanationVi: "Trong Luật Khiếu nại Hành chính, thời hạn yêu cầu xem xét lại là 3 tháng kể từ ngày tiếp theo ngày biết có xử phân hành chính. '起算して' là thuật ngữ pháp lý nghĩa là 'tính từ'.",
          skillTag: "administrative-law-terminology",
          difficulty: "hard",
          options: opts(
            "六十日",
            "三箇月",
            "六箇月",
            "一年",
            "B"
          ),
        },
        {
          prompt: "国際商事仲裁において、仲裁廷が当事者の申立てに基づき相手方の資産を保全するために発する命令を（　　）という。",
          scenario: "国際商事仲裁に関する法務文書の読解。",
          explanationVi: "Trong trọng tài thương mại quốc tế, lệnh mà hội đồng trọng tài ban hành để bảo toàn tài sản của bên đối phương theo yêu cầu của đương sự gọi là '暫定保全措置' (biện pháp bảo toàn tạm thời).",
          skillTag: "international-arbitration-law",
          difficulty: "hard",
          options: opts(
            "差止命令",
            "暫定保全措置",
            "仮処分命令",
            "執行停止決定",
            "B"
          ),
        },
        {
          prompt: "取締役会決議において、特別の利害関係を有する取締役は議決に（　　）ことができない。",
          scenario: "会社法上の取締役会運営に関する文書。",
          explanationVi: "Theo Luật Công ty Nhật Bản, giám đốc có lợi ích đặc biệt liên quan không được tham gia biểu quyết. '加わる' là cách diễn đạt chính thức trong luật.",
          skillTag: "corporate-law",
          difficulty: "hard",
          options: opts(
            "参加する",
            "関与する",
            "加わる",
            "出席する",
            "C"
          ),
        },
        {
          prompt: "「貴省におかれましては、本件に関し格別のご高配を（　　）、誠にありがとうございます」——公式文書の書き出し。",
          scenario: "中央省庁宛の公式要望書の冒頭部分。",
          explanationVi: "'賜り' là dạng kính ngữ tối cao của '受ける/もらう', dùng trong văn thư hành chính/ngoại giao chính thức khi cảm ơn cơ quan cấp trên.",
          skillTag: "official-correspondence-keigo",
          difficulty: "hard",
          options: opts(
            "いただき",
            "くださり",
            "賜り",
            "お与えになり",
            "C"
          ),
        },
        {
          prompt: "ESG報告書において「当社のサプライチェーンにおける人権デューデリジェンスは、国連ビジネスと人権に関する指導原則に（　　）実施しております」の空欄に入る最適な表現は？",
          scenario: "上場企業のESG統合報告書の人権方針セクション。",
          explanationVi: "'則って' (theo đúng/tuân theo) là cách diễn đạt phù hợp nhất khi nói về việc tuân thủ nguyên tắc/tiêu chuẩn quốc tế trong báo cáo ESG.",
          skillTag: "esg-reporting-language",
          difficulty: "hard",
          options: opts(
            "基づいて",
            "則って",
            "沿って",
            "従って",
            "B"
          ),
        },
        {
          prompt: "「部長がお帰りになられましたら、ご連絡（　　）ようお伝えいただけますでしょうか」——この文の敬語として最も適切なものは？",
          scenario: "取引先への電話における伝言依頼。",
          explanationVi: "'いただける' là khiêm nhường ngữ của 'もらえる', kết hợp với 'ご連絡いただけますよう' tạo thành biểu đạt lịch sự nhất khi nhờ đối phương liên lạc lại.",
          skillTag: "advanced-keigo-distinction",
          difficulty: "hard",
          options: opts(
            "くださいます",
            "いただけます",
            "なさいます",
            "差し上げます",
            "B"
          ),
        },
        {
          prompt: "独占禁止法上、市場における競争を実質的に制限する行為を（　　）という。",
          scenario: "独占禁止法（競争法）の基本概念に関する法務研修資料。",
          explanationVi: "'私的独占' là thuật ngữ pháp lý chỉ hành vi hạn chế cạnh tranh thực chất trên thị trường theo Luật Chống độc quyền Nhật Bản.",
          skillTag: "antitrust-law-terminology",
          difficulty: "hard",
          options: opts(
            "不当廉売",
            "私的独占",
            "優越的地位の濫用",
            "不公正な取引方法",
            "B"
          ),
        },
        {
          prompt: "「本議定書の批准、受諾又は承認の文書は、寄託者に（　　）ものとする」——条約文の正しい表現は？",
          scenario: "多国間条約の批准手続条項。",
          explanationVi: "'寄託する' là thuật ngữ ngoại giao/điều ước quốc tế nghĩa là 'gửi lưu chiểu'. Đây là cách diễn đạt cố định trong văn bản điều ước.",
          skillTag: "treaty-language",
          difficulty: "hard",
          options: opts(
            "提出する",
            "届け出る",
            "寄託する",
            "送付する",
            "C"
          ),
        },
        {
          prompt: "「瑕疵ある意思表示」とは（　　）に基づく意思表示を指す概念である。",
          scenario: "民法上の意思表示に関する法律解説書。",
          explanationVi: "'錯誤、詐欺又は強迫' (nhầm lẫn, lừa dối hoặc cưỡng ép) là ba trường hợp làm cho ý chí biểu thị có khuyết điểm theo Bộ luật Dân sự Nhật Bản.",
          skillTag: "civil-law-terminology",
          difficulty: "hard",
          options: opts(
            "善意無過失",
            "錯誤、詐欺又は強迫",
            "権利能力の制限",
            "公序良俗違反",
            "B"
          ),
        },
        {
          prompt: "金融商品取引法において、有価証券の募集又は売出しに際し虚偽記載のある届出書を提出した者は（　　）責任を負う。",
          scenario: "金融商品取引法のディスクロージャー制度に関する条文解説。",
          explanationVi: "'無過失' (không cần chứng minh lỗi) là nguyên tắc trách nhiệm của người nộp bản đăng ký có ghi chép sai sự thật theo Luật Giao dịch Công cụ Tài chính.",
          skillTag: "securities-law",
          difficulty: "hard",
          options: opts(
            "過失",
            "故意又は重過失",
            "無過失",
            "連帯",
            "C"
          ),
        },
        {
          prompt: "「当該案件につきましては、関係各位の（　　）ご理解とご協力を賜りたく、伏してお願い申し上げます」——最も格式高い表現は？",
          scenario: "官公庁から業界団体への協力要請文書。",
          explanationVi: "'格別の' là cách diễn đạt trang trọng nhất trong văn thư hành chính khi yêu cầu sự hiểu biết và hợp tác đặc biệt.",
          skillTag: "formal-governmental-language",
          difficulty: "hard",
          options: opts(
            "特段の",
            "格別の",
            "一層の",
            "特別な",
            "B"
          ),
        },
        {
          prompt: "国際物品売買に関するウィーン条約（CISG）において、買主が物品の不適合を売主に通知すべき「合理的な期間」を徒過した場合、買主は（　　）を失う。",
          scenario: "国際売買契約に関する法務研修資料。",
          explanationVi: "Theo CISG, nếu người mua không thông báo về sự không phù hợp trong 'thời hạn hợp lý', họ mất quyền viện dẫn sự không phù hợp đó ('不適合を援用する権利').",
          skillTag: "international-trade-law",
          difficulty: "hard",
          options: opts(
            "契約を解除する権利",
            "損害賠償を請求する権利",
            "不適合を援用する権利",
            "代金減額を請求する権利",
            "C"
          ),
        },
        {
          prompt: "「弊社と致しましては、何卒ご寛恕の程（　　）次第でございます」——正しい結びの表現は？",
          scenario: "重大なミスに対する取引先への詫び状の結語部分。",
          explanationVi: "'お願い申し上げる' là biểu đạt khiêm nhường tối cao trong thư xin lỗi chính thức. 'ご寛恕の程お願い申し上げる次第' nghĩa là 'xin hãy tha thứ'.",
          skillTag: "formal-apology-expression",
          difficulty: "hard",
          options: opts(
            "お願いいたす",
            "お願い申し上げる",
            "お願いする",
            "お願い致したい",
            "B"
          ),
        },
        {
          prompt: "「前項の規定に（　　）、緊急やむを得ない事由があるときは、この限りでない」——法律条文の除外規定に使う正しい接続表現は？",
          scenario: "法律条文における除外規定の典型的な構文。",
          explanationVi: "'かかわらず' là liên từ pháp lý dùng để giới thiệu điều khoản ngoại lệ. 'にかかわらず' = bất kể/mặc dù, dùng khi quy định loại trừ khỏi nguyên tắc chung.",
          skillTag: "legal-connective-expressions",
          difficulty: "hard",
          options: opts(
            "もとづき",
            "かかわらず",
            "したがい",
            "おいて",
            "B"
          ),
        },
        {
          prompt: "取締役の善管注意義務とは、取締役が会社に対して負う（　　）の注意をもって職務を遂行する義務をいう。",
          scenario: "会社法上のコーポレートガバナンスに関する解説資料。",
          explanationVi: "'善良なる管理者' là khái niệm pháp lý chỉ mức độ cẩn trọng mà một người quản lý thiện chí bình thường phải có. Viết tắt là '善管注意義務'.",
          skillTag: "corporate-governance-law",
          difficulty: "hard",
          options: opts(
            "最善の努力",
            "善良なる管理者",
            "相当の程度",
            "合理的な範囲",
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
          prompt: "外交書簡で「貴国政府の英断に深甚なる敬意を表するとともに、今後とも（　　）関係の一層の深化を図る所存であります」——最も適切な外交表現は？",
          scenario: "外務大臣から駐日大使への公式書簡。二国間関係に関する文書。",
          explanationVi: "'互恵的' (互恵的 = cùng có lợi/hỗ huệ) là từ ngoại giao chuẩn mực dùng để chỉ mối quan hệ đôi bên cùng có lợi trong văn thư chính thức.",
          skillTag: "diplomatic-expression",
          difficulty: "hard",
          options: opts(
            "友好的",
            "互恵的",
            "建設的",
            "包括的",
            "B"
          ),
        },
        {
          prompt: "CEOの書簡で「今般の経営判断につきましては、株主の皆様に多大なるご心配をおかけいたしましたことを（　　）お詫び申し上げます」——最上級の謝罪表現は？",
          scenario: "不祥事後の株主宛CEO書簡の冒頭部分。",
          explanationVi: "'衷心より' (từ đáy lòng) là biểu đạt xin lỗi ở mức cao nhất trong thư CEO gửi cổ đông, thể hiện sự chân thành tuyệt đối.",
          skillTag: "executive-apology-expression",
          difficulty: "hard",
          options: opts(
            "心より",
            "深く",
            "衷心より",
            "誠に",
            "C"
          ),
        },
        {
          prompt: "「仮に御社のご提案を受け入れた場合におきましても、弊社の既存の契約上の義務との（　　）が生じる可能性を否定できない状況にございます」——ビジネス交渉における条件付き懸念表現として最適なものは？",
          scenario: "業務提携交渉における懸念事項を伝えるメール。",
          explanationVi: "'抵触' (xung đột/mâu thuẫn) là thuật ngữ pháp lý-kinh doanh dùng để chỉ sự xung đột giữa nghĩa vụ hợp đồng, phù hợp nhất trong bối cảnh đàm phán.",
          skillTag: "business-conditional-expression",
          difficulty: "hard",
          options: opts(
            "矛盾",
            "抵触",
            "齟齬",
            "相違",
            "B"
          ),
        },
        {
          prompt: "規制当局への回答書で「ご指摘の事項につきましては、（　　）受け止め、再発防止策の策定に着手いたしました」——最も格式高い受諾表現は？",
          scenario: "金融規制当局の検査指摘に対する公式回答書。",
          explanationVi: "'真摯に' (chân thành/nghiêm túc) là biểu đạt tiếp nhận chỉ trích/chỉ đạo từ cơ quan quản lý ở mức cao nhất, thể hiện thái độ cầu thị.",
          skillTag: "regulatory-response-expression",
          difficulty: "hard",
          options: opts(
            "厳粛に",
            "真摯に",
            "謙虚に",
            "深刻に",
            "B"
          ),
        },
        {
          prompt: "「本提携の成否は、双方の経営資源の（　　）的な活用にかかっていると申しても過言ではございません」——経営幹部のプレゼンテーション表現として最適なものは？",
          scenario: "業務提携に関する経営会議でのプレゼンテーション。",
          explanationVi: "'相乗' (相乗的 = hiệp đồng/synergy) là khái niệm kinh doanh chỉ việc kết hợp nguồn lực để tạo ra giá trị lớn hơn tổng các phần.",
          skillTag: "executive-presentation-expression",
          difficulty: "hard",
          options: opts(
            "効率",
            "相乗",
            "最大",
            "統合",
            "B"
          ),
        },
        {
          prompt: "「誠に恐縮ではございますが、本件につきましては弊社の（　　）を超えるものと判断せざるを得ず、ご期待に沿いかねます旨、何卒ご了承賜りたく存じます」——丁寧な拒否表現として正しいものは？",
          scenario: "取引先からの無理な要求に対する丁重な辞退文書。",
          explanationVi: "'権限の範囲' (phạm vi thẩm quyền) là cách từ chối lịch sự nhất — ngụ ý rằng không phải không muốn mà là vượt quá quyền hạn.",
          skillTag: "polite-refusal-expression",
          difficulty: "hard",
          options: opts(
            "能力の限界",
            "権限の範囲",
            "対応の余地",
            "責任の所在",
            "B"
          ),
        },
        {
          prompt: "「今後の対応方針につきましては、関係各位と（　　）の上、改めてご報告申し上げる所存でございます」——意思決定プロセスを表す最も格式高い表現は？",
          scenario: "危機管理委員会から取締役会への中間報告書。",
          explanationVi: "'協議' (hiệp nghị/thảo luận chính thức) là từ chuẩn mực nhất trong văn thư kinh doanh để chỉ quá trình tham vấn/bàn bạc chính thức trước khi ra quyết định.",
          skillTag: "formal-decision-process-expression",
          difficulty: "hard",
          options: opts(
            "検討",
            "協議",
            "審議",
            "調整",
            "B"
          ),
        },
        {
          prompt: "「弊社の不手際により多大なるご迷惑をおかけいたしましたことは（　　）の至りでございます」——最上級の遺憾表現は？",
          scenario: "重大なサービス障害後の顧客企業への公式謝罪書。",
          explanationVi: "'慚愧' (tàm quý = hổ thẹn sâu sắc) là biểu đạt hối tiếc/xấu hổ ở mức cao nhất trong tiếng Nhật kinh doanh, dùng khi lỗi nghiêm trọng.",
          skillTag: "supreme-regret-expression",
          difficulty: "hard",
          options: opts(
            "遺憾",
            "痛恨",
            "慚愧",
            "自責",
            "C"
          ),
        },
        {
          prompt: "「本合意書の解釈又は適用に関して紛争が生じた場合には、（　　）誠実に協議するものとする」——契約書における紛争解決条項の定型表現は？",
          scenario: "国際業務提携契約書の紛争解決条項。",
          explanationVi: "'まず' (trước hết) là từ chuẩn trong điều khoản giải quyết tranh chấp, quy định các bên phải thương lượng thiện chí trước khi đưa ra trọng tài/tòa án.",
          skillTag: "contract-dispute-clause-expression",
          difficulty: "hard",
          options: opts(
            "直ちに",
            "まず",
            "速やかに",
            "必ず",
            "B"
          ),
        },
        {
          prompt: "「今般の人事異動に伴い、後任として着任いたしました○○でございます。前任者同様、（　　）お引き立てを賜りますよう、よろしくお願い申し上げます」——着任挨拶状の結びとして最適な表現は？",
          scenario: "新任役員から取引先への着任挨拶状。",
          explanationVi: "'変わらぬ' (không đổi/như trước) là cách diễn đạt chuẩn mực trong thư nhậm chức, thể hiện mong muốn tiếp tục nhận được sự ủng hộ như người tiền nhiệm.",
          skillTag: "business-greeting-expression",
          difficulty: "hard",
          options: opts(
            "一層の",
            "変わらぬ",
            "格別の",
            "末永い",
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
          prompt: "この契約条項において、売主の表明保証違反が発覚した場合、買主が取り得る措置として正しいものはどれか。",
          scenario: "第12条（表明保証違反の場合の措置）\n本契約締結日以降、売主の表明保証に重大な違反が判明した場合、買主は売主に対し書面による通知を行い、当該通知受領後30営業日以内に是正がなされないときは、本契約を解除し、既払金の返還及び損害賠償を請求することができる。ただし、買主が当該違反を契約締結時に知り又は知り得べきであった場合はこの限りでない。",
          explanationVi: "Theo điều khoản, khi phát hiện vi phạm cam đoan bảo đảm của bên bán, bên mua phải thông báo bằng văn bản và chờ 30 ngày làm việc để sửa chữa. Nếu không sửa chữa, bên mua có thể hủy hợp đồng, yêu cầu hoàn tiền và bồi thường thiệt hại.",
          skillTag: "ma-contract-reading",
          difficulty: "hard",
          options: opts(
            "直ちに契約を解除し、損害賠償を請求できる。",
            "書面通知後30営業日の是正期間を経て、解除・返還・損害賠償を請求できる。",
            "仲裁機関に調停を申し立てなければならない。",
            "売主が違反を認めた場合のみ契約を解除できる。",
            "B"
          ),
        },
        {
          prompt: "このESG報告書の記述から読み取れる、同社のScope 3排出削減に関する方針として最も適切なものはどれか。",
          scenario: "サステナビリティ報告書抜粋：\n当社グループはScope 1・2排出量の2030年ネットゼロを宣言いたしました。Scope 3につきましては、サプライヤーエンゲージメントプログラムを通じ、主要取引先100社に対しSBT整合目標の設定を要請しております。2025年度実績として、Tier 1サプライヤーの68%がSBT目標を設定済みであり、残る32%については個別支援プログラムを展開中です。",
          explanationVi: "Báo cáo cho thấy công ty yêu cầu 100 đối tác chính thiết lập mục tiêu phù hợp SBT, 68% đã hoàn thành, và đang hỗ trợ 32% còn lại. Đây là chiến lược giảm phát thải Scope 3 thông qua hợp tác chuỗi cung ứng.",
          skillTag: "esg-report-comprehension",
          difficulty: "hard",
          options: opts(
            "Scope 3は対象外としている。",
            "サプライヤーとの協働により段階的にSBT整合目標の設定を推進している。",
            "2030年までにScope 3もネットゼロを達成する。",
            "Tier 1サプライヤー全社がすでにSBT目標を達成した。",
            "B"
          ),
        },
        {
          prompt: "この政府白書の記述から、デジタル人材政策の主な課題として指摘されているものはどれか。",
          scenario: "経済産業省白書抜粋：\nデジタル・トランスフォーメーションの推進に不可欠な高度IT人材について、2025年時点で約36万人の需給ギャップが存在する。従来型のIT人材は供給過多傾向にある一方、AI・データサイエンス・サイバーセキュリティ分野の専門人材は絶対数が不足している。リスキリング施策の充実と産学連携による育成体制の構築が急務である。",
          explanationVi: "Sách trắng chỉ ra: thiếu hụt 36 vạn nhân lực IT cao cấp, thừa nhân lực IT truyền thống, thiếu chuyên gia AI/Data Science/Cyber Security. Giải pháp cấp bách là nâng cao kỹ năng lại (reskilling) và hợp tác sản-học.",
          skillTag: "government-whitepaper-reading",
          difficulty: "hard",
          options: opts(
            "IT人材全体が不足している。",
            "先端分野の専門人材の絶対数不足と従来型人材の供給過多という構造的ミスマッチ。",
            "海外からの人材受け入れが唯一の解決策である。",
            "リスキリング施策は不要と判断されている。",
            "B"
          ),
        },
        {
          prompt: "このコンプライアンス通知の内容として、従業員に求められている対応はどれか。",
          scenario: "社内通知：\n件名：改正個人情報保護法への対応について\n本年4月1日施行の改正法により、個人関連情報の第三者提供に際しては本人同意の取得が義務化されます。各部門においては、現行の業務フローを点検し、該当する処理がある場合は3月15日までにコンプライアンス部宛てに報告してください。なお、改正法対応研修を2月中に全社員必須で実施予定です。",
          explanationVi: "Thông báo yêu cầu nhân viên: (1) kiểm tra quy trình nghiệp vụ hiện tại, (2) nếu có xử lý liên quan thì báo cáo bộ phận Compliance trước 15/3, (3) tham gia đào tạo bắt buộc trong tháng 2.",
          skillTag: "compliance-document-reading",
          difficulty: "hard",
          options: opts(
            "改正法の施行を延期するよう当局に申請する。",
            "業務フローを点検し、該当処理を期限内に報告するとともに研修に参加する。",
            "個人関連情報の取り扱いを全面停止する。",
            "コンプライアンス部の指示を待って何もしない。",
            "B"
          ),
        },
        {
          prompt: "この国際取引契約の不可抗力条項において、COVID-19のようなパンデミックが不可抗力に該当するための条件として正しいものはどれか。",
          scenario: "第18条（不可抗力）\nいずれの当事者も、天災、戦争、テロ行為、政府の行為、疫病の蔓延その他当事者の合理的な支配を超える事象（以下「不可抗力事象」）により本契約上の義務の履行が妨げられた場合、当該不履行について責任を負わない。ただし、影響を受けた当事者は、(i)不可抗力事象の発生後5営業日以内に相手方に書面で通知し、(ii)影響を最小化するための合理的な努力を行い、(iii)不可抗力事象の終了後速やかに履行を再開しなければならない。",
          explanationVi: "Để viện dẫn bất khả kháng, bên bị ảnh hưởng phải: (1) thông báo bằng văn bản trong 5 ngày làm việc, (2) nỗ lực hợp lý để giảm thiểu ảnh hưởng, (3) khôi phục nghĩa vụ ngay sau khi sự kiện kết thúc.",
          skillTag: "force-majeure-clause-reading",
          difficulty: "hard",
          options: opts(
            "パンデミックは自動的に不可抗力に該当し、通知は不要。",
            "5営業日以内の通知、影響最小化努力、終了後の速やかな履行再開が条件。",
            "政府の緊急事態宣言がなければ不可抗力とは認められない。",
            "不可抗力を主張するには裁判所の認定が必要。",
            "B"
          ),
        },
        {
          prompt: "この取締役会議事録から、議案の決議結果として正しいものはどれか。",
          scenario: "取締役会議事録抜粋：\n第3号議案：子会社株式の譲渡の件\n議長より、当社100%子会社であるX社の全株式をY社に譲渡する旨の提案がなされた。取締役8名中、特別利害関係人であるA取締役を除く7名が審議に参加し、賛成5名、反対2名により本議案は可決された。なお、A取締役は議決に加わらなかった旨を議事録に記録する。",
          explanationVi: "Biên bản ghi: 8 giám đốc, trừ A (có lợi ích liên quan) = 7 người tham gia. Kết quả: 5 tán thành, 2 phản đối → nghị quyết được thông qua. A không tham gia biểu quyết được ghi nhận.",
          skillTag: "board-minutes-reading",
          difficulty: "hard",
          options: opts(
            "全員一致で可決された。",
            "特別利害関係人を除く7名中賛成5名で可決された。",
            "定足数不足により否決された。",
            "A取締役の反対により否決された。",
            "B"
          ),
        },
        {
          prompt: "この規制当局の行政指導文書において、事業者に課された改善期限と報告義務はどれか。",
          scenario: "行政指導文書：\n貴社の顧客情報管理態勢について、当局検査において以下の不備が認められた。(1)アクセスログの保存期間が法定基準を下回っている、(2)委託先管理に関する規程が未整備である。貴社におかれましては、本書面受領日から60日以内に改善計画を策定し、90日以内に是正措置を完了の上、完了報告書を当局に提出されたい。",
          explanationVi: "Văn bản hướng dẫn hành chính yêu cầu: (1) trong 60 ngày lập kế hoạch cải thiện, (2) trong 90 ngày hoàn thành biện pháp sửa chữa và nộp báo cáo hoàn thành cho cơ quan quản lý.",
          skillTag: "regulatory-guidance-reading",
          difficulty: "hard",
          options: opts(
            "30日以内に改善完了し口頭で報告する。",
            "60日以内に改善計画を策定し、90日以内に是正完了・完了報告書を提出する。",
            "期限の定めなく改善に取り組む。",
            "外部監査法人による検証報告のみ提出する。",
            "B"
          ),
        },
        {
          prompt: "この国際合弁契約のデッドロック条項において、双方の合意に至らない場合の最終的な解決手段はどれか。",
          scenario: "合弁契約書抜粋：\n第22条（デッドロック解消手続）\n取締役会又は株主総会において重要事項に関する決議が2回連続して否決された場合（以下「デッドロック」）、両当事者は以下の手続に従う。(1)各当事者のCEOによる30日間の誠実協議、(2)協議不調の場合、独立第三者による60日間の調停、(3)調停不調の場合、いずれの当事者もput/callオプションを行使し、相手方持分を時価で買い取ることができる。",
          explanationVi: "Điều khoản bế tắc quy định 3 bước: (1) CEO hai bên thương lượng 30 ngày, (2) hòa giải bởi bên thứ ba 60 ngày, (3) nếu thất bại, bất kỳ bên nào có thể thực hiện quyền chọn put/call để mua lại phần của đối phương theo giá thị trường.",
          skillTag: "jv-contract-reading",
          difficulty: "hard",
          options: opts(
            "国際仲裁に付託する。",
            "CEO協議→調停→put/callオプションによる持分買取。",
            "合弁会社を直ちに清算する。",
            "過半数株主が相手方を強制的に排除する。",
            "B"
          ),
        },
        {
          prompt: "この内部通報制度規程から、通報者保護に関して正しく読み取れるものはどれか。",
          scenario: "内部通報制度規程抜粋：\n第8条（通報者の保護）\n会社は、通報者に対し、通報を理由とするいかなる不利益取扱い（解雇、降格、減給、配置転換その他の不利益な措置を含む。）も行ってはならない。通報者の氏名その他通報者を特定し得る情報は、通報対応業務従事者以外に開示してはならない。本条に違反した者は、就業規則に基づく懲戒処分の対象とする。",
          explanationVi: "Quy chế bảo vệ người tố giác: (1) cấm mọi đối xử bất lợi vì lý do tố giác, (2) thông tin nhận dạng chỉ được tiết lộ cho người phụ trách xử lý, (3) vi phạm sẽ bị kỷ luật theo nội quy lao động.",
          skillTag: "whistleblower-policy-reading",
          difficulty: "hard",
          options: opts(
            "通報者の氏名は全従業員に開示される。",
            "通報を理由とする不利益取扱いは禁止され、違反者は懲戒対象となる。",
            "通報者保護は管理職のみに適用される。",
            "匿名通報は受け付けないと明記されている。",
            "B"
          ),
        },
        {
          prompt: "このクロスボーダー送金に関する規制文書から、送金事業者に課された主な義務として正しいものはどれか。",
          scenario: "資金決済法施行規則改正通知抜粋：\n改正規則により、海外送金を取り扱う資金移動業者は、(1)送金額が10万円を超える取引について送金人及び受取人の本人確認を厳格化すること、(2)制裁対象国への送金について、外為法に基づくフィルタリングシステムを導入すること、(3)疑わしい取引の届出を取引日から3営業日以内に行うこと、が義務付けられる。施行日は本年10月1日とする。",
          explanationVi: "Thông báo sửa đổi quy định yêu cầu nhà cung cấp dịch vụ chuyển tiền: (1) xác minh danh tính nghiêm ngặt cho giao dịch trên 10 vạn yên, (2) lắp đặt hệ thống lọc cho chuyển tiền đến nước bị trừng phạt, (3) báo cáo giao dịch đáng ngờ trong 3 ngày làm việc.",
          skillTag: "financial-regulation-reading",
          difficulty: "hard",
          options: opts(
            "全ての送金について上限額が10万円に制限される。",
            "本人確認厳格化、制裁国フィルタリング導入、疑わしい取引の3営業日以内届出。",
            "海外送金業務そのものが禁止される。",
            "届出義務は年1回の定期報告のみ。",
            "B"
          ),
        },
      ],
    },
  ],
};
