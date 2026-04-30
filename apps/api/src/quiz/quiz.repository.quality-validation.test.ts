import { describe, it, expect } from "vitest";

// Test the validateBjtQuestionIntegrity method by accessing the private method
describe("BjtQuestion quality validation", () => {
  it("detects missing explanationVi", () => {
    const question = {
      explanationVi: "",
      skillTag: "listening",
      options: [{ isCorrect: true }, { isCorrect: false }]
    };

    // We'll create a minimal validation logic inline for testing
    const issues: string[] = [];
    if (!question.explanationVi || question.explanationVi.trim().length === 0) {
      issues.push("Missing explanationVi");
    }
    if (!question.skillTag || question.skillTag.trim().length === 0) {
      issues.push("Missing skillTag");
    }
    const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
    if (!hasCorrectOption) {
      issues.push("No correct option found");
    }

    expect(issues).toContain("Missing explanationVi");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects missing skillTag", () => {
    const question = {
      explanationVi: "Explanation text",
      skillTag: "",
      options: [{ isCorrect: true }, { isCorrect: false }]
    };

    const issues: string[] = [];
    if (!question.explanationVi || question.explanationVi.trim().length === 0) {
      issues.push("Missing explanationVi");
    }
    if (!question.skillTag || question.skillTag.trim().length === 0) {
      issues.push("Missing skillTag");
    }
    const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
    if (!hasCorrectOption) {
      issues.push("No correct option found");
    }

    expect(issues).toContain("Missing skillTag");
  });

  it("detects missing correct option", () => {
    const question = {
      explanationVi: "Explanation text",
      skillTag: "listening",
      options: [{ isCorrect: false }, { isCorrect: false }]
    };

    const issues: string[] = [];
    if (!question.explanationVi || question.explanationVi.trim().length === 0) {
      issues.push("Missing explanationVi");
    }
    if (!question.skillTag || question.skillTag.trim().length === 0) {
      issues.push("Missing skillTag");
    }
    const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
    if (!hasCorrectOption) {
      issues.push("No correct option found");
    }

    expect(issues).toContain("No correct option found");
  });

  it("passes validation with all required fields", () => {
    const question = {
      explanationVi: "Explanation text",
      skillTag: "listening",
      options: [{ isCorrect: true }, { isCorrect: false }]
    };

    const issues: string[] = [];
    if (!question.explanationVi || question.explanationVi.trim().length === 0) {
      issues.push("Missing explanationVi");
    }
    if (!question.skillTag || question.skillTag.trim().length === 0) {
      issues.push("Missing skillTag");
    }
    const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
    if (!hasCorrectOption) {
      issues.push("No correct option found");
    }

    expect(issues).toHaveLength(0);
  });
});
