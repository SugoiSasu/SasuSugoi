import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  Star,
  Heart,
  Trophy,
  Megaphone,
  UserPlus,
  MessageCircle,
  Send,
  UtensilsCrossed,
  X,
  MapPin,
  ChevronDown,
  ChevronRight,
  Check,
  Camera,
  ListChecks,
  Medal,
  Share2,
  Sparkles,
  Users,
  Search,
} from "lucide-react";
import { useWallFeed, useForYouFeed, useCreateWallPost, type WallItem } from "@/lib/wall-api";
import { usePlaces, type Place } from "@/lib/places-api";
import { useMyProfile } from "@/lib/profile-api";
import { useStorageImageUpload } from "@/components/admin/useStorageImageUpload";
import { useCreateList } from "@/lib/lists-api";
import { cuisineMeta } from "@/data/places";
import { searchPlaces } from "@/lib/place-search";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { UserAvatar } from "@/components/UserAvatar";
import { SmartText } from "@/components/SmartText";
import { ReviewSocial } from "@/components/ReviewSocial";
import { WallSocial } from "@/components/WallSocial";
import { useUser } from "@/lib/use-auth";
import {
  REACTION_TYPES,
  REACTION_EMOJI,
  type ReactionType,
  usePostReactions,
  useToggleReaction,
  usePostComments,
  useAddPostComment,
} from "@/lib/post-social-api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { vipNameStyle } from "@/components/VipBadge";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/wall")({
  head: () => ({
    meta: [
      { title: "Pożeralnia - poŻeramy" },
      {
        name: "description",
        content:
          "Aktywność znajomych, nowinki z Twoich ulubionych miejscówek i komunikaty od lokali.",
      },
    ],
  }),
  component: WallPage,
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "przed chwilą";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}

function WallPage() {
  const { user, loading: authLoading } = useUser();
  return (
    <main id="main-content" className="min-h-dvh bg-background py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 pb-5 border-b border-border">
          <h1 className="font-persona text-3xl sm:text-4xl mb-1">Pożeralnia</h1>
          <p className="text-sm text-muted-foreground">
            Aktywność znajomych, nowinki z Twoich ulubionych miejscówek i komunikaty od lokali.
          </p>
        </header>
        {authLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="animate-spin" />
          </div>
        ) : !user ? (
          <AuthGate
            icon={Megaphone}
            title="Zaloguj się, żeby zobaczyć feed"
            description="Pożeralnia pokazuje recenzje znajomych, ich nowe ulubione miejscówki, zdobyte odznaki i aktualności z lokali, które obserwujesz."
          />
        ) : (
          <SignedInFeed />
        )}
      </div>
    </main>
  );
}

