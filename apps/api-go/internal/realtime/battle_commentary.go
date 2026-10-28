package realtime

import "math/rand/v2"

// commentaryTrigger names the situation a bot persona reacts to during a match.
type commentaryTrigger string

const (
	triggerUserCorrect  commentaryTrigger = "user_correct"
	triggerUserWrong    commentaryTrigger = "user_wrong"
	triggerBotCorrect   commentaryTrigger = "bot_correct"
	triggerBotWrong     commentaryTrigger = "bot_wrong"
	triggerBothCorrect  commentaryTrigger = "both_correct"
	triggerBothWrong    commentaryTrigger = "both_wrong"
	triggerUserStreak   commentaryTrigger = "user_streak"
	triggerBotStreak    commentaryTrigger = "bot_streak"
	triggerNeckAndNeck  commentaryTrigger = "neck_and_neck"
	triggerUserLeading  commentaryTrigger = "user_leading"
	triggerBotLeading   commentaryTrigger = "bot_leading"
	triggerFinalRound   commentaryTrigger = "final_round"
	triggerMatchStart   commentaryTrigger = "match_start"
	fallbackPersonaKey                    = "bot_j3"
	commentProbability                    = 0.55
	minRoundsBetween                      = 1
	streakCommentThresh                   = 3
	leadCommentThresh                     = 2
)

// commentaryContext is the match state a commentary decision is based on.
type commentaryContext struct {
	botKey            string
	botScore          int
	currentRound      int
	totalRounds       int
	trigger           commentaryTrigger
	userCorrectStreak int
	botCorrectStreak  int
	userScore         int
}

// battleCommentary is one persona line plus the trigger that produced it.
type battleCommentary struct {
	Message string            `json:"message"`
	Trigger commentaryTrigger `json:"trigger"`
}

// personaComments holds template-based, persona-flavored reactions per bot
// (ported from the retired NestJS bot-battle-commentary module).
var personaComments = map[string]map[commentaryTrigger][]string{
	"bot_j1": {
		"match_start":   {"⚡ 準備はいい？全力で行くよ！", "⚡ さあ、スピード勝負だ！", "⚡ Let's go! 負けないぞ！"},
		"user_correct":  {"おっ、やるじゃん！", "ナイス！でも次は負けないよ", "いい反応！ 🎯"},
		"user_wrong":    {"惜しい！次は取り返そう", "ドンマイ、まだまだ勝負はこれから！", "ふふ、ここは俺のポイント 💪"},
		"bot_correct":   {"よし！1ポイントいただき！", "この問題は得意なんだ 😎", "スピードで勝った！"},
		"bot_wrong":     {"あちゃー、間違えた...", "くっ...今のはミスった", "マジか、悔しい！"},
		"both_correct":  {"お互いすごい！接戦だね", "互角だ！面白くなってきた", "さすが！でも次で差をつける"},
		"both_wrong":    {"これは難しかったな...", "お互い苦手なやつだ 😅", "うーん、次こそ！"},
		"user_streak":   {"すごい連続正解！本気出すぞ！", "ストリーク来てる！負けてられない", "この調子... やばい、焦る！ 🔥"},
		"bot_streak":    {"乗ってきた！この波に乗るぞ", "連続正解！調子いい 💪", "フロー状態突入！"},
		"neck_and_neck": {"同点！次の1問が勝負だ", "いい勝負してるね！", "互角... 気が抜けない！"},
		"user_leading":  {"リードされてる... 巻き返すぞ！", "まだ諦めないよ！", "差をつけられた... 集中！"},
		"bot_leading":   {"リードしてるけど油断しない", "このまま逃げ切る！", "いい感じ... でも気を抜くな 🎯"},
		"final_round":   {"ラストスパート！全力で行くぞ！", "最後の1問... 決めてやる！", "ファイナルラウンド！⚡"},
	},
	"bot_j2": {
		"match_start":   {"🌸 のんびり楽しもうね～", "🌸 一緒に頑張ろう！焦らずにね", "🌸 よろしくね～ 楽しもう！"},
		"user_correct":  {"すごーい！上手！✨", "さすが～ よく知ってるね", "正解！嬉しい～ 🌟"},
		"user_wrong":    {"大丈夫だよ～ 次がある！", "気にしないで～ 🌸", "難しかったよね... 一緒に覚えよう"},
		"bot_correct":   {"えへへ、知ってた～ 🌸", "ラッキー！合ってた", "わーい、正解～"},
		"bot_wrong":     {"あれ～ 間違えちゃった", "えー、そっちだったの 😅", "むむむ... 難しいね～"},
		"both_correct":  {"二人とも正解！すごいね～", "やったー！お揃い正解 ✨", "一緒に正解嬉しい！"},
		"both_wrong":    {"これ難しいよね～ お互い様 🌸", "むずかしー！一緒に覚えようね", "あはは... 二人とも間違えた～"},
		"user_streak":   {"すごいすごい！連続正解！✨", "のってるね～ カッコいい！", "天才！？ すごすぎる～"},
		"bot_streak":    {"あれ、連続で合ってる... えへへ", "なんか調子いいかも～ 🌸", "わーい、れんぞく！"},
		"neck_and_neck": {"いい勝負～ 楽しいね！", "同点だ～ ドキドキ 🌸", "仲良く同点！笑"},
		"user_leading":  {"強い～！ 私も頑張る～", "差がついちゃった... でも楽しい！", "上手だね～ 尊敬 ✨"},
		"bot_leading":   {"あれ... ごめんね、勝っちゃってる", "でもまだわからないよ～", "ファイト！応援してる 🌸"},
		"final_round":   {"最後！ドキドキ～ 🌸", "ラスト！楽しかったね～", "さいご... がんばろう！"},
	},
	"bot_j3": {
		"match_start":   {"📚 さあ、実力を試しましょう", "📚 今日も学びの時間です", "📚 集中して、始めましょう"},
		"user_correct":  {"正解です。よく勉強していますね", "その通り。素晴らしい 📖", "Good! 理解が深い"},
		"user_wrong":    {"惜しいですね。復習のチャンスです", "この分野、後で一緒に確認しましょう", "間違いは学習の一部です 📚"},
		"bot_correct":   {"これは基本パターンですね", "データベースに感謝... 正解です", "この知識は重要です 📖"},
		"bot_wrong":     {"なるほど... 私の分析ミスです", "興味深い。この問題は難しい", "見直しが必要ですね..."},
		"both_correct":  {"二人とも正解。レベルが高い", "よい問題でしたね。お互い正解", "実力が拮抗していますね 📚"},
		"both_wrong":    {"難問でしたね... 復習しましょう", "この分野は要注意ですね", "興味深い問題です。覚えておきましょう"},
		"user_streak":   {"連続正解... 素晴らしい集中力です", "ストリーク継続中。見事です 📖", "この勢い、実力ですね"},
		"bot_streak":    {"分析がうまくいっています", "パターン認識が機能しています 📚", "集中できています"},
		"neck_and_neck": {"接戦... 集中力が試されます", "互角ですね。良い勝負です", "拮抗... 1問で流れが変わる"},
		"user_leading":  {"リードを許しました... 集中します", "実力者ですね。負けられません", "差がありますが、まだ挽回可能です"},
		"bot_leading":   {"リードしていますが、油断禁物", "このペースを維持します", "まだ安心できませんね 📚"},
		"final_round":   {"最終問。集中しましょう", "ラストです。悔いのない一問を 📖", "Final question. 全力で"},
	},
	"bot_j4": {
		"match_start":   {"🏆 よし、全力だ！手加減しないぞ", "🏆 BJTの頂点を目指す者同士、勝負！", "🏆 挑戦者よ... かかってこい！"},
		"user_correct":  {"やるな... 見直したぞ", "なかなかの実力だ 🎯", "認めてやる... ナイスだ"},
		"user_wrong":    {"甘いな！もっと気合い入れろ！", "そこが弱点か... 鍛え直せ！", "チャンスを逃すな！ 🏆"},
		"bot_correct":   {"当然だ。この程度は基本！", "BJT戦士をなめるな！ 🏆", "圧倒的正解！"},
		"bot_wrong":     {"くっ... 不覚！", "この屈辱... 忘れないぞ", "一瞬の油断... 次はない！"},
		"both_correct":  {"互いに一歩も譲らん... 好きだぞ！", "いい戦いだ！これぞバトル！ 🏆", "強敵... 燃えるな！"},
		"both_wrong":    {"ぐぬぬ... 難敵な問題だ", "この問題に再戦を誓う！", "二人とも落ちるとは..."},
		"user_streak":   {"おいおい... 調子に乗るなよ！", "連続正解だと!? 本気出すぞ！ 🔥", "認めてやる... 強い！"},
		"bot_streak":    {"止まらないぞ！このまま突き進む！", "これが真の実力だ！ 🏆", "王者の連続正解！"},
		"neck_and_neck": {"互角... 最高のバトルだ！ 🔥", "この緊張感... たまらん！", "一歩も引かない！勝負だ！"},
		"user_leading":  {"くそっ... だが諦めない！", "負けるわけにはいかん！ 🏆", "追いつく... 必ず追いつく！"},
		"bot_leading":   {"俺のペースだ... このまま行く！", "まだまだ！油断はしない", "勝利が見えてきた... 🏆"},
		"final_round":   {"最終決戦！全てを懸ける！ 🏆", "ラスト！ここで決めるぞ！", "最後の一撃... 受けてみろ！"},
	},
}

