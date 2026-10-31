package flashcarddeck

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDeckCardInputPreservesImageAsset(t *testing.T) {
	var card DeckCardInput
	if err := json.Unmarshal([]byte(`{"frontText":"りんご","backText":"apple","primaryImageAssetId":"67e55044-10b1-426f-9247-bb680e5fe0c8"}`), &card); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(card)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"primaryImageAssetId"`) {
		t.Fatal("primary image asset is lost from deck card input")
	}
}

func TestSelectedImageFallbackProviders(t *testing.T) {
	for _, tc := range []struct {
		name, provider, raw, author string
		exposed                     bool
	}{
		{"pexels", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","authorUrl":"https://www.pexels.com/@carol","license":"Pexels License","licenseUrl":"https://www.pexels.com/license/"}`, "Carol", true},
		{"pexels hotlink delivery", "pexels", `{"provider":"pexels","delivery":"hotlink","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","license":"Pexels License"}`, "", false},
		{"pexels foreign source", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com.evil.test/photo/a/","author":"Carol","license":"Pexels License"}`, "", false},
		{"pexels foreign license URL", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","license":"Pexels License","licenseUrl":"https://evil.test/license"}`, "", false},
		{"wikimedia", "wikimedia", `{"provider":"wikimedia","delivery":"rehosted","imageUrl":"https://thumb.wikimedia.org/a.jpg","sourceUrl":"https://commons.wikimedia.org/wiki/File:A.jpg","author":"Dave","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}`, "Dave", true},
		{"wikimedia NC license", "wikimedia", `{"provider":"wikimedia","delivery":"rehosted","imageUrl":"https://thumb.wikimedia.org/a.jpg","sourceUrl":"https://commons.wikimedia.org/wiki/File:A.jpg","author":"Dave","license":"CC BY-NC 4.0","licenseUrl":"https://creativecommons.org/licenses/by-nc/4.0/"}`, "", false},
		{"wikimedia foreign image", "wikimedia", `{"provider":"wikimedia","delivery":"rehosted","imageUrl":"https://evil.test/a.jpg","sourceUrl":"https://commons.wikimedia.org/wiki/File:A.jpg","author":"Dave","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by/4.0/"}`, "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			image := &DeckCardImage{}
			PopulateSelectedImage(image, tc.provider, []byte(tc.raw))
			if image.Author != tc.author || (image.Provider == tc.provider) != tc.exposed {
				t.Fatalf("selectedImage exposed=%v author=%q, want exposed=%v author=%q", image.Provider == tc.provider, image.Author, tc.exposed, tc.author)
			}
			if image.ReadURL != nil {
				t.Fatalf("rehosted image must not expose a hotlink URL: %q", *image.ReadURL)
			}
		})
	}
}
