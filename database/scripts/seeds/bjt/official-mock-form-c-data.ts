/**
 * Independent content bank for full-simulation form C.
 *
 * These items are authored from separate scenarios and learning objectives.
 * They do not parameterize form A/B items by swapping organizations, people,
 * products, dates, or quantities.
 */

export type IndependentMockDraft = {
  prompt: string;
  scenario: string | null;
  audioScript: string | null;
  imageAlt: null;
  imagePrompt: null;
  explanationVi: string;
  skillTag: string;
  businessSituation: string;
  stimulusKind: string;
  choices: {
    correct: string;
    distractors: readonly [string, string, string];
  };
  tags?: string[];
};

type IndependentSectionCode =
  | "LC_SCENE"
  | "LC_STATEMENT"
  | "LC_INTEGRATED"
  | "LR_SITUATION"
  | "LR_DOCUMENT"
  | "LR_INTEGRATED"
  | "RC_VOCAB_GRAMMAR"
  | "RC_EXPRESSION"
  | "RC_INTEGRATED";

function d(
  prompt: string,
  scenario: string | null,
  audioScript: string | null,
  correct: string,
  distractors: readonly [string, string, string],
  explanationVi: string,
  skillTag: string,
  businessSituation: string,
  stimulusKind: string
): IndependentMockDraft {
  return {
    prompt,
    scenario,
    audioScript,
    imageAlt: null,
    imagePrompt: null,
    explanationVi,
    skillTag,
    businessSituation,
    stimulusKind,
    choices: { correct, distractors }
  };
}

