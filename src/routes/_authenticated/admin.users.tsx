import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsSuperAdmin, useUser, type AppRole } from "@/lib/use-auth";
import {
  useAllUsersWithRoles,
  useUserCounts,
  useGrantRole,
  useRevokeRole,
  useSetBetaTester,
} from "@/lib/roles-api";
import { useRanks, useGrantRankToUser, useRevokeRankFromUser, useUserRanks } from "@/lib/ranks-api";
import { RankBadge } from "@/components/RankBadge";
import {
  Crown,
  Search,
  Loader2,
  Shield,
  User as UserIcon,
  X,
  Award,
  ExternalLink,
  Trash2,
  FlaskConical,
  Users,
} from "lucide-react";
import { AdminPageHeader, AdminStatBar } from "@/components/admin/AdminPageShell";
import { AdminSearchInput, AdminFilterChips } from "@/components/admin/AdminControls";
import { UserAvatar } from "@/components/UserAvatar";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";
import { deleteUserAccount } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Użytkownicy - Panel admina" }] }),
  component: AdminUsers,
});

const ALL_ROLES: AppRole[] = ["user", "admin", "super_admin"];

const ROLE_LABEL: Record<AppRole, string> = {
  user: "Użytkownik",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_ICON: Record<AppRole, React.ReactNode> = {
  user: <UserIcon size={12} />,
  admin: <Shield size={12} />,
  super_admin: <Crown size={12} />,
};

const ROLE_STYLE: Record<AppRole, string> = {
  user: "bg-muted text-foreground",
  admin: "bg-tomato/15 text-tomato border border-tomato/30",
  // --mustard is the brand's own gold; no need for Tailwind's amber. It is a
  // light token (L .84), so the label stays navy rather than a tinted text.
  super_admin: "bg-mustard/30 text-navy border border-mustard",
};

type StatusFilter = "all" | "staff" | "beta";

function AdminUsers() {
  const isSuper = useIsSuperAdmin();
  const { user: me } = useUser();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data: users, isLoading } = useAllUsersWithRoles(search);
  const { data: userCounts } = useUserCounts();
  const grant = useGrantRole();
  const revoke = useRevokeRole();

  const filtered = (users ?? []).filter((u) => {
    if (statusFilter === "staff") return u.roles.includes("admin") || u.roles.includes("super_admin");
    if (statusFilter === "beta") return u.is_beta_tester;
    return true;
  });

  // Real site-wide totals (useUserCounts, unaffected by the 50-row cap and
  // search filter on the list below) when not searching; while searching,
  // show counts within the search results instead, since "how many admins
  // total" isn't what the filter chips mean once you've typed a query.
  const counts = search.trim()
    ? {
        all: users?.length ?? 0,
        staff: (users ?? []).filter((u) => u.roles.includes("admin") || u.roles.includes("super_admin")).length,
        beta: (users ?? []).filter((u) => u.is_beta_tester).length,
      }
    : { all: userCounts?.all ?? 0, staff: userCounts?.staff ?? 0, beta: userCounts?.beta ?? 0 };

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Crown className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Super Admin</h2>
        <p className="text-sm text-muted-foreground">
          Zarządzanie rangami jest dostępne tylko dla użytkowników z rangą{" "}
          <strong>Super Admin</strong>.
        </p>
      </div>
    );
  }

  async function toggleRole(userId: string, role: AppRole, hasIt: boolean) {
    try {
      if (hasIt) {
        if (userId === me?.id && role === "super_admin") {
          if (!confirm("Na pewno odebrać sobie rangę Super Admin? Stracisz dostęp do tego panelu."))
            return;
        }
        await revoke.mutateAsync({ userId, role });
        toast.success(`Odebrano: ${ROLE_LABEL[role]}`);
      } else {
        await grant.mutateAsync({ userId, role });
        toast.success(`Nadano: ${ROLE_LABEL[role]}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Użytkownicy i rangi"
        icon={<Users size={26} />}
        subtitle="Nadawaj i odbieraj rangi. Tylko Super Admin widzi tę stronę."
      />
      <AdminStatBar
        loading={!userCounts}
        stats={[
          {
            label: "Wszystkie konta",
            value: userCounts?.all ?? 0,
            delta: userCounts?.newThisMonth
              ? `+${userCounts.newThisMonth} w tym mies.`
              : "bez nowych",
            tone: userCounts?.newThisMonth ? "ok" : "neutral",
          },
          {
            label: "Nowi w tym mies.",
            value: userCounts?.newThisMonth ?? 0,
            delta: "od 1. dnia miesiąca",
            tone: "neutral",
          },
          {
            label: "Zespół (admini)",
            value: userCounts?.staff ?? 0,
            delta: "admin + super admin",
            tone: "neutral",
          },
          {
            label: "Beta testerzy",
            value: userCounts?.beta ?? 0,
            delta: userCounts?.all
              ? `${Math.round(((userCounts.beta ?? 0) / userCounts.all) * 100)}% bazy`
              : "—",
            tone: "ok",
          },
        ]}
      />

      <AdminSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Szukaj po nicku lub display name…"
        className="mb-4"
      />

      <AdminFilterChips
        value={statusFilter}
        onChange={setStatusFilter}
        className="mb-5"
        options={[
          { key: "all", label: "Wszyscy", count: counts.all },
          { key: "staff", label: "Admini", count: counts.staff },
          { key: "beta", label: "Beta testerzy", count: counts.beta },
        ]}
      />

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              {/* Identity */}
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={u.avatar_url} displayName={u.display_name} username={u.username} size={44} />
                <div className="min-w-0 flex-1">
                  {u.username ? (
                    <Link
                      to="/u/$username"
                      params={{ username: u.username }}
                      className="inline-flex items-center gap-1.5 font-semibold hover:text-tomato transition-colors truncate"
                    >
                      <span className="truncate">{u.display_name || u.username || "(bez nazwy)"}</span>
                      <ExternalLink size={12} className="opacity-60 shrink-0" />
                    </Link>
                  ) : (
                    <div className="font-semibold truncate">{u.display_name || "(bez nazwy)"}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                    {u.id === me?.id && " · to Ty"}
                  </div>
                </div>
              </div>

              {/* Status: read-only badges */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLE.user}`}
                >
                  {ROLE_ICON.user} Użytkownik
                </span>
                {u.roles
                  .filter((r) => r !== "user")
                  .map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLE[r]}`}
                    >
                      {ROLE_ICON[r]} {ROLE_LABEL[r]}
                    </span>
                  ))}
                {u.is_beta_tester && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-ok/12 text-ok border border-ok/30">
                    <FlaskConical size={12} /> Beta tester
                  </span>
                )}
                <UserRanksInline userId={u.id} />
              </div>

              <div className="border-t border-dashed border-border" />

              {/* Actions: buttons, deliberately styled differently from the status badges above */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Zarządzaj
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ALL_ROLES.filter((r) => r !== "user").map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => toggleRole(u.id, r, has)}
                        disabled={grant.isPending || revoke.isPending}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
                          has
                            ? "bg-tomato text-cream border-tomato hover:bg-tomato/80"
                            : "bg-transparent border-border hover:border-tomato hover:text-tomato"
                        }`}
                      >
                        {has ? `− ${ROLE_LABEL[r]}` : `+ ${ROLE_LABEL[r]}`}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <RankPicker userId={u.id} />
                  <BetaTesterToggle userId={u.id} value={u.is_beta_tester} />
                </div>
                {u.id !== me?.id && (
                  <DeleteUserButton
                    userId={u.id}
                    label={u.display_name || u.username || u.id.slice(0, 8)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card border border-border rounded-2xl text-muted-foreground">
          Brak wyników.
        </div>
      )}
    </div>
  );
}

function UserRanksInline({ userId }: { userId: string }) {
  const { data: ranks } = useUserRanks(userId);
  if (!ranks || ranks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {ranks.map((r) => <RankBadge key={r.id} rank={r} size="sm" />)}
    </div>
  );
}

function RankPicker({ userId }: { userId: string }) {
  const { data: allRanks } = useRanks();
  const { data: userRanks } = useUserRanks(userId);
  const grant = useGrantRankToUser();
  const revoke = useRevokeRankFromUser();

  if (!allRanks || allRanks.length === 0) return null;
  const userRankIds = new Set((userRanks ?? []).map((r) => r.id));

  return (
    <details className="text-xs">
      <summary className="cursor-pointer inline-flex items-center gap-1 text-muted-foreground hover:text-tomato">
        <Award size={11} /> Nadaj rangę
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5 max-w-xs">
        {allRanks.map((r) => {
          const has = userRankIds.has(r.id);
          return (
            <button
              key={r.id}
              onClick={async () => {
                try {
                  if (has) await revoke.mutateAsync({ userId, rankId: r.id });
                  else await grant.mutateAsync({ userId, rankId: r.id });
                  toast.success(has ? "Odebrano rangę" : "Nadano rangę");
                } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                has ? "ring-2 ring-tomato" : "opacity-60 hover:opacity-100"
              }`}
              style={{ backgroundColor: r.color, color: "white" }}
            >
              {has ? "−" : "+"} {r.name}
            </button>
          );
        })}
      </div>
    </details>
  );
}

function DeleteUserButton({ userId, label }: { userId: string; label: string }) {
  const callDelete = useServerFn(deleteUserAccount);
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await callDelete({ data: { userId } });
      toast.success("Konto usunięte");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd usuwania konta");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 transition disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Usuń konto
      </button>
      <ConfirmDeleteModal
        open={open}
        title="Usunąć konto?"
        description={`Na pewno usunąć konto „${label}"? Tej operacji nie można cofnąć - usunięte zostaną dane uwierzytelniania i powiązany profil.`}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={onDelete}
      />
    </>
  );
}

function BetaTesterToggle({ userId, value }: { userId: string; value: boolean }) {
  const setBeta = useSetBetaTester();
  return (
    <label className="mt-2 inline-flex items-center gap-2 text-xs cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={setBeta.isPending}
        onChange={async (e) => {
          try {
            await setBeta.mutateAsync({ userId, value: e.target.checked });
            toast.success(
              e.target.checked
                ? "Oznaczono jako beta tester - odznaki przeliczone"
                : "Odznaczono beta tester - odznaki przeliczone",
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Błąd");
          }
        }}
        className="w-4 h-4 accent-tomato"
      />
      <span className="inline-flex items-center gap-1">
        {setBeta.isPending && <Loader2 size={11} className="animate-spin" />}
        Beta tester
      </span>
    </label>
  );
}
