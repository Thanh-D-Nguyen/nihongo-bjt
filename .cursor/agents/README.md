# Cursor agents — index

Playbook rút gọn trong `.cursor/agents/**`. Bản đầy đủ (XML dài, workflow) vẫn ở `.github/agents/*.agent.md` — **không sửa** từ repo này.

## Không load toàn bộ agent

- **Đừng** @ hàng loạt file agent hoặc paste toàn bộ README + mọi playbook vào một prompt.
- Mỗi task: **1 playbook chính** + tối đa **1–2 playbook phụ** (vd QA đi kèm mọi slice).

## Chọn agent theo task (tóm tắt)

| Nhu cầu | Playbook |
|---------|----------|
| API Nest/Prisma/OpenAPI | `core/backend.md` |
| Màn admin | `core/admin-ui.md` |
| Màn learner | `core/learner-ui.md` |
| Verify / CI / test | `core/qa.md` |
| Auth, upload, SSRF, privacy | `core/security.md` |
| Handoff, backlog doc | `core/docs.md` |
| Import JSON → DB / search | `core/data-import.md` |
| Visual learner / screenshot | `core/visual-experience.md` |
| Battle/bot/PvP UX | `core/battle-experience.md` |
| Đề thi, scoring, psychometrics | `specialists/assessment-psychometrics.md` |
| CTA, áp lực, habit | `specialists/behavioral-psychology.md` |
| Cognitive load, remediation | `specialists/learning-science.md` |
| Chất lượng tiếng Nhật nội dung | `specialists/content-quality.md` |
| Copy JA/VI, i18n tone | `specialists/localization-japan-vietnam.md` |
| Audio/motion/postcard kỹ thuật | `specialists/media-experience.md` |
| Share, OG, public page | `specialists/social-experience.md` |
| Life-in-Japan (risk literacy) | `specialists/life-in-japan.md` |
| Playwright / browser evidence | `specialists/browser-qa.md` |
| Template postcard / OG image | `specialists/postcard-visual-designer.md` |
| Điều phối multi-agent | `orchestration/boss.md` |
| Ranh giới module / drift kiến trúc | `orchestration/architect.md` |
| Backlog / MVP cutline | `orchestration/pm.md` |
| Human proxy / unattended | `orchestration/human-proxy.md` |
| Ship–no-ship evidence | `orchestration/release-director.md` |
| Abuse / bypass review | `orchestration/red-team.md` |
| CI/Docker/health | `orchestration/devops.md` |
| Support / help / User360 | `orchestration/customer-success.md` |
| Referral/growth ethics | `orchestration/growth-social.md` |

## Command → agent (gợi ý)

| Command | Agent chính | Thêm khi cần |
|---------|-------------|--------------|
| `review.md` | `core/qa.md` | `core/security.md`, `specialists/browser-qa.md` |
| `fix.md` | theo `apps/*` → backend / admin-ui / learner-ui + `core/qa.md` | `core/security.md` |
| `test.md` | `core/qa.md` | — |
| `swagger.md` | `core/backend.md`, `core/docs.md` | `core/security.md` |
| `polish-ui.md` | `core/visual-experience.md` + admin-ui hoặc learner-ui | `specialists/localization-japan-vietnam.md` |
| `comment-business-logic.md` | `core/backend.md` hoặc assessment / learning-science / battle | — |
| `feature-backend.md` | backend + qa | security |
| `feature-admin-ui.md` | admin-ui + qa | visual-experience |
| `feature-learner-ui.md` | learner-ui + qa | learning-science, behavioral-psychology, visual-experience |
| `feature-battle.md` | battle-experience + qa | social-experience |
| `import-data.md` | data-import + qa | — |
| `release-check.md` | release-director + qa + security | devops |
| `red-team.md` | red-team | security, backend |

Luôn kết hợp **`.cursor/rules/*.mdc`** (baseline) — không nhét agent vào rules.

## Danh sách file theo nhóm

**core/** — `backend`, `admin-ui`, `learner-ui`, `qa`, `security`, `docs`, `data-import`, `visual-experience`, `battle-experience`

**specialists/** — `assessment-psychometrics`, `behavioral-psychology`, `learning-science`, `content-quality`, `localization-japan-vietnam`, `media-experience`, `social-experience`, `life-in-japan`, `browser-qa`, `postcard-visual-designer`

**orchestration/** — `boss`, `architect`, `pm`, `human-proxy`, `release-director`, `red-team`, `devops`, `customer-success`, `growth-social`
