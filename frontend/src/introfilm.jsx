import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cls } from './format'
import { Button, Flame, Icon } from './ui'
import VO from './vo-script.json'

/* ── The introduction film ────────────────────────────────────────────────────
   An embedded, self-contained brand film for the landing page: seven animated
   scenes with synchronised captions.

   Voice: when a recorded voiceover is present (frontend/public/vo.mp3 + vo.json
   cue points, produced once via scripts/render_voiceover.py), that recording is
   the master clock — scenes advance and the progress bar fill are driven off
   audio.currentTime, with crossfades and a slow Ken Burns drift so cuts feel
   like film, not a slideshow. With no recording, the film falls back to the
   browser's speech synthesis on per-scene timers (captions carry the script
   either way). The narration script lives in vo-script.json so the on-screen
   captions and the rendered audio can never drift apart. */

const dly = (s) => ({ animationDelay: `${s}s` })

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
        Built by a caterer who has lived your days of chaos.
      </p>
    </div>
  )
}

/* The product itself — a stylised mini dashboard that animates in, so the line
   "one command centre" pays off with a glimpse of the real screen. */
function SceneApp() {
  const nav = ['home', 'calendar', 'book', 'cart', 'coins']
  const stats = [['Today', '3 events'], ['Prep', '12 tasks'], ['Taken', '£4.2k']]
  const rows = [
    ['calendar', 'Harlow wedding · 120 covers'],
    ['cup', 'Tasting · the Adeyemis'],
    ['truck', 'Wholesaler delivery · 9 a.m.'],
  ]
  return (
    <div className="flex h-full items-center justify-center px-3 sm:px-8">
      <div className="if-pop w-full max-w-md overflow-hidden rounded-xl border border-copper/25 bg-[#161109] shadow-pop" style={dly(0.15)}>
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Flame size={13} />
          <span className="font-display text-[9px] font-semibold uppercase tracking-[0.18em] text-copper sm:text-[10px]">The Creatiste Command</span>
          <span className="ml-auto flex gap-1" aria-hidden>
            <i className="block h-1.5 w-1.5 rounded-full bg-white/15" />
            <i className="block h-1.5 w-1.5 rounded-full bg-white/15" />
            <i className="block h-1.5 w-1.5 rounded-full bg-copper/60" />
          </span>
        </div>
        <div className="flex">
          <div className="hidden w-24 shrink-0 flex-col gap-1 border-r border-white/10 p-2 sm:flex" aria-hidden>
            {nav.map((ic, i) => (
              <div key={ic} className="if-up flex items-center gap-1.5 rounded-md px-1.5 py-1" style={dly(0.45 + i * 0.12)}>
                <Icon name={ic} size={11} className={i === 0 ? 'text-copper' : 'text-cream/45'} />
                <span className={cls('h-1.5 flex-1 rounded', i === 0 ? 'bg-copper/40' : 'bg-white/12')} />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-2 p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {stats.map(([label, val], i) => (
                <div key={label} className="if-up rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5" style={dly(0.5 + i * 0.14)}>
                  <p className="text-[7px] font-semibold uppercase tracking-wider text-cream/45 sm:text-[8px]">{label}</p>
                  <p className="font-display text-xs font-semibold text-cream sm:text-sm">{val}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {rows.map(([ic, text], i) => (
                <div key={text} className="if-up flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.04] px-2 py-1.5" style={dly(0.95 + i * 0.18)}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-copper/15 text-copper"><Icon name={ic} size={11} /></span>
                  <span className="truncate text-[10px] text-cream/85 sm:text-xs">{text}</span>
                  <span className="ml-auto hidden h-1.5 w-8 rounded-full bg-copper/40 sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SceneCta() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
      <p className="if-up text-[10px] font-semibold uppercase tracking-[0.3em] text-copper sm:text-xs" style={dly(0.2)}>Your move, chef</p>
      <p className="if-up mt-4 font-display text-2xl font-semibold leading-tight text-cream sm:text-4xl md:text-5xl" style={dly(0.9)}>
        Take command <em className="italic text-copper">of your kitchen.</em>
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

/* Narration script + scene order come from vo-script.json; View is mapped by key. */
const VIEWS = {
  hook1: SceneHookOne,
  hook2: SceneHookTwo,
  welcome: SceneWelcome,
  everything: SceneEverything,
  gap: SceneGap,
  app: SceneApp,
  cta: SceneCta,
}
const SCENES = VO.scenes.map((s) => ({ ...s, View: VIEWS[s.key] }))
const FALLBACK_TOTAL_MS = SCENES.reduce((sum, s) => sum + s.dur, 0)

const fmtClock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`

/* Per-scene [start, end] seconds from the recorded cue points (vo.json). */
const computeBounds = (meta) => {
  const byKey = {}
  meta.cues.forEach((c) => { byKey[c.key] = c })
  const starts = SCENES.map((s) => (byKey[s.key] ? byKey[s.key].start : 0))
  return SCENES.map((s, i) => {
    const start = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1] : meta.dur || start + s.dur / 1000
    return [start, end]
  })
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
  const [prev, setPrev] = useState(null) // outgoing scene index, for the crossfade
  const [tick, setTick] = useState(0) // bumps on every scene (re)start so animations replay
  const [sound, setSound] = useState(true)
  const [voiceReady, setVoiceReady] = useState(false) // browser-TTS fallback only
  const [mode, setMode] = useState('tts') // flips to 'audio' once the recording loads
  const [meta, setMeta] = useState(null) // vo.json (cue points + duration)
  const [fill, setFill] = useState(0) // audio mode: 0..1 progress within the current scene

  const voiceRef = useRef(null)
  const soundRef = useRef(true)
  const runRef = useRef(0) // invalidates timers/utterances from earlier scenes (TTS)
  const timersRef = useRef([])
  const gateRef = useRef({ timer: true, voice: true })
  const audioRef = useRef(null) // the recorded voiceover element
  const boundsRef = useRef([]) // per-scene [start, end] seconds
  const rafRef = useRef(0)
  const sceneRef = useRef(-1) // current scene the engine has shown (-1 so the first cut animates)
  const prevTimerRef = useRef(0)
  soundRef.current = sound

  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window
  const isAudio = mode === 'audio'

  /* Browser voices for the fallback path. */
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
    }
  }, [speechOk])

  /* Probe for a recorded voiceover. Needs both the cue points and a playable
     file, and every scene must have a cue — otherwise we stay on TTS. */
  useEffect(() => {
    let alive = true
    fetch('/vo.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!alive || !m || !Array.isArray(m.cues) || !m.cues.length) return
        const have = new Set(m.cues.map((c) => c.key))
        if (!SCENES.every((s) => have.has(s.key))) return
        const a = new Audio('/vo.mp3')
        a.preload = 'auto'
        a.addEventListener('loadedmetadata', () => {
          if (!alive) return
          audioRef.current = a
          boundsRef.current = computeBounds(m)
          setMeta(m)
          setMode('audio')
        }, { once: true })
        a.addEventListener('error', () => {}, { once: true })
        a.load()
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  /* The recording ends the film. */
  useEffect(() => {
    const a = audioRef.current
    if (!isAudio || !a) return
    const onEnd = () => { cancelAnimationFrame(rafRef.current); setPhase('ended') }
    a.addEventListener('ended', onEnd)
    return () => a.removeEventListener('ended', onEnd)
  }, [isAudio])

  /* Tear everything down on unmount. */
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(prevTimerRef.current)
      timersRef.current.forEach(clearTimeout)
      if (audioRef.current) audioRef.current.pause()
      if (speechOk) window.speechSynthesis.cancel()
    }
  }, [speechOk])

  /* Cut to scene i with a crossfade (the outgoing scene fades out alongside). */
  const changeScene = useCallback((i, force) => {
    if (i === sceneRef.current && !force) return
    setPrev(sceneRef.current >= 0 && sceneRef.current !== i ? sceneRef.current : null)
    sceneRef.current = i
    setScene(i)
    setTick((t) => t + 1)
    clearTimeout(prevTimerRef.current)
    prevTimerRef.current = setTimeout(() => setPrev(null), 720)
  }, [])

  /* ---- audio path: the recording is the master clock ---- */
  const loop = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    const b = boundsRef.current
    const t = a.currentTime
    let i = b.length - 1
    for (let k = 0; k < b.length; k++) {
      if (t < b[k][1]) { i = k; break }
    }
    changeScene(i)
    const seg = b[i] || [0, 1]
    setFill(Math.min(1, Math.max(0, (t - seg[0]) / Math.max(0.1, seg[1] - seg[0]))))
    rafRef.current = requestAnimationFrame(loop)
  }, [changeScene])

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const audioPlay = (from) => {
    const a = audioRef.current
    if (!a) return
    a.muted = !soundRef.current
    try { a.currentTime = from || 0 } catch (e) { /* not seekable yet */ }
    changeScene(0, true)
    a.play().catch(() => {})
    startLoop()
  }
  const audioPause = () => {
    if (audioRef.current) audioRef.current.pause()
    cancelAnimationFrame(rafRef.current)
    setPhase('paused')
  }
  const audioResume = () => {
    const a = audioRef.current
    if (!a) return
    setPhase('playing')
    a.play().catch(() => {})
    startLoop()
  }
  const audioSeek = (i) => {
    const a = audioRef.current
    if (!a) return
    const start = (boundsRef.current[i] || [0])[0]
    try { a.currentTime = start + 0.02 } catch (e) { /* ignore */ }
    changeScene(i, true)
    setPhase('playing')
    a.play().catch(() => {})
    startLoop()
  }

  /* ---- fallback path: per-scene timers + browser speech synthesis ---- */
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
    changeScene(i, true)
    gateRef.current = { timer: false, voice: true }
    arm(SCENES[i].dur, () => { if (runRef.current === run) { gateRef.current.timer = true; maybeAdvance(run, i) } })
    if (soundRef.current && voiceRef.current) speakScene(run, i)
  }

  const ttsPause = () => { runRef.current += 1; clearTimers(); hush(); setPhase('paused') }
  const ttsResume = () => { setPhase('playing'); startScene(scene) } // scenes restart so voice & motion stay in sync
  const ttsSeek = (i) => { setPhase('playing'); startScene(i) }

  /* ---- mode-agnostic controls ---- */
  const play = () => { setPhase('playing'); if (isAudio) audioPlay(0); else startScene(0) }
  const pause = () => { if (isAudio) audioPause(); else ttsPause() }
  const resume = () => { if (isAudio) audioResume(); else ttsResume() }
  const seek = (i) => { if (isAudio) audioSeek(i); else ttsSeek(i) }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    if (isAudio) {
      if (audioRef.current) audioRef.current.muted = !next
      return
    }
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

  const renderScene = (i) => {
    const View = SCENES[i].View
    return <View />
  }

  const hasVoice = isAudio || voiceReady
  const showSound = isAudio || speechOk
  const totalLabel = fmtClock(meta?.dur ? meta.dur * 1000 : FALLBACK_TOTAL_MS)

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

        {/* Scene stage — two layers so a scene change cross-dissolves; the incoming
            layer also gets a slow Ken Burns drift. Bounded above the caption zone. */}
        {phase !== 'poster' && (
          <div className="absolute inset-x-0 bottom-36 top-8 sm:bottom-28 sm:top-10">
            {prev !== null && prev !== scene && (
              <div key={`p-${prev}-${tick}`} className="absolute inset-0 if-cross-out">{renderScene(prev)}</div>
            )}
            <div key={`s-${scene}-${tick}`} className="absolute inset-0 if-cross-in">
              <div className="if-ken">{renderScene(scene)}</div>
            </div>
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
                        {active && isAudio && <span className="block h-full rounded-full bg-copper" style={{ width: `${fill * 100}%` }} />}
                        {active && !isAudio && phase === 'playing' && (
                          <span key={tick} className="block h-full rounded-full bg-copper" style={{ animation: `if-fill ${s.dur}ms linear forwards` }} />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              {showSound && (
                <button onClick={(e) => { e.stopPropagation(); toggleSound() }}
                  aria-label={sound ? 'Mute voiceover' : 'Unmute voiceover'}
                  title={hasVoice ? (sound ? 'Mute voiceover' : 'Unmute voiceover') : 'Voiceover unavailable on this device — captions are on'}
                  className={cls('rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20', sound && hasVoice ? 'text-cream' : 'text-cream/40')}>
                  <Icon name={sound && hasVoice ? 'sound' : 'soundOff'} size={15} />
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
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-copper/80 sm:text-[10px]">The introduction · {totalLabel}</span>
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
            <button onClick={play}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:bg-white/10 hover:text-cream">
              <Icon name="replay" size={15} /> Watch again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
