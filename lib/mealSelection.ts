import type { Meal, MealPeriod } from './api';

export interface MealSelectionIntent {
  /** Exact service identity, normalized from the dining hall's published name. */
  service: string;
  /** Shared service period used only when another hall has no exact-name match. */
  period: MealPeriod | null;
}

export interface AutomaticMealObservation {
  service: MealSelectionIntent | null;
  menuDate: string | null;
  selectedDate: string;
  isActiveHall: boolean;
  isToday: boolean;
}

/** Meal identity within and across menu refreshes: case/whitespace-insensitive name. */
export function normalizeMealName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Exact service identity. Do not use `period` here: a hall can publish both
 * Breakfast and Continental Breakfast with the same breakfast period.
 */
export function mealKey(meal: Meal): string {
  return normalizeMealName(meal.name) || meal.period || '';
}

function inferredMealPeriod(meal: Meal): MealPeriod | null {
  if (meal.period) return meal.period;

  switch (mealKey(meal).replaceAll('-', ' ')) {
    case 'breakfast':
    case 'continental':
    case 'continental breakfast':
      return 'breakfast';
    case 'brunch':
      return 'brunch';
    case 'lunch':
      return 'lunch';
    case 'dinner':
      return 'dinner';
    case 'late night':
      return 'late_night';
    default:
      return null;
  }
}

export function mealSelectionIntent(meal: Meal): MealSelectionIntent {
  return { service: mealKey(meal), period: inferredMealPeriod(meal) };
}

export function sameMealSelection(
  left: MealSelectionIntent | null,
  right: MealSelectionIntent | null,
): boolean {
  return left?.service === right?.service && left?.period === right?.period;
}

const ADJACENT_PERIODS: Partial<Record<MealPeriod, MealPeriod[]>> = {
  breakfast: ['brunch'],
  brunch: ['lunch', 'breakfast'],
  lunch: ['brunch'],
};

export function mealIndexForSelection(
  meals: Meal[],
  selectedMeal: MealSelectionIntent | null,
  autoIndex: number,
): number {
  if (meals.length === 0) return 0;
  if (selectedMeal) {
    const exact = meals.findIndex((meal) => mealKey(meal) === selectedMeal.service);
    if (exact >= 0) return exact;

    if (selectedMeal.period) {
      const samePeriod = meals.findIndex(
        (meal) => inferredMealPeriod(meal) === selectedMeal.period,
      );
      if (samePeriod >= 0) return samePeriod;

      for (const adjacentPeriod of ADJACENT_PERIODS[selectedMeal.period] ?? []) {
        const adjacent = meals.findIndex((meal) => inferredMealPeriod(meal) === adjacentPeriod);
        if (adjacent >= 0) return adjacent;
      }
    }
  }
  return autoIndex;
}

function isCurrentAutomaticObservation(
  observation: AutomaticMealObservation | null,
): observation is AutomaticMealObservation & { service: MealSelectionIntent } {
  return Boolean(
    observation?.isActiveHall &&
    observation.isToday &&
    observation.menuDate === observation.selectedDate &&
    observation.service,
  );
}

/**
 * Reconcile the shared automatic intent with what the active hall currently serves.
 * A first menu arrival or hall activation establishes a baseline and keeps any
 * carried cross-hall intent. A continuously observed active hall advances only
 * when the actual service changes, including a menu refresh at the same index.
 */
export function automaticMealSelection({
  previous,
  current,
  selectedMeal,
  selectionIsManual,
}: {
  previous: AutomaticMealObservation | null;
  current: AutomaticMealObservation;
  selectedMeal: MealSelectionIntent | null;
  selectionIsManual: boolean;
}): MealSelectionIntent | null {
  if (selectionIsManual || !isCurrentAutomaticObservation(current)) return selectedMeal;
  if (!selectedMeal) return current.service;

  const continuedActiveObservation =
    isCurrentAutomaticObservation(previous) && previous.selectedDate === current.selectedDate;
  if (!continuedActiveObservation) return selectedMeal;

  return sameMealSelection(previous.service, current.service) ? selectedMeal : current.service;
}

export function shouldClearMealSelection({
  windowShifted,
  selectedDateKept,
}: {
  windowShifted: boolean;
  selectedDateKept: boolean;
}): boolean {
  return windowShifted && !selectedDateKept;
}
