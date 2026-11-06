export const APP_NAME = "2K27";
export const APP_TAGLINE = "Today's wilest anonymous comedy, published daily.";

export const NAV_ITEMS = [
  { href: "/", label: "Home", shortLabel: "Home" },
  { href: "/submit", label: "Submit", shortLabel: "Submit" },
  { href: "/hall-of-fame", label: "Hall of Fame", shortLabel: "Fame" },
  { href: "/profile", label: "Profile", shortLabel: "Profile" },
] as const;

export type SubmissionCategory = "compliment" | "roast" | "joke" | "observation";

export const CATEGORY_LABELS: Record<SubmissionCategory, string> = {
  compliment: "Compliment",
  roast: "Roast",
  joke: "Joke",
  observation: "Observation",
};

export const CATEGORY_DESCRIPTIONS: Record<SubmissionCategory, string> = {
  compliment: "Something kind, sharp, or unexpectedly wholesome.",
  roast: "Playful fire. Funny > cruel.",
  joke: "Original one-liners, bits and observations.",
  observation: "A brutally accurate look at school life.",
};

export const MAX_CONTENT_LENGTH = 500;
export const MIN_CONTENT_LENGTH = 3;

/** Submission limits — enforced server-side, configurable in one place. */
export const SUBMISSION_LIMITS = {
  maxPerDay: 5,
  maxPerRecipientPerDay: 2,
} as const;

export const COMMUNITY_RULES = [
  {
    title: "No threats or intimidation",
    body: "No violence, no doxxing, no stalking. Period.",
  },
  {
    title: "No discriminatory slurs",
    body: "Protected-group insults get removed on sight.",
  },
  {
    title: "No targeted harassment",
    body: "One sharp joke is comedy. Repeated pile-ons are bullying.",
  },
  {
    title: "Keep it fresh",
    body: "No recycling last week's bit. Originality wins.",
  },
] as const;
