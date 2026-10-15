package httpserver

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authlink"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const audit159w6Origin = "https://audit159w6.example.test"

func audit159w6Router(t *testing.T, db *pgxpool.Pool) http.Handler {
	t.Helper()
	limiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit: 100, Window: time.Minute, TTL: 5 * time.Minute, MaxKeys: 100, EvictEvery: time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	return NewRouter(Dependencies{
		Config: &config.Config{Port: "4001", CORSOrigins: []string{audit159w6Origin}, CookieSecure: true},
		Logger: testLogger(), DBPool: db, SessionStore: session.NewStore(db),
		ProfileStore: profile.NewStore(db), RBACStore: authz.NewStore(db),
		CredentialStore: credential.NewStore(db), RateLimiter: limiter, AuthLinkStore: authlink.NewStore(db), Version: "test",
	})
}

func audit159w6Request(t *testing.T, router http.Handler, method, path, body string, cookie *http.Cookie, origin string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	return res
}

func audit159w6Login(t *testing.T, router http.Handler, route, email, password, cookieName string) *http.Cookie {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	res := audit159w6Request(t, router, http.MethodPost, route, string(body), nil, audit159w6Origin)
	if res.Code != http.StatusOK {
		t.Fatalf("real login %s status=%d body=%s", route, res.Code, res.Body.String())
	}
	var payload struct {
		OK    bool   `json:"ok"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil || !payload.OK {
		t.Fatalf("real login response invalid: payload=%+v err=%v", payload, err)
	}
	for _, cookie := range res.Result().Cookies() {
		if cookie.Name == cookieName && cookie.Value != "" && (payload.Token == "" || cookie.Value == payload.Token) && cookie.HttpOnly && cookie.Secure {
			return cookie
		}
	}
	t.Fatalf("real login did not set protected %s cookie", cookieName)
	return nil
}

func audit159w6SeedLearner(t *testing.T, db *pgxpool.Pool, router http.Handler, tag string) (string, *http.Cookie) {
	t.Helper()
	userID := newUUID(t)
	email := fmt.Sprintf("audit159w6-%s-%s@example.test", tag, userID[:8])
	password := "audit159w6-disposable-password-9"
	seedActiveUser(t, db, userID, "AUDIT-159 disposable learner", email, "")
	if err := credential.NewStore(db).SetLearnerCredential(context.Background(), userID, []byte(password)); err != nil {
		t.Fatal(err)
	}
	return userID, audit159w6Login(t, router, "/api/auth/login", email, password, learnerCookieName)
}

func audit159w6AssertMutationResponse(t *testing.T, res *httptest.ResponseRecorder) {
	t.Helper()
	var payload map[string]bool
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil || !payload["ok"] {
		t.Fatalf("mutation response=%s err=%v", res.Body.String(), err)
	}
	for _, cookie := range res.Result().Cookies() {
		if cookie.Name == learnerCookieName && cookie.Value == "" && cookie.MaxAge == -1 && cookie.HttpOnly {
			return
		}
	}
	t.Fatal("account mutation did not clear the learner cookie")
}

func TestAudit159Wave6LearnerAuthSessionLifecycle(t *testing.T) {
	db := testPool(t)
	router := audit159w6Router(t, db)
	sessions := session.NewStore(db)
	for _, path := range []string{"/api/auth/disable", "/api/auth/delete"} {
		if res := audit159w6Request(t, router, http.MethodPost, path, "", nil, audit159w6Origin); res.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous %s status=%d, want 401", path, res.Code)
		}
	}

	logoutUser, logoutCookie := audit159w6SeedLearner(t, db, router, "logout")
	if _, err := sessions.LookupLearnerSession(context.Background(), logoutCookie.Value); err != nil {
		t.Fatalf("login did not persist its real session: %v", err)
	}
	if res := audit159w6Request(t, router, http.MethodPost, "/api/auth/logout", "", logoutCookie, ""); res.Code != http.StatusForbidden {
		t.Fatalf("logout without trusted origin status=%d, want 403", res.Code)
	}
	if _, err := sessions.LookupLearnerSession(context.Background(), logoutCookie.Value); err != nil {
		t.Fatalf("CSRF rejection changed session: %v", err)
	}
	logout := audit159w6Request(t, router, http.MethodPost, "/api/auth/logout", "", logoutCookie, audit159w6Origin)
	if logout.Code != http.StatusOK {
		t.Fatalf("logout status=%d body=%s", logout.Code, logout.Body.String())
	}
	audit159w6AssertMutationResponse(t, logout)
	if _, err := sessions.LookupLearnerSession(context.Background(), logoutCookie.Value); err == nil {
		t.Fatal("logout left the real session active")
	}
	var activeSessions, revokedSessions int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FILTER (WHERE revoked_at IS NULL), count(*) FILTER (WHERE revoked_at IS NOT NULL) FROM auth.session WHERE user_id=$1`, logoutUser).Scan(&activeSessions, &revokedSessions); err != nil || activeSessions != 0 || revokedSessions != 1 {
		t.Fatalf("logout did not revoke persisted session row: active=%d revoked=%d err=%v", activeSessions, revokedSessions, err)
	}
	disableUser, disableCookie := audit159w6SeedLearner(t, db, router, "disable")
	if res := audit159w6Request(t, router, http.MethodPost, "/api/auth/disable", "", disableCookie, audit159w6Origin+"/untrusted"); res.Code != http.StatusForbidden {
		t.Fatalf("disable with invalid origin status=%d, want 403", res.Code)
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM profile.user_profile WHERE id=$1`, disableUser).Scan(&status); err != nil || status != "active" {
		t.Fatalf("CSRF rejection changed account status=%q err=%v", status, err)
	}
	disabled := audit159w6Request(t, router, http.MethodPost, "/api/auth/disable", "", disableCookie, audit159w6Origin)
	if disabled.Code != http.StatusOK {
		t.Fatalf("disable status=%d body=%s", disabled.Code, disabled.Body.String())
	}
	audit159w6AssertMutationResponse(t, disabled)
	if err := db.QueryRow(context.Background(), `SELECT status FROM profile.user_profile WHERE id=$1`, disableUser).Scan(&status); err != nil || status != "disabled" {
		t.Fatalf("disable persistence status=%q err=%v", status, err)
	}
	if _, err := sessions.LookupLearnerSession(context.Background(), disableCookie.Value); err == nil {
		t.Fatal("disable left the real session active")
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FILTER (WHERE revoked_at IS NULL), count(*) FILTER (WHERE revoked_at IS NOT NULL) FROM auth.session WHERE user_id=$1`, disableUser).Scan(&activeSessions, &revokedSessions); err != nil || activeSessions != 0 || revokedSessions != 1 {
		t.Fatalf("disable did not revoke persisted session rows: active=%d revoked=%d err=%v", activeSessions, revokedSessions, err)
	}
	disabledLogin := audit159w6Request(t, router, http.MethodPost, "/api/auth/login", `{"email":"`+fmt.Sprintf("audit159w6-disable-%s@example.test", disableUser[:8])+`","password":"audit159w6-disposable-password-9"}`, nil, audit159w6Origin)
	if disabledLogin.Code != http.StatusUnauthorized {
		t.Fatalf("disabled account login status=%d, want 401", disabledLogin.Code)
	}
}

