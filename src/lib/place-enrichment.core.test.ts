import { describe, it, expect } from "vitest";
import { bezpiecznyUrl, kandydaciZHtml, oczyscGodziny } from "@/lib/place-enrichment.core";

describe("oczyscGodziny", () => {
  it("null = zamkniete: dzien znika, jak w bazie", () => {
    expect(oczyscGodziny({ mon: null, tue: { open: "12:00", close: "20:00" } })).toEqual({
      tue: { open: "12:00", close: "20:00" },
    });
  });

  it("dopelnia godzine jednocyfrowa i zamienia 24:00 na 00:00", () => {
    expect(oczyscGodziny({ fri: { open: "9:00", close: "24:00" } })).toEqual({
      fri: { open: "09:00", close: "00:00" },
    });
  });

  it("odrzuca smieci i otwarcie == zamkniecie (apka pokazalaby cala dobe)", () => {
    expect(oczyscGodziny({ mon: { open: "12", close: "20:00" }, tue: { open: "18:00", close: "18:00" } })).toBeUndefined();
  });

  it("brak danych = brak propozycji", () => {
    expect(oczyscGodziny(undefined)).toBeUndefined();
    expect(oczyscGodziny({})).toBeUndefined();
  });
});

describe("bezpiecznyUrl", () => {
  it("przepuszcza zwykle strony", () => {
    expect(bezpiecznyUrl("https://yubapoznan.pl/")).not.toBeNull();
  });

  it("blokuje adresy wewnetrzne i inne protokoly", () => {
    for (const u of [
      "http://localhost:3000/x.png",
      "http://127.0.0.1/x.png",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x",
      "file:///etc/passwd",
      "ftp://example.com/a.png",
      "nie-url",
    ]) {
      expect(bezpiecznyUrl(u), u).toBeNull();
    }
  });
});

describe("kandydaciZHtml", () => {
  const html = `
    <head>
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel="apple-touch-icon" href="/apple-180.png" sizes="180x180">
      <meta property="og:image" content="https://cdn.example.com/og.jpg?a=1&amp;b=2">
    </head>
    <body>
      <img class="site-logo" src="/img/logo.png">
      <img src="/img/pierogi.jpg" alt="pierogi">
    </body>`;

  it("logo z <img>, ikony od najwiekszej, og:image; adresy bezwzgledne", () => {
    expect(kandydaciZHtml(html, "https://lokal.pl/o-nas").map((k) => k.url)).toEqual([
      "https://lokal.pl/img/logo.png",
      "https://lokal.pl/apple-180.png",
      "https://lokal.pl/favicon-32.png",
      "https://cdn.example.com/og.jpg?a=1&b=2",
    ]);
  });

  it("zwykle zdjecia bez 'logo' pomija", () => {
    expect(kandydaciZHtml(html, "https://lokal.pl/").some((k) => k.url.includes("pierogi"))).toBe(false);
  });
});
