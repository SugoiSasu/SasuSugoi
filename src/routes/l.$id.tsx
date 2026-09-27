import { BackButton } from "@/components/BackButton";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useList,
  useDeleteList,
  useUpdateList,
  useMoveListItem,
  useRemovePlaceFromList,
  VISIBILITY_LABEL,
  type ListVisibility,
} from "@/lib/lists-api";
import { pluralPl } from "@/lib/plural-pl";
import { ShareModal } from "@/components/ShareModal";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { UserAvatar } from "@/components/UserAvatar";
import { SmartText } from "@/components/SmartText";
import { WallSocial } from "@/components/WallSocial";
import { cuisineMeta } from "@/data/places";

export const Route = createFileRoute("/l/$id")({
  head: () => ({ meta: [{ title: "Lista - poŻeramy" }] }),
  component: ListDetail,
});

function ListDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useList(id);
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const del = useDeleteList();
  const zmien = useUpdateList();
  const przesun = useMoveListItem();
  const usunPozycje = useRemovePlaceFromList();
  const [udostepnij, setUdostepnij] = useState(false);

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-dvh bg-background px-4 py-10 text-center">
        <h1 className="font-display text-2xl mb-2">Nie znaleziono listy</h1>
        <BackButton to="/wall" label="Wróć do Pożeralni" />
      </main>
    );
  }

  const { list, items } = data;
  const isOwner = user?.id === list.user_id;

  async function handleDelete() {
    if (!confirm("Usunąć tę listę? Tej operacji nie można cofnąć.")) return;
    try {
      await del.mutateAsync(list.id);
      toast.success("Usunięto listę");
      window.location.href = "/wall";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd usuwania");
    }
  }

  return (
    <main id="main-content" className="min-h-dvh bg-background px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <BackButton to="/wall" label="Pożeralnia" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
            <ListChecks size={12} /> Lista · {items.length}{" "}
            {pluralPl(items.length, "miejsce", "miejsca", "miejsc")}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl mb-2">{list.title}</h1>
          {list.description && (
            <p className="text-sm text-muted-foreground mb-3">
              <SmartText>{list.description}</SmartText>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  avatarSource={profile?.avatar_source as "google" | "upload" | "initials" | null}
                  displayName={profile?.display_name}
                  username={profile?.username}
                  size={22}
                />
                Twoja lista
              </div>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUdostepnij(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-tomato"
              >
                <Share2 size={12} /> Udostępnij
              </button>
              {items.length > 0 && (
                <Link
                  to="/mapa"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-tomato"
                >
                  <MapIcon size={12} /> Pokaż na mapie
                </Link>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                >
                  {del.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Usuń listę
                </button>
              )}
            </div>
          </div>

          {isOwner && (
            <fieldset className="mt-4 border-t border-border pt-3">
              {/* Widoczna legenda zamiast pary "sr-only legend + akapit" -
                  ta sama tresc dwa razy w DOM znaczy, ze czytnik ekranu czyta
                  ja dwukrotnie. */}
              <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Kto widzi listę
              </legend>
              <div className="flex gap-1.5">
                {(["public", "friends", "private"] as ListVisibility[]).map((w) => {
                  const on = list.visibility === w;
                  const Ikona = w === "public" ? Eye : w === "friends" ? Users : EyeOff;
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      disabled={zmien.isPending}
                      onClick={async () => {
                        if (on) return;
                        try {
                          await zmien.mutateAsync({ id: list.id, visibility: w });
                          toast.success(`Widoczność: ${VISIBILITY_LABEL[w]}`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
                        }
                      }}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-extrabold transition disabled:opacity-50 ${
                        on ? "bg-navy text-cream" : "border border-border hover:border-tomato"
                      }`}
                    >
                      <Ikona size={12} /> {VISIBILITY_LABEL[w]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Ta lista jest jeszcze pusta.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((it, idx) => {
              const p = it.place;
              if (!p) return null;
              const meta = cuisineMeta(p.cuisine ?? "");
              const img = p.avatar_url || p.cover_image_url;
              return (
                <li key={it.id}>
                  <Link
                    to="/k/$id"
                    params={{ id: p.slug ?? p.id }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-tomato hover:shadow-sm"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        style={{ backgroundColor: meta.color }}
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-2xl"
                      >
                        {meta.emoji}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-extrabold">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin size={11} /> {p.address}
                      </div>
                      {it.note && (
                        <div className="mt-0.5 truncate text-xs text-tomato">{it.note}</div>
                      )}
                    </div>

                    {isOwner && (
                      // Strzalki, nie przeciaganie: liste otwiera sie tez na
                      // telefonie jednym kciukiem, a drag and drop w pionowej
                      // liscie gryzie sie tam z przewijaniem strony.
                      <span className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          aria-label={`Przesuń ${p.name} wyżej`}
                          disabled={idx === 0 || przesun.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            przesun.mutate({ items, index: idx, kierunek: -1 });
                          }}
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Przesuń ${p.name} niżej`}
                          disabled={idx === items.length - 1 || przesun.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            przesun.mutate({ items, index: idx, kierunek: 1 });
                          }}
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </span>
                    )}

                    {isOwner && (
                      <button
                        type="button"
                        aria-label={`Usuń ${p.name} z listy`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          usunPozycje.mutate(
                            { listId: list.id, placeId: p.id },
                            {
                              onSuccess: () => toast.success("Usunięto z listy"),
                              onError: (err) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Nie udało się usunąć",
                                ),
                            },
                          );
                        }}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="bg-card border border-border rounded-2xl p-4 mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Reakcje i komentarze
          </div>
          <WallSocial kind="list" refId={list.id} />
        </div>
      </div>

      <ShareModal
        open={udostepnij}
        onClose={() => setUdostepnij(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={list.title}
        subtitle={`${items.length} ${pluralPl(items.length, "miejsce", "miejsca", "miejsc")} · ${VISIBILITY_LABEL[list.visibility]}`}
        shareText={`Zobacz moją listę ${list.title} na poŻeramy`}
      />
    </main>
  );
}