func TestAudit159Wave6LearnerDeleteAccountRealSession(t *testing.T) {
	db := testPool(t)
	router := audit159w6Router(t, db)
	sessions := session.NewStore(db)
	userID, cookie := audit159w6SeedLearner(t, db, router, "delete")
	if res := audit159w6Request(t, router, http.MethodPost, "/api/auth/delete", "", cookie, "https://attacker.example.test"); res.Code != http.StatusForbidden {
		t.Fatalf("delete with untrusted origin status=%d, want 403", res.Code)
	}
	var exists bool
	if err := db.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM profile.user_profile WHERE id=$1)`, userID).Scan(&exists); err != nil || !exists {
		t.Fatalf("CSRF rejection changed disposable account exists=%v err=%v", exists, err)
	}
	deleted := audit159w6Request(t, router, http.MethodPost, "/api/auth/delete", "", cookie, audit159w6Origin)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	audit159w6AssertMutationResponse(t, deleted)
	if err := db.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM profile.user_profile WHERE id=$1)`, userID).Scan(&exists); err != nil || exists {
		t.Fatalf("delete did not persist exists=%v err=%v", exists, err)
	}
	if _, err := sessions.LookupLearnerSession(context.Background(), cookie.Value); err == nil {
		t.Fatal("delete left the real session active")
	}
	var credentials, sessionRows int
	if err := db.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM auth.password_credential WHERE user_id=$1), (SELECT count(*) FROM auth.session WHERE user_id=$1)`, userID).Scan(&credentials, &sessionRows); err != nil || credentials != 0 || sessionRows != 0 {
		t.Fatalf("delete did not cascade credentials and sessions: credentials=%d sessions=%d err=%v", credentials, sessionRows, err)
	}
}

func TestAudit159Wave6AuthLinkExchangeIsCSRFProtectedAndSingleUse(t *testing.T) {
	db := testPool(t)
	router := audit159w6Router(t, db)
	userID := newUUID(t)
	email := fmt.Sprintf("audit159w6-link-%s@example.test", userID[:8])
	seedActiveUser(t, db, userID, "Link Fixture", email, "")
	code := "audit159w6-one-time-" + userID
	hash := sha256.Sum256([]byte(code))
	if _, err := db.Exec(context.Background(), `INSERT INTO auth.auth_link_code (code_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '5 minutes')`, hex.EncodeToString(hash[:]), userID); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]string{"code": code})
	if res := audit159w6Request(t, router, http.MethodPost, "/api/auth/link/exchange", string(body), nil, ""); res.Code != http.StatusForbidden {
		t.Fatalf("link exchange without trusted origin status=%d, want 403", res.Code)
	}
	var usedAt *time.Time
	if err := db.QueryRow(context.Background(), `SELECT used_at FROM auth.auth_link_code WHERE code_hash=$1`, hex.EncodeToString(hash[:])).Scan(&usedAt); err != nil || usedAt != nil {
		t.Fatalf("CSRF denial consumed link code used_at=%v err=%v", usedAt, err)
	}
	res := audit159w6Request(t, router, http.MethodPost, "/api/auth/link/exchange", string(body), nil, audit159w6Origin)
	if res.Code != http.StatusOK {
		t.Fatalf("exchange status=%d body=%s", res.Code, res.Body.String())
	}
	var payload struct {
		UserID      string  `json:"userId"`
		DisplayName string  `json:"displayName"`
		EmailMasked *string `json:"emailMasked"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil || payload.UserID != userID || payload.DisplayName != "Link Fixture" || payload.EmailMasked == nil || *payload.EmailMasked != "a***@example.test" {
		t.Fatalf("exchange contract payload=%+v err=%v", payload, err)
	}
	if replay := audit159w6Request(t, router, http.MethodPost, "/api/auth/link/exchange", string(body), nil, audit159w6Origin); replay.Code != http.StatusBadRequest {
		t.Fatalf("replayed link code status=%d, want 400", replay.Code)
	}
}

