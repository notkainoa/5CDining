import { pickCurrentMeal, type Meal, type MealPeriod } from './api.ts';

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

/** Typical Claremont service windows, used only when a hall publishes no times. */
const TYPICAL_MEAL_TIMES: Record<MealPeriod, { startTime: string; endTime: string }> = {
  breakfast: { startTime: '07:00', endTime: '10:30' },
  brunch: { startTime: '10:00', endTime: '14:00' },
  lunch: { startTime: '11:00', endTime: '14:00' },
  dinner: { startTime: '17:00', endTime: '20:00' },
  late_night: { startTime: '21:00', endTime: '23:59' },
};

/**
 * Hoch publishes meals without start/end times, so the live-meal picker would
 * always open Breakfast. When no meal on the menu has a time, fill in typical
 * windows from each meal's period. Menus with any published time pass through.
 */
export function withTypicalMealTimes(meals: Meal[]): Meal[] {
  if (meals.some((meal) => meal.startTime)) return meals;
  return meals.map((meal) => {
    const period = inferredMealPeriod(meal);
    return period ? { ...meal, ...TYPICAL_MEAL_TIMES[period] } : meal;
  });
}

/** First meal that lists at least one dish, else 0. Default for days other than today. */
export function firstMealWithDishes(meals: Meal[]): number {
  const i = meals.findIndex((meal) => meal.stations.some((station) => station.items.length > 0));
  return i >= 0 ? i : 0;
}

/**
 * Which meal a hall shows. A meal the user picked wins while it is still on the
 * menu. Otherwise today opens on the meal being served right now, or the next
 * one if nothing is being served, and other days open on the first meal with
 * dishes.
 */
export function mealIndexFor(
  meals: Meal[],
  {
    isToday,
    nowMinutes,
    pickedKey,
  }: { isToday: boolean; nowMinutes: number; pickedKey: string | null },
): number {
  if (meals.length === 0) return 0;
  if (pickedKey) {
    const picked = meals.findIndex((meal) => mealKey(meal) === pickedKey);
    if (picked >= 0) return picked;
  }
  return isToday
    ? pickCurrentMeal(withTypicalMealTimes(meals), nowMinutes)
    : firstMealWithDishes(meals);
}
