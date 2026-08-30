import { useEffect } from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/use-auth";
import { useMyVisitStatuses, useToggleVisit, type VisitStatus } from "@/lib/visits-api";

// Split out of VisitStatus.tsx: this listener has no use for Tooltip/Radix, but
// living in the same file as VisitStatusButton (which does) meant importing it
// from the always-mounted __root.tsx dragged the whole Radix Tooltip/Popper
// implementation into the shared entry chunk that loads on every route.
export function VisitEventListener() {
  const { user } = useUser();
  const toggle = useToggleVisit();
  const { data: statuses } = useMyVisitStatuses();
  useEffect(() => {
    function onEvent(e: Event) {
      const ev = e as CustomEvent<{ placeId: string; status: VisitStatus }>;
      const { placeId, status } = ev.detail;
      if (!user) {
        toast.error("Zaloguj się, aby zapisywać listy lokali");
        return;
      }
      const isOn = statuses?.[placeId]?.has(status) ?? false;
      const next = !isOn;
      toggle.mutate(
        { placeId, status, on: next },
        {
          onSuccess: () =>
            toast.success(
              status === "want"
                ? next
                  ? "Dodano do „Chcę odwiedzić”"
                  : "Usunięto z „Chcę odwiedzić”"
                : next
                  ? "Oznaczono jako odwiedzone"
                  : "Cofnięto oznaczenie",
              { id: `visit-${status}-${placeId}` },
            ),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    }
    window.addEventListener("pz:toggle-visit", onEvent as EventListener);
    return () => window.removeEventListener("pz:toggle-visit", onEvent as EventListener);
  }, [user, toggle, statuses]);
  return null;
}
