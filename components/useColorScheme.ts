// Locked to light: the design targets the light look everywhere (web
// hardcodes light too), so phones in dark mode match instead of going gray.
export const useColorScheme = (): 'light' | 'dark' => {
  return 'light';
};
