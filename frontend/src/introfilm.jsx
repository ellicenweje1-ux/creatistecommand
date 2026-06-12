import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cls } from './format'
import { Button, Flame, Icon } from './ui'

/* ── The introduction film ────────────────────────────────────────────────────
   An embedded, self-contained brand film for the landing page: six animated
   scenes with synchronised captions and a warm female voiceover (browser
   speech synthesis — no video file to host, crisp at every size, always
   on-brand). Captions carry the full script wherever speech is unavailable. */

const dly = (s) => ({ animationDelay: `${s}s` })

/* Speech text spells Creatiste phonetically (Kree-ay-teest) so every voice
   pronounces the brand correctly; captions show the real spelling. */
const SCENES = [
  {
    key: 'hook1',
    dur: 11500,
    caption: 'Have you ever been in a position where the menu was flawless — but the business behind it ran on sticky notes, spreadsheets and midnight messages?',
    speech: 'Have you ever been in a position where the menu was flawless — but the business behind it was running on sticky notes, spreadsheets, and midnight messages?',
    View: SceneHookOne,
  },
  {
    key: 'hook2',
    dur: 11000,
    caption: 'Where weddings were priced from memory, the van was packed at 2 a.m. — and a new client slipped away because their enquiry sat unread?',
    speech: 'Where weddings were priced from memory, the van was packed at two in the morning — and a new client slipped away, because their enquiry sat unread?',
    View: SceneHookTwo,
  },
  {
    key: 'welcome',
    dur: 10500,
    caption: 'Welcome to The Creatiste Command — the comprehensive management platform and one-stop shop designed for chefs, caterers and all culinary professionals.',
    speech: 'Welcome to The Cree-ay-teest Command — the comprehensive management platform, and one-stop shop, designed for chefs, caterers, and all culinary professionals.',
    View: SceneWelcome,
  },
  {
    key: 'everything',
    dur: 13000,
    caption: 'Bookings, tastings and clients. Recipes, inventory, shopping and packing. Quotes, invoices and finances. Your team, routes and suppliers — and Mise, your AI sous-chef.',
    speech: 'Bookings, tastings and clients. Recipes, inventory, shopping and packing. Quotes, invoices and finances. Your team, your routes, your suppliers — and Mise, your A.I. sous-chef.',
    View: SceneEverything,
  },
  {
    key: 'gap',
    dur: 12000,
    caption: 'It replaces the scattered apps, the spreadsheets and the guesswork with one calm, beautiful command centre — built by a caterer who has lived your prep days.',
    speech: 'It replaces the scattered apps, the spreadsheets, and the guesswork, with one calm, beautiful command centre — built by a caterer who has lived your prep days.',
    View: SceneGap,
  },
  {
    key: 'cta',
    dur: 12000,
    caption: 'Create your account, book your welcome call, and your five-day free trial begins — no card needed. Take command of your craft, with The Creatiste Command.',
    speech: 'Create your account, book your welcome call, and your five-day free trial begins — no card needed. Take command of your craft, with The Cree-ay-teest Command.',
    View: SceneCta,
  },
]

const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.dur, 0)
const TOTAL_LABEL = `${Math.floor(TOTAL_MS / 60000)}:${String(Math.round((TOTAL_MS % 60000) / 1000)).padStart(2, '0')}`

/* ---------------------------------- scenes ---------------------------------- */
function SceneHookOne() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
      <p className="if-up text-[10px] font-semibold uppercase tracking-[0.3em] text-copper sm:text-xs" style={dly(0.2)}>A question, chef</p>
      <p className="if-up mt-4 font-display text-xl leading-snug text-cream sm:text-3xl md:text-4xl" style={dly(0.9)}>Have you ever been in a position where</p>
      <p className="if-up mt-2 font-display text-xl italic leading-snug text-copper sm:text-3xl md:text-4xl" style={dly(2.6)}>the menu was flawless —</p>
      <p className="if-up mt-3 font-display text-lg leading-snug text-cream/85 sm:text-2xl md:text-3xl" style={dly(4.6)}>but the business behind it ran on</p>
      <p className="if-up mt-2 font-display text-lg italic leading-snug text-copper sm:text-2xl md:text-3xl" style={dly(6.2)}>sticky notes, spreadsheets &amp; midnight messages?</p>
    </div>
  )
}

