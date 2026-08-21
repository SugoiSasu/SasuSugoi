import { useEffect, useState } from "react";
import { X, Copy, Check, Send, MessageCircle, Facebook, Instagram, Music2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { VipReferralProgress } from "@/components/VipReferralProgress";

const SHARE_TEXT = "Dołącz do mnie na poŻeramy - znajdźmy razem najlepsze knajpy w Poznaniu!";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
}

export function InviteFriendsModal({ open, onClose, url }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link skopiowany ✓");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  }

  function openAppShare(kind: "instagram" | "tiktok") {
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Link skopiowany - wklej go w " + (kind === "instagram" ? "Instagramie" : "TikToku"));
    window.open(kind === "instagram" ? "https://instagram.com" : "https://tiktok.com", "_blank", "noreferrer");
  }

  const encodedText = encodeURIComponent(SHARE_TEXT);
  const encodedUrl = encodeURIComponent(url);

  const shareTargets = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      color: "bg-[#25D366]",
      onClick: () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, "_blank", "noreferrer"),
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      color: "bg-[#1877F2]",
      onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank", "noreferrer"),
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      color: "bg-[#26A5E4]",
      onClick: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, "_blank", "noreferrer"),
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: Instagram,
      color: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
      onClick: () => openAppShare("instagram"),
    },
    {
      key: "tiktok",
      label: "TikTok",
      icon: Music2,
      color: "bg-navy",
      onClick: () => openAppShare("tiktok"),
    },
    {
      key: "sms",
      label: "SMS",
      icon: Phone,
      color: "bg-emerald-500",
      onClick: () => { window.location.href = `sms:?body=${encodedText}%20${encodedUrl}`; },
    },
    {
      key: "mail",
      label: "Mail",
      icon: Mail,
      color: "bg-tomato",
      onClick: () => { window.location.href = `mailto:?subject=${encodeURIComponent("Sprawdź poŻeramy!")}&body=${encodedText}%20${encodedUrl}`; },
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-navy/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zaproś znajomych"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-cream text-navy shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out"
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="font-display text-2xl">Zaproś znajomych</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-navy/5 hover:text-navy"
          >
            <X size={16} />
          </button>
        </div>
        <p className="px-6 pt-1 text-sm text-muted-foreground">
          Wyślij link znajomym - dostaniesz punkty i odznaki, kiedy dołączą.
        </p>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-card p-2 pl-4 shadow-sm transition-shadow duration-200 focus-within:border-tomato">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{url}</span>
            <button
              type="button"
              onClick={copyLink}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                copied ? "bg-emerald-500 text-white" : "bg-tomato text-cream hover:bg-tomato/90 hover:shadow-md"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Skopiowano" : "Kopiuj"}
            </button>
          </div>
        </div>

        <div className="px-6 pt-3">
          <VipReferralProgress compact />
        </div>

        <div className="grid grid-cols-4 gap-3 px-6 py-6">
          {shareTargets.map(({ key, label, icon: Icon, color, onClick }, i) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              style={{ animationDelay: `${i * 40}ms` }}
              className="group flex flex-col items-center gap-1.5 animate-in fade-in zoom-in-95 duration-300 ease-out fill-mode-both"
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-110 group-hover:shadow-lg group-active:scale-95 ${color}`}
              >
                <Icon size={20} />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
