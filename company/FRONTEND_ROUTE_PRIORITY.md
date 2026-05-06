# Frontend Route Priority

## Purpose

This is the learner frontend build order for a world-class NihonGo BJT experience.

The order prioritizes the core immersion loop before secondary surfaces.

Before executing any route, run the selected specialist set through `company/gates/agent-quality-gate.md`. This is especially important for older agents reused by Human Proxy/Boss; patch small structural gaps before relying on the agent output.

## Priority Queue

`required_agents` lists the specialist pool for that route. When executing a single slice, Human Proxy/Boss should still choose the smallest subset that covers the actual risk, plus `bjt-backend` whenever real API/provider support is missing.

```yaml
frontend_route_priority:
  - id: FE-00
    route: app shell / navigation / auth-aware learner frame
    title: Learner Shell and Design System Alignment
    primary_outcome: give learners a stable, calm product environment
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-learner-ui
      - bjt-learning-science
      - bjt-qa
    gates:
      - open_design_bjt_ui_gate
      - bjt_ui_ux_production_gate
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate

  - id: FE-01
    route: apps/web/app/[locale]/dashboard
    title: Today Focus Dashboard
    primary_outcome: show exactly what to study next from real data
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-media-experience
      - bjt-qa
    gates:
      - learning_quality_gate
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate

  - id: FE-02
    route: apps/web/app/[locale]/bjt or quiz/templates
    title: BJT Practice Entry
    primary_outcome: choose level, section, and practice/exam mode correctly
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - bjt_ui_pro_max_craft_gate
      - bjt_ui_ux_production_gate

  - id: FE-03
    route: apps/web/app/[locale]/quiz/[sessionId]
    title: Practice and Mock Exam Console
    primary_outcome: answer BJT questions with focus and exam integrity
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-media-experience
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate

  - id: FE-04
    route: apps/web/app/[locale]/quiz/[sessionId]/results
    title: Results and Coaching
    primary_outcome: convert performance into remediation and next study action
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - learning_quality_gate
      - bjt_ui_pro_max_craft_gate

  - id: FE-05
    route: reading assist reusable layer
    title: Japanese Reading Assist Product Layer
    primary_outcome: reduce Japanese friction without violating exam integrity
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-learning-science
      - bjt-localization-japan-vietnam
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learner_page_production_gate
      - bjt_ui_pro_max_craft_gate
      - bjt_ui_ux_production_gate

  - id: FE-06
    route: apps/web/app/[locale]/flashcards
    title: Flashcards and Remediation Loop
    primary_outcome: turn weak skills and missed questions into review
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learning_quality_gate
      - bjt_ui_pro_max_craft_gate

  - id: FE-07
    route: apps/web/app/[locale]/battle
    title: Bot Battle and Social Retrieval Loop
    primary_outcome: opt-in retrieval practice with bot presence, fairness, and low-pressure motivation
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-battle-experience
      - bjt-social-experience
      - bjt-learning-science
      - bjt-media-experience
      - bjt-growth-social
      - bjt-security
      - bjt-backend
      - bjt-learner-ui
      - bjt-qa
    gates:
      - growth_ethics_gate
      - media_quality_gate
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate

  - id: FE-08
    route: share preview / public share / postcard template selection
    title: SNS Share and Postcard Preview Layer
    primary_outcome: let learners create beautiful privacy-safe postcards from real achievements, BJT results, daily phrases, and battle outcomes
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-social-experience
      - bjt-postcard-visual-designer
      - bjt-media-experience
      - bjt-security
      - bjt-backend
      - bjt-learner-ui
      - bjt-qa
    gates:
      - growth_ethics_gate
      - media_quality_gate
      - visual_review_gate
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate

  - id: FE-09
    route: dictionary / grammar / kanji / search
    title: Reference and Lookup Integration
    primary_outcome: support study without becoming a thin dictionary clone
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-content-quality
      - bjt-localization-japan-vietnam
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learner_page_production_gate
      - bjt_ui_pro_max_craft_gate

  - id: FE-10
    route: profile / settings / privacy / reading settings
    title: Learner Control and Trust
    primary_outcome: let learners control locale, privacy, reading support, and focus preferences
    required_agents:
      - bjt-visual-experience
      - bjt-behavioral-psychology
      - bjt-security
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - privacy_review
      - bjt_ui_pro_max_craft_gate
      - learner_page_production_gate
```

## Selection Rule

Pick the first route whose production evidence is incomplete unless the human names a specific route.

If the selected route depends on missing backend/API behavior, route the backend gap first and keep the frontend contract open.

Every selected route also requires `agent_quality_gate` before specialist consultation.

Every selected learner route also requires `bjt_ui_pro_max_craft_gate` before a world-class or production-ready claim.

If a route has screenshot evidence that looks generic, bland, hard to use, or below world-class quality, do not advance to the next route. Reopen the current route and run `.github/prompts/54_learner_visual_quality_rescue.prompt.md`.

If a route already ran visual rescue and the human still reports unresolved issues such as weak button contrast, missing footer, huge empty canvas, or bland visual identity, invalidate the rescue pass and run `.github/prompts/55_learner_visual_escalation_after_failed_rescue.prompt.md`.

If a route already ran prompt 55 or a Pro Max escalation and the human still rejects CTA/button visibility, invalidate that pass and run `.github/prompts/56_learner_ui_pro_max_rebuild_after_repeated_rejection.prompt.md`.