function SceneHookTwo() {
  const rows = [
    ['coins', 'Weddings priced from memory'],
    ['truck', 'The van packed at 2 a.m. — fingers crossed'],
    ['mail', 'A new client lost in an unread inbox'],
  ]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center sm:gap-4 sm:px-12">
      {rows.map(([icon, text], i) => (
        <div key={icon} className="if-up flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 sm:px-5 sm:py-3" style={dly(0.3 + i * 2)}>
          <Icon name={icon} size={18} className="shrink-0 text-copper" />
          <span className="font-display text-sm text-cream sm:text-lg">{text}</span>
        </div>
      ))}
      <p className="if-up mt-3 font-display text-lg italic text-copper sm:text-2xl" style={dly(6.8)}>Sound familiar?</p>
    </div>
  )
}

function SceneWelcome() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
      <p className="if-up text-[10px] font-semibold uppercase tracking-[0.35em] text-cream/50 sm:text-xs" style={dly(0.2)}>Welcome to</p>
      <div className="if-pop mt-4" style={dly(0.6)}><Flame size={46} /></div>
      <p className="if-up mt-3" style={dly(1)}>
        <span className="if-shimmer font-display text-2xl font-semibold uppercase tracking-[0.22em] sm:text-4xl md:text-5xl" style={dly(1.3)}>The Creatiste</span>
      </p>
      <p className="if-up mt-1 font-display text-2xl italic lowercase tracking-[0.3em] text-cream sm:text-3xl md:text-4xl" style={dly(1.8)}>command</p>
      {/* text-[16px] not text-base: the `base` colour token makes text-base also set colour */}
      <p className="if-up mt-5 max-w-md text-xs leading-relaxed text-cream/60 sm:max-w-lg sm:text-sm md:text-[16px]" style={dly(3.4)}>
        The comprehensive management platform &amp; one-stop shop for chefs, caterers and all culinary professionals.
      </p>
    </div>
  )
}

function SceneEverything() {
  const items = [
    ['calendar', 'Bookings'], ['cup', 'Tastings'], ['users', 'Clients'],
    ['book', 'Recipes'], ['box', 'Inventory'], ['cart', 'Shopping'],
    ['clipboard', 'Packing'], ['doc', 'Quotes'], ['coins', 'Finances'],
    ['map', 'Routes'], ['tag', 'Suppliers'], ['sparkle', 'Mise AI'],
  ]
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 text-center sm:px-10">
      <p className="if-up font-display text-lg font-semibold text-cream sm:text-2xl md:text-3xl" style={dly(0.2)}>
        Everything, <em className="italic text-copper">in one place.</em>
      </p>
      <div className="mt-4 grid w-full max-w-xl grid-cols-3 gap-1.5 sm:mt-6 sm:grid-cols-4 sm:gap-2">
        {items.map(([icon, label], i) => (
          <div key={label} className="if-pop flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-2 sm:gap-2 sm:px-2.5" style={dly(0.7 + i * 0.45)}>
            <Icon name={icon} size={13} className="shrink-0 text-copper" />
            <span className="truncate text-[10px] font-medium text-cream/85 sm:text-xs">{label}</span>
          </div>
        ))}
      </div>
      <p className="if-up mt-4 text-xs italic text-cream/55 sm:mt-5 sm:text-sm" style={dly(7.4)}>One login. One source of truth.</p>
    </div>
  )
}

