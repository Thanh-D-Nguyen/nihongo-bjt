export function themeFor(theme?: string | null, category?: string) {
  const key = theme ?? category ?? "life";
  if (key.includes("money")) {
    return {
      accent: "text-amber-700",
      badge: "bg-amber-100 text-amber-900 ring-amber-200",
      card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
      spotlight: "from-[#1f2933] via-[#5b4b2a] to-[#a16207]"
    };
  }
  if (key.includes("ai")) {
    return {
      accent: "text-violet-700",
      badge: "bg-violet-100 text-violet-900 ring-violet-200",
      card: "border-violet-200 bg-gradient-to-br from-white to-violet-50",
      spotlight: "from-[#1f1b35] via-[#4c1d95] to-[#7c3aed]"
    };
  }
  if (key.includes("safety") || key.includes("red")) {
    return {
      accent: "text-red-700",
      badge: "bg-red-100 text-red-900 ring-red-200",
      card: "border-red-200 bg-gradient-to-br from-white to-red-50",
      spotlight: "from-[#331b1b] via-[#7f1d1d] to-[#dc2626]"
    };
  }
  if (key.includes("life") || key.includes("green") || category === "family") {
    return {
      accent: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-900 ring-emerald-200",
      card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
      spotlight: "from-[#17322c] via-[#047857] to-[#14b8a6]"
    };
  }
  return {
    accent: "text-blue-700",
    badge: "bg-blue-100 text-blue-900 ring-blue-200",
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50",
    spotlight: "from-[#172033] via-[#1d4ed8] to-[#2563eb]"
  };
}
