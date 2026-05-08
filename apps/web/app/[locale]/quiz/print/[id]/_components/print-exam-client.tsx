"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface PrintableOption {
  key: string;
  text: string;
}

interface PrintableQuestion {
  correctKey: string | null;
  number: number;
  options: PrintableOption[];
  prompt: string;
  scenario: string | null;
}

interface PrintableSection {
  code: string;
  displayOrder: number;
  questions: PrintableQuestion[];
  titleJa: string | null;
  titleVi: string | null;
}

interface PrintableExam {
  answerKey: Array<{ correctKey: string | null; number: number }>;
  id: string;
  level: string | null;
  sections: PrintableSection[];
  slug: string;
  timeLimitSeconds: number | null;
  titleJa: string | null;
  titleVi: string;
  totalQuestions: number;
  type: string;
}

/* ------------------------------------------------------------------ */
/* BJT Part / Section Metadata                                        */
/* ------------------------------------------------------------------ */

interface PartMeta {
  instructionJa: string;
  instructionVi: string;
  sections: string[];
  timeMinutes: number;
  titleJa: string;
  titleVi: string;
}

const BJT_PARTS: PartMeta[] = [
  {
    titleVi: "Phần I — Nghe hiểu",
    titleJa: "第1部 聴解",
    timeMinutes: 45,
    instructionVi:
      "Nghe hội thoại / tình huống và chọn phương án đúng nhất. Mỗi câu có 4 lựa chọn (A, B, C, D).",
    instructionJa:
      "音声を聴いて、最も適切な答えを1つ選んでください。各問題には4つの選択肢があります。",
    sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"]
  },
  {
    titleVi: "Phần II — Nghe và đọc hiểu",
    titleJa: "第2部 聴読解",
    timeMinutes: 30,
    instructionVi:
      "Nghe hội thoại kết hợp đọc tài liệu / biểu đồ và chọn phương án đúng nhất.",
    instructionJa:
      "音声を聴きながら資料を見て、最も適切な答えを1つ選んでください。",
    sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"]
  },
  {
    titleVi: "Phần III — Đọc hiểu",
    titleJa: "第3部 読解",
    timeMinutes: 30,
    instructionVi:
      "Đọc văn bản / tài liệu và chọn phương án đúng nhất. Mỗi câu có 4 lựa chọn (A, B, C, D).",
    instructionJa:
      "文章や資料を読んで、最も適切な答えを1つ選んでください。各問題には4つの選択肢があります。",
    sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"]
  }
];

const SECTION_LABELS: Record<string, { ja: string; vi: string }> = {
  LC_SCENE: { vi: "Nhận biết tình huống", ja: "場面把握問題" },
  LC_STATEMENT: { vi: "Nghe hiểu phát ngôn", ja: "発言聴解問題" },
  LC_INTEGRATED: { vi: "Tổng hợp nghe hiểu", ja: "総合聴解問題" },
  LR_SITUATION: { vi: "Nhận biết tình huống", ja: "状況把握問題" },
  LR_DOCUMENT: { vi: "Tài liệu nghe-đọc", ja: "資料聴読解問題" },
  LR_INTEGRATED: { vi: "Tổng hợp nghe-đọc", ja: "総合聴読解問題" },
  RC_VOCAB_GRAMMAR: { vi: "Từ vựng & Ngữ pháp", ja: "語彙・文法問題" },
  RC_EXPRESSION: { vi: "Đọc hiểu biểu đạt", ja: "表現読解問題" },
  RC_INTEGRATED: { vi: "Tổng hợp đọc hiểu", ja: "総合読解問題" }
};