function SceneGap() {
  const old = ['Six different apps', 'Spreadsheets', 'Notes app', 'Group chats', 'Paper lists', 'Pure memory']
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center sm:gap-4 sm:px-12">
      <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {old.map((label, i) => (
          <span key={label} className="if-fade-dim rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[11px] text-cream/80 sm:text-xs" style={dly(0.2 + i * 0.5)}>
            {label}
          </span>
        ))}
      </div>
      <div className="if-in text-copper" style={dly(3.4)}><Icon name="down" size={22} /></div>
      <div className="if-pop flex items-center gap-2.5 rounded-xl bg-copper px-5 py-3 text-ink shadow-pop sm:px-6" style={dly(3.9)}>
        <Flame size={22} />
        <span className="font-display text-[16px] font-semibold sm:text-xl">One command centre</span>
      </div>
      <p className="if-up mt-1 max-w-sm font-display text-sm italic text-cream/70 sm:text-lg" style={dly(5.6)}>
        Built by a caterer who&rsquo;s lived your prep days.
      </p>
    </div>
  )
}

function SceneCta() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
      <p className="if-up text-[10px] font-semibold uppercase tracking-[0.3em] text-copper sm:text-xs" style={dly(0.2)}>Your move, chef</p>
      <p className="if-up mt-4 font-display text-2xl font-semibold leading-tight text-cream sm:text-4xl md:text-5xl" style={dly(0.9)}>
        Take command <em className="italic text-copper">of your craft.</em>
      </p>
      <div className="if-pop mt-5 rounded-full border border-copper/40 bg-copper/10 px-4 py-1.5 text-[11px] font-semibold text-copper sm:text-sm" style={dly(2.4)}>
        5-day free trial · no card needed for the trial
      </div>
      <p className="if-up mt-3 text-[11px] text-cream/55 sm:text-sm" style={dly(3.6)}>
        Create your account · book your welcome call · your trial begins
      </p>
      <div className="if-in mt-6 flex items-center gap-2 opacity-80" style={dly(5)}>
        <Flame size={18} />
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-copper">The Creatiste</span>
        <span className="font-display text-xs italic lowercase text-cream">command</span>
      </div>
    </div>
  )
}

/* ------------------------------ voice selection ------------------------------ */
function pickVoice(voices) {
  const FEMALE = /sonia|libby|hazel|maisie|kate|serena|martha|stephanie|olivia|amy|emma|joanna|salli|samantha|victoria|karen|moira|tessa|fiona|aria|jenny|natasha|zira|catherine/
  const MALE = /\b(daniel|arthur|george|brian|guy|david|mark|james|oliver|thomas|fred|alex|ryan|aaron|gordon|eddy|reed|rocko|grandpa)\b/
  const score = (v) => {
    if (!/^en[-_]?/i.test(v.lang)) return -1
    const name = v.name.toLowerCase()
    let s = 1
    if (/en[-_]gb/i.test(v.lang)) s += 4
    if (name.includes('female') || name.includes('woman')) s += 8
    else if (FEMALE.test(name)) s += 6
    if (/\bmale\b/.test(name.replace('female', '')) || MALE.test(name)) s -= 10
    if (name.includes('natural') || name.includes('neural') || name.includes('premium') || name.includes('enhanced')) s += 2
    return s
  }
  return [...voices].filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a))[0] || null
}