// determineCommentaryTrigger picks the most relevant trigger for the state.
func determineCommentaryTrigger(ctx commentaryContext) commentaryTrigger {
	switch {
	case ctx.currentRound == 0:
		return triggerMatchStart
	case ctx.currentRound == ctx.totalRounds-1:
		return triggerFinalRound
	case ctx.userCorrectStreak >= streakCommentThresh:
		return triggerUserStreak
	case ctx.botCorrectStreak >= streakCommentThresh:
		return triggerBotStreak
	}
	diff := ctx.userScore - ctx.botScore
	switch {
	case diff >= leadCommentThresh:
		return triggerUserLeading
	case diff <= -leadCommentThresh:
		return triggerBotLeading
	case diff == 0 && ctx.currentRound > 1:
		return triggerNeckAndNeck
	}
	return ctx.trigger
}

// generateBattleCommentary returns a persona line for the round, or nil when
// the bot stays quiet (rate limiting keeps it from spamming the learner).
// random must return values in [0,1).
func generateBattleCommentary(ctx commentaryContext, lastCommentRound int, random func() float64) *battleCommentary {
	trigger := determineCommentaryTrigger(ctx)
	forced := trigger == triggerMatchStart || trigger == triggerFinalRound || trigger == triggerUserStreak
	if !forced {
		if ctx.currentRound-lastCommentRound < minRoundsBetween {
			return nil
		}
		if random() > commentProbability {
			return nil
		}
	}
	persona, ok := personaComments[ctx.botKey]
	if !ok {
		persona = personaComments[fallbackPersonaKey]
	}
	templates := persona[trigger]
	if len(templates) == 0 {
		return nil
	}
	index := int(random() * float64(len(templates)))
	if index >= len(templates) {
		index = len(templates) - 1
	}
	return &battleCommentary{Message: templates[index], Trigger: trigger}
}

// unitRandom is the production randomness source for commentary and bots.
func unitRandom() float64 { return rand.Float64() }
