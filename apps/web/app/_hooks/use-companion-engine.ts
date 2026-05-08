"use client";

import type {
  CompanionContext,
  CompanionEventKind,
  CompanionHintResponse,
  CompanionMessage,
  CompanionMessageType,
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import type { CompanionMood } from "../_components/companion-speech-bubble";
import { useCompanionMemory } from "./use-companion-memory";

/* ── Constants ── */

const PROACTIVE_INTERVAL = 300_000; // 5 min between proactive messages
const CELEBRATION_COOLDOWN = 60_000; // 1 min between celebrations
const CONTEXT_TIPS_INTERVAL = 45_000; // 45s between context-aware tips
const SLEEP_TIMEOUT = 120_000; // 2 min idle → sleep

/* ── Time of day ── */

function getTimeOfDay(): CompanionContext["timeOfDay"] {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/* ── Page category from pathname ── */

function pageCategory(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  // Skip locale segment
  const relevant = segments.length > 1 ? segments.slice(1) : segments;
  return relevant[0] ?? "home";
}

/* ── Japanese mini-tips (hardcoded for now, will be API-driven) ── */

const JAPANESE_TIPS: Array<{ ja: string; vi: string; category: string }> = [
  { ja: "「お疲れ様です」は同僚に使い、「ご苦労様です」は目上から目下に使います。", vi: "\"Otsukaresama desu\" dùng với đồng nghiệp, \"Gokurosama desu\" dùng từ trên xuống dưới.", category: "keigo" },
  { ja: "ビジネスメールでは「お世話になっております」から始めましょう。", vi: "Email công việc nên bắt đầu bằng \"Osewa ni natte orimasu\".", category: "business" },
  { ja: "「〜ていただけますか」は「〜てください」より丁寧です。", vi: "\"~te itadakemasu ka\" lịch sự hơn \"~te kudasai\".", category: "grammar" },
  { ja: "「承知しました」は「わかりました」のビジネス版です。", vi: "\"Shouchi shimashita\" là phiên bản công việc của \"Wakarimashita\".", category: "keigo" },
  { ja: "名刺交換は両手で、相手の方を向いて渡しましょう。", vi: "Trao danh thiếp bằng hai tay, hướng mặt về phía đối phương.", category: "culture" },
  { ja: "「検討させていただきます」は断りの意味で使われることが多いです。", vi: "\"Kentou sasete itadakimasu\" thường mang ý từ chối lịch sự.", category: "business" },
  { ja: "敬語の3種類：尊敬語、謙譲語、丁寧語を使い分けましょう。", vi: "3 loại kính ngữ: Sonkeigo (tôn kính), Kenjougo (khiêm nhường), Teineigo (lịch sự).", category: "grammar" },
  { ja: "「申し訳ございません」は最もフォーマルな謝罪表現です。", vi: "\"Moushiwake gozaimasen\" là cách xin lỗi trang trọng nhất.", category: "keigo" },
  { ja: "BJTでは聞き取り問題が全体の約40%を占めます。", vi: "Trong BJT, phần nghe chiếm khoảng 40% tổng số câu hỏi.", category: "bjt" },
  { ja: "「よろしくお願いいたします」は文末の締めに必須です。", vi: "\"Yoroshiku onegai itashimasu\" là câu kết bắt buộc ở cuối email/văn bản.", category: "business" },
  { ja: "「させていただく」の乱用に注意。必要な場面でだけ使いましょう。", vi: "Cẩn thận lạm dụng \"sasete itadaku\". Chỉ dùng khi thực sự cần.", category: "grammar" },
  { ja: "会議で「なるほど」を連発すると失礼になることがあります。", vi: "Nói \"Naruhodo\" liên tục trong cuộc họp có thể bị coi là thiếu lịch sự.", category: "culture" },
];

/* ── Context-aware greetings ── */

type ContextGreeting = { ja: string; vi: string; mood: CompanionMood };

function getContextGreeting(ctx: CompanionContext): ContextGreeting {
  if (ctx.isFirstVisit) {
    return { ja: "はじめまして！シバです 🐕 一緒に日本語を学ぼう！", vi: "Chào bạn! Mình là Shiba 🐕 Cùng học tiếng Nhật nhé!", mood: "wave" };
  }
  if (ctx.daysSinceLastVisit && ctx.daysSinceLastVisit >= 3) {
    return { ja: "お帰りなさい！また一緒に頑張ろう！", vi: "Chào mừng bạn quay lại! Cùng cố gắng tiếp nhé!", mood: "cheer" };
  }
  if (ctx.streakDays && ctx.streakDays >= 7) {
    return { ja: `${ctx.streakDays}日連続！すごいね！`, vi: `${ctx.streakDays} ngày liên tiếp! Giỏi quá!`, mood: "happy" };
  }
  switch (ctx.timeOfDay) {
    case "morning": return { ja: "おはよう！今日も一緒に学ぼう！", vi: "Chào buổi sáng! Hôm nay cùng học nhé!", mood: "wave" };
    case "afternoon": return { ja: "こんにちは！午後も頑張ろう！", vi: "Chào buổi chiều! Cùng cố gắng tiếp nhé!", mood: "idle" };
    case "evening": return { ja: "こんばんは！夜の学習タイムだね", vi: "Chào buổi tối! Giờ học buổi tối đây!", mood: "idle" };
    case "night": return { ja: "遅い時間だね。無理しないでね", vi: "Muộn rồi đó. Đừng cố quá nhé", mood: "idle" };
  }
}

/* ── Page-specific messages ── */

function getPageMessage(page: string): { ja: string; vi: string } | null {
  switch (page) {
    case "flashcards": return { ja: "カード復習ページだね。コツコツが大事！", vi: "Trang ôn thẻ đây. Kiên trì là chìa khóa!" };
    case "quiz": return { ja: "BJT練習！集中して頑張って！", vi: "Luyện BJT! Tập trung nhé!" };
    case "battle": return { ja: "バトルモード！全力で行こう！", vi: "Chế độ đấu! Hết mình nào!" };
    case "analytics": return { ja: "進捗を確認しよう。成長してるよ！", vi: "Xem tiến độ nào. Bạn đang tiến bộ đó!" };
    case "search": case "dictionary": return { ja: "何か調べたいことがある？", vi: "Bạn muốn tìm kiếm gì?" };
    case "settings": return { ja: "設定を調整するんだね", vi: "Chỉnh cài đặt nhé" };
    default: return null;
  }
}

/* ── Celebration messages ── */

function numberParam(params: Record<string, string | number> | undefined, key: string): number | null {
  const value = params?.[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getCelebrationMessage(event: CompanionEventKind, params?: Record<string, string | number>): { ja: string; vi: string; emoji: string } | null {
  const score = numberParam(params, "score");

  switch (event) {
    case "streak_milestone":
      return { ja: `${params?.days ?? ""}日連続達成！素晴らしい！🎉`, vi: `Đạt ${params?.days ?? ""} ngày liên tiếp! Tuyệt vời! 🎉`, emoji: "🎉" };
    case "review_completed":
      return { ja: "復習完了！お疲れ様！✨", vi: "Ôn tập xong! Giỏi lắm! ✨", emoji: "✨" };
    case "quiz_completed":
      return { ja: `スコア${params?.score ?? ""}%！${(score ?? 0) >= 80 ? "すごい！" : "次はもっと上を目指そう！"}`, vi: `Điểm ${params?.score ?? ""}%! ${(score ?? 0) >= 80 ? "Giỏi lắm!" : "Lần sau cố lên nhé!"}`, emoji: (score ?? 0) >= 80 ? "🌟" : "💪" };
    case "battle_won":
      return { ja: "勝利！強いね！🏆", vi: "Thắng rồi! Giỏi quá! 🏆", emoji: "🏆" };
    case "battle_lost":
      return { ja: "惜しかった！次は勝てるよ！", vi: "Tiếc quá! Lần sau sẽ thắng!", emoji: "💪" };
    case "comeback":
      return { ja: "お帰り！また一緒に学ぼう！", vi: "Chào mừng quay lại! Cùng học tiếp nhé!", emoji: "🤗" };
    case "achievement_unlocked":
      return { ja: "実績解除！おめでとう！🏅", vi: "Mở khóa thành tựu! Chúc mừng! 🏅", emoji: "🏅" };
    case "daily_goal_met":
      return { ja: "今日の目標達成！えらい！🌸", vi: "Hoàn thành mục tiêu hôm nay! Giỏi lắm! 🌸", emoji: "🌸" };
    default: return null;
  }
}

/* ── Study nudge messages ── */

function getStudyNudge(ctx: CompanionContext): { ja: string; vi: string } | null {
  if (ctx.dueCount && ctx.dueCount > 0) {
    if (ctx.dueCount >= 20) {
      return { ja: `${ctx.dueCount}枚のカードが待ってるよ。5分だけでもいい！`, vi: `Có ${ctx.dueCount} thẻ đang chờ. 5 phút thôi cũng được!` };
    }
    return { ja: `${ctx.dueCount}枚の復習カードがあるよ`, vi: `Có ${ctx.dueCount} thẻ cần ôn` };
  }
  if (ctx.timeOfDay === "morning") {
    return { ja: "朝の5分学習が一番効果的だよ", vi: "5 phút buổi sáng hiệu quả nhất đó" };
  }
  return null;
}

/* ── Message factory ── */

let _msgIdCounter = 0;
function createMessage(
  type: CompanionMessageType,
  ja: string,
  vi: string,
  opts?: { emoji?: string; action?: CompanionMessage["action"]; en?: string; sender?: CompanionMessage["sender"] }
): CompanionMessage {
  return {
    id: `comp_${Date.now()}_${++_msgIdCounter}`,
    type,
    sender: opts?.sender ?? "bot",
    textJa: ja,
    textVi: vi,
    textEn: opts?.en,
    emoji: opts?.emoji,
    action: opts?.action,
    timestamp: Date.now(),
  };
}

/* ── Quick reply chips ── */

type QuickReply = { id: string; labelJa: string; labelVi: string; icon: string };

const QUICK_REPLIES: QuickReply[] = [
  { id: "keigo", labelJa: "敬語を教えて", labelVi: "Dạy keigo", icon: "🎓" },
  { id: "bjt", labelJa: "BJTのコツ", labelVi: "Mẹo BJT", icon: "📝" },
  { id: "grammar", labelJa: "文法ポイント", labelVi: "Ngữ pháp", icon: "📖" },
  { id: "culture", labelJa: "ビジネスマナー", labelVi: "Văn hóa JP", icon: "🏯" },
  { id: "review", labelJa: "何を復習？", labelVi: "Ôn gì hôm nay?", icon: "🔄" },
  { id: "motivate", labelJa: "やる気出して！", labelVi: "Động viên mình!", icon: "💪" },
];

/* ── Rule-based reply engine ── */

type ReplyRule = { keywords: string[]; reply: { ja: string; vi: string; emoji?: string; action?: CompanionMessage["action"] } };

function getRuleBasedReply(text: string, base: string): ReplyRule["reply"] | null {
  const lower = text.toLowerCase();

  const rules: ReplyRule[] = [
    {
      keywords: ["keigo", "kính ngữ", "敬語", "lịch sự", "丁寧"],
      reply: { ja: "敬語の基本：「です・ます」は丁寧語、「いらっしゃる」は尊敬語、「参る」は謙譲語だよ。ビジネスでは場面に合わせて使い分けることが大切！", vi: "Kính ngữ cơ bản: \"desu/masu\" là lịch sự, \"irassharu\" là tôn kính, \"mairu\" là khiêm nhường. Trong công việc, quan trọng là biết dùng đúng lúc!", emoji: "🎓" }
    },
    {
      keywords: ["bjt", "試験", "テスト", "thi", "exam", "mẹo", "コツ", "tip"],
      reply: { ja: "BJTのコツ：聴解は全体の40%！毎日15分のリスニング練習が効果的。ビジネスシーンの会話に慣れることが大事だよ。", vi: "Mẹo BJT: Nghe chiếm 40%! Luyện nghe 15 phút mỗi ngày rất hiệu quả. Quan trọng là quen với hội thoại công sở.", emoji: "📝" }
    },
    {
      keywords: ["grammar", "ngữ pháp", "文法", "ぶんぽう"],
      reply: { ja: "ビジネス日本語の重要文法：「〜させていただく」「〜いたします」「〜存じます」。これらをマスターすればBJTスコアUP！", vi: "Ngữ pháp quan trọng: \"~sasete itadaku\", \"~itashimasu\", \"~zonjimasu\". Nắm vững những cái này sẽ tăng điểm BJT!", emoji: "📖" }
    },
    {
      keywords: ["culture", "văn hóa", "マナー", "文化", "manner", "business"],
      reply: { ja: "日本のビジネスマナー：会議では上座・下座を意識、名刺は両手で交換、メールは「お世話になっております」から始めよう！", vi: "Văn hóa công sở JP: Chú ý vị trí ngồi họp (kamiza/shimoza), trao danh thiếp bằng 2 tay, email bắt đầu bằng \"Osewa ni natte orimasu\"!", emoji: "🏯" }
    },
    {
      keywords: ["ôn", "review", "復習", "flashcard", "thẻ", "カード"],
      reply: { ja: "復習は間隔をあけて繰り返すのが効果的！今すぐカードを復習しよう 💪", vi: "Ôn tập theo khoảng cách lặp lại hiệu quả nhất! Ôn thẻ ngay nào 💪", emoji: "🔄", action: { label: "📚 Ôn thẻ ngay", href: `${base}/flashcards` } }
    },
    {
      keywords: ["motivat", "động viên", "やる気", "頑張", "cố", "mệt", "疲"],
      reply: { ja: "大丈夫！一歩ずつ進んでいけば必ず上達するよ。毎日の小さな努力が大きな成果になる！シバはいつでも応援してるよ 🐕", vi: "Không sao đâu! Cứ từng bước một, chắc chắn sẽ tiến bộ. Nỗ lực nhỏ mỗi ngày sẽ thành quả lớn! Shiba luôn ủng hộ bạn 🐕", emoji: "💪" }
    },
    {
      keywords: ["hello", "xin chào", "chào", "こんにち", "hi", "hey"],
      reply: { ja: "こんにちは！何か聞きたいことがある？敬語、BJT、文法…なんでも聞いてね！", vi: "Xin chào! Bạn muốn hỏi gì? Keigo, BJT, ngữ pháp... hỏi gì cũng được nhé!", emoji: "👋" }
    },
    {
      keywords: ["battle", "đấu", "バトル", "対戦"],
      reply: { ja: "バトルで力試し！他の学習者と対戦して実力を確認しよう！", vi: "Thử sức bằng battle! Đấu với người học khác để kiểm tra thực lực!", emoji: "⚔️", action: { label: "⚔️ Vào battle", href: `${base}/battle` } }
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.reply;
    }
  }

  return null;
}

const FALLBACK_REPLIES = [
  { ja: "うーん、ちょっとわからないな。下のボタンから質問を選んでみて！", vi: "Hmm, mình chưa hiểu lắm. Thử chọn câu hỏi từ các nút bên dưới nhé!" },
  { ja: "面白い質問だね！でもまだ勉強中…。ボタンから選んでくれる？", vi: "Câu hỏi hay đó! Nhưng mình đang học thêm... Chọn từ các nút nhé?" },
  { ja: "ごめんね、それはまだ答えられないんだ。敬語やBJTについて聞いてみて！", vi: "Xin lỗi, mình chưa trả lời được câu đó. Thử hỏi về keigo hoặc BJT nhé!" },
];

/* ── Engine hook ── */

export type CompanionEngineState = {
  mood: CompanionMood;
  messages: CompanionMessage[];
  bubbleText: { ja: string; vi: string } | null;
  bubbleMood: CompanionMood;
  showCelebration: boolean;
  celebrationEmoji: string;
  isOnboarding: boolean;
  onboardingStep: number;
  context: CompanionContext;
};

export function useCompanionEngine({
  hint,
  isLoggedIn,
  locale,
  base,
}: {
  hint: CompanionHintResponse | null;
  isLoggedIn: boolean;
  locale: string;
  base: string;
}) {
  const pathname = usePathname();
  const companionMemory = useCompanionMemory();
  const { memory, update, markCelebrationShown, isFirstVisit } = companionMemory;

  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [overrideMood, setOverrideMood] = useState<CompanionMood | null>(null);
  const [bubbleText, setBubbleText] = useState<{ ja: string; vi: string } | null>(null);
  const [bubbleMood, setBubbleMood] = useState<CompanionMood>("idle");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationEmoji, setCelebrationEmoji] = useState("");
  const [sleeping, setSleeping] = useState(false);

  const lastInteraction = useRef(Date.now());
  const lastProactive = useRef(0);
  const lastCelebration = useRef(0);
  const lastPage = useRef("");
  const tipIndex = useRef(Math.floor(Math.random() * JAPANESE_TIPS.length));
  const greeted = useRef(false);

  // Build context
  const context = useMemo<CompanionContext>(() => ({
    page: pageCategory(pathname ?? ""),
    timeOfDay: getTimeOfDay(),
    isLoggedIn,
    isFirstVisit,
    daysSinceLastVisit: memory.lastDateKey ? Math.floor((Date.now() - new Date(memory.lastDateKey).getTime()) / 86400000) : undefined,
    streakDays: memory.localStreakDays,
    dueCount: hint?.context?.dueCount,
    locale,
  }), [pathname, isLoggedIn, isFirstVisit, memory.lastDateKey, memory.localStreakDays, hint, locale]);

  // Onboarding state
  const isOnboarding = memory.onboardingStep >= 0 && memory.onboardingStep < 3 && isFirstVisit;
  const onboardingStep = memory.onboardingStep;

  const pushMessage = useCallback((msg: CompanionMessage) => {
    setMessages((prev) => [...prev.slice(-19), msg]); // keep last 20
  }, []);

  // Greeting on first load
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const g = getContextGreeting(context);
    setBubbleText({ ja: g.ja, vi: g.vi });
    setBubbleMood(g.mood);
    pushMessage(createMessage("greeting", g.ja, g.vi, { emoji: "👋" }));
  }, [context, pushMessage]);

  // Page-change reactions
  useEffect(() => {
    const page = pageCategory(pathname ?? "");
    if (page === lastPage.current) return;
    lastPage.current = page;

    const pageMsg = getPageMessage(page);
    if (pageMsg) {
      setBubbleText(pageMsg);
      setBubbleMood("talk");
      pushMessage(createMessage("context_aware", pageMsg.ja, pageMsg.vi));
      // Reset mood after 4s
      const t = setTimeout(() => setBubbleMood("idle"), 4000);
      return () => clearTimeout(t);
    }
  }, [pathname, pushMessage]);

  // Proactive tips & nudges
  useEffect(() => {
    const interval = setInterval(() => {
      if (sleeping) return;
      if (Date.now() - lastProactive.current < PROACTIVE_INTERVAL) return;
      lastProactive.current = Date.now();

      // 60% chance: Japanese tip, 40% chance: study nudge
      if (Math.random() < 0.6) {
        const tip = JAPANESE_TIPS[tipIndex.current % JAPANESE_TIPS.length];
        tipIndex.current++;
        setBubbleText({ ja: tip.ja, vi: tip.vi });
        setBubbleMood("talk");
        pushMessage(createMessage("tip", tip.ja, tip.vi, { emoji: "📚" }));
      } else {
        const nudge = getStudyNudge(context);
        if (nudge) {
          setBubbleText(nudge);
          setBubbleMood("think");
          pushMessage(createMessage("nudge", nudge.ja, nudge.vi, { emoji: "💡" }));
        }
      }
    }, CONTEXT_TIPS_INTERVAL);

    return () => clearInterval(interval);
  }, [sleeping, context, pushMessage]);

  // Sleep detection
  useEffect(() => {
    const check = setInterval(() => {
      if (Date.now() - lastInteraction.current > SLEEP_TIMEOUT) {
        setSleeping(true);
      }
    }, 30000);
    return () => clearInterval(check);
  }, []);

  // Wake up
  const wakeUp = useCallback(() => {
    lastInteraction.current = Date.now();
    setSleeping(false);
  }, []);

  // Push event (called from outside)
  const pushEvent = useCallback((event: CompanionEventKind, params?: Record<string, string | number>) => {
    wakeUp();
    const celebId = `${event}_${new Date().toISOString().slice(0, 10)}`;
    if (memory.celebrationsShown.includes(celebId)) return;
    if (Date.now() - lastCelebration.current < CELEBRATION_COOLDOWN) return;

    const celebration = getCelebrationMessage(event, params);
    if (!celebration) return;

    lastCelebration.current = Date.now();
    markCelebrationShown(celebId);

    // Show celebration
    setCelebrationEmoji(celebration.emoji);
    setShowCelebration(true);
    setOverrideMood("cheer");
    setBubbleText({ ja: celebration.ja, vi: celebration.vi });
    setBubbleMood("cheer");
    pushMessage(createMessage("celebration", celebration.ja, celebration.vi, { emoji: celebration.emoji }));

    // Reset after 4s
    setTimeout(() => {
      setShowCelebration(false);
      setOverrideMood(null);
    }, 4000);
  }, [wakeUp, memory.celebrationsShown, markCelebrationShown, pushMessage]);

  // Advance onboarding
  const advanceOnboarding = useCallback(() => {
    const next = memory.onboardingStep + 1;
    update({ onboardingStep: next >= 3 ? -1 : next });
  }, [memory.onboardingStep, update]);

  const dismissOnboarding = useCallback(() => {
    update({ onboardingStep: -1 });
  }, [update]);

  // Compute effective mood
  const mood = useMemo<CompanionMood>(() => {
    if (sleeping) return "sleep";
    if (overrideMood) return overrideMood;
    if (showCelebration) return "cheer";
    return "idle";
  }, [sleeping, overrideMood, showCelebration]);

  // Add hint as message when loaded
  useEffect(() => {
    if (!hint) return;
    const r = hint.primary.reasons[0];
    if (!r) return;
    // We don't push hint messages here — the chat panel will render them from the hint data
  }, [hint]);

  // Handle user message (rule-based reply)
  const handleUserMessage = useCallback((text: string) => {
    wakeUp();
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;

    // Push user message
    pushMessage(createMessage("context_aware", trimmed, trimmed, { sender: "user" }));

    // Brief "thinking" delay
    setOverrideMood("think");
    setTimeout(() => {
      const reply = getRuleBasedReply(trimmed, base);
      if (reply) {
        pushMessage(createMessage("hint", reply.ja, reply.vi, { emoji: reply.emoji, action: reply.action }));
      } else {
        const fb = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
        pushMessage(createMessage("hint", fb.ja, fb.vi, { emoji: "🤔" }));
      }
      setOverrideMood(null);
    }, 600 + Math.random() * 400);
  }, [wakeUp, pushMessage, base]);

  // Handle quick reply chip
  const handleQuickReply = useCallback((chipId: string) => {
    const chip = QUICK_REPLIES.find((c) => c.id === chipId);
    if (!chip) return;
    handleUserMessage(chip.labelVi);
  }, [handleUserMessage]);

  return {
    mood,
    messages,
    bubbleText,
    bubbleMood,
    showCelebration,
    celebrationEmoji,
    isOnboarding,
    onboardingStep,
    context,
    sleeping,
    memory: companionMemory,
    pushEvent,
    pushMessage,
    advanceOnboarding,
    dismissOnboarding,
    wakeUp,
    createMessage,
    handleUserMessage,
    handleQuickReply,
    quickReplies: QUICK_REPLIES,
  };
}
