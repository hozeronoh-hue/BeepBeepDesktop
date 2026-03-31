'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Config = {
  totalDuration: number
  alertDuration: number
  repeatCount: number
}

type ThemeOption = 'mint' | 'midnight'

type PhaseState =
  | { mode: 'idle' }
  | { mode: 'precountdown'; round: number; endsAt: number }
  | { mode: 'running'; round: number; endsAt: number; alertStarted: boolean }
  | {
      mode: 'paused'
      round: number
      pausedFrom: 'precountdown' | 'running'
      remainingMs: number
      alertStarted: boolean
    }
  | { mode: 'completed' }

const DEFAULT_CONFIG: Config = {
  totalDuration: 70,
  alertDuration: 3,
  repeatCount: 20,
}

const PRE_COUNTDOWN_SECONDS = 3

const THEMES: Array<{ id: ThemeOption; name: string; description: string }> = [
  { id: 'midnight', name: '심야 스프린트', description: '명암 대비가 큰 몰입 모드' },
  { id: 'mint', name: '민트 플래너', description: '산뜻하고 또렷한 학습 모드' },
]

function clampInput(value: string, minimum: number, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(minimum, parsed)
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

export default function HomePage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [theme, setTheme] = useState<ThemeOption>('midnight')
  const [inputs, setInputs] = useState({
    totalDuration: DEFAULT_CONFIG.totalDuration.toString(),
    alertDuration: DEFAULT_CONFIG.alertDuration.toString(),
    repeatCount: DEFAULT_CONFIG.repeatCount.toString(),
  })
  const [phase, setPhase] = useState<PhaseState>({ mode: 'idle' })
  const [now, setNow] = useState(() => Date.now())
  const [spokenEnabled, setSpokenEnabled] = useState(true)

  const finishAudioRef = useRef<HTMLAudioElement>(null)
  const intervalRef = useRef<number | null>(null)
  const phaseRef = useRef<PhaseState>({ mode: 'idle' })
  const configRef = useRef<Config>(DEFAULT_CONFIG)
  const spokenEnabledRef = useRef(true)
  const lastSpokenSecondRef = useRef<number | null>(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    spokenEnabledRef.current = spokenEnabled
  }, [spokenEnabled])

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const loadVoices = () => {
      window.speechSynthesis.getVoices()
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const cancelSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    lastSpokenSecondRef.current = null
  }

  const speakNumber = (value: number) => {
    if (!spokenEnabledRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(String(value))
    utterance.rate = 1
    utterance.pitch = 1
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  const stopTimerLoop = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startTimerLoop = () => {
    if (intervalRef.current !== null) {
      return
    }

    intervalRef.current = window.setInterval(() => {
      const currentNow = Date.now()
      const currentPhase = phaseRef.current
      const currentConfig = configRef.current

      setNow(currentNow)

      if (currentPhase.mode === 'idle' || currentPhase.mode === 'paused' || currentPhase.mode === 'completed') {
        return
      }

      if (currentPhase.mode === 'precountdown') {
        const remainingSeconds = Math.max(Math.ceil((currentPhase.endsAt - currentNow) / 1000), 0)

        if (
          remainingSeconds > 0 &&
          remainingSeconds <= PRE_COUNTDOWN_SECONDS &&
          lastSpokenSecondRef.current !== 1000 + remainingSeconds
        ) {
          lastSpokenSecondRef.current = 1000 + remainingSeconds
          speakNumber(remainingSeconds)
        }

        if (currentNow >= currentPhase.endsAt) {
          cancelSpeech()
          const nextPhase: PhaseState = {
            mode: 'running',
            round: currentPhase.round,
            endsAt: currentNow + currentConfig.totalDuration * 1000,
            alertStarted: false,
          }
          phaseRef.current = nextPhase
          setPhase(nextPhase)
        }

        return
      }

      const remainingSeconds = Math.max(Math.ceil((currentPhase.endsAt - currentNow) / 1000), 0)
      const alertStarted = currentPhase.alertStarted || remainingSeconds <= currentConfig.alertDuration

      if (
        alertStarted &&
        remainingSeconds > 0 &&
        remainingSeconds <= currentConfig.alertDuration &&
        lastSpokenSecondRef.current !== remainingSeconds
      ) {
        lastSpokenSecondRef.current = remainingSeconds
        speakNumber(remainingSeconds)
      }

      if (currentNow >= currentPhase.endsAt) {
        cancelSpeech()

        if (currentPhase.round < currentConfig.repeatCount) {
          const nextPhase: PhaseState = {
            mode: 'running',
            round: currentPhase.round + 1,
            endsAt: currentNow + currentConfig.totalDuration * 1000,
            alertStarted: false,
          }
          phaseRef.current = nextPhase
          setPhase(nextPhase)
          return
        }

        const nextPhase: PhaseState = { mode: 'completed' }
        phaseRef.current = nextPhase
        setPhase(nextPhase)
        stopTimerLoop()
        finishAudioRef.current?.play().catch(() => {})
        return
      }

      if (alertStarted !== currentPhase.alertStarted) {
        const nextPhase: PhaseState = {
          ...currentPhase,
          alertStarted,
        }
        phaseRef.current = nextPhase
        setPhase(nextPhase)
      }
    }, 100)
  }

  const display = useMemo(() => {
    if (phase.mode === 'idle') {
      return {
        round: 0,
        remainingSeconds: config.totalDuration,
        status: '대기 중',
        message: '시작 버튼을 누르면 3, 2, 1과 함께 몰입이 시작됩니다.',
      }
    }

    if (phase.mode === 'completed') {
      return {
        round: config.repeatCount,
        remainingSeconds: 0,
        status: '완료',
        message: '좋아요. 한 세트 완료했습니다. 합격까지 한 걸음 더 가까워졌어요.',
      }
    }

    if (phase.mode === 'paused') {
      return {
        round: phase.round,
        remainingSeconds: Math.ceil(phase.remainingMs / 1000),
        status: phase.pausedFrom === 'precountdown' ? '시작 전 일시정지' : '일시정지',
        message: '호흡 한번 정리하고, 다시 이어서 집중하면 됩니다.',
      }
    }

    const remainingSeconds = Math.max(Math.ceil((phase.endsAt - now) / 1000), 0)

    if (phase.mode === 'precountdown') {
      return {
        round: phase.round,
        remainingSeconds,
        status: '집중 준비',
        message: '삑삑삑. 이제 시작합니다. 답안 쓰는 손을 바로 올려보세요.',
      }
    }

    return {
      round: phase.round,
      remainingSeconds,
      status:
        phase.alertStarted && remainingSeconds <= config.alertDuration
          ? '마무리 카운트다운'
          : '집중 진행 중',
      message:
        phase.alertStarted && remainingSeconds <= config.alertDuration
          ? '끝까지 또박또박. 핵심 문장으로 마무리하세요.'
          : '139회 정보관리기술사 합격을 향해, 지금 이 한 문제에만 집중하세요.',
    }
  }, [config.alertDuration, config.repeatCount, config.totalDuration, now, phase])

  const canStart = phase.mode === 'idle' || phase.mode === 'completed'
  const canPause = phase.mode === 'precountdown' || phase.mode === 'running'
  const canResume = phase.mode === 'paused'
  const canReset = phase.mode !== 'idle'

  const handleInputChange = (key: keyof Config, value: string) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  const applyConfigFromInputs = () => {
    const nextConfig = {
      totalDuration: clampInput(inputs.totalDuration, 1, DEFAULT_CONFIG.totalDuration),
      alertDuration: clampInput(inputs.alertDuration, 0, DEFAULT_CONFIG.alertDuration),
      repeatCount: clampInput(inputs.repeatCount, 1, DEFAULT_CONFIG.repeatCount),
    }

    nextConfig.alertDuration = Math.min(nextConfig.alertDuration, nextConfig.totalDuration)
    setConfig(nextConfig)
    configRef.current = nextConfig
    setInputs({
      totalDuration: nextConfig.totalDuration.toString(),
      alertDuration: nextConfig.alertDuration.toString(),
      repeatCount: nextConfig.repeatCount.toString(),
    })

    return nextConfig
  }

  const handleStart = () => {
    const nextConfig = applyConfigFromInputs()
    const currentNow = Date.now()
    const nextPhase: PhaseState = {
      mode: 'precountdown',
      round: 1,
      endsAt: currentNow + PRE_COUNTDOWN_SECONDS * 1000,
    }

    stopTimerLoop()
    cancelSpeech()
    finishAudioRef.current?.pause()
    if (finishAudioRef.current) {
      finishAudioRef.current.currentTime = 0
    }

    setNow(currentNow)
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    setConfig(nextConfig)
    startTimerLoop()
  }

  const handlePause = () => {
    if (phase.mode !== 'precountdown' && phase.mode !== 'running') {
      return
    }

    const nextPhase: PhaseState = {
      mode: 'paused',
      round: phase.round,
      pausedFrom: phase.mode,
      remainingMs: Math.max(phase.endsAt - Date.now(), 0),
      alertStarted: phase.mode === 'running' ? phase.alertStarted : false,
    }

    stopTimerLoop()
    cancelSpeech()
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }

  const handleResume = () => {
    if (phase.mode !== 'paused') {
      return
    }

    const currentNow = Date.now()
    const nextPhase: PhaseState =
      phase.pausedFrom === 'precountdown'
        ? {
            mode: 'precountdown',
            round: phase.round,
            endsAt: currentNow + phase.remainingMs,
          }
        : {
            mode: 'running',
            round: phase.round,
            endsAt: currentNow + phase.remainingMs,
            alertStarted: phase.alertStarted,
          }

    cancelSpeech()
    setNow(currentNow)
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    startTimerLoop()
  }

  const handleReset = () => {
    stopTimerLoop()
    cancelSpeech()
    finishAudioRef.current?.pause()

    if (finishAudioRef.current) {
      finishAudioRef.current.currentTime = 0
    }

    const nextPhase: PhaseState = { mode: 'idle' }
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    setNow(Date.now())
  }

  return (
    <main className="page-shell">
      <audio ref={finishAudioRef} preload="auto" src="/audio/finish.wav" />

      <section className="timer-card">
        <div className="hero">
          <div className="hero-badge">삑삑삑</div>
          <p className="eyebrow">정보관리기술사 139회 합격 타이머</p>
          <h1>문제 하나씩, 답안 한 줄씩, 합격에 가까워집니다.</h1>
          <p className="subtle">
            시작 전에는 짧게 호흡을 맞추고, 시작 후에는 끊김 없이 몰입하세요. 오늘의 집중이 139회 합격 답안이 됩니다.
          </p>
        </div>

        <section className="theme-panel">
          <div className="theme-head">
            <h2>컬러 테마</h2>
            <p>눈에 가장 편한 분위기로 바꿔서 집중해보세요.</p>
          </div>
          <div className="theme-grid">
            {THEMES.map((item) => (
              <button
                key={item.id}
                className={`theme-chip${theme === item.id ? ' is-active' : ''}`}
                onClick={() => setTheme(item.id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="focus-board">
          <div className="focus-head">
            <span className="focus-kicker">지금 가장 중요한 것</span>
            <strong>{display.status}</strong>
          </div>
          <div className="focus-main">{formatTime(display.remainingSeconds)}</div>
          <div className="focus-footer">
            <div className="focus-round">{display.round} / {config.repeatCount} 세트</div>
            <p>{display.message}</p>
          </div>
        </section>

        <div className="metrics">
          <article className="metric highlight">
            <span className="label">현재 세트</span>
            <strong>
              {display.round} / {config.repeatCount}
            </strong>
          </article>
          <article className="metric highlight">
            <span className="label">남은 시간</span>
            <strong>{formatTime(display.remainingSeconds)}</strong>
          </article>
          <article className="metric">
            <span className="label">현재 상태</span>
            <strong>{display.status}</strong>
          </article>
        </div>

        <div className="panel-grid">
          <section className="panel settings-panel">
            <h2>타이머 설정</h2>
            <div className="field-grid">
              <label className="field">
                <span>전체 시간 (초)</span>
                <input
                  inputMode="numeric"
                  value={inputs.totalDuration}
                  onChange={(event) => handleInputChange('totalDuration', event.target.value)}
                />
              </label>
              <label className="field">
                <span>알림 시작 시간 (초)</span>
                <input
                  inputMode="numeric"
                  value={inputs.alertDuration}
                  onChange={(event) => handleInputChange('alertDuration', event.target.value)}
                />
              </label>
              <label className="field">
                <span>반복 횟수</span>
                <input
                  inputMode="numeric"
                  value={inputs.repeatCount}
                  onChange={(event) => handleInputChange('repeatCount', event.target.value)}
                />
              </label>
            </div>
            <label className="toggle">
              <input
                checked={spokenEnabled}
                onChange={(event) => setSpokenEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>음성 카운트다운 사용</span>
            </label>
            <p className="hint">
              시작할 때만 3, 2, 1 준비 카운트다운이 나오고, 이후 세트는 쉬는 시간 없이 바로 이어집니다.
            </p>
          </section>

          <section className="panel controls-panel">
            <h2>컨트롤</h2>
            <div className="button-grid">
              <button disabled={!canStart} onClick={handleStart}>
                시작
              </button>
              <button disabled={!canPause} onClick={handlePause}>
                일시정지
              </button>
              <button disabled={!canResume} onClick={handleResume}>
                재개
              </button>
              <button className="secondary" disabled={!canReset} onClick={handleReset}>
                리셋
              </button>
            </div>
            <div className="status-box">
              <p>핵심은 완벽함보다 속도입니다. 먼저 구조를 쓰고, 이어서 키워드를 채워보세요.</p>
              <p>`Date.now()` 기반으로 시간을 계산해서 긴 세트에서도 흐름이 흔들리지 않게 유지합니다.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}