/* ---------------------------------- player ----------------------------------- */
export default function IntroFilm({ ctaTo = '/register', ctaLabel = 'Start your free trial' }) {
  const [phase, setPhase] = useState('poster') // poster | playing | paused | ended
  const [scene, setScene] = useState(0)
  const [tick, setTick] = useState(0) // bumps on every scene (re)start so animations replay
  const [sound, setSound] = useState(true)
  const [voiceReady, setVoiceReady] = useState(false)

  const voiceRef = useRef(null)
  const soundRef = useRef(true)
  const runRef = useRef(0) // invalidates timers/utterances from earlier scenes
  const timersRef = useRef([])
  const gateRef = useRef({ timer: true, voice: true })
  soundRef.current = sound

  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!speechOk) return
    const refresh = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices())
      setVoiceReady(!!voiceRef.current)
    }
    refresh()
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh)
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', refresh)
      window.speechSynthesis.cancel()
      timersRef.current.forEach(clearTimeout)
    }
  }, [speechOk])

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
  const arm = (ms, fn) => timersRef.current.push(setTimeout(fn, ms))
  const hush = () => { if (speechOk) window.speechSynthesis.cancel() }

  const maybeAdvance = (run, i) => {
    if (runRef.current !== run) return
    if (!gateRef.current.timer || !gateRef.current.voice) return
    if (i + 1 < SCENES.length) startScene(i + 1)
    else { runRef.current += 1; clearTimers(); hush(); setPhase('ended') }
  }

  const speakScene = (run, i) => {
    gateRef.current.voice = false
    const u = new SpeechSynthesisUtterance(SCENES[i].speech)
    u.voice = voiceRef.current
    u.lang = voiceRef.current.lang
    u.rate = 0.95
    u.pitch = 1.06
    u.onend = u.onerror = () => { if (runRef.current === run) { gateRef.current.voice = true; maybeAdvance(run, i) } }
    arm(SCENES[i].dur + 8000, () => { if (runRef.current === run) { gateRef.current.voice = true; maybeAdvance(run, i) } })
    window.speechSynthesis.speak(u)
    window.speechSynthesis.resume() // Chrome sometimes queues paused
  }

  const startScene = (i) => {
    const run = ++runRef.current
    clearTimers()
    hush()
    setScene(i)
    setTick((t) => t + 1)
    gateRef.current = { timer: false, voice: true }
    arm(SCENES[i].dur, () => { if (runRef.current === run) { gateRef.current.timer = true; maybeAdvance(run, i) } })
    if (soundRef.current && voiceRef.current) speakScene(run, i)
  }

  const play = () => { setPhase('playing'); startScene(0) }
  const pause = () => { runRef.current += 1; clearTimers(); hush(); setPhase('paused') }
  const resume = () => { setPhase('playing'); startScene(scene) } // scenes restart so voice & motion stay in sync
  const seek = (i) => { setPhase('playing'); startScene(i) }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    if (phase !== 'playing' || !speechOk) return
    if (!next) {
      hush()
      gateRef.current.voice = true
      maybeAdvance(runRef.current, scene)
    } else if (voiceRef.current) {
      speakScene(runRef.current, scene)
    }
  }

  const stageClick = () => {
    if (phase === 'playing') pause()
    else if (phase === 'paused') resume()
  }

  const onKey = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (phase === 'playing' || phase === 'paused') { e.preventDefault(); stageClick() }
  }

  const ActiveScene = SCENES[scene].View

  return (
    <div
      role="region"
      aria-label="Introduction film — The Creatiste Command"
      tabIndex={0}
      onKeyDown={onKey}
      className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-2xl border border-copper/25 bg-black text-cream shadow-pop outline-none ring-1 ring-black/40 focus-visible:ring-2 focus-visible:ring-copper/60 sm:aspect-video"
    >
      {/* Ambient candlelight + vignette, present in every frame */}
      <div className={cls('absolute inset-0', phase === 'paused' && 'if-paused')} onClick={stageClick} aria-hidden>
        <div className="if-orb left-[8%] top-[10%] h-40 w-40 bg-copper/25 sm:h-52 sm:w-52" />
        <div className="if-orb bottom-[6%] right-[5%] h-48 w-48 bg-copper/15 sm:h-64 sm:w-64" style={{ animationDelay: '-7s', animationDuration: '18s' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 95% at 50% 8%, transparent 38%, rgba(0,0,0,0.55) 100%)' }} />

        {/* Scene stage — bounded above the caption/controls zone so nothing collides */}
        {phase !== 'poster' && (
          <div key={`${scene}-${tick}`} className="absolute inset-x-0 bottom-36 top-8 sm:bottom-28 sm:top-10">
            <ActiveScene />
          </div>
        )}
      </div>

      {/* During-play chrome: counter + captions + controls */}
      {(phase === 'playing' || phase === 'paused') && (
        <>
          <div className="pointer-events-none absolute left-4 top-3.5 flex items-center gap-2 opacity-70">
            <Flame size={15} />
            <span className="font-display text-[9px] font-semibold uppercase tracking-[0.22em] text-copper">The Creatiste Command</span>
          </div>
          <span className="pointer-events-none absolute right-4 top-3.5 text-[10px] font-medium tabular-nums text-cream/45">{scene + 1} / {SCENES.length}</span>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-12 sm:px-5 sm:pb-4">
            <p key={`cap-${scene}-${tick}`} aria-live="polite"
              className="if-in mx-auto mb-2.5 min-h-[3.75rem] max-w-2xl text-center text-[12px] leading-relaxed text-cream/90 drop-shadow sm:mb-3 sm:min-h-[2.75rem] sm:text-[14px]">
              {SCENES[scene].caption}
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={(e) => { e.stopPropagation(); stageClick() }} aria-label={phase === 'playing' ? 'Pause' : 'Play'}
                className="rounded-full bg-white/10 p-2 text-cream transition-colors hover:bg-white/20">
                <Icon name={phase === 'playing' ? 'pause' : 'play'} size={15} />
              </button>
              <div className="flex flex-1 gap-1">
                {SCENES.map((s, i) => {
                  const done = i < scene
                  const active = i === scene
                  return (
                    <button key={s.key} onClick={(e) => { e.stopPropagation(); seek(i) }} aria-label={`Go to part ${i + 1}`} className="flex-1 py-1.5">
                      <span className="block h-1 overflow-hidden rounded-full bg-white/20">
                        {done && <span className="block h-full w-full rounded-full bg-copper" />}
                        {active && phase === 'playing' && (
                          <span key={tick} className="block h-full rounded-full bg-copper" style={{ animation: `if-fill ${s.dur}ms linear forwards` }} />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              {speechOk && (
                <button onClick={(e) => { e.stopPropagation(); toggleSound() }}
                  aria-label={sound ? 'Mute voiceover' : 'Unmute voiceover'}
                  title={voiceReady ? (sound ? 'Mute voiceover' : 'Unmute voiceover') : 'Voiceover unavailable on this device — captions are on'}
                  className={cls('rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20', sound && voiceReady ? 'text-cream' : 'text-cream/40')}>
                  <Icon name={sound && voiceReady ? 'sound' : 'soundOff'} size={15} />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); seek(0) }} aria-label="Restart film"
                className="rounded-full bg-white/10 p-2 text-cream transition-colors hover:bg-white/20">
                <Icon name="replay" size={15} />
              </button>
            </div>
          </div>

          {phase === 'paused' && (
            <button onClick={resume} aria-label="Resume" className="absolute inset-0 z-10 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-copper/90 text-ink shadow-pop transition-transform hover:scale-110">
                <Icon name="play" size={24} strokeWidth={2} />
              </span>
            </button>
          )}
        </>
      )}

      {/* Poster frame */}
      {phase === 'poster' && (
        <button onClick={play} className="group absolute inset-0 z-10 flex w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-copper/80 sm:text-[10px]">The introduction · {TOTAL_LABEL}</span>
          <span className="flex flex-col items-center">
            <Flame size={40} />
            <span className="mt-2 font-display text-xl font-semibold uppercase tracking-[0.22em] text-copper sm:text-3xl">The Creatiste</span>
            <span className="font-display text-xl italic lowercase tracking-[0.3em] text-cream sm:text-2xl">command</span>
          </span>
          <span className="max-w-xs font-display text-sm italic text-cream/65 sm:text-[16px]">Your kitchen. Your business. One command centre.</span>
          <span className="mt-1 grid h-16 w-16 place-items-center rounded-full bg-copper text-ink shadow-pop transition-transform group-hover:scale-110">
            <Icon name="play" size={26} strokeWidth={2} />
          </span>
          <span className="text-[11px] text-cream/50 sm:text-xs">Press play — sound on, captions included</span>
        </button>
      )}

      {/* End card */}
      {phase === 'ended' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <Flame size={34} />
          <p className="font-display text-2xl font-semibold sm:text-3xl">Ready when you are, <em className="italic text-copper">chef.</em></p>
          <p className="max-w-md text-xs leading-relaxed text-cream/65 sm:text-sm">
            Create your account, book your welcome call, and your free trial begins — no card needed for the trial.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <Link to={ctaTo}><Button size="lg" icon="arrowRight">{ctaLabel}</Button></Link>
            <button onClick={() => { setPhase('playing'); startScene(0) }}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:bg-white/10 hover:text-cream">
              <Icon name="replay" size={15} /> Watch again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
