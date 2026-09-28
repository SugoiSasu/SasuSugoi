#!/usr/bin/env node
/**
 * Dym anonimowy: sprawdza, czy serwis dziala dla NIEZALOGOWANEGO.
 *
 * Powstal po awarii z 2026-09-27, kiedy strona glowna zwracala 500 przez cztery
 * doby... nie, przez kilkadziesiat minut - ale dla KAZDEGO niezalogowanego,
 * takze dla robotow wyszukiwarek. Przyczyna: polityki RLS nadane "TO anon"
 * wolaly funkcje, do ktorej rola `anon` nie ma prawa wykonania, wiec odczyt
 * konczyl sie bledem 42501 zamiast odfiltrowania wierszy.
 *
 * Caly wczesniejszy smoke test szedl na koncie zalogowanym - rola
 * `authenticated` mogla wolac te funkcje, wiec awaria byla niewidoczna.
 * Dlatego ten skrypt CELOWO nie loguje sie na nic: uzywa wylacznie klucza
 * publicznego, tak jak przegladarka goscia.
 *
 * Uzycie:
 *   node scripts/smoke-anon.mjs                  # produkcja
 *   node scripts/smoke-anon.mjs http://localhost:4173
 */
import fs from "node:fs";

const BAZOWY = process.argv[2] ?? "https://pozeramy.live";

function env() {
  if (!fs.existsSync(".env")) return process.env;
  const z = Object.fromEntries(
    fs
      .readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "").trim()];
      }),
  );
  return { ...z, ...process.env };
}

const e = env();
const SUPABASE = e.VITE_SUPABASE_URL || e.SUPABASE_URL;
const KLUCZ = e.VITE_SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_PUBLISHABLE_KEY;

const wyniki = [];
const zapisz = (nazwa, ok, szczegol = "") => {
  wyniki.push(ok);
  console.log(`${ok ? "OK  " : "BLAD"} ${nazwa}${szczegol ? ` -> ${szczegol}` : ""}`);
};

// 1. Trasy renderowane po stronie serwera. 500 tutaj znaczy, ze SSR sie wywrocil.
const TRASY = ["/", "/mapa", "/osiagniecia", "/moje-miejsca", "/wall", "/karty", "/u", "/wspolpraca", "/regulamin"];

// Karta lokalu i profil publiczny - to strony, na ktore trafia sie z Google i z
// udostepnionych linkow, wiec padniecie ich dla goscia boli najbardziej.
// Adresy dobierane na biezaco z bazy, a nie wpisane na sztywno.
let przykladowyLokal = null;
if (SUPABASE && KLUCZ) {
  try {
    const [lokal] = await fetch(
      `${SUPABASE}/rest/v1/places?select=id,slug&is_published=eq.true&limit=1`,
      { headers: { apikey: KLUCZ } },
    ).then((r) => r.json());
    if (lokal?.slug) {
      TRASY.push(`/k/${lokal.slug}`);
      przykladowyLokal = lokal;
    }
    const [profil] = await fetch(
      `${SUPABASE}/rest/v1/profiles?select=username&username=not.is.null&limit=1`,
      { headers: { apikey: KLUCZ } },
    ).then((r) => r.json());
    if (profil?.username) TRASY.push(`/u/${profil.username}`);
  } catch {
    // Brak dostepu do bazy nie moze zablokowac reszty testu.
  }
}
for (const t of TRASY) {
  try {
    const r = await fetch(`${BAZOWY}${t}`, { redirect: "manual" });
    zapisz(`GET ${t}`, r.status < 400, `HTTP ${r.status}`);
  } catch (err) {
    zapisz(`GET ${t}`, false, err.message);
  }
}

// 2. Czy strona glowna niesie prawdziwa tresc, a nie pusta skorupe ze statusem
//    200. Zapytania w stanie "error" w zrzucie react-query to dokladnie to, co
//    poprzedzilo awarie.
try {
  const html = await fetch(BAZOWY).then((r) => r.text());
  zapisz(
    "strona glowna ma lokale w HTML z serwera",
    /status:"success"/.test(html) && !/status:"error"/.test(html),
    /status:"error"/.test(html) ? "jakies zapytanie w stanie error" : "",
  );
} catch (err) {
  zapisz("strona glowna ma lokale w HTML z serwera", false, err.message);
}

