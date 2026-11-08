// Weather via Open-Meteo (free, no API key). Only the chosen place's coordinates
// are sent; nothing about the user's account. Cached per place for 30 minutes.

export interface Place {
  name: string;
  lat: number;
  lon: number;
}
export interface DayFc {
  date: Date;
  code: number;
  max: number;
  min: number;
}
export interface Weather {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  max: number;
  min: number;
  days: DayFc[];
  fetchedAt: number;
}
export type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

const DEFAULT_PLACE: Place = { name: 'Dhaka', lat: 23.8103, lon: 90.4125 };
const PLACE_KEY = 'dl2_weather_place';
const CACHE_KEY = 'dl2_weather_cache_v1';
const TTL = 30 * 60 * 1000;

export function getPlace(): Place {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null');
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number') return p;
  } catch {
    /* ignore */
  }
  return DEFAULT_PLACE;
}
export function savePlace(p: Place) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const placeId = (p: Place) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function cachedWeather(p: Place): Weather | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c || c.id !== placeId(p)) return null;
    const w = c.data as Weather;
    w.days = w.days.map((d) => ({ ...d, date: new Date(d.date) }));
    return w;
  } catch {
    return null;
  }
}

export async function fetchWeather(p: Place, force = false): Promise<Weather> {
  const c = cachedWeather(p);
  if (c && !force && Date.now() - c.fetchedAt < TTL) return c;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4';
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  const j = await res.json();
  const cur = j.current || {};
  const d = j.daily || {};
  const days: DayFc[] = (d.time || []).map((t: string, i: number) => ({ date: parseDay(t), code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i] }));
  const w: Weather = {
    temp: cur.temperature_2m,
    feels: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m,
    wind: cur.wind_speed_10m,
    code: cur.weather_code,
    isDay: cur.is_day === 1,
    max: days[0]?.max ?? cur.temperature_2m,
    min: days[0]?.min ?? cur.temperature_2m,
    days: days.slice(1, 4),
    fetchedAt: Date.now()
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ id: placeId(p), data: w }));
  } catch {
    /* ignore */
  }
  return w;
}

export async function searchPlaces(q: string): Promise<(Place & { sub: string })[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results || []).map((r: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    sub: [r.admin1, r.country].filter(Boolean).join(', ')
  }));
}

export function kindOf(code: number): Kind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export const KIND_LABEL: Record<Kind, [string, string]> = {
  clear: ['পরিষ্কার আকাশ', 'Clear'],
  partly: ['আংশিক মেঘলা', 'Partly Cloudy'],
  cloudy: ['মেঘলা', 'Cloudy'],
  fog: ['কুয়াশা', 'Foggy'],
  drizzle: ['গুঁড়ি গুঁড়ি বৃষ্টি', 'Drizzle'],
  rain: ['বৃষ্টি', 'Rain'],
  snow: ['তুষারপাত', 'Snow'],
  storm: ['বজ্রঝড়', 'Thunderstorm']
};