export const FORM_C_SECTION_DRAFTS: Record<IndependentSectionCode, IndependentMockDraft[]> = {
  LC_SCENE: [
    d(
      "避難訓練中の放送を聞きました。フロア責任者が最初に行うことは何ですか。",
      "オフィスで地震を想定した避難訓練が始まり、社員が机の下で安全を確保している。",
      "揺れが収まった想定です。フロア責任者は出口の安全を確認してから、避難経路ごとに誘導を開始してください。",
      "出口の安全を確認してから社員を誘導する。",
      [
        "すぐ全員をエレベーターへ集める。",
        "訓練終了まで机の下で待つ。",
        "各自の判断で建物を出てもらう。"
      ],
      "Chỉ dẫn yêu cầu người phụ trách kiểm tra lối ra trước rồi mới tổ chức sơ tán.",
      "emergency_evacuation_leadership",
      "internal_coordination",
      "photo"
    ),
    d(
      "入館証を紛失した社員への対応として最も適切なものはどれですか。",
      "セキュリティゲート前で社員が入館証を探し、警備員に事情を説明している。",
      "入館証が見当たりません。最後に使った場所は食堂ですが、外へ出てから気づきました。",
      "本人確認後に一時証を発行し、紛失した証明書を直ちに無効化する。",
      [
        "同僚の入館証を借りてもらう。",
        "見つかるまで自由に入館させる。",
        "翌日の朝まで何もしない。"
      ],
      "Mất thẻ ra vào phải xác minh danh tính, vô hiệu hóa thẻ cũ và cấp thẻ tạm theo quy trình.",
      "access_badge_incident",
      "internal_coordination",
      "photo"
    ),
    d(
      "海外拠点との打ち合わせで、通訳担当が不在です。司会の対応として最も適切なものはどれですか。",
      "会議室の大型画面に海外チームが接続しているが、予定していた通訳がまだ参加していない。",
      "通訳担当から、交通機関の遅れで十五分ほど遅れると連絡がありました。",
      "目的と進行を英語資料で確認できる範囲から始め、重要な交渉事項は通訳参加後に扱う。",
      [
        "交渉条件まで機械翻訳だけで決定する。",
        "海外側への説明なしに会議を終了する。",
        "通訳が来るまで全員を無言で待たせる。"
      ],
      "Có thể dùng thời gian cho nội dung xác nhận chung, nhưng điều khoản quan trọng nên chờ phiên dịch.",
      "bilingual_meeting_contingency",
      "meeting",
      "photo"
    ),
    d(
      "冷蔵倉庫で温度警報が出ています。担当者の最初の行動は何ですか。",
      "食品を保管する冷蔵倉庫で警報灯が点滅し、温度表示が規定値を上回っている。",
      "第三倉庫の温度が上限を超えました。扉を閉めたまま、予備倉庫の空きと保管品の状態を確認してください。",
      "扉を開けず、保管品と予備倉庫の状況を確認して移送準備をする。",
      [
        "警報音だけを止めて作業を続ける。",
        "すべての商品を廊下へ出す。",
        "翌日の点検まで温度を記録しない。"
      ],
      "Cần tránh làm nhiệt độ tăng thêm, kiểm tra hàng và sức chứa kho dự phòng trước khi di chuyển.",
      "cold_chain_alarm_response",
      "internal_coordination",
      "photo"
    ),
    d(
      "車いす利用者がショールームを訪れました。案内担当の最も適切な対応はどれですか。",
      "ショールーム入口で来場者が段差のない見学経路について尋ねている。",
      "二階の展示も見たいのですが、エレベーターまでの経路を教えていただけますか。",
      "利用可能な経路を本人に説明し、希望を確認してから案内する。",
      [
        "本人に聞かず一階だけの見学に変更する。",
        "同行者に車いすを階段で運んでもらう。",
        "混雑が解消するまで屋外で待ってもらう。"
      ],
      "Hỗ trợ tiếp cận cần tôn trọng lựa chọn của khách, giải thích lộ trình và xác nhận nhu cầu trước.",
      "accessible_visitor_guidance",
      "sales_customer",
      "photo"
    )
  ],
  LC_STATEMENT: [
    d(
      "為替予約に関する説明を聞いてください。財務担当が提案していることは何ですか。",
      "海外仕入れの支払計画を説明する音声。",
      "三か月後のドル建て支払いについて、全額ではなく半分だけ為替予約を行い、残りは相場を見ながら判断する案です。",
      "支払額の半分を先に為替予約する。",
      [
        "支払いをすべて中止する。",
        "全額を今日すぐ現金で払う。",
        "ドル建て契約を円建てに自動変更する。"
      ],
      "Đề xuất là phòng ngừa rủi ro tỷ giá cho một nửa khoản thanh toán, không phải toàn bộ.",
      "currency_hedging_listening",
      "report_document",
      "audio"
    ),
    d(
      "情報セキュリティ部からの注意を聞いてください。社員がしてはいけないことは何ですか。",
      "不審メールへの対応を周知する音声。",
      "件名が『容量超過のお知らせ』となっていても、メール内のリンクからパスワードを入力しないでください。まず社内窓口へ転送してください。",
      "メール内のリンクからパスワードを入力すること。",
      ["不審メールを社内窓口へ転送すること。", "送信元を確認すること。", "窓口の指示を待つこと。"],
      "Cảnh báo cấm nhập mật khẩu qua liên kết trong email đáng ngờ.",
      "phishing_instruction",
      "internal_coordination",
      "audio"
    ),
    d(
      "稟議の結果を聞いてください。条件付きで承認された内容は何ですか。",
      "設備購入申請への決裁コメント。",
      "購入自体は承認します。ただし、保守契約は三年ではなく一年で開始し、更新時に利用実績を報告してください。",
      "保守契約を一年で始め、更新時に実績を報告する。",
      [
        "設備購入そのものを取り消す。",
        "三年契約をそのまま締結する。",
        "保守契約を付けずに購入する。"
      ],
      "Phê duyệt có điều kiện: hợp đồng bảo trì một năm và đánh giá khi gia hạn.",
      "conditional_approval_listening",
      "report_document",
      "audio"
    ),
    d(
      "需要予測の説明を聞いてください。生産部が注意すべき時期はいつですか。",
      "季節商品の需要予測に関する音声。",
      "例年は七月がピークですが、今年は大型連休の影響で六月後半から注文が増える見込みです。資材は五月中に確保してください。",
      "六月後半の需要増加に備え、五月中に資材を確保する。",
      [
        "七月が終わってから資材を買う。",
        "六月前半に生産を止める。",
        "大型連休後まで需要予測を作らない。"
      ],
      "Năm nay nhu cầu tăng sớm từ cuối tháng Sáu, nên vật tư phải được bảo đảm trong tháng Năm.",
      "seasonal_demand_forecast",
      "report_document",
      "audio"
    ),
    d(
      "議事録の訂正依頼を聞いてください。どこを直しますか。",
      "会議参加者から記録担当への音声メッセージ。",
      "決定事項の二番は『新店舗を開設する』ではなく、『候補地の調査を始める』です。決定と検討を区別して記載してください。",
      "新店舗開設の決定を、候補地調査開始へ訂正する。",
      ["会議の日付を変更する。", "出席者を一人削除する。", "調査結果を決定事項として追加する。"],
      "Nội dung đúng mới chỉ quyết định khảo sát địa điểm, chưa quyết định mở cửa hàng.",
      "minutes_accuracy_correction",
      "meeting",
      "audio"
    ),
    d(
      "輸出書類に関する説明を聞いてください。追加で必要な書類は何ですか。",
      "海外発送前の書類確認。",
      "請求書と梱包明細はそろっていますが、原産地証明書がありません。通関依頼の前に商工会議所へ申請してください。",
      "原産地証明書。",
      ["請求書。", "梱包明細。", "国内配送伝票。"],
      "Hóa đơn và bảng kê đã có; còn thiếu giấy chứng nhận xuất xứ.",
      "export_document_listening",
      "report_document",
      "audio"
    ),
    d(
      "残業時間に関する説明を聞いてください。管理者が行うことは何ですか。",
      "月末の勤怠確認に関する音声。",
      "今月三十時間を超えた社員には、来月の業務予定を確認する面談を実施してください。単に申請を承認するだけでは不十分です。",
      "対象社員と来月の業務予定を確認する面談を行う。",
      ["超過分の記録を削除する。", "全社員の残業を禁止する。", "申請を確認せず自動承認する。"],
      "Quản lý phải trao đổi kế hoạch công việc tháng tới với nhân viên vượt ngưỡng.",
      "overtime_management_action",
      "hr_interview",
      "audio"
    ),
    d(
      "契約更新の案内を聞いてください。自動更新を止めるにはどうしますか。",
      "法人向けサービスの更新条件。",
      "契約は満了日の三十日前に自動更新されます。更新しない場合は、四十五日前までに管理者から書面で通知してください。",
      "満了日の四十五日前までに管理者が書面で通知する。",
      [
        "満了日の当日に電話する。",
        "三十日前に利用者個人が口頭で伝える。",
        "更新後に請求書を返送する。"
      ],
      "Muốn không tự động gia hạn phải gửi thông báo bằng văn bản trước 45 ngày.",
      "renewal_notice_requirement",
      "sales_customer",
      "audio"
    ),
    d(
      "メンター制度の説明を聞いてください。相談内容の扱いはどうなりますか。",
      "新入社員向けオリエンテーション。",
      "相談内容は原則として本人の同意なく上司へ共有しません。ただし、安全や法令に関わる重大な問題は人事へ報告します。",
      "原則は非共有だが、重大な安全・法令問題は人事へ報告する。",
      [
        "すべて自動的に上司へ送る。",
        "どのような内容も絶対に共有しない。",
        "相談記録を社内全員が閲覧できる。"
      ],
      "Nguyên tắc là bảo mật, nhưng có ngoại lệ cho vấn đề nghiêm trọng về an toàn/pháp luật.",
      "mentoring_confidentiality",
      "hr_interview",
      "audio"
    ),
    d(
      "内部監査の説明を聞いてください。今回の監査対象外はどれですか。",
      "購買プロセス監査の開始説明。",
      "今回は発注から検収までの証跡を確認します。仕入先の選定理由も対象ですが、製品の販売価格は営業監査で別途確認します。",
      "製品の販売価格。",
      ["発注記録。", "検収記録。", "仕入先の選定理由。"],
      "Giá bán thuộc đợt kiểm toán kinh doanh khác; ba nội dung còn lại nằm trong phạm vi lần này.",
      "audit_scope_listening",
      "report_document",
      "audio"
    )
  ],
  LC_INTEGRATED: [
    d(
      "来場者数の図と館内放送を確認してください。午後の受付を何人体制にしますか。",
      "来場予測図は午前二百人、午後三百五十人。基準は来場者百人につき受付一名。",
      "午後は団体客も到着します。基準人数を切り上げて配置してください。",
      "4名。",
      ["2名。", "3名。", "5名。"],
      "350 khách, mỗi 100 khách một người và làm tròn lên, cần 4 nhân viên.",
      "visitor_staffing_calculation",
      "presentation",
      "illustration"
    ),
    d(
      "工程図と作業責任者の説明から、最初に延期される作業を選んでください。",
      "工程図は「配線→動作確認→顧客立会い」。配線部材の到着が二日遅れている。",
      "配線が完了しなければ動作確認は始められません。顧客立会い日は変更できるか確認中です。",
      "動作確認。",
      ["部材発注。", "配線作業そのものの計画。", "顧客への請求。"],
      "Bước ngay sau lắp dây là kiểm tra vận hành, nên đây là công việc đầu tiên bị lùi.",
      "critical_path_listening",
      "internal_coordination",
      "illustration"
    ),
    d(
      "座席表と司会の説明を確認してください。空席として残す場所はどこですか。",
      "会場前方に登壇者席、中央に参加者席、後方入口横に二席が表示されている。",
      "途中入場者の移動で発表を妨げないよう、入口横の二席は開始時に空けておいてください。",
      "後方入口横の二席。",
      ["前方の登壇者席。", "中央列の全席。", "司会者の隣だけ。"],
      "Hai ghế cạnh cửa vào được giữ trống để người đến muộn không làm gián đoạn.",
      "venue_seating_instruction",
      "presentation",
      "illustration"
    ),
    d(
      "原価構成図と説明から、見直し対象を選んでください。",
      "原価構成は材料45%、物流25%、人件費20%、その他10%。物流だけ前年より八ポイント上昇。",
      "品質に影響する材料費は維持し、増加幅が最も大きい項目から改善案を検討します。",
      "物流費。",
      ["材料費。", "人件費。", "その他経費。"],
      "Chi phí logistics tăng mạnh nhất, trong khi vật liệu được yêu cầu giữ nguyên.",
      "cost_structure_priority",
      "report_document",
      "illustration"
    ),
    d(
      "店舗地図と電話連絡を確認してください。修理担当が先に向かう店舗はどこですか。",
      "地図には北店、中央店、南店。北店は端末一台停止、南店は全レジ停止、中央店は正常。",
      "売上への影響が最大の店舗を優先してください。南店には予備端末もありません。",
      "南店。",
      ["北店。", "中央店。", "三店舗を同時に訪問する。"],
      "Cửa hàng Nam ngừng toàn bộ quầy và không có máy dự phòng nên mức ảnh hưởng cao nhất.",
      "field_service_prioritization",
      "sales_customer",
      "illustration"
    ),
    d(
      "組織図と異動説明から、新しい報告先を選んでください。",
      "組織図は商品企画部の下に調査課と開発課。新設の顧客分析室は部長直轄。",
      "調査課の分析チームは来月から顧客分析室へ移り、課長ではなく部長へ直接報告します。",
      "商品企画部長。",
      ["調査課長。", "開発課長。", "人事部長。"],
      "Nhóm phân tích chuyển sang đơn vị trực thuộc trưởng bộ phận và báo cáo trực tiếp cho người này.",
      "organization_change_comprehension",
      "internal_coordination",
      "illustration"
    ),
    d(
      "生産能力図と説明から、外注が必要な数量を計算してください。",
      "自社の週産能力は通常四百個、残業対応で最大四百八十個。受注は五百五十個。",
      "納期は変更できません。社内は最大能力まで生産し、残りを認定工場へ依頼します。",
      "70個。",
      ["50個。", "80個。", "150個。"],
      "Đơn 550 trừ công suất tối đa nội bộ 480, cần thuê ngoài 70.",
      "capacity_outsource_calculation",
      "report_document",
      "illustration"
    ),
    d(
      "リスク表とプロジェクト責任者の説明から、直ちに対応する項目を選んでください。",
      "表は法令違反「影響大・確率中」、納期遅延「影響中・確率高」、軽微な表示崩れ「影響小・確率高」。",
      "発生確率だけでなく、事業継続と法的責任への影響を最優先に評価します。",
      "法令違反リスク。",
      ["納期遅延だけ。", "軽微な表示崩れ。", "確率が高い二項目だけ。"],
      "Tác động pháp lý lớn được ưu tiên hơn chỉ số xác suất đơn thuần.",
      "risk_matrix_judgment",
      "report_document",
      "illustration"
    ),
    d(
      "案内図と担当者の説明から、取材班の移動順を選んでください。",
      "会場図は受付、撮影許可窓口、展示ホール、記者席の順に配置されている。",
      "撮影機材を持つ方は、展示ホールへ入る前に必ず撮影許可証を受け取ってください。",
      "受付後、撮影許可窓口に寄ってから展示ホールへ進む。",
      [
        "受付から直接展示ホールへ進む。",
        "展示後に許可証を受け取る。",
        "最初に記者席へ機材を置く。"
      ],
      "Phải lấy giấy phép quay trước khi vào khu triển lãm.",
      "event_access_sequence",
      "presentation",
      "illustration"
    ),
    d(
      "保管棚の図と品質担当の説明から、隔離するロットを選んでください。",
      "棚にはL21、L22、L23。検査表ではL22だけ規格下限に近く、L23は検査結果未入力。",
      "結果が未確認の製品は出荷可能と判断しないでください。入力漏れか未検査かを確認するまで隔離します。",
      "L23。",
      ["L21。", "L22。", "三ロットすべて。"],
      "Lô chưa có kết quả phải được cách ly đến khi xác minh, dù chưa biết là bỏ sót nhập liệu hay chưa kiểm tra.",
      "quality_hold_decision",
      "report_document",
      "illustration"
    )
  ],
  LR_SITUATION: [
    d(
      "受付端末の表示と案内を確認してください。来場者が次にすることは何ですか。",
      "無人受付端末に予約QRコード読取画面があり、横に有人窓口への案内ボタンがある。",
      "事前登録がお済みの方はQRコードを読み取って入館証を印刷してください。読み取れない場合だけ案内ボタンを押してください。",
      "QRコードを読み取り、入館証を印刷する。",
      ["最初から有人窓口を呼ぶ。", "入館証なしでゲートを通る。", "予約を新しく取り直す。"],
      "Người đã đăng ký trước phải quét QR và in thẻ; chỉ gọi hỗ trợ khi không đọc được.",
      "self_checkin_procedure",
      "sales_customer",
      "photo"
    ),
    d(
      "廃棄物置場の表示と指示を確認してください。この箱はどこへ置きますか。",
      "置場には機密紙、一般紙、段ボールの三つの回収区画。箱には顧客名入りラベルが残っている。",
      "顧客情報が付いたままの段ボールは一般の段ボール回収へ出さず、ラベルを剥がして機密廃棄してください。",
      "ラベルを剥がし、ラベルを機密廃棄して箱を段ボール回収へ出す。",
      ["箱ごと一般紙へ出す。", "ラベル付きのまま段ボール回収へ出す。", "顧客へ箱を返送する。"],
      "Cần tách nhãn có dữ liệu khách để tiêu hủy bảo mật, rồi mới tái chế thùng.",
      "confidential_waste_sorting",
      "internal_coordination",
      "photo"
    ),
    d(
      "避難経路図と館内放送を確認してください。利用できない経路はどれですか。",
      "経路図には東階段、西階段、中央エレベーター。東階段付近に煙の表示がある。",
      "東側通路で煙を確認しました。西階段を使用し、エレベーターには乗らないでください。",
      "東階段と中央エレベーター。",
      ["西階段だけ。", "中央エレベーターだけ。", "すべての経路。"],
      "Phía Đông có khói và thang máy bị cấm; chỉ cầu thang phía Tây dùng được.",
      "evacuation_route_integration",
      "internal_coordination",
      "photo"
    ),
    d(
      "レジ画面と店長の説明を確認してください。担当者が最初にすることは何ですか。",
      "閉店後のレジ画面は現金差額マイナス五千円、取消取引一件、返品一件を表示している。",
      "差額を自己判断で補填せず、取消と返品の伝票を照合してから責任者へ報告してください。",
      "取消・返品伝票を照合し、責任者へ報告する。",
      ["自分のお金で差額を埋める。", "差額記録を削除する。", "翌日の売上から差し引く。"],
      "Không tự bù tiền; phải đối chiếu chứng từ rồi báo người chịu trách nhiệm.",
      "cash_variance_response",
      "sales_customer",
      "photo"
    ),
    d(
      "搬入口の表示と無線連絡を確認してください。トラックはどこで待機しますか。",
      "搬入口は一番から三番。一番は冷凍品専用、二番は点検中、三番は空いている。",
      "今回の荷物は常温品です。二番の点検が終わるまで待たず、利用可能な通常口へ誘導してください。",
      "三番搬入口。",
      ["一番搬入口。", "二番搬入口。", "道路上。"],
      "Hàng thường không dùng cửa đông lạnh; cửa số hai đang kiểm tra nên chọn cửa số ba.",
      "loading_bay_assignment",
      "internal_coordination",
      "photo"
    )
  ],
  LR_DOCUMENT: [
    d(
      "電力使用表と設備担当の説明から、節電対象を選んでください。",
      "表は空調48%、照明18%、製造設備29%、その他5%。夜間も空調使用量だけほぼ変わらない。",
      "夜間は製造設備を停止しています。まず無人時間帯の設定温度と運転区域を見直します。",
      "夜間の空調運転。",
      ["昼間の製造設備。", "非常灯。", "その他の電力すべて。"],
      "Điện điều hòa không giảm ban đêm dù không có người, nên đây là mục tiêu đầu tiên.",
      "energy_usage_analysis",
      "report_document",
      "chart"
    ),
    d(
      "宿泊者一覧と部屋表から、追加で必要な部屋数を選んでください。",
      "参加者は男女各七名。部屋は二名室が男性用三室、女性用四室、個室一室。男女別室が条件。",
      "個室は講師が使用します。参加者用に不足する分を追加予約してください。",
      "男性用に二名室を1室。",
      ["女性用に二名室を1室。", "男女共用の二名室を1室。", "追加は不要。"],
      "Nam có 7 người nhưng 3 phòng đôi chỉ đủ 6; nữ có 4 phòng đủ 7. Cần thêm 1 phòng nam.",
      "room_allocation_calculation",
      "schedule",
      "chart"
    ),
    d(
      "ライン別能力表と注文内容から、割り当てを決めてください。",
      "Aラインは小型品を日産百二十、Bラインは大型品を日産八十。注文は小型二百、大型百二十、納期二日。",
      "各ラインは担当サイズ以外を生産できません。二日間の通常能力で対応してください。",
      "両注文とも通常能力で納期内に対応できる。",
      ["小型品だけ不足する。", "大型品だけ不足する。", "両方とも不足する。"],
      "Hai ngày: nhỏ 240 ≥ 200, lớn 160 ≥ 120, cả hai đều đủ.",
      "production_capacity_table",
      "report_document",
      "chart"
    ),
    d(
      "損益分岐表と販売責任者の説明から、必要販売数を選んでください。",
      "固定費は六十万円。一個当たり販売価格五千円、変動費三千円。",
      "利益ゼロとなる数量を基準に、販売目標を設定します。",
      "300個。",
      ["120個。", "200個。", "600個。"],
      "Lãi góp mỗi sản phẩm 2.000 yên; 600.000 / 2.000 = 300 sản phẩm.",
      "break_even_calculation",
      "report_document",
      "chart"
    ),
    d(
      "保守契約表と障害記録から、違反した基準を選んでください。",
      "SLAは重大障害の初動三十分以内、復旧四時間以内。記録は検知九時、初動九時二十分、復旧十四時。",
      "初動は基準内ですが、完全復旧までの時間を確認してください。",
      "復旧時間。",
      ["初動時間。", "検知時刻。", "両方とも基準内。"],
      "Khởi động 20 phút đạt chuẩn, nhưng phục hồi mất 5 giờ, vượt SLA 4 giờ.",
      "sla_compliance_analysis",
      "report_document",
      "chart"
    ),
    d(
      "出席表と修了条件から、修了できない受講者を選んでください。",
      "条件は四回中三回以上出席。甲は四回、乙は三回、丙は二回出席。課題は全員提出済み。",
      "課題提出だけでなく、最低出席回数も満たす必要があります。",
      "丙。",
      ["甲。", "乙。", "全員修了できる。"],
      "Người Bính chỉ dự 2/4, chưa đạt tối thiểu 3 buổi.",
      "attendance_requirement_table",
      "hr_interview",
      "chart"
    ),
    d(
      "交通費比較表と出張条件から、選ぶ経路を判断してください。",
      "鉄道Aは八千円・二時間、鉄道Bは六千円・三時間、高速バスは三千円・五時間。",
      "到着期限は正午、出発可能時刻は九時です。費用が最も低く、期限に間に合う方法を選びます。",
      "鉄道B。",
      ["鉄道A。", "高速バス。", "どれも間に合わない。"],
      "Từ 9 giờ, tuyến B mất 3 giờ vừa kịp 12 giờ và rẻ hơn tuyến A; xe buýt quá chậm.",
      "travel_option_constraint",
      "schedule",
      "chart"
    ),
    d(
      "シフト表と休憩規則から、休憩時間を判断してください。",
      "勤務は八時半から十七時半。規則は実働六時間超で四十五分、八時間超で六十分の休憩。",
      "この勤務には一時間の休憩を予定しています。規則上、実働時間がどうなるか確認してください。",
      "実働8時間となり、45分以上の休憩が必要。",
      ["実働9時間で休憩不要。", "実働8時間半で60分必須。", "実働6時間で45分不要。"],
      "Ca 9 giờ trừ nghỉ 1 giờ = làm 8 giờ; mức trên 6 giờ cần ít nhất 45 phút.",
      "working_hours_rule",
      "hr_interview",
      "chart"
    ),
    d(
      "外貨見積表と予算上限から、購入可能数量を計算してください。",
      "単価は百二十ドル、換算レートは一ドル百五十円。予算は百八十万円、送料なし。",
      "予算を超えない最大の整数数量で発注してください。",
      "100個。",
      ["90個。", "120個。", "150個。"],
      "Đơn giá 18.000 yên; ngân sách 1.800.000 yên mua tối đa 100 chiếc.",
      "foreign_currency_budget",
      "negotiation",
      "chart"
    ),
    d(
      "採決結果表と議長の説明から、提案の結果を選んでください。",
      "出席十二名、賛成六、反対四、棄権二。規程は出席者の過半数賛成で可決。",
      "棄権者も出席者数に含め、過半数かどうかを判断してください。",
      "否決。",
      ["可決。", "賛否同数。", "再投票が必須。"],
      "Quá bán của 12 là ít nhất 7; chỉ có 6 phiếu thuận nên không thông qua.",
      "voting_rule_application",
      "meeting",
      "chart"
    )
  ],
  LR_INTEGRATED: [
    d(
      "購買申請と在庫記録を確認してください。発注数量はいくつですか。",
      "申請は必要数三百、現在庫九十、安全在庫五十。納入までに使用予定四十。",
      "納入時点でも安全在庫を確保した上で、必要数を満たすよう発注してください。",
      "300個。",
      ["210個。", "260個。", "350個。"],
      "Tồn khi hàng về: 90−40=50 đúng mức an toàn, nên toàn bộ nhu cầu 300 phải đặt mới.",
      "procurement_stock_integration",
      "report_document",
      "document"
    ),
    d(
      "同意書と利用申請を確認してください。このデータ利用は可能ですか。",
      "同意書は商品改善目的のみ許可。申請は広告配信のため購買履歴を外部事業者へ提供。",
      "同意の範囲を超える利用は、目的が社内承認済みでも開始できません。",
      "現在の同意範囲では利用できない。",
      [
        "社内承認があれば利用できる。",
        "匿名化しなくても自由に提供できる。",
        "商品改善と広告配信は同じ目的である。"
      ],
      "Mục đích quảng cáo và chia sẻ ra ngoài không nằm trong đồng ý cải thiện sản phẩm.",
      "consent_purpose_limitation",
      "report_document",
      "document"
    ),
    d(
      "広告レポートと会議メモから、継続する施策を選んでください。",
      "検索広告は費用四十万円・成約二十件、動画広告は六十万円・成約十五件、紹介施策は二十万円・成約十八件。",
      "次期は成約一件当たり費用が最も低い施策へ予算を追加します。",
      "紹介施策。",
      ["検索広告。", "動画広告。", "三施策へ同額を追加する。"],
      "Chi phí/chuyển đổi: giới thiệu thấp nhất, nên được tăng ngân sách.",
      "campaign_efficiency_synthesis",
      "report_document",
      "document"
    ),
    d(
      "資格一覧と作業計画を確認してください。作業を担当できる人は誰ですか。",
      "高所作業には資格Hと安全研修Sが必要。木村はHのみ、森はSのみ、中村はHとSを保有。",
      "監督者が同席しても、必要資格を両方持たない人は担当にできません。",
      "中村。",
      ["木村。", "森。", "三人全員。"],
      "Chỉ Nakamura có đủ cả chứng chỉ H và đào tạo S.",
      "certification_requirement_integration",
      "internal_coordination",
      "document"
    ),
    d(
      "保存規程と廃棄一覧を確認してください。廃棄を延期する文書はどれですか。",
      "契約書は満了後七年、応募書類は二年、一般問い合わせは一年保存。廃棄一覧の契約Aは満了六年前。",
      "保存期間を満たしていない文書は、一覧に載っていても廃棄しないでください。",
      "契約A。",
      [
        "保存期間を終えた応募書類。",
        "保存期間を終えた一般問い合わせ。",
        "すべて予定どおり廃棄する。"
      ],
      "Hợp đồng mới hết hạn 6 năm, chưa đủ thời hạn lưu 7 năm.",
      "records_retention_application",
      "report_document",
      "document"
    ),
    d(
      "健康診断結果と配置基準を確認してください。配置変更が必要な社員は誰ですか。",
      "夜勤は医師の就業可判定が必要。甲は可、乙は日勤のみ可、丙は再検査中。",
      "再検査中は夜勤へ配置せず、明確に日勤のみとされた社員も夜勤対象外です。",
      "乙と丙。",
      ["甲だけ。", "乙だけ。", "三人全員。"],
      "Ất chỉ được làm ngày; Bính đang chờ kiểm tra lại, cả hai không được xếp ca đêm.",
      "occupational_health_assignment",
      "hr_interview",
      "document"
    ),
    d(
      "輸入予定表と通関連絡を確認してください。納品日はどうなりますか。",
      "船の到着は月曜、通関予定は火曜、倉庫納品は水曜。原本書類は火曜午後に到着予定。",
      "原本確認後でなければ通関できません。確認は水曜午前となるため、倉庫納品も一日後ろへずれます。",
      "木曜日。",
      ["火曜日。", "水曜日。", "金曜日。"],
      "Thông quan chuyển sang sáng thứ Tư nên nhập kho lùi một ngày sang thứ Năm.",
      "import_schedule_dependency",
      "schedule",
      "document"
    ),
    d(
      "リコール通知と販売記録を確認してください。連絡対象は何件ですか。",
      "対象は製造番号R500〜R549。販売記録ではR490〜R519を三十件、R520〜R529を十件販売。",
      "対象範囲に含まれる販売先へ個別に連絡してください。",
      "30件。",
      ["10件。", "20件。", "40件。"],
      "Trong R490–519 chỉ R500–519 là 20, cộng R520–529 là 10, tổng 30.",
      "recall_scope_calculation",
      "complaint",
      "document"
    ),
    d(
      "障害タイムラインと顧客契約を確認してください。補償対象となりますか。",
      "停止は二十二時から翌二時まで四時間。契約は月間停止が三時間を超えた場合に補償。",
      "計画停止ではなく障害停止です。契約条件に基づき補償手続きを開始してください。",
      "停止が四時間なので補償対象となる。",
      ["夜間なので補償対象外。", "三時間ちょうどなので対象外。", "計画停止として扱う。"],
      "Gián đoạn sự cố 4 giờ vượt ngưỡng 3 giờ, nên thuộc diện bồi thường.",
      "service_credit_eligibility",
      "complaint",
      "document"
    ),
    d(
      "研究データ一覧と公開方針を確認してください。公開前に追加対応が必要なものは何ですか。",
      "Aは集計済み匿名データ、Bは氏名削除済みだが社員番号あり、Cは公開統計。",
      "直接の氏名がなくても、社内番号で個人を識別できるデータは匿名データとして公開できません。",
      "Bの社員番号を除去または適切に匿名化する。",
      ["Aの集計値を削除する。", "Cの公開統計を非公開にする。", "三種類をそのまま公開する。"],
      "Mã nhân viên vẫn nhận dạng được cá nhân, cần loại bỏ/ẩn danh trước công bố.",
      "deidentification_judgment",
      "report_document",
      "document"
    )
  ],
  RC_VOCAB_GRAMMAR: [
    d(
      "新しい手順を全社に（　）する前に、一部部署で試行します。",
      "業務改善計画書の一文。",
      null,
      "展開",
      ["展望", "展覧", "展開図"],
      "全社に展開する nghĩa là triển khai rộng trong toàn công ty.",
      "rollout_vocabulary",
      "report_document",
      "text"
    ),
    d(
      "取引条件について双方の見解が（　）しており、合意には至りませんでした。",
      "交渉経過報告の一文。",
      null,
      "対立",
      ["対面", "対比", "対応"],
      "見解が対立する là quan điểm xung đột, chưa thể đạt đồng thuận.",
      "viewpoint_conflict_vocabulary",
      "negotiation",
      "text"
    ),
    d(
      "障害発生時の連絡経路を（　）し、担当者不在でも対応できるようにします。",
      "事業継続計画の一文。",
      null,
      "明確化",
      ["透明化", "軽量化", "簡略化"],
      "連絡経路を明確化する nghĩa là làm rõ tuyến báo cáo/liên lạc.",
      "clarification_vocabulary",
      "internal_coordination",
      "text"
    ),
    d(
      "予想を上回る注文が入り、生産が需要に（　）ない状況です。",
      "需給報告の一文。",
      null,
      "追いつか",
      ["追い越さ", "追い出さ", "追い払わ"],
      "需要に追いつかない nghĩa là sản xuất không theo kịp nhu cầu.",
      "capacity_expression",
      "report_document",
      "text"
    ),
    d(
      "本計画は市場環境の変化に（　）、随時見直すものとします。",
      "中期計画の注意書き。",
      null,
      "応じて",
      ["関して", "向けて", "かけて"],
      "〜に応じて nghĩa là tùy theo/phù hợp với sự thay đổi.",
      "adaptive_grammar",
      "report_document",
      "text"
    ),
    d(
      "採用人数を増やす（　）、育成担当者の確保も必要です。",
      "人員計画会議の一文。",
      null,
      "だけでなく",
      ["ばかりに", "だけなら", "ほどなく"],
      "〜だけでなく nghĩa là không chỉ A mà còn cần B.",
      "additive_grammar",
      "hr_interview",
      "text"
    ),
    d(
      "担当者の経験に（　）ず、同じ基準で審査してください。",
      "審査マニュアルの一文。",
      null,
      "かかわら",
      ["したがわ", "ともなわ", "くらべ"],
      "〜にかかわらず nghĩa là bất kể kinh nghiệm của người phụ trách.",
      "regardless_grammar",
      "report_document",
      "text"
    ),
    d(
      "ご指摘の点は（　）受け止め、改善に努めてまいります。",
      "顧客への回答文。",
      null,
      "真摯に",
      ["率直を", "正直で", "慎重を"],
      "真摯に受け止める là kết hợp trang trọng: nghiêm túc tiếp nhận góp ý.",
      "formal_response_collocation",
      "complaint",
      "text"
    ),
    d(
      "作業の（　）を避けるため、担当範囲を一覧にしました。",
      "チーム運営資料の一文。",
      null,
      "重複",
      ["重点", "重圧", "重役"],
      "作業の重複 nghĩa là công việc bị làm trùng lặp.",
      "duplication_vocabulary",
      "internal_coordination",
      "text"
    ),
    d(
      "この判断は一時的な措置であり、方針変更を（　）ものではありません。",
      "経営会議の通知文。",
      null,
      "意味する",
      ["意味になる", "意味させる", "意味できる"],
      "〜を意味するものではない là không đồng nghĩa với/không có nghĩa là.",
      "formal_negation_expression",
      "meeting",
      "text"
    )
  ],
  RC_EXPRESSION: [
    d(
      "「差し支えなければ、今回の選定理由について今後の改善の参考としてお聞かせいただけますでしょうか。」送信者の意図は何ですか。",
      "失注後に取引先へ送るメール。",
      null,
      "相手に負担を強いず、選定理由のフィードバックを求めている。",
      [
        "契約の再開を要求している。",
        "選定結果の撤回を命じている。",
        "競合他社の機密情報を求めている。"
      ],
      "差し支えなければ làm giảm áp lực; mục đích là xin phản hồi để cải thiện.",
      "optional_feedback_request",
      "sales_customer",
      "text"
    ),
    d(
      "「本件は関係部署への確認に時間を要しております。週明けまでお待ちいただけますと幸いです。」この文面が伝えていることは何ですか。",
      "回答期限を調整するメール。",
      null,
      "確認が終わっておらず、回答を週明けまで延期したい。",
      ["確認を中止した。", "すでに否決が決まった。", "相手からの回答を週明けまで求めている。"],
      "Đang cần thêm thời gian xác nhận nội bộ và xin bên kia chờ tới đầu tuần.",
      "response_delay_message",
      "email_chat",
      "text"
    ),
    d(
      "「全面的な刷新は見送りますが、問い合わせの多い機能から順に改善を進めます。」方針として正しいものはどれですか。",
      "システム改善方針の通知。",
      null,
      "全面刷新はせず、優先度の高い機能を段階的に改善する。",
      [
        "すべての改善を中止する。",
        "全機能を同時に作り直す。",
        "問い合わせ件数に関係なく古い機能から直す。"
      ],
      "Không làm mới toàn bộ; cải tiến theo thứ tự ưu tiên dựa trên nhu cầu.",
      "scoped_improvement_policy",
      "internal_coordination",
      "text"
    ),
    d(
      "「責任の所在を問う前に、まず影響を受けたお客様への対応を完了させましょう。」発言者が優先していることは何ですか。",
      "障害対応会議での発言。",
      null,
      "顧客への影響対応を先に終えること。",
      [
        "担当者の処分を先に決めること。",
        "原因調査を永久に行わないこと。",
        "顧客への説明を避けること。"
      ],
      "Người nói ưu tiên xử lý ảnh hưởng khách hàng trước khi quy trách nhiệm.",
      "incident_priority_expression",
      "meeting",
      "text"
    ),
    d(
      "「ご提案の機能をすべて含めると予算を超えるため、必須要件と将来追加できる要件を分けていただけますか。」何を求めていますか。",
      "開発範囲を調整する打ち合わせ。",
      null,
      "要件を優先度で分け、初期範囲を絞ること。",
      ["予算を無制限に増やすこと。", "すべての機能を削除すること。", "将来の追加を禁止すること。"],
      "Yêu cầu phân loại bắt buộc và có thể làm sau để thu hẹp phạm vi ban đầu.",
      "scope_prioritization_request",
      "negotiation",
      "text"
    ),
    d(
      "「数値自体は改善していますが、回答者が前回と異なるため、単純比較には注意が必要です。」注意点は何ですか。",
      "調査結果の報告。",
      null,
      "調査対象の違いにより、改善をそのまま時系列比較できない。",
      [
        "数値が必ず誤っている。",
        "前回の調査は存在しない。",
        "回答者が同じなので比較に問題はない。"
      ],
      "Khác nhóm người trả lời làm hạn chế khả năng so sánh trực tiếp giữa hai kỳ.",
      "survey_comparability_caveat",
      "report_document",
      "text"
    ),
    d(
      "「現場の判断を尊重します。ただし、安全基準に関する例外は認めません。」裁量の範囲はどうなっていますか。",
      "管理者向け方針説明。",
      null,
      "安全基準を守る範囲で現場が判断できる。",
      [
        "安全基準も現場が自由に変更できる。",
        "現場には一切判断権がない。",
        "安全に関係する場合だけ基準を無視できる。"
      ],
      "Trao quyền cho hiện trường nhưng không cho phép ngoại lệ về an toàn.",
      "bounded_discretion_reading",
      "internal_coordination",
      "text"
    ),
    d(
      "「せっかくお声がけいただいたところ恐縮ですが、同日の別件対応のため今回は辞退させてください。」文面の目的は何ですか。",
      "講演依頼への返信。",
      null,
      "感謝を示しながら、日程上の理由で依頼を断る。",
      ["依頼を受諾する。", "講演料の増額を求める。", "別件を取り消すよう相手に求める。"],
      "Cảm ơn lời mời nhưng từ chối lịch sự vì trùng lịch.",
      "polite_invitation_decline",
      "email_chat",
      "text"
    ),
    d(
      "「暫定対応によりサービスは再開しましたが、根本原因の解消には至っておりません。」現在の状態はどれですか。",
      "障害復旧報告。",
      null,
      "利用は再開したが、恒久的な解決はまだである。",
      ["障害は完全に解決した。", "サービスはまだ停止している。", "原因調査は不要になった。"],
      "Dịch vụ đã hoạt động nhờ giải pháp tạm thời nhưng nguyên nhân gốc chưa được xử lý.",
      "temporary_recovery_status",
      "report_document",
      "text"
    ),
    d(
      "「価格だけでなく、導入後の運用費と解約時の移行費用も含めて比較してください。」比較範囲は何ですか。",
      "ベンダー選定の指示。",
      null,
      "導入から解約・移行までの総費用。",
      ["初期価格だけ。", "解約時の費用だけ。", "製品の知名度だけ。"],
      "Cần so sánh tổng chi phí vòng đời, không chỉ giá mua ban đầu.",
      "total_cost_scope",
      "negotiation",
      "text"
    )
  ],
  RC_INTEGRATED: [
    d(
      "社内便記録：機密契約書を本社から支社へ発送。追跡番号あり。受領欄は空白。支社担当は『まだ届いていない』と回答。最初に確認すべきことは何ですか。",
      "機密書類の配送状況を調査する場面。",
      null,
      "追跡情報と配送業者の受渡記録を確認する。",
      [
        "同じ契約書をすぐ再印刷して通常郵便で送る。",
        "受領欄に担当者名を推測で記入する。",
        "書類が届いたものとして処理を終える。"
      ],
      "Trước khi gửi lại tài liệu mật, cần kiểm tra dấu vết vận chuyển và bàn giao.",
      "secure_delivery_investigation",
      "report_document",
      "document"
    ),
    d(
      "提案評価：技術適合A社90・B社75、費用A社60・B社85、支援A社80・B社70。重みは技術50%、費用30%、支援20%。総合点が高いのはどこですか。",
      "ベンダー評価表を読む問題。",
      null,
      "A社。",
      ["B社。", "両社同点。", "重みがあるため計算できない。"],
      "A = 45+18+16=79; B = 37,5+25,5+14=77, nên A cao hơn.",
      "weighted_vendor_scoring",
      "negotiation",
      "document"
    ),
    d(
      "工程変更申請：材料XをYへ変更。品質試験は合格、顧客仕様書はXを指定、顧客承認欄は未記入。量産開始前に必要なことは何ですか。",
      "仕様変更の承認状況を確認する場面。",
      null,
      "顧客へ変更内容を説明し、承認を得る。",
      [
        "品質試験合格だけで量産する。",
        "仕様書の材料名を無断で書き換える。",
        "承認欄を社内担当が代筆する。"
      ],
      "Dù thử nghiệm đạt, thông số khách vẫn chỉ định vật liệu cũ nên phải được khách phê duyệt thay đổi.",
      "customer_spec_change_control",
      "report_document",
      "document"
    ),
    d(
      "店舗別データ：東店は来客千・購入率20%、西店は来客八百・購入率28%、南店は来客六百・購入率30%。購入者数が最も多い店舗はどこですか。",
      "店舗実績を比較する問題。",
      null,
      "西店。",
      ["東店。", "南店。", "三店舗同じ。"],
      "Số mua: Đông 200, Tây 224, Nam 180; Tây cao nhất.",
      "traffic_conversion_calculation",
      "report_document",
      "document"
    ),
    d(
      "規程改定案：私物端末からの業務メール禁止。施行日は来月一日。FAQ：会社貸与端末が故障した場合も例外なし、IT窓口へ連絡。正しい対応はどれですか。",
      "情報セキュリティ規程を適用する場面。",
      null,
      "貸与端末の故障をIT窓口へ連絡し、私物端末は使わない。",
      [
        "緊急なら私物端末から送る。",
        "同僚の個人端末を借りる。",
        "規程施行後も従来どおり利用する。"
      ],
      "FAQ ghi rõ không có ngoại lệ khi thiết bị công ty hỏng; phải liên hệ IT.",
      "byod_policy_application",
      "report_document",
      "document"
    ),
    d(
      "顧客対応記録：午前に返金希望を受領、規程では未開封品のみ返金可。写真では開封済みだが製品に初期不良。保証規程では交換または修理。案内すべき内容は何ですか。",
      "返金規程と保証規程を組み合わせる場面。",
      null,
      "返金条件外であることを説明し、保証による交換または修理を案内する。",
      [
        "初期不良でも何も対応しない。",
        "規程を確認せず全額返金する。",
        "開封済みなので連絡を終了する。"
      ],
      "Không đủ điều kiện hoàn tiền, nhưng lỗi ban đầu thuộc bảo hành đổi/sửa.",
      "refund_warranty_synthesis",
      "complaint",
      "document"
    ),
    d(
      "プロジェクト状況：予算消化70%、進捗50%、残期間40%。追加要件が三件。変更管理規程では影響分析後に承認が必要。次の対応は何ですか。",
      "進行中プロジェクトの変更判断。",
      null,
      "追加要件の費用・日程影響を分析し、承認前は着手しない。",
      [
        "三件すべて直ちに開発する。",
        "予算消化を隠して承認を求める。",
        "追加要件を記録せず口頭で対応する。"
      ],
      "Dự án đã tiêu ngân sách nhanh hơn tiến độ; yêu cầu mới phải được phân tích và phê duyệt.",
      "change_request_governance",
      "internal_coordination",
      "document"
    ),
    d(
      "募集結果：応募百名、書類通過四十名、一次通過十六名、内定八名、入社六名。一次面接から内定までの通過率は何%ですか。",
      "採用ファネルを分析する問題。",
      null,
      "50%。",
      ["8%。", "15%。", "60%。"],
      "Từ 16 người qua vòng một có 8 offer: 8/16 = 50%.",
      "recruitment_funnel_calculation",
      "hr_interview",
      "document"
    ),
    d(
      "保守履歴：同じ部品を三か月で二回交換。メーカー資料では通常寿命三年。使用記録では規定を超える温度が複数回。最も妥当な調査は何ですか。",
      "設備故障の原因を検討する場面。",
      null,
      "温度管理と使用環境が部品寿命へ与えた影響を調べる。",
      [
        "部品寿命は短いものだと結論づける。",
        "交換履歴を削除する。",
        "温度記録は原因と無関係として無視する。"
      ],
      "Tuổi thọ kỳ vọng dài nhưng nhiệt độ vượt chuẩn lặp lại, nên cần điều tra môi trường sử dụng.",
      "maintenance_root_cause",
      "report_document",
      "document"
    ),
    d(
      "BCP表：本社停電時は西拠点へ切替、通信障害時は携帯回線、両方同時はクラウド復旧サイト。現在は本社停電と固定回線障害が同時発生。どの手順を使いますか。",
      "事業継続計画を適用する問題。",
      null,
      "クラウド復旧サイトへ切り替える。",
      ["西拠点だけへ切り替える。", "携帯回線だけを使う。", "復旧まで業務を再開しない。"],
      "Hai sự cố xảy ra đồng thời nên áp dụng kịch bản kết hợp: site khôi phục cloud.",
      "bcp_scenario_application",
      "internal_coordination",
      "document"
    )
  ]
};

