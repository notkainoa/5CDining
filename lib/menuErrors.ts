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
    default:
      return {
        title: 'Menu server error',
        detail: 'Something went wrong on our end. Try again in a bit.',
      };
  }
}
