import { createFileRoute, redirect } from "@tanstack/react-router";

// /zaproszenie/$token used to be a second, parallel invite-landing
// implementation (separate client API, separate accept flow) from /i/$token.
// Consolidated onto /i/$token - this route now just redirects so any
// already-shared /zaproszenie links keep working.
export const Route = createFileRoute("/zaproszenie/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/i/$token", params: { token: params.token } });
  },
});
