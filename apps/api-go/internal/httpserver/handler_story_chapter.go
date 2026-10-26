package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// storyCatalogue is the learner-facing subset of career.mission_arc.story_payload.
type storyCatalogue struct {
	SynopsisVi string   `json:"synopsisVi"`
	NpcSlugs   []string `json:"npcSlugs"`
	ArtAccent  string   `json:"artAccent"`
}

// parseStoryCatalogue tolerates free-form or malformed payloads: missing fields fall back to empty values.
func parseStoryCatalogue(raw json.RawMessage) storyCatalogue {
	var c storyCatalogue
	_ = json.Unmarshal(raw, &c)
	if c.NpcSlugs == nil {
		c.NpcSlugs = []string{}
	}
	return c
}

type storyBriefing struct {
	BriefingJa       string `json:"briefingJa"`
	BriefingVi       string `json:"briefingVi"`
	YourRoleVi       string `json:"yourRoleVi"`
	EstimatedMinutes int    `json:"estimatedMinutes"`
}

func parseStoryBriefing(raw json.RawMessage) storyBriefing {
	var b storyBriefing
	_ = json.Unmarshal(raw, &b)
	return b
}

// getStoryChapterHandler implements GET /api/story/chapters/{id}: the playable content of one chapter
// of a published arc, for signed-in learners only (it carries the answer keys). Persona prompts are never exposed.
func getStoryChapterHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// uuid.Parse also accepts urn:uuid:, braced and padded forms that Postgres rejects; only the canonical form is an id.
		parsed, err := uuid.Parse(extractPathParam(r.URL.Path, "chapters", 1))
		if err != nil || !strings.EqualFold(parsed.String(), extractPathParam(r.URL.Path, "chapters", 1)) {
			writeJSONError(w, "chapter not found", http.StatusNotFound)
			return
		}
		id := parsed.String()

		var (
			chapterID, arcSlug, slug, titleJa, titleVi string
			displayOrder                               int
			isBoss                                     bool
			briefingRaw, scenarioRaw, rewardsRaw       json.RawMessage
		)
		const q = `SELECT c.id, a.slug, c.slug, c.display_order, c.title_ja, c.title_vi, c.is_boss,
				c.briefing_payload, c.scenario_payload, c.rewards_payload
			FROM career.mission_chapter c
			JOIN career.mission_arc a ON a.id = c.arc_id
			WHERE c.id = $1::uuid AND a.status = 'published'`
		if err := db.QueryRow(r.Context(), q, id).Scan(&chapterID, &arcSlug, &slug, &displayOrder, &titleJa, &titleVi, &isBoss,
			&briefingRaw, &scenarioRaw, &rewardsRaw); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "chapter not found", http.StatusNotFound)
				return
			}
			logger.Error("get story chapter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var rawScenarios struct {
			Scenarios []json.RawMessage `json:"scenarios"`
		}
		_ = json.Unmarshal(scenarioRaw, &rawScenarios)
		if rawScenarios.Scenarios == nil {
			rawScenarios.Scenarios = []json.RawMessage{}
		}

		// Every active NPC is returned: option outcomes and rewards may name NPCs outside the scene's characters.
		type npcView struct {
			Slug            string  `json:"slug"`
			NameJa          string  `json:"nameJa"`
			RoleJa          string  `json:"roleJa"`
			CompanyJa       *string `json:"companyJa"`
			DefaultRelation string  `json:"defaultRelation"`
			AvatarInitial   string  `json:"avatarInitial"`
			AvatarTint      string  `json:"avatarTint"`
			BioVi           string  `json:"bioVi"`
		}
		npcs := []npcView{}
		rows, err := db.Query(r.Context(), `SELECT slug, name_ja, role_ja, company_ja, default_relation, avatar_media
			FROM career.story_npc WHERE status = 'active' ORDER BY slug`)
		if err != nil {
			logger.Error("list story chapter npcs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var n npcView
			var avatar json.RawMessage
			if err := rows.Scan(&n.Slug, &n.NameJa, &n.RoleJa, &n.CompanyJa, &n.DefaultRelation, &avatar); err != nil {
				logger.Error("scan story chapter npc", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			var media struct {
				AvatarInitial string `json:"avatarInitial"`
				AvatarTint    string `json:"avatarTint"`
				BioVi         string `json:"bioVi"`
			}
			_ = json.Unmarshal(avatar, &media)
			n.AvatarInitial, n.AvatarTint, n.BioVi = media.AvatarInitial, media.AvatarTint, media.BioVi
			if n.AvatarInitial == "" {
				if first, size := utf8.DecodeRuneInString(n.NameJa); size > 0 {
					n.AvatarInitial = string(first)
				}
			}
			npcs = append(npcs, n)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate story chapter npcs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		briefing := parseStoryBriefing(briefingRaw)
		if len(rewardsRaw) == 0 || string(rewardsRaw) == "null" {
			rewardsRaw = json.RawMessage(`{}`)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"chapter": map[string]any{
				"id": chapterID, "arcSlug": arcSlug, "slug": slug, "displayOrder": displayOrder,
				"titleJa": titleJa, "titleVi": titleVi,
				"briefingJa": briefing.BriefingJa, "briefingVi": briefing.BriefingVi, "yourRoleVi": briefing.YourRoleVi,
				"isBoss": isBoss, "scenarios": rawScenarios.Scenarios, "estimatedMinutes": briefing.EstimatedMinutes,
			},
			"npcs":           npcs,
			"rewardsPayload": rewardsRaw,
		})
	}
}
