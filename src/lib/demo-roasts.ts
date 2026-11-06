/**
 * Demo "class roast" data — an easter-egg joke section (see DECISIONS D15).
 * This is user-provided class-humour content, NOT real submissions: it never
 * enters the database, never appears in the real feed, and each card vanishes
 * the moment a visitor interacts with it.
 *
 * Excluded for violating our own community rules (protected-group/gendered
 * mockery): the "Fulani man" ethnic reference, and the Stephanie/Divine
 * gendered lines. The non-ethnic portion of Ella's roast was kept.
 */
export interface DemoRoastSet {
  name: string;
  insults: string[];
}

export const DEMO_ROASTS: DemoRoastSet[] = [
  {
    name: "Umejuru Daniel Chuckwuekele",
    insults: [
      "You are an irrespetful bastard",
      "You are an inconsequential dummy who needs to take a 3 week haitus from being smart",
    ],
  },
  {
    name: "Chino Goodnews",
    insults: ["You are an inconsequential dummy who needs to take a 3 week haitus from being smart"],
  },
  { name: "Kelechi Kamsi", insults: ["Stop laughing like a hyena"] },
  { name: "Investor Joemoney", insults: ["Get a life"] },
  { name: "Iyobosa", insults: ["Yep we've heard it enough times we know you hate your phone"] },
  { name: "Rafiki", insults: ["Meet Wu Kong for advice"] },
  { name: "KD", insults: ["Ceaser, you and king kong should go to club once in a while"] },
  { name: "Big Sam", insults: ["Bro go bathe, no dey smell"] },
  { name: "Gospel", insults: ["Bro go bathe, no dey smell, go brush"] },
  { name: "Ataene", insults: ["Leave prick"] },
  {
    name: "Ella Uguwadu",
    insults: ["u no go ever get sense; armpit of uniform na brown; you look like Angel in SS2."],
  },
];

/** Case-insensitive, whitespace-tolerant lookup (mirrors the original script). */
export function findRoasts(raw: string): DemoRoastSet | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return DEMO_ROASTS.find((set) => set.name.toLowerCase() === normalized) ?? null;
}