function SignedInFeed() {
  const [tab, setTab] = useState<"friends" | "for-you">("friends");
  const friendsFeed = useWallFeed();
  const forYouFeed = useForYouFeed();
  const { data, isLoading } = tab === "friends" ? friendsFeed : forYouFeed;

  return (
    <>
      <QuickPostBar />
      <div className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("friends")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === "friends" ? "bg-tomato text-cream" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Users size={13} /> Znajomi
        </button>
        <button
          type="button"
          onClick={() => setTab("for-you")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === "for-you" ? "bg-tomato text-cream" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sparkles size={13} /> Dla Ciebie
        </button>
      </div>
      {isLoading ? (
        <ul className="space-y-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="bg-card border border-border rounded-3xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2 w-1/5" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </li>
          ))}
        </ul>
      ) : !data || data.length === 0 ? (
        tab === "friends" ? (
          <EmptyWall />
        ) : (
          <EmptyForYou />
        )
      ) : (
        <ul className="space-y-3">
          {data.map((it) => (
            <FeedCard key={it.id} item={it} />
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyWall() {
  return (
    <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center">
      <Megaphone className="mx-auto text-muted-foreground mb-3" size={32} />
      <h2 className="font-display text-xl mb-2">Cisza jak makiem zasiał</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Dodaj znajomych albo polub kilka lokali, a tutaj zacznie się dziać.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link to="/friends" className="chip bg-tomato text-cream hover:bg-tomato/90">
          <UserPlus size={12} /> Szukaj znajomych
        </Link>
        <Link to="/" hash="mapa" className="chip bg-card border border-border hover:border-tomato">
          Mapa lokali
        </Link>
      </div>
    </div>
  );
}

function EmptyForYou() {
  return (
    <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center">
      <Sparkles className="mx-auto text-muted-foreground mb-3" size={32} />
      <h2 className="font-display text-xl mb-2">Jeszcze Cię nie znamy</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Wybierz ulubione kuchnie i dzielnicę w profilu, a dobierzemy dla Ciebie ciekawe lokale.
      </p>
      <Link to="/profile" className="chip bg-tomato text-cream hover:bg-tomato/90">
        Ustaw preferencje
      </Link>
    </div>
  );
}

function QuickPostBar() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: places } = usePlaces();
  const create = useCreateWallPost();
  const [open, setOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [body, setBody] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    uploading,
    upload,
    inputRef: fileInputRef,
  } = useStorageImageUpload({
    bucket: "review-photos",
    buildPath: (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      return `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    },
    maxMb: 5,
  });

  async function handlePhoto(file: File) {
    const url = await upload(file);
    if (url) setImageUrl(url);
  }

  function resetForm() {
    setBody("");
    setPlaceId("");
    setImageUrl(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = body.trim();
    if (!v) return;
    try {
      await create.mutateAsync({ body: v, placeId: placeId || null, imageUrl });
      resetForm();
      setOpen(false);
      toast.success("Dodano wpis na Pożeralni ✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się dodać wpisu");
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-4">
      {!open ? (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            className="flex items-center gap-3 w-full text-left"
          >
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              avatarSource={profile?.avatar_source as "google" | "upload" | "initials" | null}
              displayName={profile?.display_name}
              username={profile?.username}
              size={36}
            />
            <span className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              Co dzisiaj jadłeś? 🍽️
            </span>
          </button>
          <button
            type="button"
            onClick={() => setListModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tomato hover:underline"
          >
            <ListChecks size={13} /> Stwórz listę tematyczną
          </button>
          {listModalOpen && <CreateListModal onClose={() => setListModalOpen(false)} />}
        </>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Co dzisiaj jadłeś? Podziel się jednym zdaniem…"
            maxLength={500}
            rows={2}
            className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tomato resize-none"
          />
          {imageUrl ? (
            <div className="relative inline-block">
              <img
                src={imageUrl}
                alt=""
                className="h-20 w-20 rounded-xl object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                aria-label="Usuń zdjęcie"
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy text-cream shadow-sm hover:bg-navy/90"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="chip bg-card border border-border hover:border-tomato text-sm disabled:opacity-60"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {uploading ? "Wgrywam…" : "Dodaj zdjęcie"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePhoto(f);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <PlacePickerField value={placeId} onChange={setPlaceId} places={places ?? []} />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="chip bg-card border border-border hover:border-destructive hover:text-destructive text-sm"
              >
                <X size={12} /> Anuluj
              </button>
              <button
                type="submit"
                disabled={!body.trim() || create.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-1.5 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
              >
                {create.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Dodaj
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function CreateListModal({ onClose }: { onClose: () => void }) {
  const { data: places } = usePlaces();
  const create = useCreateList();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { results } = searchPlaces(places ?? [], query);
  const selectedPlaces = (places ?? []).filter((p) => selectedIds.includes(p.id));

  function toggle(id: string) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0) {
      toast.error("Podaj tytuł i wybierz co najmniej jedno miejsce");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        placeIds: selectedIds,
      });
      toast.success("Lista utworzona ✓");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się utworzyć listy");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground rounded-3xl max-w-lg w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card border-b border-border">
          <h2 className="font-display text-2xl inline-flex items-center gap-2">
            <ListChecks size={22} className="text-tomato" /> Nowa lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center hover:bg-muted/70"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Najlepszy street food w Poznaniu"
              maxLength={100}
              required
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-tomato"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis (opcjonalnie)"
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tomato"
            />

            {selectedPlaces.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedPlaces.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-tomato/10 px-2.5 py-1 text-xs font-semibold text-tomato"
                  >
                    {p.name}
                    <button type="button" onClick={() => toggle(p.id)} aria-label="Usuń z listy">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj lokalu, żeby dodać do listy…"
                className="w-full rounded-full border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-tomato"
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {results.slice(0, 25).map((p) => {
                const checked = selectedIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 ${checked ? "bg-tomato/5" : ""}`}
                  >
                    <PlaceAvatarDot place={p} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.cuisine}
                        {p.district ? ` · ${p.district}` : ""}
                      </span>
                    </span>
                    {checked && <Check size={14} className="shrink-0 text-tomato" />}
                  </button>
                );
              })}
              {results.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Brak wyników.</p>
              )}
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-border py-3 font-semibold transition hover:bg-muted"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={create.isPending || !title.trim() || !selectedIds.length}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-full bg-tomato py-3 font-semibold text-cream transition hover:bg-tomato/90 disabled:opacity-50"
            >
              {create.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <ListChecks size={16} />
              )}
              Utwórz listę ({selectedIds.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlaceAvatarDot({
  place,
  size = 24,
}: {
  place: Pick<Place, "cuisine" | "avatar_url" | "cover_image_url">;
  size?: number;
}) {
  const meta = cuisineMeta(place.cuisine);
  const img = place.avatar_url || place.cover_image_url;
  if (img) {
    return (
      <img
        src={img}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-border"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: meta.color, fontSize: size * 0.5 }}
      className="rounded-full grid place-items-center shrink-0"
    >
      {meta.emoji}
    </span>
  );
}

function PlacePickerField({
  value,
  onChange,
  places,
}: {
  value: string;
  onChange: (id: string) => void;
  places: Place[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = places.find((p) => p.id === value) ?? null;
  const { results } = searchPlaces(places, query);

  function pick(id: string) {
    onChange(id);
    setPickerOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={pickerOpen}
      onOpenChange={(v) => {
        setPickerOpen(v);
        if (!v) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background pl-1.5 pr-3 py-1 text-xs font-semibold hover:border-tomato transition max-w-full"
        >
          {selected ? (
            <>
              <PlaceAvatarDot place={selected} size={22} />
              <span className="truncate max-w-[9rem]">{selected.name}</span>
            </>
          ) : (
            <>
              <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-muted text-muted-foreground">
                <MapPin size={12} />
              </span>
              <span className="text-muted-foreground">Dodaj miejsce</span>
            </>
          )}
          <ChevronDown size={12} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Szukaj lokalu…" />
          <CommandList>
            <CommandEmpty>Nie znaleziono lokalu.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => pick("")} className="gap-2">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-muted text-muted-foreground shrink-0">
                  <MapPin size={13} />
                </span>
                <span className="flex-1">Bez wskazania miejsca</span>
                {!value && <Check size={14} className="text-tomato shrink-0" />}
              </CommandItem>
              {results.slice(0, 30).map((p) => (
                <CommandItem key={p.id} value={p.id} onSelect={() => pick(p.id)} className="gap-2">
                  <PlaceAvatarDot place={p} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.cuisine}
                      {p.district ? ` · ${p.district}` : ""}
                    </span>
                  </span>
                  {value === p.id && <Check size={14} className="text-tomato shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FeedCard({ item }: { item: WallItem }) {
  const author = item.author;
  return (
    <li className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-2">
        {item.kind === "place_post" ? (
          <div className="grid place-items-center w-9 h-9 rounded-full bg-tomato/10 text-tomato">
            <Megaphone size={16} />
          </div>
        ) : (
          <UserAvatar
            avatarUrl={author?.avatar_url}
            avatarSource={author?.avatar_source}
            displayName={author?.display_name}
            username={author?.username}
            size={36}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            <HeaderLine item={item} />
          </div>
          <div className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</div>
        </div>
        <KindBadge kind={item.kind} />
      </div>
      {item.kind === "review" && (
        <div className="text-sm">
          {typeof item.rating === "number" && (
            <div className="flex items-center gap-1 text-tomato mb-1">
              <Star size={14} className="fill-current" />{" "}
              <span className="font-semibold">{item.rating}/5</span>
            </div>
          )}
          {item.text && <SmartText>{item.text}</SmartText>}
        </div>
      )}
      {item.kind === "place_post" && (
        <div className="text-sm">
          {item.meta && <div className="font-semibold mb-1">{item.meta}</div>}
          {item.text && <SmartText>{item.text}</SmartText>}
        </div>
      )}
      {item.kind === "post" && item.text && (
        <div className="text-sm">
          <SmartText>{item.text}</SmartText>
        </div>
      )}
      {item.kind === "achievement_group" && item.achievements && item.achievements.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.achievements.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 text-xs font-semibold"
            >
              <Trophy size={11} /> {a.name}
            </span>
          ))}
        </div>
      )}
      {item.kind === "list" && (
        <div>
          {item.text && <p className="text-sm text-muted-foreground mb-2">{item.text}</p>}
          {item.listPlaces && item.listPlaces.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.listPlaces.map((p) => (
                <div key={p.id} className="w-16 shrink-0 text-center">
                  <PlaceAvatarDot place={p as Place} size={56} />
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            to="/l/$id"
            params={{ id: item.socialRefId ?? "" }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-tomato hover:underline"
          >
            Zobacz całą listę ({item.listItemCount ?? 0}) <ChevronRight size={12} />
          </Link>
        </div>
      )}
      {item.kind === "challenge_complete" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <span className="text-xl">{item.challengeIcon || "🏆"}</span>
          Gratulacje, kolejne wyzwanie za Tobą!
        </div>
      )}
      {item.image_url && (
        <img
          src={item.image_url}
          alt=""
          className="mt-3 w-full max-h-72 object-cover rounded-xl"
          loading="lazy"
        />
      )}
      {item.kind === "review" && <ReviewSocial reviewId={item.id.replace(/^review-/, "")} />}
      {item.kind === "place_post" && <PostSocial postId={item.id.replace(/^pp-/, "")} />}
      {(item.kind === "favorite" ||
        item.kind === "achievement_group" ||
        item.kind === "post" ||
        item.kind === "list" ||
        item.kind === "challenge_complete") &&
        item.socialRefId && <WallSocial kind={item.kind} refId={item.socialRefId} />}
      <ShareRow item={item} />
    </li>
  );
}

function shareInfoFor(item: WallItem): { title: string; text: string; path: string } | null {
  const author = item.author?.display_name || item.author?.username || "Ktoś";
  if (item.kind === "review" && item.place)
    return {
      title: "poŻeramy",
      text: `${author} ocenił(a) ${item.place.name} na poŻeramy${typeof item.rating === "number" ? ` (${item.rating}/5)` : ""} 🍽️`,
      path: `/k/${item.place.slug ?? item.place.id}`,
    };
  if (item.kind === "place_post" && item.place)
    return {
      title: "poŻeramy",
      text: `Nowość w ${item.place.name}: ${item.meta ?? ""} 🍽️`,
      path: `/k/${item.place.slug ?? item.place.id}`,
    };
  if (item.kind === "post")
    return {
      title: "poŻeramy",
      text: `${author} na poŻeramy: „${item.text ?? ""}"`,
      path: item.place ? `/k/${item.place.slug ?? item.place.id}` : "/wall",
    };
  if (item.kind === "list")
    return {
      title: item.meta ?? "Lista na poŻeramy",
      text: `${author} poleca listę „${item.meta}" na poŻeramy 📋`,
      path: `/l/${item.socialRefId ?? ""}`,
    };
  if (item.kind === "challenge_complete")
    return {
      title: "poŻeramy",
      text: `${author} ukończył(a) wyzwanie „${item.meta}" na poŻeramy ${item.challengeIcon ?? "🏆"}`,
      path: "/wall",
    };
  return null;
}

function ShareRow({ item }: { item: WallItem }) {
  const info = shareInfoFor(item);
  if (!info) return null;

  async function share() {
    const url = `${window.location.origin}${info!.path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: info!.title, text: info!.text, url });
      } catch {
        // user cancelled the native share sheet - not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${info!.text} ${url}`);
      toast.success("Link skopiowany ✓");
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-tomato"
    >
      <Share2 size={12} /> Udostępnij
    </button>
  );
}

function PostSocial({ postId }: { postId: string }) {
  const { user } = useUser();
  const { data: reactions } = usePostReactions(postId);
  const toggle = useToggleReaction(postId);
  const { data: comments } = usePostComments(postId);
  const add = useAddPostComment(postId);
  const [text, setText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const myReaction = user
    ? (reactions ?? []).find((r) => r.user_id === user.id)?.reaction_type
    : undefined;

  const counts: Record<string, number> = {};
  (reactions ?? []).forEach((r) => (counts[r.reaction_type] = (counts[r.reaction_type] ?? 0) + 1));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || !user) return;
    try {
      await add.mutateAsync(v);
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się dodać komentarza");
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {REACTION_TYPES.map((t) => {
          const active = myReaction === t;
          return (
            <button
              key={t}
              disabled={toggle.isPending}
              onClick={() => {
                if (!user) {
                  toast.error("Zaloguj się, żeby reagować");
                  return;
                }
                toggle.mutate(t as ReactionType, {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Nie udało się dodać reakcji"),
                });
              }}
              className={`pz-reaction-pop chip text-sm disabled:opacity-60 disabled:pointer-events-none ${active ? "bg-tomato text-cream" : "bg-card border border-border hover:border-tomato"}`}
              aria-pressed={active}
              aria-label={`Reakcja ${t}`}
            >
              <span>{REACTION_EMOJI[t as ReactionType]}</span>
              {counts[t] ? <span className="text-xs font-semibold">{counts[t]}</span> : null}
            </button>
          );
        })}
        <button
          onClick={() => setShowComments((s) => !s)}
          className="chip bg-card border border-border hover:border-tomato text-sm"
          aria-expanded={showComments}
        >
          <MessageCircle size={12} /> {comments?.length ?? 0}
        </button>
      </div>
      {showComments && (
        <div className="space-y-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <UserAvatar
                avatarUrl={c.author?.avatar_url}
                avatarSource={
                  (c.author?.avatar_source ?? "initials") as "google" | "upload" | "initials"
                }
                displayName={c.author?.display_name}
                username={c.author?.username}
                size={24}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={vipNameStyle(c.author)}>
                  {c.author?.display_name ||
                    (c.author?.username ? `@${c.author.username}` : "Anonim")}
                </div>
                <SmartText>{c.body}</SmartText>
              </div>
            </div>
          ))}
          {user ? (
            <form onSubmit={submit} className="flex items-center gap-2 pt-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Napisz komentarz…"
                maxLength={500}
                className="flex-1 rounded-full bg-background border border-border px-3 py-1.5 text-sm outline-none focus:border-tomato"
              />
              <button
                type="submit"
                disabled={!text.trim() || add.isPending}
                className="rounded-full bg-tomato text-cream w-11 h-11 grid place-items-center disabled:opacity-50"
                aria-label="Wyślij komentarz"
              >
                <Send size={14} />
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">Zaloguj się, żeby komentować.</p>
          )}
        </div>
      )}
    </div>
  );
}

function HeaderLine({ item }: { item: WallItem }) {
  const a = item.author;
  const authorName = a?.display_name || (a?.username ? `@${a.username}` : "Znajomy");
  const authorLink = a?.username ? (
    <Link
      to="/u/$username"
      params={{ username: a.username }}
      className="hover:text-tomato"
      style={vipNameStyle(a)}
    >
      {authorName}
    </Link>
  ) : (
    <span style={vipNameStyle(a)}>{authorName}</span>
  );
  const placeLink = item.place ? (
    <Link
      to="/k/$id"
      params={{ id: item.place.slug ?? item.place.id }}
      className="hover:text-tomato"
    >
      {item.place.name}
    </Link>
  ) : null;
  if (item.kind === "review")
    return (
      <>
        {authorLink} ocenił(a) <strong>{placeLink}</strong>
      </>
    );
  if (item.kind === "favorite")
    return (
      <>
        {authorLink} dodał(a) <strong>{placeLink}</strong> do ulubionych
      </>
    );
  if (item.kind === "achievement_group") {
    const n = item.achievements?.length ?? 1;
    return (
      <>
        {authorLink} zdobył(a) {n > 1 ? `${n} odznaki` : "odznakę"}
        {n === 1 && item.achievements?.[0] ? (
          <>
            {" "}
            <strong>{item.achievements[0].name}</strong>
          </>
        ) : null}
      </>
    );
  }
  if (item.kind === "place_post")
    return (
      <>
        <strong>{placeLink}</strong> ma nowy wpis
      </>
    );
  if (item.kind === "post")
    return placeLink ? (
      <>
        {authorLink} jadł(a) w <strong>{placeLink}</strong>
      </>
    ) : (
      <>{authorLink} dodał(a) wpis</>
    );
  if (item.kind === "list")
    return (
      <>
        {authorLink} stworzył(a) listę <strong>{item.meta}</strong>
      </>
    );
  if (item.kind === "challenge_complete")
    return (
      <>
        {authorLink} ukończył(a) wyzwanie <strong>{item.meta}</strong>
      </>
    );
  return null;
}

function KindBadge({ kind }: { kind: WallItem["kind"] }) {
  const map = {
    review: {
      icon: <Star size={11} />,
      label: "Recenzja",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    favorite: { icon: <Heart size={11} />, label: "Ulubione", cls: "bg-pink-500/10 text-pink-500" },
    achievement_group: {
      icon: <Trophy size={11} />,
      label: "Odznaka",
      cls: "bg-purple-500/10 text-purple-500",
    },
    place_post: {
      icon: <Megaphone size={11} />,
      label: "Wpis lokalu",
      cls: "bg-tomato/10 text-tomato",
    },
    post: {
      icon: <UtensilsCrossed size={11} />,
      label: "Wpis",
      cls: "bg-navy/10 text-navy",
    },
    list: {
      icon: <ListChecks size={11} />,
      label: "Lista",
      cls: "bg-emerald-500/10 text-emerald-600",
    },
    challenge_complete: {
      icon: <Medal size={11} />,
      label: "Wyzwanie",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  } as const;
  const m = map[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
}
