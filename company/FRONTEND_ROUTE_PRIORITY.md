# Frontend Route Priority

## Purpose

This is the learner frontend build order for a world-class NihonGo BJT experience.

The order prioritizes the core immersion loop before secondary surfaces.

## Priority Queue

`required_agents` lists the specialist pool for that route. When executing a single slice, Human Proxy/Boss should still choose the smallest subset that covers the actual risk, plus `bjt-backend` whenever real API/provider support is missing.

```yaml
frontend_route_priority:
  - id: FE-00
    route: app shell / navigation / auth-aware learner frame
    title: Learner Shell and Design System Alignment
    primary_outcome: give learners a stable, calm product environment
    required_agents:
      - bjt-learner-ui
      - bjt-learning-science
      - bjt-qa
    gates:
      - open_design_bjt_ui_gate
      - bjt_ui_ux_production_gate
      - learner_page_production_gate

  - id: FE-01
    route: apps/web/app/[locale]/dashboard
    title: Today Focus Dashboard
    primary_outcome: show exactly what to study next from real data
    required_agents:
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learning_quality_gate
      - learner_page_production_gate

  - id: FE-02
    route: apps/web/app/[locale]/bjt or quiz/templates
    title: BJT Practice Entry
    primary_outcome: choose level, section, and practice/exam mode correctly
    required_agents:
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - bjt_ui_ux_production_gate

  - id: FE-03
    route: apps/web/app/[locale]/quiz/[sessionId]
    title: Practice and Mock Exam Console
    primary_outcome: answer BJT questions with focus and exam integrity
    required_agents:
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-media-experience
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - learner_page_production_gate

  - id: FE-04
    route: apps/web/app/[locale]/quiz/[sessionId]/results
    title: Results and Coaching
    primary_outcome: convert performance into remediation and next study action
    required_agents:
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - assessment_quality_gate
      - learning_quality_gate

  - id: FE-05
    route: reading assist reusable layer
    title: Japanese Reading Assist Product Layer
    primary_outcome: reduce Japanese friction without violating exam integrity
    required_agents:
      - bjt-learning-science
      - bjt-localization-japan-vietnam
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learner_page_production_gate
      - bjt_ui_ux_production_gate

  - id: FE-06
    route: apps/web/app/[locale]/flashcards
    title: Flashcards and Remediation Loop
    primary_outcome: turn weak skills and missed questions into review
    required_agents:
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learning_quality_gate

  - id: FE-07
    route: apps/web/app/[locale]/battle
    title: Bot Battle and Social Retrieval Loop
    primary_outcome: opt-in retrieval practice with bot presence, fairness, and low-pressure motivation
    required_agents:
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
      - learner_page_production_gate

  - id: FE-08
    route: share preview / public share / postcard template selection
    title: SNS Share and Postcard Preview Layer
    primary_outcome: let learners create beautiful privacy-safe postcards from real achievements, BJT results, daily phrases, and battle outcomes
    required_agents:
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
      - learner_page_production_gate

  - id: FE-09
    route: dictionary / grammar / kanji / search
    title: Reference and Lookup Integration
    primary_outcome: support study without becoming a thin dictionary clone
    required_agents:
      - bjt-content-quality
      - bjt-localization-japan-vietnam
      - bjt-learner-ui
      - bjt-qa
    gates:
      - learner_page_production_gate

  - id: FE-10
    route: profile / settings / privacy / reading settings
    title: Learner Control and Trust
    primary_outcome: let learners control locale, privacy, reading support, and focus preferences
    required_agents:
      - bjt-security
      - bjt-learning-science
      - bjt-learner-ui
      - bjt-qa
    gates:
      - privacy_review
      - learner_page_production_gate
```

## Selection Rule

Pick the first route whose production evidence is incomplete unless the human names a specific route.

If the selected route depends on missing backend/API behavior, route the backend gap first and keep the frontend contract open.
