/**
 * Lighthouse CI Configuration — runs Performance, A11y, Best Practices, SEO
 * audits against the learner web app.
 *
 * Usage:
 *   npx @lhci/cli autorun --config=lighthouserc.cjs
 *
 * Targets:
 *   Performance ≥ 85 (mobile), A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 95
 */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/vi",
        "http://localhost:3000/vi/flashcards",
        "http://localhost:3000/vi/bjt",
      ],
      numberOfRuns: 3,
      settings: {
        // Mobile emulation (Moto G Power)
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 3,
        },
        throttling: {
          cpuSlowdownMultiplier: 4,
          downloadThroughputKbps: 1638,
          requestLatencyMs: 150,
          rttMs: 150,
          throughputKbps: 1638,
          uploadThroughputKbps: 675,
        },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["warn", { minScore: 0.95 }],
        // A11y-specific assertions
        "color-contrast": "error",
        "document-title": "error",
        "html-has-lang": "error",
        "image-alt": "error",
        "meta-viewport": "error",
        "target-size": "warn",
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./test-results/lighthouse",
    },
  },
};
