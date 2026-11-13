CREATE TABLE ops.deck_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES learning.deck(id) ON DELETE CASCADE,
    reason VARCHAR(16) NOT NULL CHECK (reason IN ('spam', 'abuse', 'sexual', 'other')),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES authz.admin_actor(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    UNIQUE (reporter_user_id, deck_id, reason)
);

CREATE INDEX idx_deck_report_review_queue ON ops.deck_report(status, created_at);

CREATE TABLE ops.deck_author_block (
    blocker_user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    CHECK (blocker_user_id <> blocked_user_id)
);
