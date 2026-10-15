package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// contentSummaryHandler returns counts from the canonical active content tables.
func contentSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var summary struct {
			Lexemes int64 `json:"lexemes"`
			Kanji   int64 `json:"kanji"`
			Grammar int64 `json:"grammar"`
		}
		const query = `SELECT
			(SELECT count(*) FROM content.lexeme WHERE status = 'active'),
			(SELECT count(*) FROM content.kanji WHERE status = 'active'),
			(SELECT count(*) FROM content.grammar_point WHERE status = 'active')`
		if err := db.QueryRow(r.Context(), query).Scan(&summary.Lexemes, &summary.Kanji, &summary.Grammar); err != nil {
			logger.ErrorContext(r.Context(), "get canonical content summary", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, summary)
	}
}