func TestAudit159Wave6AdminQuizQuestionsReadOnlyContract(t *testing.T) {
	db := testPool(t)
	router := audit159w6Router(t, db)

	unauth := audit159w6Request(t, router, http.MethodGet, "/api/admin/quiz/questions", "", nil, "")
	if unauth.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous quiz read status=%d, want 401", unauth.Code)
	}

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("audit159w6-admin-%s@example.test", adminID[:8])
	seedActiveAdmin(t, db, adminID, "AUDIT-159 Admin", adminEmail)
	if err := credential.NewStore(db).SetAdminCredential(context.Background(), adminID, []byte("audit159w6-admin-password-9")); err != nil {
		t.Fatal(err)
	}
	adminCookie := audit159w6Login(t, router, "/api/admin/login", adminEmail, "audit159w6-admin-password-9", adminCookieName)
	_, learnerCookie := audit159w6SeedLearner(t, db, router, "quiz-access")
	if denied := audit159w6Request(t, router, http.MethodGet, "/api/admin/quiz/questions", "", learnerCookie, ""); denied.Code != http.StatusUnauthorized {
		t.Fatalf("learner quiz read status=%d, want 401", denied.Code)
	}
	testID := newUUID(t)
	sectionID := newUUID(t)
	questionID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,created_at,updated_at) VALUES ($1,$2,'AUDIT-159 disposable test','practice','draft',now(),now())`, testID, "audit159-"+testID[:8]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID); err != nil {
			t.Errorf("clean up disposable quiz fixture: %v", err)
		}
	})
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_test_section (id,test_id,code,title_vi,display_order) VALUES ($1,$2,$3,'Disposable section',1)`, sectionID, testID, "audit159-"+sectionID[:8]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_question (id,section_id,prompt,explanation_vi,skill_tag,difficulty,status,created_at,updated_at) VALUES ($1,$2,'AUDIT-159 fixture question','fixture explanation','audit159','standard','audit159',now(),now())`, questionID, sectionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_question_option (question_id,option_key,text,is_correct) VALUES ($1,'A','fixture A',true),($1,'B','fixture B',false)`, questionID); err != nil {
		t.Fatal(err)
	}
	var beforeOptions int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM assessment.bjt_question_option WHERE question_id=$1`, questionID).Scan(&beforeOptions); err != nil || beforeOptions != 2 {
		t.Fatalf("invalid question fixture option count=%d err=%v", beforeOptions, err)
	}
	read := audit159w6Request(t, router, http.MethodGet, "/api/admin/quiz/questions?status=audit159", "", adminCookie, "")
	if read.Code != http.StatusOK {
		t.Fatalf("admin quiz read status=%d body=%s", read.Code, read.Body.String())
	}
	var payload struct {
		Items []struct {
			ID          string `json:"id"`
			Prompt      string `json:"prompt"`
			OptionCount int    `json:"optionCount"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(read.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 || payload.Items[0].ID != questionID || payload.Items[0].Prompt != "AUDIT-159 fixture question" || payload.Items[0].OptionCount != 2 {
		t.Fatalf("quiz list contract=%+v; want fixture question with 2 options", payload)
	}
	var afterOptions int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM assessment.bjt_question_option WHERE question_id=$1`, questionID).Scan(&afterOptions); err != nil || afterOptions != beforeOptions {
		t.Fatalf("read mutated canonical question options: before=%d after=%d err=%v", beforeOptions, afterOptions, err)
	}
}
