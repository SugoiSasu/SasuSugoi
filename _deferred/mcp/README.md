# MCP endpoint — tymczasowo wyłączony

Te pliki obsługiwały endpoint `pozeramy.live/mcp` przez `@lovable.dev/mcp-js`
(sekcja 5.3 `PROJECT_BRIEF.md`). Wyłączone na życzenie Mateusza podczas
migracji ze scaffoldu Lovable — priorytet ma najpierw główna aplikacja.

Żeby przywrócić:
1. Zdecydować: własna implementacja przez `@modelcontextprotocol/sdk`, czy
   inny transport HTTP dla `lib/mcp/tools/*` (logika narzędzi jest gotowa,
   tylko `defineTool`/`defineMcp` z `@lovable.dev/mcp-js` trzeba zastąpić).
2. Przenieść `lib/mcp/**` z powrotem do `src/lib/mcp/**`.
3. Przenieść `routes/**` z powrotem do odpowiadających ścieżek w `src/routes/`
   (`mcp.ts`, `[.mcp]/list-tools.ts`, `[.mcp]/invoke-tool/$tool.ts`,
   `[.well-known]/oauth-protected-resource.ts`).
4. Napisać transport HTTP (SDK Anthropica albo ręcznie) w miejscu
   `createTanStackMcpHandler` i pokrewnych helperów z `@lovable.dev/mcp-js`.
