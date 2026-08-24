import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Lightbulb } from "lucide-react";
import { submitPlaceSuggestion } from "@/lib/place-suggestions.functions";
import { useCuisines } from "@/lib/cuisines-api";
import { trackEvent } from "@/lib/analytics";

export function SuggestPlacePanel() {
  const [open, setOpen] = useState(false);
  const { data: cuisines } = useCuisines();
  const submitFn = useServerFn(submitPlaceSuggestion);
  const submit = useMutation({ mutationFn: submitFn });
  const [form, setForm] = useState({
    name: "", address: "", cuisine: "", website: "", instagram: "", notes: "",
    submitter_name: "", submitter_email: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const openedAtRef = useRef<number | null>(null);

  function handleToggle() {
    setOpen((v) => {
      if (!v) openedAtRef.current = Date.now();
      return !v;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await submit.mutateAsync({
        data: {
          ...form,
          honeypot,
          elapsed_ms: openedAtRef.current ? Date.now() - openedAtRef.current : 0,
        },
      });
      toast.success("Dzięki! Zgłoszenie trafiło do redakcji 🍽️");
      trackEvent("place_suggestion_submit", { cuisine: form.cuisine || undefined });
      setForm({ name: "", address: "", cuisine: "", website: "", instagram: "", notes: "", submitter_name: "", submitter_email: "" });
      setHoneypot("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się wysłać");
    }
  }

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 my-8">
      <div className="rounded-3xl border-2 border-tomato/30 bg-tomato/5 p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-tomato text-cream grid place-items-center flex-shrink-0">
            <Lightbulb size={22} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="font-display text-2xl leading-tight mb-1">Nie widzisz jakiejś knajpy?</h2>
            <p className="text-sm text-muted-foreground">
              Wypełnij formularz, a my sprawdzimy zgłoszenie!
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
          >
            {open ? "Zamknij" : "Zgłoś lokal"}
          </button>
        </div>

        {open && (
          <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <label className="block sm:col-span-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Nazwa lokalu *</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Adres</span>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ul. ..., Poznań" className="input" />
            </label>
            <label className="block">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Kuchnia</span>
              <select value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} className="input">
                <option value=""> - wybierz - </option>
                {(cuisines ?? []).filter((c) => c.enabled).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Instagram (opcjonalnie)</span>
              <input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@lokal" className="input" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Strona www</span>
              <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." className="input" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Uwagi / co warto zamówić?</span>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Twoje imię (opcjonalnie)</span>
              <input value={form.submitter_name} onChange={(e) => setForm({ ...form, submitter_name: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Email (żebyśmy dali znać)</span>
              <input type="email" value={form.submitter_email} onChange={(e) => setForm({ ...form, submitter_email: e.target.value })} className="input" />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={submit.isPending || !form.name.trim()} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-6 py-3 font-semibold disabled:opacity-50">
                {submit.isPending ? <><Loader2 className="animate-spin" size={16} /> Wysyłam…</> : <><Send size={16} /> Wyślij zgłoszenie</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
