import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsSuperAdmin, useUser, type AppRole } from "@/lib/use-auth";
import {
  useAllUsersWithRoles,
  useGrantRole,
  useRevokeRole,
  useSetBetaTester,
} from "@/lib/roles-api";
import { useRanks, useGrantRankToUser, useRevokeRankFromUser, useUserRanks } from "@/lib/ranks-api";
import { RankBadge } from "@/components/RankBadge";
import { Crown, Search, Loader2, Shield, User as UserIcon, X, Award, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteUserAccount } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Użytkownicy — Panel admina" }] }),
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
  super_admin: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
};

function AdminUsers() {
  const isSuper = useIsSuperAdmin();
  const { user: me } = useUser();
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAllUsersWithRoles(search);
  const grant = useGrantRole();
  const revoke = useRevokeRole();

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
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-1">Uzytkownicy i rangi</h1>
        <p className="text-sm text-muted-foreground">
          Nadawaj i odbieraj rangi. Tylko Super Admin widzi tę stronę.
        </p>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nicku lub display name…"
          className="w-full pl-10 pr-9 py-3 rounded-xl bg-card border border-border outline-none focus:border-tomato"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Wyczyść"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : users && users.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Użytkownik</th>
                <th className="text-left px-4 py-3">Aktualne rangi</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Zmień</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    {u.username ? (
                      <Link
                        to="/u/$username"
                        params={{ username: u.username }}
                        className="inline-flex items-center gap-1.5 font-semibold hover:text-tomato transition-colors"
                      >
                        {u.display_name || u.username || "(bez nazwy)"}
                        <ExternalLink size={12} className="opacity-60" />
                      </Link>
                    ) : (
                      <div className="font-semibold">
                        {u.display_name || "(bez nazwy)"}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                      {u.id === me?.id && " · to Ty"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">— user —</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLE[r]}`}
                          >
                            {ROLE_ICON[r]} {ROLE_LABEL[r]}
                          </span>
                        ))}
                      </div>
                    )}
                    <UserRanksInline userId={u.id} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {ALL_ROLES.filter((r) => r !== "user").map((r) => {
                        const has = u.roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => toggleRole(u.id, r, has)}
                            disabled={grant.isPending || revoke.isPending}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                              has
                                ? "bg-tomato text-cream hover:bg-tomato/80"
                                : "bg-muted hover:bg-muted/70"
                            }`}
                          >
                            {has ? `− ${ROLE_LABEL[r]}` : `+ ${ROLE_LABEL[r]}`}
                          </button>
                        );
                      })}
                    </div>
                    <RankPicker userId={u.id} />
                    <BetaTesterToggle userId={u.id} value={u.is_beta_tester} />
                    {u.id !== me?.id && (
                      <DeleteUserButton
                        userId={u.id}
                        label={u.display_name || u.username || u.id.slice(0, 8)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  async function onDelete() {
    if (
      !confirm(
        `Na pewno usunąć konto „${label}”? Tej operacji nie można cofnąć — usunięte zostaną dane uwierzytelniania i powiązany profil.`,
      )
    )
      return;
    setPending(true);
    try {
      await callDelete({ data: { userId } });
      toast.success("Konto usunięte");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd usuwania konta");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={pending}
      className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30 transition disabled:opacity-50"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      Usuń konto
    </button>
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
                ? "Oznaczono jako beta tester — odznaki przeliczone"
                : "Odznaczono beta tester — odznaki przeliczone",
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
