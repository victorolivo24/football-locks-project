export type TeamKey =
  | 'Cardinals' | 'Falcons' | 'Ravens' | 'Bills' | 'Panthers' | 'Bears' | 'Bengals' | 'Browns'
  | 'Cowboys' | 'Broncos' | 'Lions' | 'Packers' | 'Texans' | 'Colts' | 'Jaguars' | 'Chiefs'
  | 'Raiders' | 'Chargers' | 'Rams' | 'Dolphins' | 'Vikings' | 'Patriots' | 'Saints' | 'Giants'
  | 'Jets' | 'Eagles' | 'Steelers' | '49ers' | 'Seahawks' | 'Buccaneers' | 'Titans' | 'Commanders';

export interface TeamMeta {
  abbr: string;           // ESPN/NFL 2–3 letter abbreviation
  primary: string;        // Primary hex color
  secondary: string;      // Secondary hex color (for accents)
  textOnPrimary: '#000' | '#fff';
}

// Authentic primary/secondary brand colors (approximate, web-safe)
export const TEAMS: Record<TeamKey, TeamMeta> = {
  Cardinals:   { abbr: 'ari', primary: '#97233F', secondary: '#FFB612', textOnPrimary: '#fff' },
  Falcons:     { abbr: 'atl', primary: '#A71930', secondary: '#000000', textOnPrimary: '#fff' },
  Ravens:      { abbr: 'bal', primary: '#241773', secondary: '#9E7C0C', textOnPrimary: '#fff' },
  Bills:       { abbr: 'buf', primary: '#00338D', secondary: '#C60C30', textOnPrimary: '#fff' },
  Panthers:    { abbr: 'car', primary: '#0085CA', secondary: '#101820', textOnPrimary: '#fff' },
  Bears:       { abbr: 'chi', primary: '#0B162A', secondary: '#C83803', textOnPrimary: '#fff' },
  Bengals:     { abbr: 'cin', primary: '#FB4F14', secondary: '#000000', textOnPrimary: '#000' },
  Browns:      { abbr: 'cle', primary: '#311D00', secondary: '#FF3C00', textOnPrimary: '#fff' },
  Cowboys:     { abbr: 'dal', primary: '#041E42', secondary: '#869397', textOnPrimary: '#fff' },
  Broncos:     { abbr: 'den', primary: '#002244', secondary: '#FB4F14', textOnPrimary: '#fff' },
  Lions:       { abbr: 'det', primary: '#0076B6', secondary: '#B0B7BC', textOnPrimary: '#fff' },
  Packers:     { abbr: 'gb',  primary: '#203731', secondary: '#FFB612', textOnPrimary: '#fff' },
  Texans:      { abbr: 'hou', primary: '#03202F', secondary: '#A71930', textOnPrimary: '#fff' },
  Colts:       { abbr: 'ind', primary: '#002C5F', secondary: '#A2AAAD', textOnPrimary: '#fff' },
  Jaguars:     { abbr: 'jax', primary: '#006778', secondary: '#9F792C', textOnPrimary: '#fff' },
  Chiefs:      { abbr: 'kc',  primary: '#E31837', secondary: '#FFB81C', textOnPrimary: '#fff' },
  Raiders:     { abbr: 'lv',  primary: '#000000', secondary: '#A5ACAF', textOnPrimary: '#fff' },
  Chargers:    { abbr: 'lac', primary: '#0080C6', secondary: '#FFC20E', textOnPrimary: '#fff' },
  Rams:        { abbr: 'lar', primary: '#003594', secondary: '#FFA300', textOnPrimary: '#fff' },
  Dolphins:    { abbr: 'mia', primary: '#008E97', secondary: '#FC4C02', textOnPrimary: '#fff' },
  Vikings:     { abbr: 'min', primary: '#4F2683', secondary: '#FFC62F', textOnPrimary: '#fff' },
  Patriots:    { abbr: 'ne',  primary: '#002244', secondary: '#C60C30', textOnPrimary: '#fff' },
  Saints:      { abbr: 'no',  primary: '#101820', secondary: '#D3BC8D', textOnPrimary: '#fff' },
  Giants:      { abbr: 'nyg', primary: '#0B2265', secondary: '#A71930', textOnPrimary: '#fff' },
  Jets:        { abbr: 'nyj', primary: '#125740', secondary: '#000000', textOnPrimary: '#fff' },
  Eagles:      { abbr: 'phi', primary: '#004C54', secondary: '#A5ACAF', textOnPrimary: '#fff' },
  Steelers:    { abbr: 'pit', primary: '#101820', secondary: '#FFB612', textOnPrimary: '#fff' },
  '49ers':     { abbr: 'sf',  primary: '#AA0000', secondary: '#B3995D', textOnPrimary: '#fff' },
  Seahawks:    { abbr: 'sea', primary: '#002244', secondary: '#69BE28', textOnPrimary: '#fff' },
  Buccaneers:  { abbr: 'tb',  primary: '#D50A0A', secondary: '#FF7900', textOnPrimary: '#fff' },
  Titans:      { abbr: 'ten', primary: '#0C2340', secondary: '#4B92DB', textOnPrimary: '#fff' },
  Commanders:  { abbr: 'wsh', primary: '#5A1414', secondary: '#FFB612', textOnPrimary: '#fff' },
};

export function getTeamMeta(team: string): TeamMeta | undefined {
  // Input in DB is expected to be nickname (e.g., 'Chiefs').
  // Fallback tries to match case-insensitively by nickname.
  const key = Object.keys(TEAMS).find(
    (k) => k.toLowerCase() === team.trim().toLowerCase()
  ) as TeamKey | undefined;
  return key ? TEAMS[key] : undefined;
}

export function getEspnLogoUrl(team: string, size: 100 | 200 | 500 = 500): string | null {
  const meta = getTeamMeta(team);
  if (!meta) return null;
  // ESPN scoreboard logos (transparent background)
  // e.g. https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png
  return `https://a.espncdn.com/i/teamlogos/nfl/${size}/scoreboard/${meta.abbr}.png`;
}

