export type HallId = 'mcconnell' | 'frary' | 'hoch' | 'malott' | 'collins' | 'frank' | 'oldenborg';

export interface DiningHall {
  id: HallId;
  /** 2-letter bottom-bar abbreviation (user-specified) */
  abbr: string;
  /** Official display name from GET /v1/halls */
  name: string;
  college: string;
  collegeShort: string;
  /** Badge initials for the school logo circle */
  badge: string;
  /** Bundled school logo for the page header */
  logo: number;
  /** Show the logo on a white circle (for logos that clash with the header) */
  logoOnWhite: boolean;
  /** School brand color (light mode header + tab) */
  color: string;
  /** School brand color for dark mode */
  colorDark: string;
  /** Text/icons drawn on top of the school color */
  onColor: string;
  sourceUrl: string;
}

/**
 * Static dining-hall config. Pages are fixed — only date + menu are dynamic.
 * Names/colleges verified against GET /v1/halls (2026-09-07).
 * Bottom-bar order: MC FY HC MA CO FK OL + settings.
 */
export const DINING_HALLS: DiningHall[] = [
  {
    id: 'mcconnell',
    abbr: 'MC',
    name: 'McConnell',
    college: 'Pitzer College',
    collegeShort: 'Pitzer',
    logo: require('../assets/images/pitzer.png'),
    logoOnWhite: true,
    badge: 'PZ',
    color: '#F7821E',
    colorDark: '#E3721D',
    onColor: '#FFFFFF',
    sourceUrl: 'https://pitzer.cafebonappetit.com/',
  },
  {
    id: 'frary',
    abbr: 'FY',
    name: 'Frary',
    college: 'Pomona College',
    collegeShort: 'Pomona',
    logo: require('../assets/images/pomona.png'),
    logoOnWhite: false,
    badge: 'PO',
    color: '#3978DC',
    colorDark: '#3865C8',
    onColor: '#FFFFFF',
    sourceUrl: 'https://www.pomona.edu/administration/dining/menus/frary',
  },
  {
    id: 'hoch',
    abbr: 'HC',
    name: 'Hoch-Shanahan',
    college: 'Harvey Mudd College',
    collegeShort: 'Harvey Mudd',
    logo: require('../assets/images/hmc.png'),
    logoOnWhite: false,
    badge: 'HM',
    color: '#EAAA01',
    colorDark: '#D69701',
    onColor: '#FFFFFF',
    sourceUrl: 'https://hmc.sodexomyway.com/en-us/locations/hoch-shanahan-dining-commons',
  },
  {
    id: 'malott',
    abbr: 'MA',
    name: 'Malott',
    college: 'Scripps College',
    collegeShort: 'Scripps',
    logo: require('../assets/images/scripps.png'),
    logoOnWhite: true,
    badge: 'SC',
    color: '#4BA583',
    colorDark: '#49916E',
    onColor: '#FFFFFF',
    sourceUrl: 'https://scripps.cafebonappetit.com/',
  },
  {
    id: 'collins',
    abbr: 'CO',
    name: 'Collins',
    college: 'Claremont McKenna College',
    collegeShort: 'Claremont McKenna',
    logo: require('../assets/images/cmc.png'),
    logoOnWhite: true,
    badge: 'CM',
    color: '#DA2C46',
    colorDark: '#C62D47',
    onColor: '#FFFFFF',
    sourceUrl: 'https://collins-cmc.cafebonappetit.com/',
  },
  {
    id: 'frank',
    abbr: 'FK',
    name: 'Frank',
    college: 'Pomona College',
    collegeShort: 'Pomona',
    logo: require('../assets/images/pomona.png'),
    logoOnWhite: false,
    badge: 'PO',
    color: '#3978DC',
    colorDark: '#3865C8',
    onColor: '#FFFFFF',
    sourceUrl: 'https://www.pomona.edu/administration/dining/menus/frank',
  },
  {
    id: 'oldenborg',
    abbr: 'OL',
    name: 'Oldenborg',
    college: 'Pomona College',
    collegeShort: 'Pomona',
    logo: require('../assets/images/pomona.png'),
    logoOnWhite: false,
    badge: 'PO',
    color: '#3978DC',
    colorDark: '#3865C8',
    onColor: '#FFFFFF',
    sourceUrl: 'https://www.pomona.edu/administration/dining/menus/oldenborg',
  },
];

export const HALL_BY_ID: Record<HallId, DiningHall> = Object.fromEntries(
  DINING_HALLS.map((h) => [h.id, h]),
) as Record<HallId, DiningHall>;

/** Halls sorted per the user's order (unknown ids dropped, missing appended). */
export function orderedHalls(order: HallId[]): DiningHall[] {
  const seen = new Set<HallId>();
  const out: DiningHall[] = [];
  for (const id of order) {
    const h = HALL_BY_ID[id];
    if (h && !seen.has(id)) {
      seen.add(id);
      out.push(h);
    }
  }
  for (const h of DINING_HALLS) {
    if (!seen.has(h.id)) out.push(h);
  }
  return out;
}
