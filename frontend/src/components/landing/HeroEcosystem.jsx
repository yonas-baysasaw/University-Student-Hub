import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMouseParallax } from './hooks/useMouseParallax.js';

const ORBIT_CARDS = [
  {
    id: 'assignment',
    className: 'absolute left-[2%] top-[8%] w-[9.5rem]',
    duration: 7,
    delay: 0,
    depth: 0.35,
    content: (
      <>
        <ClipboardList className="h-3.5 w-3.5 text-amber-600" />
        <p className="mt-1 text-[10px] font-semibold text-slate-800 dark:text-slate-100">
          Assignment due
        </p>
        <p className="text-[9px] text-slate-500">Data Structures · Fri</p>
      </>
    ),
  },
  {
    id: 'class',
    className: 'absolute right-[0%] top-[14%] w-[8.5rem]',
    duration: 8.5,
    delay: 0.4,
    depth: 0.5,
    content: (
      <>
        <CalendarDays className="h-3.5 w-3.5 text-cyan-600" />
        <p className="mt-1 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-100">
          09:00
        </p>
        <p className="text-[9px] text-slate-500">Linear Algebra</p>
      </>
    ),
  },
  {
    id: 'exam',
    className: 'absolute left-[8%] bottom-[18%] w-[8rem]',
    duration: 9,
    delay: 0.8,
    depth: 0.45,
    content: (
      <>
        <p className="text-[9px] font-bold uppercase text-rose-600">Exam</p>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-800 dark:text-slate-100">
          Midterm in 3d
        </p>
      </>
    ),
  },
  {
    id: 'event',
    className: 'absolute right-[6%] bottom-[22%] w-[9rem]',
    duration: 7.5,
    delay: 1.2,
    depth: 0.4,
    content: (
      <>
        <p className="text-[9px] font-bold uppercase text-emerald-600">Event</p>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-800 dark:text-slate-100">
          Robotics showcase
        </p>
      </>
    ),
  },
  {
    id: 'announcement',
    className: 'absolute left-[28%] top-[2%] w-[10rem]',
    duration: 10,
    delay: 0.2,
    depth: 0.55,
    content: (
      <>
        <Bell className="h-3.5 w-3.5 text-cyan-600" />
        <p className="mt-1 text-[10px] font-semibold text-slate-800 dark:text-slate-100">
          Verified update
        </p>
        <span className="mt-1 inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 dark:text-emerald-300">
          Official
        </span>
      </>
    ),
  },
  {
    id: 'liquai',
    className: 'absolute right-[22%] top-[4%] w-[9.5rem]',
    duration: 8,
    delay: 0.6,
    depth: 0.6,
    content: (
      <>
        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        <p className="mt-1 text-[10px] font-semibold text-slate-800 dark:text-slate-100">
          LiquAI
        </p>
        <p className="text-[9px] text-slate-500">Explain merge sort…</p>
      </>
    ),
  },
  {
    id: 'library',
    className: 'absolute left-[4%] top-[42%] w-[8.5rem]',
    duration: 9.5,
    delay: 1,
    depth: 0.3,
    content: (
      <>
        <Search className="h-3 w-3 text-slate-400" />
        <p className="mt-1 text-[9px] text-slate-500">Search library…</p>
        <BookOpen className="mt-1 h-3 w-3 text-slate-400" />
      </>
    ),
  },
  {
    id: 'community',
    className: 'absolute right-[2%] top-[48%] w-[8rem]',
    duration: 11,
    delay: 1.4,
    depth: 0.35,
    content: (
      <>
        <Users className="h-3.5 w-3.5 text-cyan-600" />
        <div className="mt-1.5 flex -space-x-1.5">
          {['A', 'B', 'C'].map((l) => (
            <span
              key={l}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-cyan-600 text-[8px] font-bold text-white dark:border-slate-800"
            >
              {l}
            </span>
          ))}
        </div>
      </>
    ),
  },
];

function OrbitCard({ card, parallax, reduced }) {
  const px = parallax.x * card.depth;
  const py = parallax.y * card.depth;

  return (
    <div className={`${card.className} hidden sm:block`} style={{ transform: `translate(${px}px, ${py}px)` }}>
      <motion.div
        className="landing-glass landing-glow rounded-xl p-2.5"
        animate={reduced ? undefined : { y: [0, -8, 0] }}
        transition={
          reduced
            ? undefined
            : {
                duration: card.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: card.delay,
              }
        }
      >
        {card.content}
      </motion.div>
    </div>
  );
}

function DashboardCenter() {
  return (
    <div className="panel-card landing-glow relative overflow-hidden rounded-2xl border-slate-200/90 p-4 shadow-xl dark:border-slate-600 md:p-5">
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100/90 p-1 dark:bg-slate-800/80">
        <span className="h-2 w-8 rounded bg-cyan-500/60" />
        <span className="h-2 w-8 rounded bg-slate-200 dark:bg-slate-700" />
        <span className="h-2 w-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
            <Bell className="h-4 w-4 text-cyan-600" />
            <span className="font-display text-xs font-bold">Dashboard</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
            Midterm schedule posted
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
            <CalendarDays className="h-4 w-4 text-cyan-600" />
            <span className="font-display text-xs font-bold">Today</span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-slate-600 dark:text-slate-300">
            09:00 · Data Structures
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroEcosystem() {
  const reduced = useReducedMotion();
  const parallax = useMouseParallax(14);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[28rem] lg:max-w-none lg:aspect-auto lg:min-h-[26rem]">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/20 via-transparent to-violet-500/15 blur-2xl" />

      <motion.div
        className="relative z-[2] mx-auto w-[88%] max-w-sm lg:absolute lg:left-1/2 lg:top-1/2 lg:w-[min(100%,22rem)] lg:-translate-x-1/2 lg:-translate-y-1/2"
        style={{
          x: reduced ? 0 : parallax.x * 0.15,
          y: reduced ? 0 : parallax.y * 0.15,
        }}
        animate={reduced ? undefined : { y: [0, -10, 0] }}
        transition={
          reduced
            ? undefined
            : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <DashboardCenter />
      </motion.div>

      <div className="absolute inset-0 z-[1] hidden sm:block">
        {ORBIT_CARDS.map((card) => (
          <OrbitCard
            key={card.id}
            card={card}
            parallax={parallax}
            reduced={reduced}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroEcosystem;
