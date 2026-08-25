import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Save,
  Trash2,
  Loader2,
  X,
  Lock,
  Zap,
  Trophy,
  Award,
  Medal,
  Sparkles,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminStatBar,
  type AdminStat,
} from "@/components/admin/AdminPageShell";
import { useIsAdmin, useIsSuperAdmin } from "@/lib/use-auth";
import { usePointsRules, useUpdatePointsRule } from "@/lib/points-rules-api";
import {
  useAchievements,
  useSaveAchievement,
  useDeleteAchievement,
  type Achievement,
} from "@/lib/achievements-api";
import { useRanks, useSaveRank, useDeleteRank, type Rank } from "@/lib/ranks-api";
import {
  useChallenges,
  useSaveChallenge,
  useDeleteChallenge,
  type Challenge,
  type ChallengeCriteriaType,
} from "@/lib/challenges-api";
import { CUISINES } from "@/data/places";
import { RankBadge } from "@/components/RankBadge";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";
import { Field } from "@/components/admin/Field";

export const Route = createFileRoute("/_authenticated/admin/gamifikacja")({
  head: () => ({ meta: [{ title: "Gamifikacja - Panel admina" }] }),
  component: AdminGamifikacja,
});

const TABS = [
  { key: "points", label: "Punkty", icon: <Zap size={13} /> },
  { key: "achievements", label: "Achievementy", icon: <Trophy size={13} /> },
  { key: "challenges", label: "Wyzwania", icon: <Medal size={13} /> },
  { key: "ranks", label: "Rangi", icon: <Award size={13} /> },
] as const;

function AdminGamifikacja() {
  const { data: isAdmin } = useIsAdmin();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("points");

  if (!isAdmin) return <div className="text-center py-20 text-muted-foreground">Tylko admin.</div>;

  return (
    <div>
      <AdminPageHeader
        title="Gamifikacja"
        icon={<Sparkles size={26} />}
        subtitle="Punkty, achievementy i rangi - system nagradzania użytkowników."
      />
      <GamificationStatBar />
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === "points" && <PointsTab />}
      {tab === "achievements" && <AchievementsTab />}
      {tab === "challenges" && <ChallengesTab />}
      {tab === "ranks" && <RanksTab />}
    </div>
  );
}

const POINTS_LABELS: Record<string, string> = {
  review_created: "Za dodanie recenzji",
  review_with_photo: "Bonus za zdjęcie w recenzji",
  first_visit_new_place: "Bonus za pierwszą wizytę w nowym lokalu",
  invite_accepted: "Za zaproszenie znajomego, który dołączył",
  wall_post_created: "Za dodanie wpisu na Pożeralni",
  list_created: "Za utworzenie listy tematycznej",
  challenge_completed: "Za ukończenie wyzwania",
};

/**
 * All four numbers are "how big is the system and how much of it is live" -
 * a disabled achievement or a disabled points rule is invisible to users,
 * and that's easy to forget you left switched off.
 */
function GamificationStatBar() {
  const { data: rules, isLoading } = usePointsRules();
  const { data: achievements } = useAchievements();
  const { data: challenges } = useChallenges();
  const { data: ranks } = useRanks();

  const stats = useMemo<AdminStat[]>(() => {
    const r = rules ?? [];
    const a = achievements ?? [];
    const c = challenges ?? [];
    const offRules = r.filter((x) => !x.enabled).length;
    const offAch = a.filter((x) => !x.enabled).length;
    const offCh = c.filter((x) => !x.enabled).length;
    return [
      {
        label: "Reguły punktów",
        value: r.length,
        delta: offRules ? `${offRules} wyłączonych` : "wszystkie aktywne",
        tone: offRules ? "attention" : "ok",
      },
      {
        label: "Achievementy",
        value: a.length,
        delta: offAch ? `${offAch} wyłączonych` : "wszystkie aktywne",
        tone: offAch ? "attention" : "ok",
      },
      {
        label: "Wyzwania",
        value: c.length,
        delta: offCh ? `${offCh} wyłączonych` : "wszystkie aktywne",
        tone: offCh ? "attention" : "ok",
      },
      { label: "Rangi", value: (ranks ?? []).length, delta: "progi poziomów", tone: "neutral" },
    ];
  }, [rules, achievements, challenges, ranks]);

  return <AdminStatBar stats={stats} loading={isLoading} />;
}

