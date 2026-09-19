import { requireOptionalNativeModule } from 'expo';
import type { ImageSourcePropType } from 'react-native';

export type AppIconId =
  'main' | 'plain' | 'anthropic' | 'halls' | 'spark' | 'book' | 'bowl' | 'loc' | 'stack' | 'window';
type AlternateAppIconId = Exclude<AppIconId, 'main'>;

export interface AppIconOption {
  id: AppIconId;
  label: string;
  source: ImageSourcePropType;
}

interface AwesomeAppIconModule {
  supportsAlternateIcons(): boolean;
  getAvailableIcons(): string[];
  getAppIcon(): string | null;
  setAppIconAsync(iconName: string | null): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<AwesomeAppIconModule>('AwesomeAppIcon');

export const APP_ICONS: readonly AppIconOption[] = [
  { id: 'main', label: 'Main', source: require('@/assets/images/icon_main.png') },
  { id: 'plain', label: 'Plain', source: require('@/assets/images/icon_plain.png') },
  {
    id: 'anthropic',
    label: 'Anthropic',
    source: require('@/assets/images/icon_anthropic.png'),
  },
  { id: 'halls', label: 'Halls', source: require('@/assets/images/icon_halls.png') },
  { id: 'spark', label: 'Spark', source: require('@/assets/images/icon_spark.png') },
  { id: 'book', label: 'Book', source: require('@/assets/images/icon_book.png') },
  { id: 'bowl', label: 'Bowl', source: require('@/assets/images/icon_bowl.png') },
  { id: 'loc', label: 'Location', source: require('@/assets/images/icon_loc.png') },
  { id: 'stack', label: 'Stack', source: require('@/assets/images/icon_stack.png') },
  { id: 'window', label: 'Window', source: require('@/assets/images/icon_window.png') },
];

const ALTERNATE_ICON_IDS = new Set<AlternateAppIconId>(
  APP_ICONS.filter(
    (icon): icon is AppIconOption & { id: AlternateAppIconId } => icon.id !== 'main',
  ).map((icon) => icon.id),
);

export function supportsAppIconSelection(): boolean {
  if (!nativeModule?.supportsAlternateIcons()) return false;
  const available = new Set(nativeModule.getAvailableIcons());
  return [...ALTERNATE_ICON_IDS].every((id) => available.has(id));
}

export function getSelectedAppIcon(): AppIconId {
  const selected = nativeModule?.getAppIcon();
  return selected && ALTERNATE_ICON_IDS.has(selected as AlternateAppIconId)
    ? (selected as AlternateAppIconId)
    : 'main';
}

export async function selectAppIcon(id: AppIconId): Promise<void> {
  if (!nativeModule || !supportsAppIconSelection()) {
    throw new Error('App icon changes are unavailable in this build.');
  }
  await nativeModule.setAppIconAsync(id === 'main' ? null : id);
}