// 2b. Wersja deployu - z niej aplikacja na telefonie wie, ze ma sie odswiezyc.
try {
  const r = await fetch(`${BAZOWY}/api/public/wersja`);
  const j = await r.json().catch(() => ({}));
  zapisz("GET /api/public/wersja (auto-odswiezanie aplikacji)", r.ok && typeof j.wersja === "string" && !!j.wersja, r.ok ? String(j.wersja) : `HTTP ${r.status}`);
} catch (err) {
  zapisz("GET /api/public/wersja (auto-odswiezanie aplikacji)", false, err.message);
}

// 3. Tabele czytane przez goscia - wprost przez PostgREST, kluczem publicznym.
if (SUPABASE && KLUCZ) {
  const TABELE = [
    ["places z zagniezdzonymi lokalizacjami", "places?select=id,locations:place_locations(id)&limit=1"],
    ["place_locations", "place_locations?select=id&limit=1"],
    ["place_photos", "place_photos?select=id&limit=1"],
    ["place_posts", "place_posts?select=id&limit=1"],
    ["ads", "ads?select=id&limit=1"],
    ["cuisines", "cuisines?select=id&limit=1"],
    ["achievements", "achievements?select=id&limit=1"],
  ];
  for (const [nazwa, sciezka] of TABELE) {
    try {
      const r = await fetch(`${SUPABASE}/rest/v1/${sciezka}`, { headers: { apikey: KLUCZ } });
      const tekst = await r.text();
      const blad = tekst.includes('"code"') && tekst.includes('"message"');
      zapisz(`anon czyta ${nazwa}`, r.ok && !blad, blad ? tekst.slice(0, 140) : "");
    } catch (err) {
      zapisz(`anon czyta ${nazwa}`, false, err.message);
    }
  }

  // 3b. Tabele tylko dla admina - gosc ma NIE dostac danych (propozycje z AI
  //     zawieraja nieprzejrzane dane lokali, w tym szkicow).
  const TYLKO_ADMIN = [["place_enrichment (propozycje AI)", "place_enrichment?select=place_id&limit=1"]];
  for (const [nazwa, sciezka] of TYLKO_ADMIN) {
    try {
      const r = await fetch(`${SUPABASE}/rest/v1/${sciezka}`, { headers: { apikey: KLUCZ } });
      const tekst = await r.text();
      const puste = r.ok && tekst.trim() === "[]";
      zapisz(`anon NIE czyta ${nazwa}`, !r.ok || puste, !r.ok || puste ? "" : tekst.slice(0, 140));
    } catch (err) {
      zapisz(`anon NIE czyta ${nazwa}`, false, err.message);
    }
  }

  // 4. Funkcje wolane z PRZEGLADARKI goscia. SSR moze zwrocic 200, a strona i tak
  //    rozsypie sie po stronie klienta, jesli ktoras straci prawo dla `anon` -
  //    samo sprawdzanie tras by tego nie zlapalo.
  const RPC = [
    ["alpha_gate_enabled (bramka - kazdy gosc)", "alpha_gate_enabled", {}],
    ["place_favorite_counts (liczniki na kartach)", "place_favorite_counts", {}],
    ["place_follow_counts (liczniki na kartach)", "place_follow_counts", {}],
    ["achievement_stats (rzadkosc odznak)", "achievement_stats", {}],
  ];
  if (przykladowyLokal) {
    RPC.push(["place_rating_breakdown (karta lokalu)", "place_rating_breakdown", { _place_id: przykladowyLokal.id }]);
  }
  for (const [nazwa, fn, args] of RPC) {
    try {
      const r = await fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: KLUCZ, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const tekst = await r.text();
      zapisz(`anon wola ${nazwa}`, r.ok, r.ok ? "" : tekst.slice(0, 140));
    } catch (err) {
      zapisz(`anon wola ${nazwa}`, false, err.message);
    }
  }
} else {
  console.log("UWAGA: brak VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY - pomijam odczyty z bazy");
}

const ok = wyniki.filter(Boolean).length;
console.log(`\npodsumowanie: ${ok}/${wyniki.length}`);
process.exit(ok === wyniki.length ? 0 : 1);
