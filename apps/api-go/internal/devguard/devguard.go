// Package devguard keeps developer fixture commands away from shared databases.
package devguard

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// AllowRemoteEnv explicitly opts a fixture command into a non-local database.
const AllowRemoteEnv = "ALLOW_REMOTE_FIXTURE_DATABASE"

// RequireLocalDatabase refuses database URLs whose host is not loopback unless
// allowRemote is "1". Fixture commands create accounts with known credentials
// and delete audit rows; they must never run against a shared environment by
// accident.
func RequireLocalDatabase(rawURL, allowRemote string) error {
	if allowRemote == "1" {
		return nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("devguard: DATABASE_URL is not a valid URL")
	}
	host := parsed.Hostname()
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return nil
	}
	if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
		return nil
	}
	return fmt.Errorf("devguard: refusing non-local database host %q; fixture tools are for disposable databases (set %s=1 to override deliberately)", host, AllowRemoteEnv)
}
