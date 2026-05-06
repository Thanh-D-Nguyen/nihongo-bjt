/**
 * Nhóm danh mục ngữ pháp (VN/JP) để tổng hợp biểu đồ / lọc theo nhóm.
 * Cùng mô hình: exact trùng tuyệt đối, includes kiểm tra chuỗi con (không phân biệt hoa thường cho ASCII).
 * Thứ tự: nhóm trước ưu tiên hơn khi khớp nhiều mẫu.
 */
export const GRAMMAR_CATEGORY_GROUP_SPECS = [
    {
        id: "keigo",
        exact: [],
        includes: [
            "keigo",
            "敬語",
            "kính ngữ",
            "hạ ngữ",
            "尊敬",
            "謙譲",
            "尊他"
        ]
    },
    {
        id: "expression",
        exact: [
            "Diễn tả",
            "Cảm thán",
            "Ngạc nhiên",
            "Hối hận",
            "Mô tả"
        ],
        includes: ["表現", "diễn tả", "描写"]
    },
    {
        id: "comparison",
        exact: [
            "So sánh",
            "Tỷ lệ, song song",
            "Tỉ lệ, song song",
            "Tỷ lệ",
            "Tỉ lệ",
            "Tương tụ, mức độ",
            "Tương phản",
            "Tương tụ, mức độ"
        ],
        includes: ["so sánh", "tương tụ", "tương phản", "比較", "mức độ tương tự", "cùng tỉ lệ"]
    },
    {
        id: "time_space_process",
        exact: [
            "Thời điểm",
            "Thời hạn, khoảng thời gian / Thứ tự",
            "Quá trình",
            "Hạn định",
            "Điểm xuất phát, điểm nhận",
            "vị trí, cách thức, nguyên nhân",
            "Thời điểm / quá trình kéo dài tới",
            "Điều hướng, phương hướng, ngưỡng",
            "Chủ điểm thứ tự, xác định, phạm vi"
        ],
        includes: [
            "thời gian",
            "時間",
            "vị trí",
            "quá trình",
            "thứ tự",
            "hạn",
            "場所"
        ]
    },
    {
        id: "quantity_frequency",
        exact: ["Số lượng", "Tần suất", "Mức độ", "Mức độ, phạm vi, phạm vi ước lượng", "Mức độ, phạm vi, phỏng đoán/ước lượng"],
        includes: ["số lượng", "tần suất", "頻度", "mức độ, phạm vi"]
    },
    {
        id: "modality_intent",
        exact: [
            "Bắt buộc",
            "Cần thiết, nghĩa vụ",
            "Mệnh lệnh",
            "Ý định",
            "Phán đoán",
            "Suy đoán",
            "Xác nhận",
            "Quyết định",
            "Mục đích",
            "Mục tiêu, mục đích",
            "Mời rủ, khuyên bảo",
            "Ý chí, quyết tâm",
            "Cảm thán, ra lệnh / kêu gọi"
        ],
        includes: ["bắt buộc", "義務", "suy đoán", "推測", "意志", "mệnh lệnh"]
    },
    {
        id: "form_syntax",
        exact: [
            "Danh từ hóa",
            "Chia động từ",
            "Bổ nghĩa",
            "Danh từ hóa, phạm trù",
            "Hình thức, trạng thái (phạm trù)",
            "Biểu hiện bằng ví dụ"
        ],
        includes: ["名詞", "文型", "接続", "名詞化", "morpho"]
    },
    {
        id: "negation_condition",
        exact: [
            "Phủ định",
            "Điều kiện giả định",
            "Bất biến",
            "Điều không khớp với dự đoán"
        ],
        includes: ["phủ định", "仮定", "条件", "giả định", "bất biến"]
    },
    {
        id: "business_rhetoric",
        exact: ["Chỉ trích", "Cách nói, thái độ, phương thức, phạm trù", "Chủ điểm, phạm trù"],
        includes: ["chỉ trích", "công việc", "business", "hội thoại", "giao tiếp"]
    }
];
/** Thứ tự hiển thị biểu đồ (ổn định, không theo số lượng). */
export const GRAMMAR_CATEGORY_GROUP_CHART_ORDER = [
    "keigo",
    "expression",
    "comparison",
    "time_space_process",
    "quantity_frequency",
    "modality_intent",
    "form_syntax",
    "negation_condition",
    "business_rhetoric",
    "other",
    "uncategorized"
];
export function mapGrammarCategoryToGroupId(raw) {
    if (raw == null) {
        return "uncategorized";
    }
    const t = String(raw).trim();
    if (t === "" || t === "—" || t === "-") {
        return "uncategorized";
    }
    for (const g of GRAMMAR_CATEGORY_GROUP_SPECS) {
        for (const e of g.exact) {
            if (e === t) {
                return g.id;
            }
        }
    }
    const lower = t.toLowerCase();
    for (const g of GRAMMAR_CATEGORY_GROUP_SPECS) {
        for (const inc of g.includes) {
            const p = String(inc);
            if (t.includes(inc) || (!inc.match(/[\u3040-\u9fff]/) && lower.includes(p.toLowerCase()))) {
                return g.id;
            }
        }
    }
    return "other";
}
export function aggregateByCategoryGroup(byCategory) {
    const out = {};
    for (const [k, v] of Object.entries(byCategory)) {
        const n = Number(v);
        if (Number.isNaN(n) || n <= 0) {
            continue;
        }
        const gid = k === "—" ? "uncategorized" : mapGrammarCategoryToGroupId(k);
        out[gid] = (out[gid] ?? 0) + n;
    }
    return out;
}
/**
 * Các mệnh đề OR tương ứng Prisma: filter mục theo cả nhóm.
 * "other" không có tập OR hữu hạn tốt: trả về mảng rỗng (giao diện chỉ nên dùng lọc theo từng `category` con).
 */
export function getGrammarCategoryGroupFilterClauses(groupId) {
    if (groupId === "uncategorized") {
        return [{ kind: "categoryIsNull" }, { kind: "categoryEmpty" }];
    }
    if (groupId === "other") {
        return [];
    }
    const spec = GRAMMAR_CATEGORY_GROUP_SPECS.find((g) => g.id === groupId);
    if (!spec) {
        return [];
    }
    const out = [];
    for (const e of spec.exact) {
        out.push({ kind: "categoryEquals", value: e });
    }
    for (const inc of spec.includes) {
        out.push({ kind: "categoryContains", value: inc, mode: "insensitive" });
    }
    return out;
}
