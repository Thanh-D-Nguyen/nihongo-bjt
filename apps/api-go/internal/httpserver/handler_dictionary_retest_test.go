package httpserver

import "testing"

func TestDictionaryRejectsRetestRefusal(t *testing.T) {
	refusal := "không có thông tin đầy đủ để dịch chính xác"
	if dictionaryGlossUsable("バインド", &refusal) {
		t.Fatal("translation refusal must not appear as a dictionary definition")
	}
}
