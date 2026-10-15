package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/devguard"
)

type fixture struct {
	Action    string `json:"action"`
	ActorID   string `json:"actorId"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	RoleCode  string `json:"roleCode"`
	ArticleID string `json:"articleId"`
}

func main() {
	var f fixture
	if err := json.NewDecoder(os.Stdin).Decode(&f); err != nil {
		fail(err)
	}
	if err := devguard.RequireLocalDatabase(os.Getenv("DATABASE_URL"), os.Getenv(devguard.AllowRemoteEnv)); err != nil {
		fail(err)
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		fail(err)
	}
	defer db.Close()
	if f.Action == "cleanup" {
		if _, err = db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE id::text IN (
			SELECT target_id FROM ops.admin_audit_log WHERE actor_id=$1 AND action='magazine.article.generated')`, f.ActorID); err != nil {
			fail(err)
		}
		if f.ArticleID != "" {
			if _, err = db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE id=$1`, f.ArticleID); err != nil {
				fail(err)
			}
			if _, err = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2`, f.ArticleID, f.ActorID); err != nil {
				fail(err)
			}
		}
		for _, query := range []string{
			`DELETE FROM ops.admin_audit_log WHERE actor_id=$1`,
			`DELETE FROM auth.admin_password_credential WHERE actor_id=$1`,
			`DELETE FROM auth.admin_session WHERE actor_id=$1`,
			`DELETE FROM authz.admin_actor_role WHERE actor_id=$1`,
			`DELETE FROM authz.admin_actor WHERE id=$1`,
			`DELETE FROM authz.admin_role_permission WHERE role_id=(SELECT id FROM authz.admin_role WHERE code=$1)`,
			`DELETE FROM authz.admin_role WHERE code=$1`,
		} {
			arg := any(f.ActorID)
			if query == `DELETE FROM authz.admin_role_permission WHERE role_id=(SELECT id FROM authz.admin_role WHERE code=$1)` || query == `DELETE FROM authz.admin_role WHERE code=$1` {
				arg = f.RoleCode
			}
			if _, err = db.Exec(ctx, query, arg); err != nil {
				fail(err)
			}
		}
		fmt.Println("fixture removed")
		return
	}
	if f.Action != "create" {
		fail(fmt.Errorf("unknown action"))
	}
	if _, err = db.Exec(ctx, `INSERT INTO authz.admin_actor (id,email,display_name,status,updated_at) VALUES ($1,$2,'Audit 138 Admin','active',now())`, f.ActorID, f.Email); err != nil {
		fail(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO authz.admin_role (id,code,name,status) VALUES (gen_random_uuid(),$1,'Audit 138 Content Admin','active')`, f.RoleCode); err != nil {
		fail(err)
	}
	for _, code := range []string{"admin.content.read", "admin.content.write"} {
		if _, err = db.Exec(ctx, `INSERT INTO authz.admin_permission (id,code) VALUES (gen_random_uuid(),$1) ON CONFLICT (code) DO NOTHING`, code); err != nil {
			fail(err)
		}
		var permissionID string
		if err = db.QueryRow(ctx, `SELECT id FROM authz.admin_permission WHERE code=$1`, code).Scan(&permissionID); err != nil {
			fail(err)
		}
		if _, err = db.Exec(ctx, `INSERT INTO authz.admin_role_permission (role_id,permission_id) SELECT id,$2 FROM authz.admin_role WHERE code=$1`, f.RoleCode, permissionID); err != nil {
			fail(err)
		}
	}
	if _, err = db.Exec(ctx, `INSERT INTO authz.admin_actor_role (actor_id,role_id) SELECT $1,id FROM authz.admin_role WHERE code=$2`, f.ActorID, f.RoleCode); err != nil {
		fail(err)
	}
	if err = credential.NewStore(db).SetAdminCredential(ctx, f.ActorID, []byte(f.Password)); err != nil {
		fail(err)
	}
	fmt.Println("fixture created")
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
