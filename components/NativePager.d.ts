/**
 * Type declarations so tsc can resolve `@/components/NativePager`, which only
 * exists as platform files (.native/.web). Metro ignores .d.ts entirely, so
 * this never affects bundling — native gets .native.tsx, web gets .web.tsx.
 */
import type NativePagerComponent from './NativePager.native';
import type { NativePagerHandle, PageScrollEvent } from './NativePager.native';

declare const NativePager: typeof NativePagerComponent;

export default NativePager;
export type { NativePagerHandle, PageScrollEvent };
