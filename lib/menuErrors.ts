/**
 * Why a menu couldn't be shown, and the words the screen uses for it.
 *
 * The menu API answers failures with a body like
 *   { "error": { "code": "MENU_NOT_PUBLISHED", "message": "..." } }
 * (often with HTTP 503), so the code, not the status, says what happened.
 */
export type MenuProblem =
  /** fetch itself failed: no internet (or the API host is unreachable). */
  | 'offline'
  /** No answer within the timeout: slow connection or a stuck server. */
  | 'timeout'
  /** The hall's source didn't publish a menu for that date (often closed). */
  | 'not_published'
  /** The hall's own website/feed couldn't be fetched by the API. */
  | 'source_down'
  /** Date outside the window the API serves. */
  | 'out_of_range'
  /** The menu API itself errored (unknown 4xx/5xx). */
  | 'server'
  /** The response wasn't the JSON shape the app expects. */
  | 'bad_response'
  /** The school's source explicitly says the hall is closed that day. */
  | 'closed'
  /** The menu loaded fine but lists no meals for the day. */
  | 'no_meals';

export class MenuLoadError extends Error {
  readonly problem: MenuProblem;
  readonly status?: number;
  constructor(problem: MenuProblem, status?: number) {
    super(`Menu load failed: ${problem}${status ? ` (${status})` : ''}`);
    this.name = 'MenuLoadError';
    this.problem = problem;
    this.status = status;
  }
}

/** Problems that mean "the menu isn't there", not "the request broke". Returned, not thrown. */
export const EXPECTED_PROBLEMS: ReadonlySet<MenuProblem> = new Set([
  'not_published',
  'source_down',
  'out_of_range',
]);

/** Problems worth an automatic second attempt before showing anything. */
export const TRANSIENT_PROBLEMS: ReadonlySet<MenuProblem> = new Set(['offline', 'server']);

/** Map an API error code (any case) to a problem; undefined for codes the app doesn't know. */
export function problemFromApiCode(code: string | undefined): MenuProblem | undefined {
  switch (code?.toLowerCase()) {
    case 'menu_not_published':
    case 'menu_unavailable':
      return 'not_published';
    case 'source_fetch_failed':
      return 'source_down';
    case 'unsupported_date':
      return 'out_of_range';
    default:
      return undefined;
  }
}

/** Turn anything a menu load threw into a problem. */
export function problemFromError(e: unknown): { problem: MenuProblem; status?: number } {
  if (e instanceof MenuLoadError) return { problem: e.problem, status: e.status };
  if (e instanceof Error && e.name === 'AbortError') return { problem: 'timeout' };
  // fetch rejects with a TypeError ("Failed to fetch", "Network request failed").
  if (e instanceof TypeError) return { problem: 'offline' };
  if (e instanceof SyntaxError) return { problem: 'bad_response' };
  return { problem: 'server' };
}

export interface ProblemCopy {
  title: string;
  detail: string;
  /** Button label, or null when trying again can't help. */
  action: string | null;
  /** Offer a link to the hall's own menu page. */
  showSource: boolean;
}

export interface ProblemContext {
  hallName: string;
  college: string;
  /** "today", "tomorrow", "on Sunday" */
  dayPhrase: string;
  status?: number;
}

export function describeMenuProblem(problem: MenuProblem, ctx: ProblemContext): ProblemCopy {
  const { hallName, college, dayPhrase, status } = ctx;
  switch (problem) {
    case 'offline':
      return {
        title: 'No internet connection',
        detail: 'Check your Wi‑Fi or cellular data, then try again.',
        action: 'Try again',
        showSource: false,
      };
    case 'timeout':
      return {
        title: 'Menu is taking too long',
        detail: 'Your connection may be slow, or the menu server is busy. Try again.',
        action: 'Try again',
        showSource: false,
      };
    case 'not_published':
      return {
        title: `No menu posted ${dayPhrase}`,
        detail: `${hallName} hasn't posted a menu ${dayPhrase}. It may be closed, or the menu isn't up yet.`,
        action: 'Check again',
        showSource: true,
      };
    case 'source_down':
      return {
        title: `${college} menu site is down`,
        detail: `${hallName}'s menu comes from ${college}'s dining website, which isn't responding right now. This is usually temporary.`,
        action: 'Try again',
        showSource: true,
      };
    case 'out_of_range':
      return {
        title: 'Too far ahead',
        detail: 'Menus are only available for the next few days.',
        action: null,
        showSource: false,
      };
    case 'closed':
      return {
        title: `Closed ${dayPhrase}`,
        detail: `${hallName} is closed ${dayPhrase}.`,
        action: null,
        showSource: true,
      };
    case 'no_meals':
      return {
        title: `Closed ${dayPhrase}`,
        detail: `${hallName} has no meals listed ${dayPhrase}, so it's probably closed.`,
        action: 'Check again',
        showSource: true,
      };
    case 'bad_response':
      return {
        title: "Couldn't read the menu",
        detail: 'The menu came back in a format the app didn’t expect. Try again in a bit.',
        action: 'Try again',
        showSource: true,
      };
    case 'server':
    default:
      return {
        title: 'Menu server error',
        detail: `Something went wrong on our end${status ? ` (error ${status})` : ''}. Try again in a bit.`,
        action: 'Try again',
        showSource: true,
      };
  }
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago". */
export function timeAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** One-line note shown above a menu the API served from its saved copy. */
export function describeStale(
  reason: 'source_down' | 'overdue',
  verifiedAt: string | null,
  college: string,
  now: Date = new Date(),
): string {
  const ago = timeAgo(verifiedAt, now);
  const saved = ago ? `Saved copy, last checked ${ago}.` : 'Saved copy.';
  return reason === 'source_down'
    ? `${saved} ${college}'s menu site isn't responding, so changes may be missing.`
    : `${saved} Updates are delayed, so changes may be missing.`;
}

/** Note above a menu shown from the device's own saved copy. */
export function describeSavedOffline(
  problem: MenuProblem,
  savedAt: string,
  now: Date = new Date(),
): string {
  const ago = timeAgo(savedAt, now);
  const when = ago ? ` ${ago}` : '';
  const why =
    problem === 'offline'
      ? 'No internet connection'
      : problem === 'timeout'
        ? 'The menu server is slow to respond'
        : 'The menu server had a problem';
  return `${why}. Showing the menu saved on this device${when}.`;
}

/** Search loads every hall at once; describe the failure when none of them loaded. */
export function describeSearchProblem(problem: MenuProblem): { title: string; detail: string } {
  switch (problem) {
    case 'offline':
      return {
        title: 'No internet connection',
        detail: 'Check your Wi‑Fi or cellular data, then try again.',
      };
    case 'timeout':
      return {
        title: 'Menus are taking too long',
        detail: 'Your connection may be slow, or the menu server is busy.',
      };
    case 'bad_response':
      return {
        title: "Couldn't read the menus",
        detail: 'The menu server sent something unexpected. Try again in a bit.',
      };
    default:
      return {
        title: 'Menu server error',
        detail: 'Something went wrong on our end. Try again in a bit.',
      };
  }
}
