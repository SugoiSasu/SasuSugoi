import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Zwykła",
  rare: "Rzadka",
  epic: "Epicka",
  legendary: "Legendarna",
};

/** Od najrzadszej - kolejnosc sortowania "Rzadkość" i kolejnosc w podsumowaniu. */
export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];

/** Kolory z paczki: zloty / fiolet / teal / wygaszony granat. */
export const RARITY_DOT: Record<Rarity, string> = {
  legendary: "bg-mustard",
  epic: "bg-[oklch(66%_0.1_300)]",
  rare: "bg-[oklch(66%_0.09_190)]",
  common: "bg-muted-foreground/45",
};

export interface AchievementStat {
  achievement_id: string;
  holders: number;
  total_players: number;
}

/**
 * Ponizej tylu graczy odsetek posiadaczy nie niesie informacji, tylko szum.
 *
 * Przy 10 kontach jeden posiadacz to 10%, wiec nic nie zejdzie ponizej progu
 * legendarnego, a odznaka, ktorej nie ma jeszcze NIKT, wyszlaby na 0% - czyli
 * najrzadsza z mozliwych. Na dzis tak wypadloby 61 z 71 odznak.
 *
 * Probowalem to obejsc, licząc rzadkosc z trudnosci progu zamiast z odsetka -
 * i to tez nie dziala: 30 z ~34 kryteriow ma po JEDNEJ odznace
 * (reviews_cuisine_pizza, same_district_reviews, review_likes_total...), wiec
 * nie ma ich z czym porownac i 64 z 71 wychodzilo "Zwykła". Taka etykieta
 * wyglada jak klasyfikacja, a jest brakiem klasyfikacji.
 *
 * Dlatego dopoki graczy jest za malo, rzadkosc jest po prostu NIEZNANA
 * (rarityOf zwraca null), a interfejs jej nie pokazuje.
 */
export const MIN_PROBKA_GRACZY = 100;

const PROG_ODSETEK: [Rarity, number][] = [
  ["legendary", 1],
  ["epic", 5],
  ["rare", 20],
];

/**
 * Rzadkosc odznaki liczona z odsetka graczy, ktorzy ja maja - sama sie
 * aktualizuje w miare przybywania kont, nikt nie wklepuje jej dla 71 odznak.
 *
 * `null` oznacza "za malo danych, zeby cokolwiek powiedziec".
 */
export function rarityOf(stat: AchievementStat | undefined): Rarity | null {
  if (!stat || stat.total_players < MIN_PROBKA_GRACZY) return null;
  const odsetek = (stat.holders / stat.total_players) * 100;
  for (const [poziom, prog] of PROG_ODSETEK) if (odsetek <= prog) return poziom;
  return "common";
}

/** Czy w ogole warto pokazywac warstwe rzadkosci (kropki, podzial, sortowanie). */
export function rarityDostepna(stats: Map<string, AchievementStat> | undefined): boolean {
  const pierwszy = stats?.values().next().value;
  return !!pierwszy && pierwszy.total_players >= MIN_PROBKA_GRACZY;
}

export function useAchievementStats() {
  return useQuery({
    queryKey: ["achievement-stats"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, AchievementStat>> => {
      const { data, error } = await supabase.rpc("achievement_stats");
      if (error) throw error;
      const m = new Map<string, AchievementStat>();
      for (const row of (data ?? []) as AchievementStat[]) {
        m.set(row.achievement_id, {
          achievement_id: row.achievement_id,
          holders: Number(row.holders),
          total_players: Number(row.total_players),
        });
      }
      return m;
    },
  });
}

/** "Ma ją 3% poŻeraczy" - tylko gdy probka cos znaczy. */
export function odsetekGraczyLabel(stat: AchievementStat | undefined): string | null {
  if (!stat || stat.total_players < MIN_PROBKA_GRACZY) return null;
  const odsetek = (stat.holders / stat.total_players) * 100;
  const zaokr = odsetek < 1 && odsetek > 0 ? odsetek.toFixed(1) : Math.round(odsetek);
  return `Ma ją ${zaokr}% poŻeraczy`;
}
