import { useState } from "react";

/** Checkbox-select + sequential bulk-run-with-progress, extracted from the
 * near-identical logic that used to live separately in admin.suggestions.tsx
 * and admin.owner-requests.tsx. Runs `action` once per selected item,
 * sequentially (not Promise.all) so `progress` ticks up predictably and one
 * failure doesn't abort the rest. */
export function useBulkAction<T>(items: T[], getId: (item: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  const selectedItems = items.filter((item) => selected.has(getId(item)));

  async function run(action: (item: T) => Promise<void>): Promise<{ ok: number; fail: number }> {
    const targets = selectedItems;
    if (targets.length === 0) return { ok: 0, fail: 0 };
    setProgress({ done: 0, total: targets.length });
    let ok = 0;
    let fail = 0;
    for (const item of targets) {
      try {
        await action(item);
        ok++;
      } catch {
        fail++;
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setProgress(null);
    clear();
    return { ok, fail };
  }

  return {
    selected,
    toggle,
    clear,
    selectedCount: selected.size,
    selectedItems,
    progress,
    busy: progress !== null,
    run,
  };
}
