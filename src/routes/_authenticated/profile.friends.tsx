import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile/friends")({
  beforeLoad: () => {
    throw redirect({ to: "/friends" });
  },
});
