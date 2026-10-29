package loto

import (
	"errors"
	"strings"
	"testing"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

const loto6CSV = "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字,1等口数,キャリーオーバー\n" +
	"1,2000/10/5,2,8,10,13,27,30,39,2,0\n" +
	"2,2000/10/12,1,9,16,20,21,43,5,0,4,000\n"

func shiftJIS(t *testing.T, text string) []byte {
	t.Helper()
	encoded, _, err := transform.String(japanese.ShiftJIS.NewEncoder(), text)
	if err != nil {
		t.Fatalf("encode Shift_JIS: %v", err)
	}
	return []byte(encoded)
}

func TestDecodeCSVBytesHandlesShiftJISAndUTF8(t *testing.T) {
	sjis := shiftJIS(t, loto6CSV)
	if strings.Contains(string(sjis), "開催回") {
		t.Fatal("fixture must really be Shift_JIS")
	}
	decoded, err := DecodeCSVBytes(sjis)
	if err != nil || decoded != loto6CSV {
		t.Fatalf("Shift_JIS decode = %q, %v", decoded, err)
	}
	utf8Text, err := DecodeCSVBytes(append([]byte{0xEF, 0xBB, 0xBF}, loto6CSV...))
	if err != nil || utf8Text != loto6CSV {
		t.Fatalf("UTF-8 with BOM decode = %q, %v", utf8Text, err)
	}
}

func TestParseCSVReadsThekyoLoto6Rows(t *testing.T) {
	draws, err := ParseCSV(strings.Replace(loto6CSV, "4,000", "4000", 1), Loto6)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(draws) != 2 || draws[0].Number != 1 || draws[0].DateKey != "2000-10-05" {
		t.Fatalf("draws = %+v", draws)
	}
	if got := draws[0].Main; len(got) != 6 || got[0] != 2 || got[5] != 30 {
		t.Fatalf("main numbers = %v, want ascending 2..30", got)
	}
	if got := draws[0].Bonus; len(got) != 1 || got[0] != 39 {
		t.Fatalf("bonus = %v, want [39]", got)
	}
	if draws[1].Carryover == nil || *draws[1].Carryover != 4000 {
		t.Fatalf("carryover = %v, want 4000", draws[1].Carryover)
	}
}

func TestParseCSVDetectsLoto7FromHeaders(t *testing.T) {
	text := "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,第7数字,BONUS数字1,BONUS数字2\n" +
		"2,2013/4/12,20,24,29,31,33,34,35,32,12\n"
	draws, err := ParseCSV(text, Loto6)
	if err != nil || len(draws) != 1 || draws[0].Game != Loto7 {
		t.Fatalf("draws=%+v err=%v, want one loto7 draw", draws, err)
	}
	if len(draws[0].Bonus) != 2 || draws[0].Bonus[0] != 12 || draws[0].Bonus[1] != 32 {
		t.Fatalf("bonus = %v, want sorted [12 32]", draws[0].Bonus)
	}
}

func TestParseCSVRejectsInvalidRowsNamingTheRow(t *testing.T) {
	header := "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字\n"
	cases := map[string]string{
		"number out of range": header + "1,2000/10/5,2,8,10,13,27,44,39\n",
		"repeated main":       header + "1,2000/10/5,2,2,10,13,27,30,39\n",
		"bonus equals main":   header + "1,2000/10/5,2,8,10,13,27,30,30\n",
		"bad date":            header + "1,2000/13/5,2,8,10,13,27,30,39\n",
		"duplicate draw":      header + "1,2000/10/5,2,8,10,13,27,30,39\n1,2000/10/12,1,9,16,20,21,43,5\n",
		"missing number":      header + "1,2000/10/5,2,8,10,13,27,,39\n",
	}
	for name, text := range cases {
		_, err := ParseCSV(text, Loto6)
		if err == nil || !errors.Is(err, ErrInvalidInput) && !errors.Is(err, ErrInvalidDate) {
			t.Errorf("%s: err = %v, want a validation error", name, err)
			continue
		}
		if !strings.Contains(err.Error(), "row ") {
			t.Errorf("%s: error %q must name the row", name, err)
		}
	}
	if _, err := ParseCSV(header, Loto6); err == nil {
		t.Error("a header-only CSV must be rejected")
	}
}
