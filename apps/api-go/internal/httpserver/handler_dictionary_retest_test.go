package httpserver

import "testing"

func TestDictionaryRejectsRetestRefusal(t *testing.T) {
	refusal := "không có thông tin đầy đủ để dịch chính xác"
	if dictionaryGlossUsable("バインド", &refusal) {
		t.Fatal("translation refusal must not appear as a dictionary definition")
	}
}

func TestDictionaryRejectsCorruptedAndMistranslatedGlosses(t *testing.T) {
	badCases := []struct {
		headword string
		gloss    string
	}{
		{"クリスマスローズ属", "chi thiết khoái tử; chi cây trị điên; chi cây lê lư; chi helleborus )"},
		{"クリスマスローズ", "thiết khoái tử; cây trị điên; cây lê lư"},
		{"H1(HID)", "h1 does not have a clear meaning in vietnamese. it appears to be a technical term related to the construction industry"},
		{"あいくるしい", "đẹp đẽ; xinh; nghĩa mỹ); người đàn bà trẻ đẹp"},
		{"アカバナ属", "chi epilobium )"},
		{"近縁属", "liên hệ genera; những tiền đồng có liên hệ"},
	}
	for _, tc := range badCases {
		g := tc.gloss
		if dictionaryGlossUsable(tc.headword, &g) {
			t.Fatalf("expected corrupted gloss for %s (%q) to be rejected", tc.headword, tc.gloss)
		}
	}

	good := "chi hoa Christmas rose (chi Helleborus)"
	if !dictionaryGlossUsable("クリスマスローズ属", &good) {
		t.Fatalf("expected valid gloss %q to be accepted", good)
	}
}

