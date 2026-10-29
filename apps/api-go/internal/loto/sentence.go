package loto

// VocabItem is one vocabulary entry attached to a learning sentence.
type VocabItem struct {
	WordJP    string `json:"wordJp"`
	Reading   string `json:"reading"`
	MeaningVI string `json:"meaningVi"`
}

// Sentence is the Japanese learning card published with a reference set.
type Sentence struct {
	TextJP     string      `json:"textJp"`
	Reading    string      `json:"reading"`
	TextVI     string      `json:"textVi"`
	Level      string      `json:"level"`
	Grammar    string      `json:"grammar"`
	VocabItems []VocabItem `json:"vocabItems"`
}

// sentenceLibrary is a curated rotation of probability/data themed sentences
// that double as BJT-style business Japanese practice.
var sentenceLibrary = []Sentence{
	{
		TextJP: "どの組み合わせも、当たる確率は同じです。", Reading: "どのくみあわせも、あたるかくりつはおなじです。",
		TextVI: "Tổ hợp nào cũng có xác suất trúng như nhau.", Level: "N4",
		Grammar:    "〜も：cũng / bất kỳ ~ cũng (nhấn mạnh toàn bộ)",
		VocabItems: []VocabItem{{"組み合わせ", "くみあわせ", "tổ hợp"}, {"確率", "かくりつ", "xác suất"}, {"同じ", "おなじ", "giống nhau"}},
	},
	{
		TextJP: "過去のデータを見ても、未来の結果は予測できません。", Reading: "かこのデータをみても、みらいのけっかはよそくできません。",
		TextVI: "Dù xem dữ liệu quá khứ cũng không thể dự đoán kết quả tương lai.", Level: "N3",
		Grammar:    "〜ても：dù ~ cũng",
		VocabItems: []VocabItem{{"過去", "かこ", "quá khứ"}, {"未来", "みらい", "tương lai"}, {"予測", "よそく", "dự đoán"}},
	},
	{
		TextJP: "くじは毎回独立しているので、前の結果は次に関係ありません。", Reading: "くじはまいかいどくりつしているので、まえのけっかはつぎにかんけいありません。",
		TextVI: "Mỗi lần quay là độc lập nên kết quả trước không liên quan đến lần sau.", Level: "N3",
		Grammar:    "〜ので：vì ~ nên (lý do khách quan)",
		VocabItems: []VocabItem{{"毎回", "まいかい", "mỗi lần"}, {"独立", "どくりつ", "độc lập"}, {"関係", "かんけい", "liên quan"}},
	},
	{
		TextJP: "平均を計算すると、全体の傾向が見えてきます。", Reading: "へいきんをけいさんすると、ぜんたいのけいこうがみえてきます。",
		TextVI: "Khi tính trung bình, xu hướng tổng thể dần hiện ra.", Level: "N3",
		Grammar:    "〜と：hễ ~ thì ~ / 〜てくる：dần dần",
		VocabItems: []VocabItem{{"平均", "へいきん", "trung bình"}, {"計算", "けいさん", "tính toán"}, {"傾向", "けいこう", "xu hướng"}},
	},
	{
		TextJP: "数字を選ぶ前に、まず確率の考え方を学びましょう。", Reading: "すうじをえらぶまえに、まずかくりつのかんがえかたをまなびましょう。",
		TextVI: "Trước khi chọn số, hãy học cách nghĩ về xác suất đã.", Level: "N4",
		Grammar:    "〜前に：trước khi ~ / 〜ましょう：hãy cùng ~",
		VocabItems: []VocabItem{{"選ぶ", "えらぶ", "chọn"}, {"考え方", "かんがえかた", "cách nghĩ"}, {"学ぶ", "まなぶ", "học"}},
	},
	{
		TextJP: "偶然の結果にも、数学の法則があります。", Reading: "ぐうぜんのけっかにも、すうがくのほうそくがあります。",
		TextVI: "Ngay cả kết quả ngẫu nhiên cũng có quy luật toán học.", Level: "N3",
		Grammar:    "〜にも：ngay cả ở ~ cũng",
		VocabItems: []VocabItem{{"偶然", "ぐうぜん", "ngẫu nhiên"}, {"法則", "ほうそく", "quy luật"}, {"数学", "すうがく", "toán học"}},
	},
	{
		TextJP: "出た回数が多い数字でも、次に出やすいとは限りません。", Reading: "でたかいすうがおおいすうじでも、つぎにでやすいとはかぎりません。",
		TextVI: "Dù là số xuất hiện nhiều lần, cũng không hẳn dễ ra ở lần sau.", Level: "N2",
		Grammar:    "〜とは限らない：không hẳn là ~",
		VocabItems: []VocabItem{{"回数", "かいすう", "số lần"}, {"出る", "でる", "xuất hiện"}, {"限る", "かぎる", "giới hạn"}},
	},
	{
		TextJP: "グラフにすると、データの特徴がよく分かります。", Reading: "グラフにすると、データのとくちょうがよくわかります。",
		TextVI: "Khi vẽ thành biểu đồ, đặc trưng của dữ liệu hiện ra rất rõ.", Level: "N4",
		Grammar:    "〜にする：biến thành ~ / làm thành ~",
		VocabItems: []VocabItem{{"グラフ", "グラフ", "biểu đồ"}, {"特徴", "とくちょう", "đặc trưng"}, {"分かる", "わかる", "hiểu"}},
	},
	{
		TextJP: "宝くじは楽しみとして、無理のない範囲で考えましょう。", Reading: "たからくじはたのしみとして、むりのないはんいでかんがえましょう。",
		TextVI: "Xổ số chỉ nên xem là thú vui, hãy cân nhắc trong phạm vi không quá sức.", Level: "N3",
		Grammar:    "〜として：với tư cách là ~",
		VocabItems: []VocabItem{{"宝くじ", "たからくじ", "xổ số"}, {"楽しみ", "たのしみ", "thú vui"}, {"範囲", "はんい", "phạm vi"}},
	},
	{
		TextJP: "当せん番号を確認して、結果と比べてみましょう。", Reading: "とうせんばんごうをかくにんして、けっかとくらべてみましょう。",
		TextVI: "Hãy xác nhận số trúng thưởng rồi thử so sánh với kết quả.", Level: "N4",
		Grammar:    "〜てみる：thử làm ~",
		VocabItems: []VocabItem{{"当せん", "とうせん", "trúng thưởng"}, {"確認", "かくにん", "xác nhận"}, {"比べる", "くらべる", "so sánh"}},
	},
	{
		TextJP: "奇数と偶数がほどよく混ざっている組み合わせが多いです。", Reading: "きすうとぐうすうがほどよくまざっているくみあわせがおおいです。",
		TextVI: "Phần lớn các tổ hợp có số lẻ và số chẵn trộn lẫn vừa phải.", Level: "N3",
		Grammar:    "〜ている：trạng thái đang tiếp diễn",
		VocabItems: []VocabItem{{"奇数", "きすう", "số lẻ"}, {"偶数", "ぐうすう", "số chẵn"}, {"混ざる", "まざる", "trộn lẫn"}},
	},
	{
		TextJP: "毎週の抽選を観察すると、運と確率の違いが分かります。", Reading: "まいしゅうのちゅうせんをかんさつすると、うんとかくりつのちがいがわかります。",
		TextVI: "Quan sát kỳ quay hằng tuần, bạn sẽ hiểu sự khác nhau giữa may mắn và xác suất.", Level: "N3",
		Grammar:    "〜と：hễ ~ thì ~",
		VocabItems: []VocabItem{{"抽選", "ちゅうせん", "bốc thăm"}, {"観察", "かんさつ", "quan sát"}, {"運", "うん", "vận may"}, {"違い", "ちがい", "khác biệt"}},
	},
	{
		TextJP: "来週の会議までに、データをまとめておきます。", Reading: "らいしゅうのかいぎまでに、データをまとめておきます。",
		TextVI: "Tôi sẽ tổng hợp sẵn dữ liệu trước cuộc họp tuần sau.", Level: "BJT",
		Grammar:    "〜までに：trước hạn ~ / 〜ておく：làm sẵn",
		VocabItems: []VocabItem{{"会議", "かいぎ", "cuộc họp"}, {"まとめる", "まとめる", "tổng hợp"}, {"来週", "らいしゅう", "tuần sau"}},
	},
	{
		TextJP: "統計では、サンプルが多いほど信頼できる結果になります。", Reading: "とうけいでは、サンプルがおおいほどしんらいできるけっかになります。",
		TextVI: "Trong thống kê, mẫu càng nhiều thì kết quả càng đáng tin cậy.", Level: "N2",
		Grammar:    "〜ほど：càng ~ càng",
		VocabItems: []VocabItem{{"統計", "とうけい", "thống kê"}, {"信頼", "しんらい", "tin cậy"}, {"結果", "けっか", "kết quả"}},
	},
}

// SentenceFor deterministically picks the learning sentence for a draw. The
// pick advances by one for every scheduled draw, so consecutive draws never
// repeat a sentence until the whole library has been seen.
func SentenceFor(game Game, targetDateKey string) Sentence {
	ordinal, err := ScheduledDrawsBetween(game, "2000-01-01", targetDateKey)
	if err != nil || ordinal < 0 {
		ordinal = int(hashString(string(game) + targetDateKey))
	}
	sentence := sentenceLibrary[ordinal%len(sentenceLibrary)]
	sentence.VocabItems = append([]VocabItem(nil), sentence.VocabItems...)
	return sentence
}

// SentenceLibrarySize reports how many distinct sentences rotate.
func SentenceLibrarySize() int { return len(sentenceLibrary) }
