// Package loto implements the Loto6/Loto7 learning hub domain: official result
// import, deterministic reference-combination generation, JST calendar rules,
// Japanese learning sentences and learner statistics.
//
// Every valid Loto combination has exactly the same chance of being drawn. The
// generator is a heuristic over historical data that exists to teach
// probability and Japanese; nothing in this package claims predictive power.
package loto

import (
	"errors"
	"time"
)

// Game identifies a supported lottery game.
type Game string

const (
	Loto6 Game = "loto6"
	Loto7 Game = "loto7"
)

// Spec describes the rules and draw schedule of a game.
type Spec struct {
	Game         Game
	MainCount    int
	BonusCount   int
	MaxNumber    int
	DrawWeekdays []time.Weekday
	DrawTime     string
	LabelJP      string
	LabelVI      string
	LabelEN      string
	// TotalCombinations is C(MaxNumber, MainCount).
	TotalCombinations int64
}

var specs = map[Game]Spec{
	Loto6: {
		Game: Loto6, MainCount: 6, BonusCount: 1, MaxNumber: 43,
		DrawWeekdays: []time.Weekday{time.Monday, time.Thursday},
		DrawTime:     "18:45 JST",
		LabelJP:      "毎週 月曜・木曜 18:45 抽選",
		LabelVI:      "Thứ 2 & Thứ 5 hàng tuần, quay thưởng 18:45 (giờ Nhật)",
		LabelEN:      "Every Monday & Thursday, draw at 18:45 JST",
	},
	Loto7: {
		Game: Loto7, MainCount: 7, BonusCount: 2, MaxNumber: 37,
		DrawWeekdays: []time.Weekday{time.Friday},
		DrawTime:     "18:45 JST",
		LabelJP:      "毎週 金曜 18:45 抽選",
		LabelVI:      "Thứ 6 hàng tuần, quay thưởng 18:45 (giờ Nhật)",
		LabelEN:      "Every Friday, draw at 18:45 JST",
	},
}

func init() {
	for game, spec := range specs {
		spec.TotalCombinations = Combinations(spec.MaxNumber, spec.MainCount)
		specs[game] = spec
	}
}

// Games lists every supported game in display order.
func Games() []Game { return []Game{Loto6, Loto7} }

// ParseGame validates a raw game identifier.
func ParseGame(value string) (Game, bool) {
	game := Game(value)
	_, ok := specs[game]
	return game, ok
}

// SpecFor returns the rules of a game. It panics only for a Game value that was
// not obtained from ParseGame or the package constants.
func SpecFor(game Game) Spec {
	spec, ok := specs[game]
	if !ok {
		panic("loto: unknown game " + string(game))
	}
	return spec
}

// Combinations returns the binomial coefficient C(n, k).
func Combinations(n, k int) int64 {
	if k < 0 || k > n {
		return 0
	}
	if k > n-k {
		k = n - k
	}
	var result int64 = 1
	for i := 1; i <= k; i++ {
		result = result * int64(n-k+i) / int64(i)
	}
	return result
}

// Draw is one official draw result.
type Draw struct {
	Game      Game
	Number    int
	DateKey   string // YYYY-MM-DD, the JST calendar date of the draw
	Main      []int  // sorted ascending
	Bonus     []int  // sorted ascending
	Carryover *int64
	Sales     *int64
	SourceURL string
	Provider  string
}

// Sentinel errors returned by the package.
var (
	ErrInvalidInput = errors.New("loto: invalid input")
	ErrInvalidDate  = errors.New("loto: invalid date")
)
