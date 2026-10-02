package postgres

// SQL ↔ canonical schema conformance ratchet.
//
// Every static SQL string literal in the Go API (non-test files) is PREPAREd
// against the canonical schema (Prisma migrations + internal/postgres/migrations,
// exactly what CI provisions). PREPARE resolves tables, columns, functions and
// types without executing anything. INSERTs with an explicit column list are
// additionally checked for NOT NULL columns that have no DB default (e.g. Prisma
// @updatedAt columns), which PREPARE cannot see but which fail every insert.
//
// Known drift is recorded in testdata/sql_conformance_baseline.json. New drift
// fails; drift that disappears must be removed from the baseline:
//
//	UPDATE_SQL_CONFORMANCE_BASELINE=1          shrink the baseline (refuses new drift)
//	UPDATE_SQL_CONFORMANCE_BASELINE=accept-new also accept new drift (must be reviewed)
//
// Limitations (documented, not silently ignored): SQL assembled by string
// concatenation (fragments fail with "syntax error at end of input") and
// fmt.Sprintf templates (contain '%') cannot be checked statically.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const conformanceBaselinePath = "testdata/sql_conformance_baseline.json"

type conformanceBaseline struct {
	Note       string         `json:"note"`
	MinChecked int            `json:"min_statements_checked"`
	KnownDrift map[string]int `json:"known_drift"`
}

var (
	sqlPrefix   = regexp.MustCompile(`^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\s`)
	insertCols  = regexp.MustCompile(`(?is)^\s*INSERT\s+INTO\s+"?([a-z_][a-z0-9_]*)"?\."?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)`)
	ignoredCode = map[string]bool{
		"42P18": true, // indeterminate_datatype: $n type only known at call site
		"42P08": true, // ambiguous_parameter
	}
)

type sqlLiteral struct {
	file string // relative to the module root
	sql  string
}

func collectSQLLiterals(t *testing.T, moduleRoot string) []sqlLiteral {
	t.Helper()
	var out []sqlLiteral
	err := filepath.WalkDir(moduleRoot, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if name := d.Name(); name == "testdata" || name == "vendor" || strings.HasPrefix(name, ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(p, ".go") || strings.HasSuffix(p, "_test.go") {
			return nil
		}
		fset := token.NewFileSet()
		f, err := parser.ParseFile(fset, p, nil, 0)
		if err != nil {
			return fmt.Errorf("parse %s: %w", p, err)
		}
		rel, _ := filepath.Rel(moduleRoot, p)
		ast.Inspect(f, func(n ast.Node) bool {
			lit, ok := n.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			s, err := strconv.Unquote(lit.Value)
			if err != nil || !sqlPrefix.MatchString(s) || strings.Contains(s, "%") {
				return true
			}
			out = append(out, sqlLiteral{file: filepath.ToSlash(rel), sql: s})
			return true
		})
		return nil
	})
	if err != nil {
		t.Fatalf("walk Go sources: %v", err)
	}
	return out
}

// requiredColumns returns schema.table → set of NOT NULL columns that have no
// default, identity, or generation expression.
func requiredColumns(ctx context.Context, t *testing.T, conn *pgx.Conn) map[string]map[string]bool {
	t.Helper()
	rows, err := conn.Query(ctx, `SELECT table_schema || '.' || table_name, column_name
FROM information_schema.columns
WHERE is_nullable = 'NO' AND column_default IS NULL AND is_identity = 'NO' AND is_generated = 'NEVER'
  AND table_schema NOT IN ('pg_catalog', 'information_schema')`)
	if err != nil {
		t.Fatalf("query required columns: %v", err)
	}
	defer rows.Close()
	req := map[string]map[string]bool{}
	for rows.Next() {
		var table, col string
		if err := rows.Scan(&table, &col); err != nil {
			t.Fatalf("scan required columns: %v", err)
		}
		if req[table] == nil {
			req[table] = map[string]bool{}
		}
		req[table][col] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate required columns: %v", err)
	}
	return req
}

