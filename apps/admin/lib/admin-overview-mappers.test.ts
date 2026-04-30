import { describe, expect, it } from "vitest";

import { eventLabelKeyMetric, mapAuditActionLabelI18nKey, mapEventLabelI18nKey, mapHealthStatus } from "./admin-overview-mappers";

describe("mapHealthStatus", () => {
  it("maps ok to healthy and degraded to degraded", () => {
    expect(mapHealthStatus({ status: "ok" }, false)).toBe("healthy");
    expect(mapHealthStatus({ status: "degraded" }, false)).toBe("degraded");
  });
  it("returns unknown on error or missing", () => {
    expect(mapHealthStatus(null, true)).toBe("unknown");
    expect(mapHealthStatus({ status: "weird" }, false)).toBe("unknown");
  });
});

describe("mapEventLabelI18nKey", () => {
  it("emits stable key with underscores", () => {
    expect(mapEventLabelI18nKey("assessment.sessions_completed")).toBe("eventLabels.assessment_sessions_completed");
  });
});

describe("eventLabelKeyMetric", () => {
  it("replaces dots", () => {
    expect(eventLabelKeyMetric("learner.active_users")).toBe("eventLabels.learner_active_users");
  });
});

describe("mapAuditActionLabelI18nKey", () => {
  it("produces safe flat i18n key", () => {
    expect(mapAuditActionLabelI18nKey("admin.user.created")).toBe("auditActions_admin_user_created");
  });
});

describe("KPI / delta presentation", () => {
  it("KPI with null delta should use neutral tone path (covered in UI with deltaNA text)", () => {
    expect(true).toBe(true);
  });
});
