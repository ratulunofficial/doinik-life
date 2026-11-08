// DEV-ONLY demo data (loaded with ?demo in `npm run dev`). Never bundled into
// the production build and never touches Firebase.
import { useApp } from './store';
import { addDays, dateKey, startOfToday } from './dates';

export function startDemo() {
  const raw: Record<string, string> = {};
  const today = startOfToday();
  const names = ['🍚 চাল', '🚌 ভাড়া', '☕ চা', '🍗 মাংস', '📱 রিচার্জ', '💊 ওষুধ', '🥬 সবজি', '🍔 নাস্তা', '🎬 Netflix'];
  for (let i = 1; i < 430; i += 1) {
    const d = addDays(today, -i);
    if (i % 3 !== 0 && i > 20) continue;
    const ex = [];
    const c = 1 + ((i * 7) % 3);
    for (let j = 0; j < c; j++) ex.push({ id: i * 10 + j, name: names[(i + j * 3) % names.length], amt: 40 + ((i * 37 + j * 91) % 420) });
    raw['day_' + dateKey(d)] = JSON.stringify({
      tasks: [
        { id: 1, text: 'Wake up at 7 AM', cat: 'health', done: i % 2 === 0 },
        { id: 2, text: 'After Effects practice', cat: 'work', done: i % 3 === 0 }
      ],
      water: (i * 3) % 9,
      expenses: ex
    });
  }
  raw['day_' + dateKey(today)] = JSON.stringify({
    tasks: [
      { id: 1, text: 'Wake up at 7 AM', cat: 'health', done: true, perm: true },
      { id: 2, text: '30 minutes exercise', cat: 'health', done: false },
      { id: 3, text: 'After Effects practice', cat: 'work', done: false },
      { id: 4, text: 'Read at night', cat: 'personal', done: false }
    ],
    water: 3,
    expenses: [
      { id: 1, name: '☕ চা', amt: 30 },
      { id: 2, name: '🚌 ভাড়া', amt: 60 }
    ]
  });
  raw.waterGoal = '8';
  raw.permanent_tasks = JSON.stringify([{ id: 1, text: 'Wake up at 7 AM', cat: 'health' }]);
  const mood: Record<string, { level: number; emoji: string }> = {};
  const em = ['😞', '😔', '😐', '🙂', '😄'];
  for (let i = 1; i < 7; i++) {
    const lv = 1 + ((i * 2) % 5);
    mood[dateKey(addDays(today, -i))] = { level: lv, emoji: em[lv - 1] };
  }
  raw.mood_data = JSON.stringify(mood);
  raw.loans_data = JSON.stringify([
    { id: 1, type: 'gave', name: 'Rafi', amt: 1500, paid: 500, date: dateKey(addDays(today, -12)), settled: false },
    { id: 2, type: 'took', name: 'Sabbir', amt: 800, paid: 0, date: dateKey(addDays(today, -3)), settled: false }
  ]);
  raw.bazar_data = JSON.stringify([
    { id: 11, name: 'চাল', cat: 'grocery', qty: 5, unit: 'kg', price: 0, done: false, addedAt: Date.now() - 5000 },
    { id: 12, name: 'আপেল', cat: 'fruit', qty: 1, unit: 'dozen', price: 0, done: false, addedAt: Date.now() - 4000 },
    { id: 13, name: 'দুধ', cat: 'dairy', qty: 2, unit: 'l', price: 180, done: true, addedAt: Date.now() - 3000, doneAt: Date.now() - 1000 }
  ]);
  raw.notes_data = JSON.stringify([
    { id: 'note_1', title: 'Wi-Fi', content: 'Password: {{doinik-2026}}\nRouter: {{192.168.0.1}}', color: 'blue', pinned: true, createdAt: Date.now() - 864e5 * 3, updatedAt: Date.now() - 864e5 },
    { id: 'note_2', title: 'Ideas', content: 'Portfolio redesign\nMotion reel', color: 'purple', pinned: false, createdAt: Date.now() - 864e5 * 6, updatedAt: Date.now() - 864e5 * 2 },
    { id: 'tnote_3', title: 'Quick math', content: 'Quick math\n250*4=1000', color: 'yellow', pinned: false, temporary: true, expiresAt: Date.now() + 864e5 / 2, createdAt: Date.now(), updatedAt: Date.now() }
  ]);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  raw.orders_data = JSON.stringify(
    Array.from({ length: 40 }, (_, i) => ({
      username: ['tanvir', 'mim', 'sakib', 'nabila', 'rony', 'ayan', 'sumi', 'fahim', 'joy'][i % 9],
      date: iso(addDays(today, -[10, 29, 45, 2, 60, 15, 31, 88, 5][i % 9] - (i % 4) * 3)),
      items: ['Netflix', 'Spotify', 'YouTube Premium', 'Canva Pro', 'Netflix', 'ChatGPT Plus', 'Spotify', 'Netflix', 'Canva Pro'][i % 9],
      validity: [1, 1, 2, 1, 3, 1, 1, 3, 1][i % 9],
      status: 'Continue',
      amount: [350, 180, 400, 250, 900, 2400, 180, 900, 250][i % 9],
      cost: [250, 100, 280, 150, 650, 2100, 100, 650, 150][i % 9],
      orderStatus: i % 9 === 6 ? 'hold' : 'completed',
      account: `user${i + 1}@example.com`,
      password: 'pass' + (1000 + i * 37)
    }))
  );
  useApp.setState({
    demo: true,
    raw,
    remoteLoaded: true,
    authChecked: true,
    status: 'online',
    user: { uid: 'demo', email: 'demo@example.com', username: 'demo', providerId: 'password', isPasswordProvider: true }
  });
}