function PointsTab() {
  const { data: rules, isLoading } = usePointsRules();
  const update = useUpdatePointsRule();
  const [drafts, setDrafts] = useState<Record<string, { points: number; enabled: boolean }>>({});

  if (isLoading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );

  async function handleSave(event_key: string, points: number, enabled: boolean) {
    try {
      await update.mutateAsync({ event_key, points, enabled });
      toast.success("Zaktualizowano");
      setDrafts((d) => {
        const next = { ...d };
        delete next[event_key];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-muted-foreground -mt-2 mb-2">
        Ile pkt dostaje użytkownik za każdą akcję. Możesz wyłączyć regułę bez kasowania jej z
        historii.
      </p>
      {(rules ?? []).map((r) => {
        const draft = drafts[r.event_key];
        const points = draft?.points ?? r.points;
        const enabled = draft?.enabled ?? r.enabled;
        const dirty =
          draft !== undefined && (draft.points !== r.points || draft.enabled !== r.enabled);
        return (
          <div key={r.event_key} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="font-semibold">{POINTS_LABELS[r.event_key] ?? r.event_key}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.event_key}</div>
                {r.description && (
                  <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [r.event_key]: { points, enabled: e.target.checked },
                    }))
                  }
                />
                Aktywna
              </label>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="number"
                value={points}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [r.event_key]: { points: parseInt(e.target.value) || 0, enabled },
                  }))
                }
                className="w-28 rounded-lg border-2 border-border px-3 py-2 outline-none focus:border-tomato"
              />
              <span className="text-sm text-muted-foreground">pkt</span>
              <button
                disabled={!dirty || update.isPending}
                onClick={() => handleSave(r.event_key, points, enabled)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-40"
              >
                <Save size={14} /> Zapisz
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CRITERIA_TYPES = [
  { value: "reviews_count", label: "Liczba recenzji" },
  { value: "unique_places", label: "Liczba unikalnych lokali" },
  { value: "points_total", label: "Suma punktów" },
  { value: "friends_count", label: "Liczba znajomych" },
  { value: "referrals_count", label: "Liczba zaproszonych znajomych" },
] as const;

function emptyAchievement(): Omit<Achievement, "id"> {
  return {
    slug: "",
    name: "",
    description: "",
    icon_url: "🏅",
    criteria: { type: "reviews_count", threshold: 1 },
    sort_order: 100,
    enabled: true,
  };
}

function AchievementsTab() {
  const { data: achievements, isLoading } = useAchievements();
  const save = useSaveAchievement();
  const del = useDeleteAchievement();
  const [editing, setEditing] = useState<Achievement | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Achievement | null>(null);

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90"
        >
          <Plus size={16} /> Dodaj
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(achievements ?? []).map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{renderAchievementIcon(a.icon_url)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg leading-tight">{a.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.slug}</div>
                </div>
                {!a.enabled && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    off
                  </span>
                )}
              </div>
              {a.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
              )}
              <div className="text-xs text-muted-foreground">
                Próg:{" "}
                <span className="font-mono">
                  {a.criteria?.type} ≥ {a.criteria?.threshold}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(a)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-tomato hover:text-tomato"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => setConfirmDelete(a)}
                  className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AchievementModal
          achievement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success("Zapisano");
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Błąd");
            }
          }}
          saving={save.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć achievement "${confirmDelete?.name}"?`}
        description="Użytkownicy, którzy już go zdobyli, zachowają wpis w historii - tylko definicja zniknie z listy do zdobycia."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function renderAchievementIcon(icon: string | null) {
  if (!icon) return "🏅";
  if (icon.startsWith("http")) return <img src={icon} alt="" className="w-8 h-8 rounded" />;
  return icon;
}

function AchievementModal({
  achievement,
  onClose,
  onSave,
  saving,
}: {
  achievement: Achievement | null;
  onClose: () => void;
  onSave: (v: Omit<Achievement, "id">) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Omit<Achievement, "id">>(
    achievement
      ? {
          slug: achievement.slug,
          name: achievement.name,
          description: achievement.description,
          icon_url: achievement.icon_url,
          criteria: achievement.criteria,
          sort_order: achievement.sort_order,
          enabled: achievement.enabled,
        }
      : emptyAchievement(),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{achievement ? "Edytuj" : "Nowy achievement"}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center"
          >
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(f);
          }}
          className="space-y-3"
        >
          <Field label="Slug">
            <input
              required
              disabled={!!achievement}
              value={f.slug}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
              className="input"
              placeholder="np. food_critic"
            />
          </Field>
          <Field label="Nazwa">
            <input
              required
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Ikona (emoji lub URL)">
            <input
              value={f.icon_url ?? ""}
              onChange={(e) => setF({ ...f, icon_url: e.target.value })}
              className="input"
              placeholder="🏅 lub https://..."
            />
          </Field>
          <Field label="Opis">
            <textarea
              rows={2}
              value={f.description ?? ""}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Typ progu">
              <select
                value={f.criteria?.type ?? "reviews_count"}
                onChange={(e) =>
                  setF({ ...f, criteria: { ...(f.criteria ?? {}), type: e.target.value } })
                }
                className="input"
              >
                {CRITERIA_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Wartość progu">
              <input
                type="number"
                min={1}
                value={f.criteria?.threshold ?? 1}
                onChange={(e) =>
                  setF({
                    ...f,
                    criteria: { ...(f.criteria ?? {}), threshold: parseInt(e.target.value) || 1 },
                  })
                }
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort">
              <input
                type="number"
                value={f.sort_order}
                onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </Field>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Aktywny
              </span>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => setF({ ...f, enabled: e.target.checked })}
                className="w-5 h-5 mt-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Zapisz
          </button>
        </form>
      </div>
    </div>
  );
}

const CHALLENGE_CRITERIA_TYPES: { value: ChallengeCriteriaType; label: string }[] = [
  { value: "cuisine_reviews", label: "Recenzje danej kuchni" },
  { value: "new_places_reviewed", label: "Nowe lokale ocenione" },
  { value: "unique_cuisines_reviewed", label: "Różne kuchnie ocenione" },
];

function emptyChallenge(): Omit<Challenge, "id"> {
  return {
    slug: "",
    title: "",
    description: "",
    icon: "🏆",
    criteria: { type: "cuisine_reviews", cuisine: CUISINES[0], threshold: 3, window_days: 7 },
    starts_at: null,
    ends_at: null,
    enabled: true,
    sort_order: 100,
  };
}

function ChallengesTab() {
  const { data: challenges, isLoading } = useChallenges();
  const save = useSaveChallenge();
  const del = useDeleteChallenge();
  const [editing, setEditing] = useState<Challenge | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Challenge | null>(null);

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground -mt-2 mb-4">
        Wyzwania czasowe (np. "tydzień kebabu") - sprawdzane automatycznie po każdej nowej recenzji
        użytkownika. Po ukończeniu pojawia się jeden wpis na Pożeralni.
      </p>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90"
        >
          <Plus size={16} /> Dodaj wyzwanie
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(challenges ?? []).map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{c.icon || "🏆"}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg leading-tight">{c.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.slug}</div>
                </div>
                {!c.enabled && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    off
                  </span>
                )}
              </div>
              {c.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
              )}
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">
                  {c.criteria?.type}
                  {c.criteria?.cuisine ? ` (${c.criteria.cuisine})` : ""} ≥ {c.criteria?.threshold}
                </span>{" "}
                / {c.criteria?.window_days} dni
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(c)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-tomato hover:text-tomato"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => setConfirmDelete(c)}
                  className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ChallengeModal
          challenge={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success("Zapisano");
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Błąd");
            }
          }}
          saving={save.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć wyzwanie "${confirmDelete?.title}"?`}
        description="Użytkownicy, którzy je już ukończyli, zachowają wpis w historii - tylko definicja zniknie z listy aktywnych."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function ChallengeModal({
  challenge,
  onClose,
  onSave,
  saving,
}: {
  challenge: Challenge | null;
  onClose: () => void;
  onSave: (v: Omit<Challenge, "id">) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Omit<Challenge, "id">>(
    challenge
      ? {
          slug: challenge.slug,
          title: challenge.title,
          description: challenge.description,
          icon: challenge.icon,
          criteria: challenge.criteria,
          starts_at: challenge.starts_at,
          ends_at: challenge.ends_at,
          enabled: challenge.enabled,
          sort_order: challenge.sort_order,
        }
      : emptyChallenge(),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{challenge ? "Edytuj" : "Nowe wyzwanie"}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center"
          >
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(f);
          }}
          className="space-y-3"
        >
          <Field label="Slug">
            <input
              required
              disabled={!!challenge}
              value={f.slug}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
              className="input"
              placeholder="np. tydzien-kebabu"
            />
          </Field>
          <Field label="Tytuł">
            <input
              required
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Ikona (emoji)">
            <input
              value={f.icon ?? ""}
              onChange={(e) => setF({ ...f, icon: e.target.value })}
              className="input"
              placeholder="🥙"
            />
          </Field>
          <Field label="Opis">
            <textarea
              rows={2}
              value={f.description ?? ""}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Typ celu">
            <select
              value={f.criteria.type}
              onChange={(e) =>
                setF({
                  ...f,
                  criteria: { ...f.criteria, type: e.target.value as ChallengeCriteriaType },
                })
              }
              className="input"
            >
              {CHALLENGE_CRITERIA_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {f.criteria.type === "cuisine_reviews" && (
            <Field label="Kuchnia">
              <select
                value={f.criteria.cuisine ?? CUISINES[0]}
                onChange={(e) =>
                  setF({ ...f, criteria: { ...f.criteria, cuisine: e.target.value } })
                }
                className="input"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Wartość progu">
              <input
                type="number"
                min={1}
                value={f.criteria.threshold}
                onChange={(e) =>
                  setF({
                    ...f,
                    criteria: { ...f.criteria, threshold: parseInt(e.target.value) || 1 },
                  })
                }
                className="input"
              />
            </Field>
            <Field label="Okno czasowe (dni)">
              <input
                type="number"
                min={1}
                value={f.criteria.window_days}
                onChange={(e) =>
                  setF({
                    ...f,
                    criteria: { ...f.criteria, window_days: parseInt(e.target.value) || 1 },
                  })
                }
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start (opcjonalnie)">
              <input
                type="date"
                value={f.starts_at ? f.starts_at.slice(0, 10) : ""}
                onChange={(e) =>
                  setF({ ...f, starts_at: e.target.value ? `${e.target.value}T00:00:00Z` : null })
                }
                className="input"
              />
            </Field>
            <Field label="Koniec (opcjonalnie)">
              <input
                type="date"
                value={f.ends_at ? f.ends_at.slice(0, 10) : ""}
                onChange={(e) =>
                  setF({ ...f, ends_at: e.target.value ? `${e.target.value}T23:59:59Z` : null })
                }
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort">
              <input
                type="number"
                value={f.sort_order}
                onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </Field>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Aktywne
              </span>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => setF({ ...f, enabled: e.target.checked })}
                className="w-5 h-5 mt-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Zapisz
          </button>
        </form>
      </div>
    </div>
  );
}

function emptyRank(): Omit<Rank, "id" | "is_system"> {
  return { slug: "", name: "", color: "#e35d2e", icon: "🏆", description: "", sort_order: 100 };
}

function RanksTab() {
  const isSuper = useIsSuperAdmin();
  const { data: ranks, isLoading } = useRanks();
  const save = useSaveRank();
  const del = useDeleteRank();
  const [editing, setEditing] = useState<Rank | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Rank | null>(null);

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Lock className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Head Admin</h2>
        <p className="text-sm text-muted-foreground">
          Edycja rang dostępna jest tylko dla pożeramy (super_admin).
        </p>
      </div>
    );
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
        >
          <Plus size={16} /> Dodaj rangę
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(ranks ?? []).map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <RankBadge rank={r} />
                {r.is_system && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-tomato">
                    systemowa
                  </span>
                )}
              </div>
              <div>
                <div className="font-display text-lg">{r.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.slug}</div>
              </div>
              {r.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(r)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-tomato hover:text-tomato"
                >
                  Edytuj
                </button>
                {!r.is_system && (
                  <button
                    onClick={() => setConfirmDelete(r)}
                    className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RankModal
          rank={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success("Zapisano");
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Błąd");
            }
          }}
          saving={save.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć rangę "${confirmDelete?.name}"?`}
        description="Odznaka zniknie z profili wszystkich użytkowników, którzy ją mają."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function RankModal({
  rank,
  onClose,
  onSave,
  saving,
}: {
  rank: Rank | null;
  onClose: () => void;
  onSave: (v: Omit<Rank, "id" | "is_system">) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Omit<Rank, "id" | "is_system">>(
    rank
      ? {
          slug: rank.slug,
          name: rank.name,
          color: rank.color,
          icon: rank.icon,
          description: rank.description,
          sort_order: rank.sort_order,
        }
      : emptyRank(),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{rank ? "Edytuj rangę" : "Nowa ranga"}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center"
          >
            <X size={16} />
          </button>
        </div>
        {rank && (
          <div className="mb-4">
            <RankBadge rank={{ ...rank, ...f, is_system: rank.is_system }} />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(f);
          }}
          className="space-y-3"
        >
          <Field label="Slug (a-z, 0-9, _-)">
            <input
              required
              value={f.slug}
              disabled={!!rank}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
              className="input"
              placeholder="np. smakosz"
            />
          </Field>
          <Field label="Nazwa">
            <input
              required
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Ikona (emoji lub puste)">
            <input
              value={f.icon ?? ""}
              onChange={(e) => setF({ ...f, icon: e.target.value })}
              className="input"
              placeholder="🍕"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kolor (hex)">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={f.color}
                  onChange={(e) => setF({ ...f, color: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-border"
                />
                <input
                  value={f.color}
                  onChange={(e) => setF({ ...f, color: e.target.value })}
                  className="input flex-1 font-mono text-sm"
                />
              </div>
            </Field>
            <Field label="Sort (mniej = wcześniej)">
              <input
                type="number"
                value={f.sort_order}
                onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Opis (opcjonalnie)">
            <textarea
              rows={2}
              value={f.description ?? ""}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              className="input"
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Zapisz
          </button>
        </form>
      </div>
    </div>
  );
}
