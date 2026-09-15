import McConnellPage from '@/app/(tabs)/mcconnell';
import FraryPage from '@/app/(tabs)/frary';
import HochPage from '@/app/(tabs)/hoch';
import MalottPage from '@/app/(tabs)/malott';
import CollinsPage from '@/app/(tabs)/collins';
import FrankPage from '@/app/(tabs)/frank';
import OldenborgPage from '@/app/(tabs)/oldenborg';

/**
 * Hall page components by id, shared by the native pager
 * (`app/(tabs)/_layout.tsx`) and the URL-less edition (`FrozenHalls`).
 * Add new halls here so both editions stay in sync.
 */
export const HALL_PAGES = {
  mcconnell: McConnellPage,
  frary: FraryPage,
  hoch: HochPage,
  malott: MalottPage,
  collins: CollinsPage,
  frank: FrankPage,
  oldenborg: OldenborgPage,
} as const;

export type HallPageKey = keyof typeof HALL_PAGES;
