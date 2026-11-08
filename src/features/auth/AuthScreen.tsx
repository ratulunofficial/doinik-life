import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { setLang, useL, useLang } from '../../lib/store';
import { Icon } from '../../components/Icon';
import { spring } from '../../components/ui';
import { LogoMark } from '../shell/Header';
import { cx } from '../../lib/format';

type Mode = 'login' | 'register' | 'reset';

function strength(pw: string) {
  if (!pw) return { score: 0, pct: 0 };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  s = Math.min(4, s);
  return { score: s, pct: [18, 35, 58, 80, 100][s] };
}

export function AuthScreen() {
  const L = useL();
  const lang = useLang();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [orders, setOrders] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const st = strength(pw);
  const stLabels = [L('খুব দুর্বল', 'Very weak'), L('দুর্বল', 'Weak'), L('মাঝারি', 'Fair'), L('ভালো', 'Good'), L('শক্তিশালী', 'Strong')];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    const fb = await import('../../lib/firebase');
    let res: string | null;
    if (mode === 'reset') {
      res = await fb.resetPassword(email);
      if (!res) setMsg(L('✅ Reset link পাঠানো হয়েছে — email চেক করো।', '✅ Reset link sent — check your inbox.'));
    } else if (mode === 'register') res = await fb.register(email, pw, orders);
    else res = await fb.login(email, pw);
    setBusy(false);
    if (res) {
      setErr(res);
      setShake((s) => s + 1);
    }
  };

  const title = mode === 'login' ? L('লগইন করো', 'Welcome back') : mode === 'register' ? L('অ্যাকাউন্ট তৈরি করো', 'Create account') : L('Password reset', 'Reset password');
  const sub =
    mode === 'login'
      ? L('তোমার email ও password দিয়ে লগইন করো', 'Log in with your email and password')
      : mode === 'register'
        ? L('তোমার email + password দিয়ে নতুন অ্যাকাউন্ট খোলো', 'Sign up with your email and password')
        : L('তোমার email এ একটা reset link পাঠানো হবে', "We'll email you a reset link");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(139,92,246,0.5), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(91,45,200,0.3), transparent 70%)' }}
      />
      <motion.div
        aria-hidden="true"
        className="watermark absolute left-1/2 top-[6vh] text-[clamp(64px,15vw,210px)]"
        initial={{ opacity: 0, y: -20, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        Doinik Life
      </motion.div>

      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
        className="pill absolute right-4 top-[calc(16px+env(safe-area-inset-top))] h-8 px-3 text-[11.5px] font-semibold text-ink-2"
      >
        {lang === 'en' ? 'বাংলা' : 'English'}
      </button>

      <motion.form
        onSubmit={submit}
        layout
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.15 }}
        className="relative z-10 w-full max-w-[400px] rounded-[28px] border border-line-2 px-6 pt-7 pb-6 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
        style={{ background: 'radial-gradient(120% 60% at 50% -10%, rgba(124,77,255,0.22), transparent 60%), linear-gradient(180deg, rgba(22,17,42,0.82), rgba(10,8,20,0.9))' }}
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <LogoMark size={52} />
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <h1 className="mt-4 text-[30px] font-light tracking-[-0.035em] text-white">{title}</h1>
              <p className="mt-1.5 text-[13px] text-ink-3">{sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {err && (
            <motion.div
              key={'e' + shake}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -5, 5, 0] }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-3 overflow-hidden rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#ffd0d0]"
            >
              {err}
            </motion.div>
          )}
          {msg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden rounded-2xl border border-good/30 bg-good/10 px-3.5 py-2.5 text-[12.5px] text-[#c8f5e2]">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        <label className="label" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          className="field mb-3.5"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AnimatePresence initial={false}>
          {mode !== 'reset' && (
            <motion.div key="pw" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <label className="label" htmlFor="auth-pw">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-pw"
                  className="field pr-11"
                  type={show ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder={L('কমপক্ষে ৬ অক্ষর', 'At least 6 characters')}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-white" aria-label="Show password">
                  <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </div>
              {mode === 'register' && (
                <div className="mt-2.5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[#6d3df5] to-[#cdb8ff]" animate={{ width: st.pct + '%' }} transition={spring} />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-4">{pw ? L('শক্তি: ', 'Strength: ') + stLabels[st.score] : L('পাসওয়ার্ডের শক্তি', 'Password strength')}</div>
                </div>
              )}
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button type="button" className="text-[12px] font-semibold text-blue-3 hover:text-white" onClick={() => setMode('reset')}>
                    {L('Password ভুলে গেছ?', 'Forgot password?')}
                  </button>
                </div>
              )}
              {mode === 'register' && (
                <label className="sub-glass mt-3.5 flex cursor-pointer items-start gap-3 p-3">
                  <input type="checkbox" checked={orders} onChange={(e) => setOrders(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#7c4dff]" />
                  <span>
                    <span className="block text-[12.5px] font-semibold text-white">{L('📊 Orders option চাই', '📊 I want the Orders section')}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-4">
                      {L('Account modal থেকে পরেও বদলানো যাবে।', 'You can change this later from Account.')}
                    </span>
                  </span>
                </label>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={busy} className={cx('btn btn-primary mt-5 w-full py-3 text-[14px]')}>
          {busy ? (
            <motion.span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
          ) : (
            <>
              {mode === 'login' ? L('লগইন', 'Log in') : mode === 'register' ? L('রেজিস্টার করো', 'Create account') : L('📧 Reset link পাঠাও', '📧 Send reset link')}
              <span className="ml-1 grid h-6 w-6 place-items-center rounded-full bg-[#7c4dff] text-white">
                <Icon name="chevR" size={14} stroke={2.4} />
              </span>
            </>
          )}
        </button>

        <div className="mt-4 text-center text-[12.5px] text-ink-3">
          {mode === 'login' ? (
            <>
              {L('নতুন ব্যবহারকারী? ', 'New here? ')}
              <button type="button" className="font-semibold text-white hover:underline" onClick={() => (setMode('register'), setErr(''))}>
                {L('অ্যাকাউন্ট তৈরি করো', 'Create an account')}
              </button>
            </>
          ) : (
            <>
              {mode === 'register' ? L('আগে থেকেই অ্যাকাউন্ট আছে? ', 'Already have an account? ') : ''}
              <button type="button" className="font-semibold text-white hover:underline" onClick={() => (setMode('login'), setErr(''), setMsg(''))}>
                {mode === 'register' ? L('লগইন করো', 'Log in') : L('← লগইনে ফিরে যাও', '← Back to login')}
              </button>
            </>
          )}
        </div>
      </motion.form>
    </div>
  );
}