const LEVEL_SCORE_TABLE = [
  { level: "J1+", range: "600–800", description: "Năng lực giao tiếp kinh doanh xuất sắc" },
  { level: "J1", range: "530–599", description: "Năng lực giao tiếp kinh doanh tốt" },
  { level: "J2", range: "420–529", description: "Năng lực giao tiếp kinh doanh khá" },
  { level: "J3", range: "320–419", description: "Năng lực giao tiếp kinh doanh trung bình" },
  { level: "J4", range: "200–319", description: "Năng lực giao tiếp kinh doanh cơ bản" },
  { level: "J5", range: "0–199", description: "Năng lực giao tiếp kinh doanh hạn chế" }
];

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function PrintExamClient({
  examId,
  locale
}: {
  examId: string;
  locale: string;
}) {
  const [exam, setExam] = useState<PrintableExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const isJa = locale === "ja";

  useEffect(() => {
    async function loadExam() {
      try {
        const apiBase = (
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
        ).replace(/\/$/u, "");
        const res = await fetch(
          `${apiBase}/api/quiz/templates/${examId}/printable`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        setExam((await res.json()) as PrintableExam);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load exam");
      } finally {
        setLoading(false);
      }
    }
    void loadExam();
  }, [examId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">
          {isJa ? "読み込み中..." : "Đang tải đề thi..."}
        </p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-600">
          {isJa
            ? "問題を読み込めませんでした"
            : "Không thể tải đề thi. Vui lòng thử lại."}
        </p>
      </div>
    );
  }

  const totalMinutes = exam.timeLimitSeconds
    ? Math.round(exam.timeLimitSeconds / 60)
    : 105;

  // Group sections into BJT parts
  const groupedParts = BJT_PARTS.map((part) => ({
    ...part,
    sections: exam.sections.filter((s) => part.sections.includes(s.code))
  })).filter((p) => p.sections.length > 0);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          ← {isJa ? "戻る" : "Quay lại"}
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showAnswerKey}
              onChange={(e) => setShowAnswerKey(e.target.checked)}
              className="rounded"
            />
            {isJa ? "解答を表示" : "Hiện đáp án"}
          </label>
          <button
            onClick={handlePrint}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            🖨️ {isJa ? "印刷する" : "In đề thi"}
          </button>
        </div>
      </div>

      {/* Printable exam content */}
      <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0">
        {/* Cover Page */}
        <div className="print:page-break-after-always px-8 py-12 text-center">
          <div className="border-2 border-gray-800 rounded-lg p-12 mx-auto max-w-lg">
            <p className="text-sm tracking-widest text-gray-500 uppercase mb-4">
              NihonGo BJT Practice Test
            </p>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              BJTビジネス日本語能力テスト
            </h1>
            <h2 className="text-xl text-gray-700 mb-1">
              {isJa ? "練習問題" : "Đề luyện tập"}
            </h2>
            <p className="text-lg font-semibold text-gray-900 mb-6">
              {exam.titleVi}
              {exam.titleJa && (
                <span className="block text-base text-gray-600 mt-1">
                  {exam.titleJa}
                </span>
              )}
            </p>

            <div className="border-t border-gray-300 pt-6 space-y-2 text-sm text-gray-700">
              {exam.level && (
                <p>
                  <span className="font-medium">
                    {isJa ? "レベル" : "Trình độ"}:
                  </span>{" "}
                  {exam.level}
                </p>
              )}
              <p>
                <span className="font-medium">
                  {isJa ? "問題数" : "Tổng số câu"}:
                </span>{" "}
                {exam.totalQuestions}{" "}
                {isJa ? "問" : "câu"}
              </p>
              <p>
                <span className="font-medium">
                  {isJa ? "制限時間" : "Thời gian"}:
                </span>{" "}
                {totalMinutes}{" "}
                {isJa ? "分" : "phút"}
              </p>
              <p>
                <span className="font-medium">
                  {isJa ? "構成" : "Cấu trúc"}:
                </span>{" "}
                {exam.sections.length}{" "}
                {isJa ? "セクション" : "phần"}
              </p>
            </div>
          </div>

          {/* Exam structure overview */}
          <div className="mt-8 text-left max-w-lg mx-auto">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
              {isJa ? "試験構成" : "Cấu trúc đề thi"}
            </h3>
            <table className="w-full text-sm border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    {isJa ? "部門" : "Phần"}
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    {isJa ? "セクション" : "Mục"}
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-center">
                    {isJa ? "問数" : "Số câu"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedParts.map((part) =>
                  part.sections.map((section, si) => (
                    <tr key={section.code}>
                      {si === 0 && (
                        <td
                          className="border border-gray-300 px-3 py-2 font-medium bg-gray-50"
                          rowSpan={part.sections.length}
                        >
                          {isJa ? part.titleJa : part.titleVi}
                          <br />
                          <span className="text-xs text-gray-500">
                            ~{part.timeMinutes}{isJa ? "分" : " phút"}
                          </span>
                        </td>
                      )}
                      <td className="border border-gray-300 px-3 py-2">
                        {isJa
                          ? SECTION_LABELS[section.code]?.ja
                          : SECTION_LABELS[section.code]?.vi}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        {section.questions.length}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-gray-100 font-medium">
                  <td className="border border-gray-300 px-3 py-2" colSpan={2}>
                    {isJa ? "合計" : "Tổng cộng"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    {exam.totalQuestions}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Instructions */}
          <div className="mt-6 text-left max-w-lg mx-auto text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-800">
              {isJa ? "注意事項" : "Lưu ý"}:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                {isJa
                  ? "各問題には4つの選択肢があり、最も適切なものを1つ選んでください。"
                  : "Mỗi câu có 4 lựa chọn (A, B, C, D). Hãy chọn 1 đáp án đúng nhất."}
              </li>
              <li>
                {isJa
                  ? "この練習問題はNihonGo BJTの独自教材です。公式試験とは形式が異なる場合があります。"
                  : "Đây là đề luyện tập của NihonGo BJT, không phải đề thi chính thức."}
              </li>
              <li>
                {isJa
                  ? "聴解部門の問題は、印刷版では音声なしの会話文として表示されます。"
                  : "Phần nghe hiểu được hiển thị dưới dạng văn bản (không có audio khi in)."}
              </li>
            </ul>
          </div>
        </div>

        {/* Exam Sections */}
        {groupedParts.map((part, partIndex) => (
          <div key={partIndex}>
            {/* Part header */}
            <div className="print:page-break-before-always px-8 pt-8 pb-4 border-b-2 border-gray-800">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {isJa ? part.titleJa : part.titleVi}
                </h2>
                <span className="text-sm text-gray-500">
                  ~{part.timeMinutes} {isJa ? "分" : "phút"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isJa ? part.instructionJa : part.instructionVi}
              </p>
            </div>

            {/* Sections within part */}
            {part.sections.map((section) => (
              <div key={section.code} className="px-8 py-6">
                {/* Section header */}
                <div className="mb-4 pb-2 border-b border-gray-300">
                  <h3 className="text-base font-semibold text-gray-800">
                    {isJa
                      ? SECTION_LABELS[section.code]?.ja
                      : SECTION_LABELS[section.code]?.vi}
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({section.questions.length}{" "}
                      {isJa ? "問" : "câu"})
                    </span>
                  </h3>
                </div>

                {/* Questions */}
                {section.questions.map((q) => (
                  <div
                    key={q.number}
                    className="mb-6 print:break-inside-avoid"
                  >
                    {/* Question number and prompt */}
                    <div className="flex gap-3 mb-2">
                      <span className="flex-shrink-0 w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {q.number}
                      </span>
                      <div className="flex-1">
                        {q.scenario && (
                          <p className="text-sm text-gray-500 italic mb-1">
                            {q.scenario}
                          </p>
                        )}
                        <p className="text-base text-gray-900 leading-relaxed">
                          {q.prompt}
                        </p>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="ml-11 grid grid-cols-1 gap-1.5 mt-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`flex items-start gap-2 text-sm py-1 px-2 rounded ${
                            showAnswerKey && q.correctKey === opt.key
                              ? "bg-green-50 border border-green-300"
                              : ""
                          }`}
                        >
                          <span className="flex-shrink-0 w-6 h-6 border border-gray-400 rounded-full flex items-center justify-center text-xs font-medium text-gray-700">
                            {opt.key}
                          </span>
                          <span className="text-gray-800 leading-relaxed">
                            {opt.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Answer Sheet (for self-check) */}
        <div className="print:page-break-before-always px-8 py-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-800 pb-2">
            {isJa ? "解答用紙" : "Phiếu trả lời"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isJa
              ? "自己採点用に正解を丸で囲んでください。"
              : "Khoanh tròn đáp án bạn chọn để tự chấm điểm."}
          </p>

          <div className="grid grid-cols-5 gap-4 text-sm">
            {exam.answerKey.map((item) => (
              <div
                key={item.number}
                className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5"
              >
                <span className="font-bold text-gray-700 w-6 text-right">
                  {item.number}.
                </span>
                <div className="flex gap-1.5">
                  {["A", "B", "C", "D"].map((key) => (
                    <span
                      key={key}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                        showAnswerKey && item.correctKey === key
                          ? "bg-green-600 text-white border-green-600 font-bold"
                          : "border-gray-400 text-gray-600"
                      }`}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score interpretation table */}
        <div className="print:page-break-before-always px-8 py-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-800 pb-2">
            {isJa ? "スコアとレベルの目安" : "Bảng quy đổi điểm — cấp độ BJT"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {isJa
              ? "BJTは0〜800点の配点で、J5〜J1+の6段階レベルで評価されます。"
              : "BJT chấm theo thang 0–800 điểm, chia thành 6 cấp độ từ J5 đến J1+."}
          </p>

          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">
                  {isJa ? "レベル" : "Cấp độ"}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  {isJa ? "スコア" : "Điểm số"}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  {isJa ? "説明" : "Mô tả"}
                </th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_SCORE_TABLE.map((row) => (
                <tr
                  key={row.level}
                  className={
                    exam.level?.includes(row.level)
                      ? "bg-blue-50 font-medium"
                      : ""
                  }
                >
                  <td className="border border-gray-300 px-4 py-2 font-semibold">
                    {row.level}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {row.range}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {row.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-xs text-gray-400 text-center">
            <p>
              NihonGo BJT — {isJa ? "独自練習教材" : "Đề luyện tập độc lập"}
            </p>
            <p>
              {isJa
                ? "公式のBJTビジネス日本語能力テストとは異なります。"
                : "Không phải đề thi chính thức của BJT. Tham khảo kanken.or.jp/bjt để biết thêm."}
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:page-break-before-always {
            page-break-before: always;
          }
          .print\\:page-break-after-always {
            page-break-after: always;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
          .print\\:max-w-none {
            max-width: none;
          }
          .print\\:mx-0 {
            margin-left: 0;
            margin-right: 0;
          }
          @page {
            margin: 15mm 12mm;
            size: A4;
          }
        }
      `}</style>
    </>
  );
}