/**
 * Ten independent form-B replacements remove the remaining normalized
 * A/B clones required to clear the cross-form diversity gate.
 */
export const FORM_B_SIGNATURE_OVERRIDES: Partial<
  Record<IndependentSectionCode, IndependentMockDraft[]>
> = {
  LC_SCENE: [
    d(
      "研究室で薬品がこぼれました。周囲の社員の最も適切な行動はどれですか。",
      "床に液体が広がり、容器には接触禁止の危険表示がある。",
      "物質が特定できるまで触れないでください。周辺を立入禁止にして、安全管理室へ連絡します。",
      "区域を立入禁止にし、安全管理室へ連絡する。",
      ["素手で拭き取る。", "水で排水口へ流す。", "表示を外して通常業務を続ける。"],
      "Chưa xác định hóa chất nên phải cô lập khu vực và gọi bộ phận an toàn.",
      "chemical_spill_isolation",
      "internal_coordination",
      "photo"
    ),
    d(
      "テレビ取材班が突然来社しました。受付の対応として最も適切なものはどれですか。",
      "カメラを持った取材班がロビーで経営者へのコメントを求めている。",
      "本日の発表について、社長から一言いただけませんか。生放送まで時間がありません。",
      "広報窓口へ連絡し、撮影や面会の許可が出るまで待ってもらう。",
      ["社長室へ直接案内する。", "受付担当が会社見解を答える。", "ロビーで自由に撮影してもらう。"],
      "Tiếp xúc báo chí phải qua đầu mối truyền thông và được phép trước khi quay/phỏng vấn.",
      "media_visit_protocol",
      "sales_customer",
      "photo"
    ),
    d(
      "試作品の写真が共有スペースに置かれています。発見者はどうしますか。",
      "来客も利用するラウンジの机に「社外秘」と書かれた試作品写真が残されている。",
      "この写真は開発中の製品ですね。持ち主が分かりません。",
      "写真を安全に回収し、情報管理担当へ発見状況を報告する。",
      [
        "来客に見せて持ち主を尋ねる。",
        "スマートフォンで撮影して全員へ送る。",
        "そのまま机に置いて帰る。"
      ],
      "Tài liệu mật bị bỏ quên cần được thu hồi an toàn và báo sự cố.",
      "confidential_material_recovery",
      "internal_coordination",
      "photo"
    ),
    d(
      "懇親会の料理にアレルギー表示がありません。主催者の対応はどれですか。",
      "立食会場で参加者が料理の原材料について尋ねているが、表示カードが空白。",
      "ナッツが入っているか確認できますか。重いアレルギーがあります。",
      "提供を一時止め、調理担当へ原材料と交差接触を確認する。",
      [
        "見た目でナッツがないと判断する。",
        "少量だけ試食してもらう。",
        "本人の責任として自由に取ってもらう。"
      ],
      "Dị ứng nặng cần xác minh cả thành phần và nhiễm chéo trước khi phục vụ.",
      "event_allergen_safety",
      "presentation",
      "photo"
    ),
    d(
      "公証人とのオンライン手続きで本人確認が中断しました。担当者はどうしますか。",
      "画面に本人確認書類の画像不鮮明という警告が表示され、契約署名ボタンが無効になっている。",
      "書類番号が読み取れないため、このまま署名手続きへ進むことはできません。",
      "鮮明な書類を再提出してもらい、本人確認完了後に署名を再開する。",
      [
        "番号を口頭で聞いて警告を無視する。",
        "別人の書類で代用する。",
        "本人確認なしで署名を確定する。"
      ],
      "Quy trình ký chỉ tiếp tục sau khi tài liệu định danh rõ và xác minh hoàn tất.",
      "remote_identity_verification",
      "negotiation",
      "photo"
    )
  ],
  LC_STATEMENT: [
    d(
      "振込先変更の連絡を聞いてください。経理担当が最初にすることは何ですか。",
      "仕入先を名乗るメールへの対応説明。",
      "メールで口座変更の依頼が届きました。登録済みの電話番号へこちらから連絡し、担当者本人に確認するまで変更しないでください。",
      "登録済み連絡先で仕入先本人へ確認する。",
      [
        "メール記載の番号だけへ電話する。",
        "確認せず新口座へ振り込む。",
        "旧口座情報を直ちに削除する。"
      ],
      "Đổi tài khoản thanh toán phải được xác minh qua kênh đã đăng ký, tránh gian lận hóa đơn.",
      "payment_change_verification",
      "report_document",
      "audio"
    ),
    d(
      "相談窓口の説明を聞いてください。匿名相談者について正しいものはどれですか。",
      "内部通報制度の案内。",
      "匿名でも相談できます。調査に必要な追加情報を受け取れるよう、個人を特定しない専用番号を発行します。",
      "匿名のまま専用番号を使って追加連絡を受けられる。",
      ["匿名では相談できない。", "相談者名が全社員へ公開される。", "追加情報は一切受け取れない。"],
      "Hệ thống cho phép ẩn danh nhưng vẫn trao đổi tiếp qua mã riêng.",
      "whistleblowing_anonymous_channel",
      "internal_coordination",
      "audio"
    ),
    d(
      "特許出願の期限説明を聞いてください。何をいつまでに提出しますか。",
      "知的財産部から開発チームへの連絡。",
      "学会発表の前に出願を済ませる必要があります。発表資料は金曜日公開予定なので、発明届を水曜日正午までに提出してください。",
      "発明届を水曜日正午までに提出する。",
      [
        "特許公報を金曜日までに提出する。",
        "発表後に発明届を出す。",
        "学会資料を水曜日に公開する。"
      ],
      "Cần nộp bản khai sáng chế trước khi công bố; hạn cụ thể là trưa thứ Tư.",
      "patent_filing_deadline",
      "report_document",
      "audio"
    ),
    d(
      "仕入先調査の説明を聞いてください。追加確認が必要な企業はどこですか。",
      "サプライヤーの環境・労務調査結果。",
      "回答未提出の企業だけでなく、重大事故があったのに是正報告が空欄の企業も追加確認の対象です。",
      "未回答企業と、重大事故の是正報告がない企業。",
      ["回答済み企業すべて。", "価格が最も低い企業だけ。", "国内企業だけ。"],
      "Cần kiểm tra cả bên chưa trả lời lẫn bên có sự cố nghiêm trọng nhưng thiếu báo cáo khắc phục.",
      "supplier_due_diligence_scope",
      "report_document",
      "audio"
    ),
    d(
      "保険契約の説明を聞いてください。補償されないものは何ですか。",
      "配送保険の免責事項。",
      "輸送中の破損と盗難は対象ですが、包装が契約基準を満たしていない場合の破損は補償されません。",
      "基準外の包装が原因となった破損。",
      ["輸送中の盗難。", "基準どおり包装した商品の破損。", "契約対象地域での輸送事故。"],
      "Hư hỏng do đóng gói không đạt chuẩn là trường hợp loại trừ.",
      "insurance_exclusion_listening",
      "report_document",
      "audio"
    ),
    d(
      "データ保管方針を聞いてください。国外保管できない情報はどれですか。",
      "クラウド移行前のコンプライアンス説明。",
      "公開資料は国外リージョンでも保管できますが、本人確認書類の画像は国内リージョンに限定します。",
      "本人確認書類の画像。",
      ["公開済みの商品資料。", "匿名の利用統計。", "一般向けFAQ。"],
      "Ảnh giấy tờ định danh bị giới hạn lưu trữ trong nước.",
      "data_residency_rule",
      "report_document",
      "audio"
    ),
    d(
      "勤務制度変更の説明を聞いてください。正式決定前に必要なことは何ですか。",
      "人事部による労使協議の進捗説明。",
      "案は経営会議を通過しましたが、勤務時間に関わるため、正式導入前に従業員代表との協議が必要です。",
      "従業員代表と協議する。",
      [
        "直ちに全社員へ適用する。",
        "経営会議をもう一度開くだけでよい。",
        "利用者アンケートだけで決定する。"
      ],
      "Thay đổi giờ làm cần tham vấn đại diện người lao động trước khi áp dụng chính thức.",
      "labor_consultation_requirement",
      "hr_interview",
      "audio"
    ),
    d(
      "サービス終了の案内を聞いてください。既存利用者への対応は何ですか。",
      "旧製品の提供終了計画。",
      "新規受付は今月末で終了しますが、既存契約は半年間継続し、その間に後継サービスへの移行を支援します。",
      "半年間サービスを継続し、後継サービスへの移行を支援する。",
      [
        "今月末に既存契約もすべて停止する。",
        "新規受付を半年延長する。",
        "後継サービスを案内しない。"
      ],
      "Người dùng hiện tại được duy trì 6 tháng và hỗ trợ chuyển sang dịch vụ kế nhiệm.",
      "product_sunset_transition",
      "sales_customer",
      "audio"
    ),
    d(
      "適格請求書の確認説明を聞いてください。不足している項目は何ですか。",
      "仕入先請求書の経理確認。",
      "取引日、金額、税率は記載されていますが、登録番号がありません。支払処理前に再発行を依頼してください。",
      "発行事業者の登録番号。",
      ["取引日。", "取引金額。", "適用税率。"],
      "Hóa đơn có ngày, số tiền và thuế suất nhưng thiếu mã đăng ký của bên phát hành.",
      "qualified_invoice_check",
      "report_document",
      "audio"
    ),
    d(
      "バックアップ訓練の結果を聞いてください。次に改善することは何ですか。",
      "災害復旧テストの振り返り。",
      "データ復元には成功しましたが、担当者への連絡開始が目標より二十分遅れました。次回は連絡網の自動通知を試します。",
      "担当者への連絡開始を早める仕組み。",
      ["データ復元機能を削除する。", "訓練記録を残さない。", "復元成功を失敗として扱う。"],
      "Khôi phục dữ liệu thành công; điểm cần cải thiện là kích hoạt liên lạc chậm.",
      "disaster_recovery_drill",
      "internal_coordination",
      "audio"
    )
  ],
  LC_INTEGRATED: [
    d(
      "漏水センサー図と設備放送を確認してください。閉鎖する区域はどこですか。",
      "地下図は機械室A、書庫B、通路C。警報は書庫Bと通路Cの境界で検知。",
      "水が通路側へ広がる可能性があります。書庫と隣接通路を閉鎖し、機械室への出入りは北口を使ってください。",
      "書庫Bと隣接する通路C。",
      ["機械室Aだけ。", "建物全体。", "北口だけ。"],
      "Phải đóng kho tài liệu và hành lang liền kề nơi nước có thể lan.",
      "facility_leak_zone",
      "internal_coordination",
      "illustration"
    ),
    d(
      "積載表と運行管理者の説明から、追加車両が必要か判断してください。",
      "車両上限は一台二トン。荷物は九百キロ、八百キロ、六百キロの三パレット。",
      "パレットは分割できません。一台目に二つ載せても上限を超えない組み合わせを選んでください。",
      "二台必要で、一台目に九百キロと八百キロを載せる。",
      [
        "一台ですべて運べる。",
        "三台必要。",
        "一台目に九百キロと六百キロだけ載せ、残りを廃棄する。"
      ],
      "Tổng 2,3 tấn nên cần 2 xe; ghép 900+800 vẫn dưới giới hạn 2 tấn.",
      "vehicle_load_planning",
      "schedule",
      "illustration"
    ),
    d(
      "研修室配置図と講師の説明から、実技研修の部屋を選んでください。",
      "甲室は机固定で四十席、乙室は可動机で二十四席、丙室はオンライン配信専用。",
      "二十人が四人組で器具を使います。机を動かせることが必須です。",
      "乙室。",
      ["甲室。", "丙室。", "廊下。"],
      "Thực hành nhóm cần bàn di chuyển được; chỉ phòng Ất phù hợp.",
      "training_room_selection",
      "hr_interview",
      "illustration"
    ),
    d(
      "排出量グラフと環境担当の説明から、削減対象を選んでください。",
      "排出量は電力五十、社用車二十五、出張十五、廃棄十。社用車だけ前年比増。",
      "最大項目の電力対策は進行中です。今回は増加に転じた原因を優先調査します。",
      "社用車による排出。",
      ["電力だけ。", "出張だけ。", "廃棄だけ。"],
      "Dù điện lớn nhất, mục tiêu lần này là hạng mục tăng so với năm trước: xe công ty.",
      "emission_trend_priority",
      "report_document",
      "illustration"
    ),
    d(
      "窓口待ち時間図と案内責任者の説明から、応援を出す窓口を選んでください。",
      "相談窓口は待ち十二分・三人、契約窓口は待ち二十五分・八人、受取窓口は待ち五分・二人。",
      "待ち時間二十分を超えた窓口へ、空いている担当者を一名移してください。",
      "契約窓口。",
      ["相談窓口。", "受取窓口。", "三窓口すべて。"],
      "Chỉ quầy hợp đồng vượt ngưỡng chờ 20 phút.",
      "queue_reallocation",
      "sales_customer",
      "illustration"
    ),
    d(
      "返済図と財務担当の説明から、繰上返済する借入を選んでください。",
      "借入Xは固定金利一・五%、違約金あり。Yは変動金利三%、違約金なし。余剰資金は一部返済分のみ。",
      "金利負担が高く、追加費用なしで返済できる借入を優先します。",
      "借入Y。",
      ["借入X。", "両方を全額返済する。", "どちらも返済しない。"],
      "Khoản Y có lãi cao hơn và không có phí trả trước, đúng tiêu chí.",
      "debt_repayment_priority",
      "report_document",
      "illustration"
    )
  ]
};
