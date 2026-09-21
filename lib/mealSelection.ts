import type { Meal } from './api';

/** Meal identity across halls: case/whitespace-insensitive name. */
export function normalizeMealName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function mealKey(meal: Meal): string {
  if (meal.period) return meal.period;

  const name = normalizeMealName(meal.name);
  if (name === 'continental' || name === 'continental breakfast') return 'breakfast';
  if (name === 'late night' || name === 'late-night') return 'late_night';
  return name;
}

const EQUIVALENT_MEALS: Partial<Record<string, string[]>> = {
  breakfast: ['brunch'],
  brunch: ['lunch', 'breakfast'],
  lunch: ['brunch'],
};

export function mealIndexForSelection(
  meals: Meal[],
  selectedMeal: string | null,
  autoIndex: number,
): number {
  if (meals.length === 0) return 0;
  if (selectedMeal) {
    const exact = meals.findIndex((meal) => mealKey(meal) === selectedMeal);
    if (exact >= 0) return exact;

    for (const equivalent of EQUIVALENT_MEALS[selectedMeal] ?? []) {
      const match = meals.findIndex((meal) => mealKey(meal) === equivalent);
      if (match >= 0) return match;
    }
  }
  return autoIndex;
}

export function automaticMealSelection({
  meals,
  selectedMeal,
  autoIndex,
  autoIndexChanged,
  selectionIsManual,
  isActiveHall,
  isCurrentMenu,
  isToday,
}: {
  meals: Meal[];
  selectedMeal: string | null;
  autoIndex: number;
  autoIndexChanged: boolean;
  selectionIsManual: boolean;
  isActiveHall: boolean;
  isCurrentMenu: boolean;
  isToday: boolean;
}): string | null {
  if (
    selectionIsManual ||
    !isActiveHall ||
    !isCurrentMenu ||
    !isToday ||
    meals.length === 0 ||
    (selectedMeal && !autoIndexChanged)
  ) {
    return selectedMeal;
  }
  return mealKey(meals[autoIndex] ?? meals[0]);
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
