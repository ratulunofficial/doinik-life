import { lazy, Suspense } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { stepTab, useApp, type Tab } from './lib/store';
import { cx } from './lib/format';
import { ConfirmHost, ToastHost, useIsDesktop, useRipples } from './components/ui';
import { Landscape } from './components/Landscape';
import { Header } from './features/shell/Header';
import { Greeting } from './features/shell/Greeting';
import { Sidebar } from './features/shell/Sidebar';
import { Dock, BazarBanner } from './features/shell/Dock';
import { WeatherCard } from './features/weather/WeatherCard';
import { ModalHost } from './features/shell/ModalHost';
import { AuthScreen } from './features/auth/AuthScreen';
import { CalendarCard } from './features/calendar/CalendarCard';
import { SummaryCard } from './features/calendar/SummaryCard';
import { TasksCard } from './features/tasks/TasksCard';
import { WaterMoodCard } from './features/tracker/WaterMoodCard';
import { ExpenseCard } from './features/expense/ExpenseCard';
import { LoansCard } from './features/expense/LoansCard';
import { NotesCard } from './features/notes/NotesCard';
import { BazarCard } from './features/bazar/BazarCard';

// The orders sheet (and the Excel library it pulls in) is only loaded when opened.
const OrdersPage = lazy(() => import('./features/orders/OrdersPage'));

export default function App() {
  useRipples();
  const user = useApp((s) => s.user);
  const cached = useApp((s) => s.cachedUsername);
  const authChecked = useApp((s) => s.authChecked);
  const signedIn = !!user || (!authChecked && !!cached);

  return (
    <>
      <div className="canvas" aria-hidden="true">
        <Landscape />
      </div>
      <AnimatePresence mode="wait">
        {signedIn ? (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Dashboard />
          </motion.div>
        ) : authChecked ? (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35 }}>
            <AuthScreen />
          </motion.div>
        ) : (
          <Splash key="splash" />
        )}
      </AnimatePresence>
      <ModalHost />
      <ConfirmHost />
      <ToastHost />
    </>
  );
}

function Splash() {
  return (
    <motion.div className="grid min-h-dvh place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="watermark text-[18vw] lg:text-[140px]"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        Doinik Life
      </motion.div>
    </motion.div>
  );
}

function Dashboard() {
  const desktop = useIsDesktop();
  const desktopOrders = useApp((s) => s.desktopOrders);
  // Desktop: sidebar rail on the left + full-width content (reference layout). Phone: top bar + bottom tabs.
  return (
    <>
      {desktop ? <Sidebar /> : <Header />}
      <main
        className={cx(
          'w-full px-3 pt-3 pb-[calc(112px+env(safe-area-inset-bottom))] sm:px-4 lg:pl-[104px] lg:pr-6 lg:pt-5',
          desktopOrders ? 'lg:pb-6' : 'lg:pb-12'
        )}
      >
        {desktop ? desktopOrders ? <Suspense fallback={null}><OrdersPage /></Suspense> : <DesktopGrid /> : <MobileTabs />}
      </main>
      {!desktop && <Dock />}
    </>
  );
}

/** Grid cell that lets the card inside stretch to the row height. */
function Cell({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={cx('col-span-12 min-w-0 [&>section]:h-full', className)}>{children}</div>;
}

function DesktopGrid() {
  return (
    <div className="flex flex-col gap-4">
      <Greeting />
      <div className="grid grid-cols-12 gap-4">
        <Cell className="lg:col-span-6 xl:col-span-4">
          <CalendarCard id="sec-calendar" panel={false} delay={0.04} />
        </Cell>
        <Cell className="lg:col-span-6 xl:col-span-4">
          <SummaryCard delay={0.08} />
        </Cell>
        <Cell className="lg:col-span-12 xl:col-span-4">
          <WeatherCard delay={0.12} />
        </Cell>
        <Cell className="lg:col-span-7">
          <TasksCard id="sec-tasks" delay={0.14} />
        </Cell>
        <Cell className="lg:col-span-5">
          <WaterMoodCard delay={0.18} />
        </Cell>
        <Cell className="lg:col-span-6 xl:col-span-7">
          <ExpenseCard id="sec-expense" delay={0.2} />
        </Cell>
        <Cell className="lg:col-span-6 xl:col-span-5">
          <LoansCard delay={0.22} />
        </Cell>
        <Cell className="">
          <NotesCard id="sec-notes" delay={0.24} />
        </Cell>
        <Cell className="">
          <BazarCard id="sec-bazar" delay={0.26} />
        </Cell>
      </div>
    </div>
  );
}

function TabPage({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'cal':
      return (
        <>
          <Greeting />
          <CalendarCard />
          <SummaryCard delay={0.06} />
          <WeatherCard delay={0.1} />
        </>
      );
    case 'tasks':
      return (
        <>
          <TasksCard showStats />
          <NotesCard delay={0.06} />
        </>
      );
    case 'track':
      return <WaterMoodCard />;
    case 'orders':
      return (
        <Suspense fallback={null}>
          <OrdersPage />
        </Suspense>
      );
    case 'expense':
      return (
        <>
          <ExpenseCard />
          <LoansCard delay={0.06} />
        </>
      );
    case 'bazar':
      return <BazarCard />;
  }
}

function MobileTabs() {
  const tab = useApp((s) => s.tab);
  const dir = useApp((s) => s.tabDir);
  const onPanEnd = (e: PointerEvent, info: PanInfo) => {
    if (tab === 'orders') return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('[data-noswipe], input, textarea, select')) return;
    if (Math.abs(info.offset.x) < 70 || Math.abs(info.offset.y) > 60) return;
    if (Math.abs(info.velocity.x) < 200 && Math.abs(info.offset.x) < 120) return;
    stepTab(info.offset.x < 0 ? 1 : -1);
  };
  return (
    <motion.div onPanEnd={onPanEnd} style={{ touchAction: 'pan-y' }}>
      <BazarBanner />
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={tab}
          custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 40 }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: d * -40 })
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="flex flex-col gap-3"
        >
          <TabPage tab={tab} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
