"use client";

interface CategoryFilterProps {
  categories: Record<string, string>;
  selected: string | null;
  onSelect: (cat: string | null) => void;
  allLabel: string;
}

export function CategoryFilter({ categories, selected, onSelect, allLabel }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
      <button
        role="tab"
        aria-selected={selected === null}
        className={`min-h-[36px] rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
          selected === null
            ? "bg-accent text-white shadow-md shadow-accent/20 scale-105"
            : "bg-surface text-ink/60 hover:bg-surface-hover active:scale-95 dark:bg-gray-800 dark:text-ink/50"
        }`}
        onClick={() => onSelect(null)}
      >
        {allLabel}
      </button>
      {Object.entries(categories).map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={selected === key}
          className={`min-h-[36px] rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
            selected === key
              ? "bg-accent text-white shadow-md shadow-accent/20 scale-105"
              : "bg-surface text-ink/60 hover:bg-surface-hover active:scale-95 dark:bg-gray-800 dark:text-ink/50"
          }`}
          onClick={() => onSelect(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
