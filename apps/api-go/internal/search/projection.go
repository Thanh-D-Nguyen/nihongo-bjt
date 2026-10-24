package search

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

// LoadDocuments reads the full canonical projection shared by admin and CLI rebuilds.
func LoadDocuments(ctx context.Context, db *pgxpool.Pool, kind string) ([]Document, error) {
	if db == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	rows, err := db.Query(ctx, `
		SELECT id::text, kind, title, reading, description
		FROM reporting.v_content_search_documents
		WHERE ($1 = '' OR kind = $1)
		ORDER BY kind, id`, kind)
	if err != nil {
		return nil, fmt.Errorf("query canonical search projection: %w", err)
	}
	defer rows.Close()
	documents := make([]Document, 0)
	for rows.Next() {
		var document Document
		if err := rows.Scan(&document.ID, &document.Kind, &document.Title, &document.Reading, &document.Description); err != nil {
			return nil, fmt.Errorf("scan canonical search projection: %w", err)
		}
		documents = append(documents, document)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate canonical search projection: %w", err)
	}
	return documents, nil
}
