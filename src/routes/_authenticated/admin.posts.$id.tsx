import { BackButton } from "@/components/BackButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { usePostById, useSavePost, slugify, type PostInput, type PostStatus } from "@/lib/posts-api";
import { usePlaces } from "@/lib/places-api";
import { uploadBlogImage } from "@/lib/blog-images";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_authenticated/admin/posts/$id")({
  component: EditPost,
});

function EditPost() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { data: post, isLoading } = usePostById(isNew ? undefined : id);
  const { data: places } = usePlaces();
  const save = useSavePost();
  const [preview, setPreview] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<PostInput>({
    slug: "",
    title: "",
    excerpt: "",
    content_md: "",
    cover_image_url: "",
    tags: [],
    status: "draft" as PostStatus,
    place_id: null,
  });

  useEffect(() => {
    if (post) {
      setForm({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? "",
        content_md: post.content_md,
        cover_image_url: post.cover_image_url ?? "",
        tags: post.tags,
        status: post.status,
        place_id: post.place_id,
      });
    }
  }, [post]);

  if (!isNew && isLoading) {
    return <div className="grid place-items-center py-20"><Loader2 className="animate-spin" size={28} /></div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!form.title.trim()) {
        toast.error("Tytuł nie może być pusty.");
        return;
      }
      if (!form.content_md.trim()) {
        toast.error("Treść nie może być pusta.");
        return;
      }
      let slug = (form.slug || slugify(form.title)).trim();
      if (!slug) slug = `wpis-${Date.now()}`;
      const savedId = await save.mutateAsync({
        id: isNew ? undefined : id,
        values: { ...form, slug },
      });
      toast.success("Zapisano");
      if (isNew) navigate({ to: "/admin/posts/$id", params: { id: savedId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd zapisu";
      console.error("Save post error:", err);
      if (msg.includes("duplicate") || msg.includes("blog_posts_slug_key")) {
        toast.error("Slug już istnieje — zmień adres URL wpisu.");
      } else {
        toast.error(msg);
      }
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadBlogImage(file);
      setForm((f) => ({ ...f, cover_image_url: url }));
      toast.success("Okładka wgrana");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd uploadu");
    } finally {
      setUploadingCover(false);
      if (e.target) e.target.value = "";
    }
  }

  function insertAtCursor(before: string, after = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = form.content_md.slice(start, end) || placeholder;
    const next =
      form.content_md.slice(0, start) + before + selected + after + form.content_md.slice(end);
    setForm((f) => ({ ...f, content_md: next }));
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + before.length + selected.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  async function handleInlineImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInline(true);
    try {
      const url = await uploadBlogImage(file);
      insertAtCursor(`\n\n![${file.name.split(".")[0]}](${url})\n\n`);
      toast.success("Zdjęcie wstawione do treści");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd uploadu");
    } finally {
      setUploadingInline(false);
      if (e.target) e.target.value = "";
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4"><BackButton to="/admin/posts" label="Wszystkie wpisy" /></div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="font-display text-3xl">{isNew ? "Nowy wpis" : "Edytuj wpis"}</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreview(!preview)} className="chip border border-border hover:border-tomato">
              <Eye size={14} /> {preview ? "Edytor" : "Podgląd"}
            </button>
            <button type="submit" disabled={save.isPending} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2 font-semibold hover:bg-tomato/90 transition disabled:opacity-50">
              {save.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Zapisz
            </button>
          </div>
        </div>

        <input
          required value={form.title}
          onChange={(e) => {
            const t = e.target.value;
            setForm((f) => ({ ...f, title: t, slug: f.slug || slugify(t) }));
          }}
          placeholder="Tytuł wpisu"
          className="w-full bg-transparent text-3xl font-display border-b-2 border-border focus:border-tomato outline-none py-2"
        />

        {preview ? (
          <article className="prose prose-neutral max-w-none bg-card border border-border rounded-2xl p-6 min-h-[400px] prose-headings:font-display prose-a:text-tomato prose-img:rounded-xl">
            {form.cover_image_url && <img src={form.cover_image_url} alt="" className="w-full rounded-xl mb-4" />}
            {form.excerpt && <p className="text-lg text-muted-foreground italic">{form.excerpt}</p>}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content_md || "*Pusty wpis…*"}</ReactMarkdown>
          </article>
        ) : (
          <>
            <textarea
              value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Krótki opis (excerpt) — pokazuje się na liście i w social media" rows={2}
              className="w-full input"
            />

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
                <ToolbarBtn title="Pogrubienie" onClick={() => insertAtCursor("**", "**", "tekst")}><Bold size={14} /></ToolbarBtn>
                <ToolbarBtn title="Kursywa" onClick={() => insertAtCursor("*", "*", "tekst")}><Italic size={14} /></ToolbarBtn>
                <span className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn title="Nagłówek H1" onClick={() => insertAtCursor("\n# ", "", "Nagłówek")}><Heading1 size={14} /></ToolbarBtn>
                <ToolbarBtn title="Nagłówek H2" onClick={() => insertAtCursor("\n## ", "", "Nagłówek")}><Heading2 size={14} /></ToolbarBtn>
                <span className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn title="Lista" onClick={() => insertAtCursor("\n- ", "", "punkt")}><List size={14} /></ToolbarBtn>
                <ToolbarBtn title="Lista numerowana" onClick={() => insertAtCursor("\n1. ", "", "punkt")}><ListOrdered size={14} /></ToolbarBtn>
                <ToolbarBtn title="Cytat" onClick={() => insertAtCursor("\n> ", "", "cytat")}><Quote size={14} /></ToolbarBtn>
                <span className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn title="Link" onClick={() => {
                  const url = prompt("Adres URL:");
                  if (url) insertAtCursor("[", `](${url})`, "tekst linku");
                }}><Link2 size={14} /></ToolbarBtn>
                <ToolbarBtn title="Wstaw URL zdjęcia" onClick={() => {
                  const url = prompt("URL zdjęcia:");
                  if (url) insertAtCursor(`\n\n![opis](${url})\n\n`);
                }}><ImageIcon size={14} /></ToolbarBtn>
                <ToolbarBtn
                  title="Wgraj zdjęcie z urządzenia"
                  onClick={() => inlineFileRef.current?.click()}
                  disabled={uploadingInline}
                >
                  {uploadingInline ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                </ToolbarBtn>
                <input
                  ref={inlineFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInlineImage}
                />
              </div>
              <textarea
                ref={textareaRef}
                required
                value={form.content_md}
                onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                placeholder="Treść wpisu (markdown: **bold**, # nagłówek, [link](url), ![alt](img))"
                rows={20}
                className="w-full bg-transparent px-4 py-3 font-mono text-sm outline-none resize-y"
              />
            </div>
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Slug (URL)">
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="input" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PostStatus })} className="input">
              <option value="draft">Szkic</option>
              <option value="published">Opublikowany</option>
            </select>
          </Field>
          <Field label="Okładka wpisu">
            <div className="space-y-2">
              {form.cover_image_url && (
                <img src={form.cover_image_url} alt="okładka" className="w-full h-32 object-cover rounded-lg border border-border" />
              )}
              <div className="flex gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-2 cursor-pointer chip border border-border hover:border-tomato">
                  {uploadingCover ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  {form.cover_image_url ? "Zmień okładkę" : "Wgraj z urządzenia"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                </label>
                {form.cover_image_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cover_image_url: "" })}
                    className="chip border border-border hover:border-destructive text-muted-foreground hover:text-destructive"
                  >
                    Usuń
                  </button>
                )}
              </div>
              <input
                value={form.cover_image_url ?? ""}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                placeholder="lub wklej URL"
                className="input text-xs"
              />
            </div>
          </Field>
          <Field label="Tagi (po przecinku)">
            <input
              value={form.tags.join(", ")}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="pizza, włoska, jeżyce" className="input"
            />
          </Field>
          <Field label="Powiązany lokal">
            <select value={form.place_id ?? ""} onChange={(e) => setForm({ ...form, place_id: e.target.value || null })} className="input">
              <option value="">— brak —</option>
              {(places ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
