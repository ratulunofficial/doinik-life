import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast, useL, useLang } from '../../lib/store';
import { KIND_LABEL, cachedWeather, fetchWeather, getPlace, kindOf, savePlace, searchPlaces, type Kind, type Place, type Weather } from '../../lib/weather';
import { days } from '../../lib/dates';
import { Card, IconBtn, SecLabel, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';

const CLOUD = 'M19 47h27a10.5 10.5 0 0 0 1.2-20.9A14 14 0 0 0 20.4 24.4 11.4 11.4 0 0 0 19 47z';

/** Illustrated, gently animated weather icon (sun / moon / clouds / rain / snow / storm). */
export function WeatherIcon({ kind, night, size = 88 }: { kind: Kind; night?: boolean; size?: number }) {
  const sun = (cx: number, cy: number, r: number) =>
    night ? (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="url(#wi-moon)" />
        <circle cx={cx + r * 0.45} cy={cy - r * 0.3} r={r * 0.85} fill="#1a1534" />
      </g>
    ) : (
      <g>
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={cx} y1={cy - r - 4} x2={cx} y2={cy - r - 8} stroke="#fcd34d" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${i * 45} ${cx} ${cy})`} opacity="0.85" />
          ))}
        </motion.g>
        <circle cx={cx} cy={cy} r={r} fill="url(#wi-sun)" />
      </g>
    );
  const cloud = (dx = 0, dy = 0, s = 1, back = false) => (
    <motion.path d={CLOUD} fill={back ? 'url(#wi-cloud2)' : 'url(#wi-cloud)'} transform={`translate(${dx} ${dy}) scale(${s})`} animate={{ x: [0, 1.5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="overflow-visible drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]">
      <defs>
        <radialGradient id="wi-sun" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.55" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="wi-moon" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#f5f3ff" />
          <stop offset="1" stopColor="#c4b5fd" />
        </radialGradient>
        <linearGradient id="wi-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d7d3ea" />
        </linearGradient>
        <linearGradient id="wi-cloud2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b3d6" />
          <stop offset="1" stopColor="#8f88b4" />
        </linearGradient>
      </defs>
      {kind === 'clear' && sun(32, 32, 14)}
      {kind === 'partly' && (
        <>
          {sun(26, 24, 11)}
          {cloud(6, 6, 0.95)}
        </>
      )}
      {(kind === 'cloudy' || kind === 'fog') && (
        <>
          {cloud(-6, -6, 0.8, true)}
          {cloud(4, 2)}
        </>
      )}
      {(kind === 'rain' || kind === 'drizzle' || kind === 'storm' || kind === 'snow') && cloud(2, -4)}
      {kind === 'fog' &&
        [50, 56].map((y, i) => (
          <motion.line key={y} x1="14" x2="50" y1={y} y2={y} stroke="#c4b5fd" strokeWidth="3" strokeLinecap="round" opacity="0.7" animate={{ x: [0, i ? -3 : 3, 0] }} transition={{ duration: 4, repeat: Infinity }} />
        ))}
      {(kind === 'rain' || kind === 'drizzle') &&
        [22, 32, 42].map((x, i) => (
          <motion.line key={x} x1={x} x2={x - 3} y1="46" y2={kind === 'rain' ? 54 : 51} stroke="#93c5fd" strokeWidth="2.4" strokeLinecap="round" animate={{ y: [0, 8], opacity: [1, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.25, ease: 'easeIn' }} />
        ))}
      {kind === 'snow' &&
        [22, 32, 42].map((x, i) => (
          <motion.circle key={x} cx={x} cy="49" r="2" fill="#fff" animate={{ y: [0, 9], opacity: [1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }} />
        ))}
      {kind === 'storm' && <motion.path d="M33 42 l-6 10 h5 l-3 9 l9 -12 h-5 l3 -7z" fill="#fde047" animate={{ opacity: [1, 0.2, 1, 1] }} transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.1, 0.2, 1] }} />}
    </svg>
  );
}

export const WeatherCard = memo(function WeatherCard({ delay = 0, id }: { delay?: number; id?: string }) {
  const L = useL();
  const lang = useLang();
  const [place, setPlace] = useState<Place>(getPlace);
  const [w, setW] = useState<Weather | null>(() => cachedWeather(getPlace()));
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<(Place & { sub: string })[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (p: Place, force = false) => {
    setLoading(true);
    setErr(false);
    try {
      setW(await fetchWeather(p, force));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(place);
    const t = setInterval(() => void load(place), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [place]);

  useEffect(() => {
    if (!picker) return;
    setTimeout(() => inputRef.current?.focus(), 80);
    const t = setTimeout(async () => setResults(await searchPlaces(q).catch(() => [])), 300);
    return () => clearTimeout(t);
  }, [q, picker]);

  const choose = (p: Place) => {
    savePlace(p);
    setPlace(p);
    setPicker(false);
    setQ('');
    setResults([]);
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) return toast(L('এই browser এ location নেই', 'Location is not available here'));
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ name: L('আমার এলাকা', 'My location'), lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => toast(L('Location permission পাওয়া যায়নি', 'Location permission was denied')),
      { timeout: 10000, maximumAge: 3600_000 }
    );
  };

  const kind = w ? kindOf(w.code) : 'partly';
  const label = KIND_LABEL[kind][lang === 'en' ? 1 : 0];
  const r = (n: number) => Math.round(n);

  return (
    <Card delay={delay} id={id} className="@container flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <SecLabel>{L('আবহাওয়া', 'Weather')}</SecLabel>
        <button type="button" onClick={() => setPicker(!picker)} className="ml-auto flex max-w-[60%] items-center gap-1 rounded-full border border-line-2 bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-ink-2 hover:text-white">
          <span>📍</span>
          <span className="truncate">{place.name}</span>
          <Icon name="chevD" size={12} />
        </button>
        <IconBtn icon="reset" label={L('আবার আনো', 'Refresh')} size={28} onClick={() => load(place, true)} className={loading ? 'animate-spin' : ''} />
      </div>

      <AnimatePresence initial={false}>
        {picker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
            <div className="mb-3 rounded-2xl border border-line-2 bg-black/20 p-2">
              <input ref={inputRef} className="field py-2 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('শহরের নাম লেখো… (যেমন Chattogram)', 'Search a city… (e.g. Chattogram)')} />
              <div className="mt-1.5 max-h-44 overflow-y-auto">
                {results.map((p) => (
                  <button key={`${p.lat},${p.lon}`} type="button" onClick={() => choose(p)} className="block w-full rounded-xl px-2.5 py-2 text-left hover:bg-white/5">
                    <span className="text-[13px] text-white">{p.name}</span>
                    <span className="ml-2 text-[11px] text-ink-4">{p.sub}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={useMyLocation} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12px] font-medium text-blue-3 hover:bg-white/5">
                📍 {L('আমার location ব্যবহার করো', 'Use my location')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!w ? (
        <div className="grid flex-1 place-items-center py-8 text-center text-[12.5px] text-ink-4">
          {err ? (
            <div>
              {L('আবহাওয়া আনা যায়নি', "Couldn't load the weather")}
              <button type="button" onClick={() => load(place, true)} className="mt-2 block w-full text-blue-3">
                {L('আবার চেষ্টা করো', 'Try again')}
              </button>
            </div>
          ) : (
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>
              {L('লোড হচ্ছে…', 'Loading…')}
            </motion.div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col @[560px]:flex-row @[560px]:items-center @[560px]:gap-8">
          <div className="flex flex-col items-center text-center @[560px]:flex-row @[560px]:gap-5 @[560px]:text-left">
            <motion.div key={kind + w.isDay} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
              <WeatherIcon kind={kind} night={!w.isDay} size={92} />
            </motion.div>
            <div>
              <div className="text-[64px] font-extralight leading-none tracking-[-0.05em] text-white">
                {r(w.temp)}
                <span className="align-top text-[34px]">°</span>
              </div>
              <div className="mt-1 text-[13.5px] text-ink-2">{label}</div>
              <div className="mt-1.5 flex justify-center gap-4 text-[12.5px] text-ink-3 @[560px]:justify-start">
                <span>↑ {r(w.max)}°</span>
                <span>↓ {r(w.min)}°</span>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink-4 @[560px]:mt-0 @[560px]:flex-1">
            <div className="rounded-xl bg-white/[0.03] py-1.5 text-center">
              💧 {w.humidity}%
            </div>
            <div className="rounded-xl bg-white/[0.03] py-1.5 text-center">
              🌬 {r(w.wind)} km/h
            </div>
            <div className="rounded-xl bg-white/[0.03] py-1.5 text-center">
              {L('অনুভূত', 'Feels')} {r(w.feels)}°
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 @[560px]:mt-0 @[560px]:border-0 @[560px]:pt-0">
            {w.days.map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 + i * 0.06 }} className="flex flex-col items-center gap-0.5">
                <span className="text-[11.5px] text-ink-3">{days(lang)[d.date.getDay()]}</span>
                <WeatherIcon kind={kindOf(d.code)} size={34} />
                <span className="text-[12.5px] font-medium text-white">{r(d.max)}°</span>
                <span className="text-[10.5px] text-ink-4">{r(d.min)}°</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
});
