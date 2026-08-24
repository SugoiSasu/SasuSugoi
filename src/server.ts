import "./lib/error-capture";

import * as Sentry from "@sentry/tanstackstart-react";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Vercel runs this module as a serverless function handler rather than a
// long-lived Node process, so the --import/instrument.server.mjs approach
// from Sentry's generic docs doesn't apply here - init once at module scope
// instead, which runs on cold start and is reused across warm invocations.
Sentry.init({
  dsn: "https://fa96f17e4abce686390d683db7cd91d8@o4511966886756352.ingest.de.sentry.io/4511966969921616",
});

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const swallowedError = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(swallowedError);
  Sentry.captureException(swallowedError);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
