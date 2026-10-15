package devguard

import "testing"

func TestRequireLocalDatabase(t *testing.T) {
	cases := []struct {
		name, url, allow string
		wantErr          bool
	}{
		{"loopback ipv4", "postgresql://u:p@127.0.0.1:5432/db", "", false},
		{"localhost", "postgresql://u:p@localhost/db", "", false},
		{"ipv6 loopback", "postgresql://u:p@[::1]:5432/db", "", false},
		{"remote host", "postgresql://u:p@db.internal.example:5432/db", "", true},
		{"remote ip", "postgresql://u:p@10.0.0.7:5432/db", "", true},
		{"explicit override", "postgresql://u:p@db.internal.example:5432/db", "1", false},
		{"override must be exactly 1", "postgresql://u:p@db.internal.example:5432/db", "true", true},
		{"malformed", "://%zz", "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := RequireLocalDatabase(tc.url, tc.allow)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tc.wantErr)
			}
		})
	}
}
