import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsSuperAdmin } from "@/lib/use-auth";
import {
  useAllSocialAccounts,
  useUpsertSocialAccount,
  useDeleteSocialAccount,
  useSetManualMetrics,
  PLATFORM_LABEL,
  formatCount,
  isStale,
  type SocialPlatform,
  type SocialAccount,
} from "@/lib/social-api";
import { refreshSocialMetrics } from "@/lib/social.functions";
import { Crown, Instagram, Youtube, Facebook, RefreshCw, Trash2, Save, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";

export const Route = createFileRoute("/_authenticated/admin/social")({
  head: () => ({ meta: [{ title: "Social media — Panel admina" }] }),
  component: AdminSocial,
});

const PLATFORMS: SocialPlatform[] = ["instagram", "youtube", "facebook"];

const ICON: Partial<Record<SocialPlatform, React.ReactNode>> = {
  instagram: <Instagram size={18} />,
  youtube: <Youtube size={18} />,
  facebook: <Facebook size={18} />,
};

function AdminSocial() {
  const isSuper = useIsSuperAdmin();
  const { data: accounts, isLoading } = useAllSocialAccounts();

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Crown className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Super Admin</h2>
        <p className="text-sm text-muted-foreground">
          Zarządzanie kontami social jest dostępne tylko dla rangi Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-1">Social media marki</h1>
        <p className="text-sm text-muted-foreground">
          Liczniki odświeżają się automatycznie raz na 48h. Możesz wymusić odświeżenie ręcznie.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Ładowanie…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => {
            const acc = accounts?.find((a) => a.platform === p);
            return <PlatformCard key={p} platform={p} account={acc} />;
          })}
        </div>
      )}

      <section className="mt-8 bg-card border border-border rounded-2xl p-5">
        <h2 className="font-display text-xl mb-1">Sekrety API</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sekrety dodajesz w bezpiecznym panelu Lovable Cloud → <em>View Backend</em> → Secrets. Po dodaniu kliknij „Sync" na karcie platformy.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 font-semibold mb-1"><Instagram size={14}/> Instagram</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><code>INSTAGRAM_ACCESS_TOKEN</code> — long-lived token (Meta Graph API)</li>
              <li><code>INSTAGRAM_USER_ID</code> — ID konta IG Business</li>
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2">Wymaga konta IG przełączonego na Business i połączonego z Page FB.</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 font-semibold mb-1"><Facebook size={14}/> Facebook</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><code>FACEBOOK_PAGE_ID</code></li>
              <li><code>FACEBOOK_PAGE_ACCESS_TOKEN</code></li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 font-semibold mb-1"><Youtube size={14}/> YouTube</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><code>YOUTUBE_API_KEY</code> — Google Cloud Console, YouTube Data API v3</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlatformCard({
  platform,
  account,
}: {
  platform: SocialPlatform;
  account: SocialAccount | undefined;
}) {
  const upsert = useUpsertSocialAccount();
  const del = useDeleteSocialAccount();
  const setManual = useSetManualMetrics();
  const refresh = useServerFn(refreshSocialMetrics);
  const [handle, setHandle] = useState(account?.handle ?? "");
  const [url, setUrl] = useState(account?.profile_url ?? "");
  const [active, setActive] = useState(account?.is_active ?? true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualFollowers, setManualFollowers] = useState<string>(
    account?.followers_count != null ? String(account.followers_count) : "",
  );
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasAccount = !!account;
  const stale = account ? isStale(account) : true;

  async function save() {
    try {
      if (!handle.trim()) {
        toast.error("Handle wymagany");
        return;
      }
      await upsert.mutateAsync({
        platform,
        handle: handle.trim(),
        profile_url: url.trim() || null,
        is_active: active,
      });
      toast.success("Zapisano");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function doRefresh(force: boolean) {
    setRefreshing(true);
    try {
      const result = await refresh({ data: { platform, force } });
      if (result.cached) {
        toast.info(`Z cache (sprzed ${result.ageMinutes} min). Użyj „Wymuś”, by pobrać ponownie.`);
      } else {
        toast.success("Metryki odświeżone");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd odświeżania");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove() {
    try {
      await del.mutateAsync(platform);
      setHandle("");
      setUrl("");
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmRemove(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold">
          {ICON[platform]} {PLATFORM_LABEL[platform]}
        </div>
        {hasAccount && (
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              account.last_sync_error
                ? "bg-red-500/15 text-red-600"
                : stale
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-emerald-500/15 text-emerald-700"
            }`}
          >
            {account.last_sync_error ? (
              <>
                <AlertTriangle size={11} /> błąd
              </>
            ) : stale ? (
              "do odświeżenia"
            ) : (
              <>
                <CheckCircle2 size={11} /> aktualne
              </>
            )}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Handle (np. po_zeramy)"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-tomato text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL profilu (opcjonalnie)"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-tomato text-sm"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-tomato"
          />
          Widoczne publicznie
        </label>
      </div>

      {hasAccount && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="bg-background rounded-lg py-2">
            <div className="font-display text-xl">{formatCount(account.followers_count)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Obserwujący</div>
          </div>
          <div className="bg-background rounded-lg py-2">
            <div className="font-display text-xl">{formatCount(account.posts_count)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posty</div>
          </div>
        </div>
      )}

      {account?.last_sync_error && (
        <p className="text-xs text-red-600 mb-2 line-clamp-2">{account.last_sync_error}</p>
      )}
      {account?.last_synced_at && (
        <p className="text-[11px] text-muted-foreground mb-3">
          Ostatnia sync: {new Date(account.last_synced_at).toLocaleString("pl-PL")}
        </p>
      )}

      {hasAccount && platform === "facebook" && (
        <div className="mb-3 rounded-lg border border-dashed border-border bg-background/50 p-3">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
            Ręcznie ustaw liczbę obserwujących
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Użyj gdy token Graph API wygasł — wartość zostanie wpisana „na sztywno" do następnego udanego syncu.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={manualFollowers}
              onChange={(e) => setManualFollowers(e.target.value)}
              placeholder="np. 1240"
              className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border outline-none focus:border-tomato text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                const n = manualFollowers.trim() === "" ? null : Number(manualFollowers);
                if (n !== null && (!Number.isFinite(n) || n < 0)) {
                  toast.error("Podaj liczbę nieujemną");
                  return;
                }
                try {
                  await setManual.mutateAsync({ platform, followers_count: n });
                  toast.success("Zapisano ręczną wartość");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Błąd zapisu");
                }
              }}
              disabled={setManual.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-cream text-xs font-semibold hover:bg-navy/90 disabled:opacity-50"
            >
              <Save size={12} /> Ustaw
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={upsert.isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tomato text-cream text-xs font-semibold hover:bg-tomato/90 disabled:opacity-50"
        >
          {hasAccount ? <Save size={12} /> : <Plus size={12} />} {hasAccount ? "Zapisz" : "Dodaj"}
        </button>
        {hasAccount && (
          <>
            <button
              onClick={() => doRefresh(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold hover:bg-muted/70 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Sync
            </button>
            <button
              onClick={() => doRefresh(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold hover:bg-muted/70 disabled:opacity-50"
            >
              Wymuś
            </button>
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={del.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={12} /> Usuń
            </button>
          </>
        )}
      </div>

      <ConfirmDeleteModal
        open={confirmRemove}
        title={`Usunąć konto ${PLATFORM_LABEL[platform]}?`}
        description="Handle, URL i historia metryk dla tej platformy znikną z panelu."
        pending={del.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
    </div>
  );
}