func TestSQLConformsToCanonicalSchema(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping SQL conformance check (requires the canonical schema)")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	literals := collectSQLLiterals(t, moduleRoot)
	required := requiredColumns(ctx, t, conn)

	drift := map[string]int{}
	examples := map[string]string{}
	checked := 0
	for _, lit := range literals {
		_, perr := conn.Prepare(ctx, "", lit.sql)
		var pgErr *pgconn.PgError
		switch {
		case perr == nil:
			checked++
		case errors.As(perr, &pgErr) && ignoredCode[pgErr.Code]:
			checked++
			continue
		case errors.As(perr, &pgErr) && pgErr.Code == "42601" && pgErr.Message == "syntax error at end of input":
			continue // concatenated fragment; not statically checkable
		case errors.As(perr, &pgErr):
			checked++
			key := fmt.Sprintf("%s :: %s %s", lit.file, pgErr.Code, pgErr.Message)
			drift[key]++
			examples[key] = lit.sql
			continue
		default:
			t.Fatalf("prepare failed without a PostgreSQL error (connection problem?): %v", perr)
		}
		m := insertCols.FindStringSubmatch(lit.sql)
		if m == nil {
			continue
		}
		table := strings.ToLower(m[1] + "." + m[2])
		listed := map[string]bool{}
		for _, c := range strings.Split(m[3], ",") {
			listed[strings.ToLower(strings.Trim(strings.TrimSpace(c), `"`))] = true
		}
		for col := range required[table] {
			if !listed[col] {
				key := fmt.Sprintf("%s :: NOT_NULL_NO_DEFAULT %s.%s omitted from INSERT", lit.file, table, col)
				drift[key]++
				examples[key] = lit.sql
			}
		}
	}
	t.Logf("SQL literals found=%d checked=%d drift entries=%d", len(literals), checked, len(drift))

	var base conformanceBaseline
	raw, readErr := os.ReadFile(conformanceBaselinePath)
	if readErr == nil {
		if err := json.Unmarshal(raw, &base); err != nil {
			t.Fatalf("baseline %s is not valid JSON: %v", conformanceBaselinePath, err)
		}
	} else if !errors.Is(readErr, os.ErrNotExist) {
		t.Fatalf("read baseline: %v", readErr)
	}
	if base.KnownDrift == nil {
		base.KnownDrift = map[string]int{}
	}

	var added, resolved []string
	for k, n := range drift {
		if n > base.KnownDrift[k] {
			added = append(added, fmt.Sprintf("%s (x%d)\n      SQL: %s", k, n-base.KnownDrift[k], oneLine(examples[k])))
		}
	}
	for k, n := range base.KnownDrift {
		if drift[k] < n {
			resolved = append(resolved, fmt.Sprintf("%s (x%d)", k, n-drift[k]))
		}
	}
	sort.Strings(added)
	sort.Strings(resolved)

	if mode := os.Getenv("UPDATE_SQL_CONFORMANCE_BASELINE"); mode != "" {
		if len(added) > 0 && mode != "accept-new" {
			t.Fatalf("refusing to baseline %d NEW drift entries without UPDATE_SQL_CONFORMANCE_BASELINE=accept-new:\n  %s",
				len(added), strings.Join(added, "\n  "))
		}
		out := conformanceBaseline{
			Note:       "Known Go SQL vs canonical-schema drift (product defects). Generated by UPDATE_SQL_CONFORMANCE_BASELINE; CI never writes this file. Shrink it as defects are fixed.",
			MinChecked: checked,
			KnownDrift: drift,
		}
		b, _ := json.MarshalIndent(out, "", "  ")
		if err := os.WriteFile(conformanceBaselinePath, append(b, '\n'), 0o644); err != nil {
			t.Fatalf("write baseline: %v", err)
		}
		t.Logf("baseline written: %d entries (%d new accepted, %d resolved removed)", len(drift), len(added), len(resolved))
		return
	}

	if readErr != nil {
		t.Fatalf("baseline %s missing; generate it with UPDATE_SQL_CONFORMANCE_BASELINE=1", conformanceBaselinePath)
	}
	if checked < base.MinChecked {
		t.Errorf("only %d SQL statements were checkable, baseline floor is %d (extraction broken, or statements removed — update the baseline in a reviewed change)",
			checked, base.MinChecked)
	}
	if len(added) > 0 {
		t.Errorf("NEW SQL/schema drift (statement references something the canonical schema does not have):\n  %s", strings.Join(added, "\n  "))
	}
	if len(resolved) > 0 {
		t.Errorf("drift fixed but still listed in %s — run UPDATE_SQL_CONFORMANCE_BASELINE=1 go test -run TestSQLConformsToCanonicalSchema ./internal/postgres/ and commit:\n  %s",
			conformanceBaselinePath, strings.Join(resolved, "\n  "))
	}
}

func oneLine(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > 220 {
		s = s[:220] + "…"
	}
	return s
}
