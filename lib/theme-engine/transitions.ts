import type { Venue } from "@/types/venue";

type TransitionContext = {
  previous: Venue | null;
  candidate: Venue;
  stageType?: string | null;
};

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .flatMap((item) => item.split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function getVenueTypes(venue: Venue | null): string[] {
  if (!venue) return [];
  return normalizeStringList(venue.type);
}

function hasAny(types: string[], desired: string[]): boolean {
  return types.some((type) => desired.includes(type));
}

const MEAL_TYPES = ["breakfast", "brunch", "lunch", "dinner"];
const DAY_MEAL_TYPES = ["breakfast", "brunch", "lunch"];
const NIGHT_DRINK_TYPES = [
  "cocktail",
  "bar",
  "wine bar",
  "lounge",
  "speakeasy",
  "rooftop",
  "club",
];
const FITNESS_TYPES = ["fitness", "yoga", "pilates", "wellness"];
const SOFT_EXPLORATION_TYPES = [
  "gallery",
  "museum",
  "bookstore",
  "lifestyle",
  "showroom",
  "market",
  "park",
  "random gem",
];
const COFFEE_TYPES = ["coffee", "cafe", "café", "tea", "bakery"];
const WIND_DOWN_TYPES = ["dessert", "wine bar", "lounge", "tea"];

/**
 * Scores how naturally one venue follows another.
 *
 * Positive score = better sequence.
 * Negative score = awkward/repetitive sequence.
 *
 * This should influence ranking, not hard-block candidates.
 */
export function transitionScore({
  previous,
  candidate,
  stageType,
}: TransitionContext): number {
  if (!previous) return 0;

  const prevTypes = getVenueTypes(previous);
  const nextTypes = getVenueTypes(candidate);
  const desiredStage = stageType?.trim().toLowerCase() ?? "";

  let score = 0;

  const prevIsMeal = hasAny(prevTypes, MEAL_TYPES);
  const nextIsMeal = hasAny(nextTypes, MEAL_TYPES);

  const prevIsDayMeal = hasAny(prevTypes, DAY_MEAL_TYPES);
  const nextIsDayMeal = hasAny(nextTypes, DAY_MEAL_TYPES);

  const prevIsDinner = prevTypes.includes("dinner");
  const nextIsDinner = nextTypes.includes("dinner");

  const prevIsCoffee = hasAny(prevTypes, COFFEE_TYPES);
  const nextIsCoffee = hasAny(nextTypes, COFFEE_TYPES);

  const prevIsDrink = hasAny(prevTypes, NIGHT_DRINK_TYPES);
  const nextIsDrink = hasAny(nextTypes, NIGHT_DRINK_TYPES);

  const nextIsFitness = hasAny(nextTypes, FITNESS_TYPES);

  const nextIsExploration = hasAny(nextTypes, SOFT_EXPLORATION_TYPES);
  const nextIsWindDown = hasAny(nextTypes, WIND_DOWN_TYPES);

  /* ------------------------------------------------ */
  /* Strong positive transitions                      */
  /* ------------------------------------------------ */

  if (prevIsDinner && hasAny(nextTypes, ["cocktail", "bar", "wine bar", "lounge", "speakeasy"])) {
    score += 8;
  }

  if (prevIsDinner && nextTypes.includes("dessert")) {
    score += 7;
  }

  if (prevIsCoffee && nextIsExploration) {
    score += 5;
  }

  if (prevTypes.includes("gallery") && hasAny(nextTypes, ["bookstore", "lifestyle", "coffee", "café", "wine bar"])) {
    score += 4;
  }

  if (prevTypes.includes("bookstore") && hasAny(nextTypes, ["coffee", "café", "tea", "park", "wine bar"])) {
    score += 4;
  }

  if (prevTypes.includes("park") && hasAny(nextTypes, ["brunch", "lunch", "coffee", "market"])) {
    score += 4;
  }

  if (prevTypes.includes("market") && hasAny(nextTypes, ["lunch", "coffee", "park", "wine bar"])) {
    score += 3;
  }

  if (prevIsDrink && hasAny(nextTypes, ["rooftop", "speakeasy", "lounge", "club", "music"])) {
    score += 5;
  }

  if (prevTypes.includes("cocktail") && hasAny(nextTypes, ["rooftop", "speakeasy", "lounge"])) {
    score += 5;
  }

  if (prevTypes.includes("wine bar") && hasAny(nextTypes, ["dinner", "cocktail", "dessert", "lounge"])) {
    score += 4;
  }

  if (prevTypes.includes("activity") && hasAny(nextTypes, ["lunch", "dinner", "coffee", "bar"])) {
    score += 4;
  }

  if (prevTypes.includes("fitness") && hasAny(nextTypes, ["coffee", "juice", "breakfast", "brunch", "lunch"])) {
    score += 6;
  }

  if (prevTypes.includes("yoga") && hasAny(nextTypes, ["coffee", "tea", "breakfast", "brunch", "juice"])) {
    score += 5;
  }

  /* ------------------------------------------------ */
  /* Repetition penalties                             */
  /* ------------------------------------------------ */

  if (prevIsDinner && nextIsDinner) {
    score -= 10;
  }

  if (prevIsDayMeal && nextIsDayMeal) {
    score -= 8;
  }

  if (prevIsCoffee && nextIsCoffee) {
    score -= 6;
  }

  if (prevIsDrink && nextIsDrink) {
    score -= 2;
  }

  if (prevTypes.includes("gallery") && nextTypes.includes("gallery")) {
    score -= 5;
  }

  if (prevTypes.includes("bookstore") && nextTypes.includes("bookstore")) {
    score -= 5;
  }

  if (prevTypes.includes("club") && nextTypes.includes("club")) {
    score -= 6;
  }

  if (prevTypes.includes("rooftop") && nextTypes.includes("rooftop")) {
    score -= 5;
  }

  /* ------------------------------------------------ */
  /* Awkward sequence penalties                       */
  /* ------------------------------------------------ */

  if (prevIsDinner && nextIsCoffee) {
    score -= 4;
  }

  if (prevIsDrink && nextIsDinner && desiredStage !== "dinner") {
    score -= 4;
  }

  if (prevTypes.includes("club") && nextIsMeal && desiredStage !== "late-night") {
    score -= 5;
  }

  if (prevTypes.includes("dessert") && nextIsMeal) {
    score -= 6;
  }

  if (prevTypes.includes("fitness") && hasAny(nextTypes, ["club", "speakeasy", "cocktail"])) {
    score -= 4;
  }

  if (
    nextIsFitness &&
    (
      prevIsDrink ||
      prevIsDinner ||
      prevTypes.includes("dessert") ||
      prevTypes.includes("club") ||
      prevTypes.includes("rooftop")
    )
  ) {
    score -= 25;
  }

  if (
    nextIsFitness &&
    !["fitness", "yoga", "pilates", "wellness", "morning"].includes(desiredStage)
  ) {
    score -= 20;
  }

  /* ------------------------------------------------ */
  /* Stage-alignment nudges                           */
  /* ------------------------------------------------ */

  if (desiredStage && nextTypes.includes(desiredStage)) {
    score += 2;
  }

  if (
    desiredStage === "cocktail" &&
    prevIsDinner &&
    hasAny(nextTypes, ["cocktail", "bar", "lounge", "speakeasy", "rooftop"])
  ) {
    score += 4;
  }

  if (
    desiredStage === "dessert" &&
    prevIsDinner &&
    nextTypes.includes("dessert")
  ) {
    score += 4;
  }

  if (
    desiredStage === "dinner" &&
    prevIsMeal &&
    nextIsDinner
  ) {
    score -= 5;
  }

  return score;
}

/**
 * Applies transition-aware score adjustment to a candidate.
 */
export function applyTransitionScore<T extends Venue>(
  candidate: T,
  previous: Venue | null,
  stageType?: string | null
): T {
  const bonus = transitionScore({
    previous,
    candidate,
    stageType,
  });

  return {
    ...candidate,
    _score: (candidate._score ?? 0) + bonus,
  };
}