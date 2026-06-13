import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { LegalPage } from './LegalPage'
import { PurchasePage } from './PurchasePage'

type Config = {
  supabaseUrl: string
  supabaseAnonKey: string
}

type GamePhase = 'idle' | 'running' | 'won' | 'lost'

type Shot = {
  x: number
  y: number
  vy: number
  owner: 'player' | 'enemy'
}

type Invader = {
  x: number
  y: number
  alive: boolean
  row: number
  col: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

const GAME_WIDTH = 900
const GAME_HEIGHT = 600
const PLAY_COST = 1

const parseApiJson = async (response: Response) => {
  const value = await response.json().catch(() => ({}))
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '')

const fetchConfig = async () => {
  const response = await fetch('/api/config')
  const data = await parseApiJson(response)
  if (!response.ok) throw new Error(asString(data.error) || '設定の取得に失敗しました。')
  return data as Config
}

const apiFetch = async (path: string, session: Session, init: RequestInit = {}) => {
  return fetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}

function drawPixelShip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#75ff83'
  ctx.fillRect(x - 18, y + 10, 36, 8)
  ctx.fillRect(x - 10, y + 2, 20, 8)
  ctx.fillRect(x - 4, y - 8, 8, 10)
  ctx.fillStyle = '#f8ffb5'
  ctx.fillRect(x - 3, y - 14, 6, 6)
}

function drawInvader(ctx: CanvasRenderingContext2D, invader: Invader, tick: number) {
  const x = invader.x
  const y = invader.y
  const wobble = Math.sin(tick / 180 + invader.col) > 0 ? 2 : -2
  ctx.fillStyle = invader.row % 2 === 0 ? '#ff4fd8' : '#56e7ff'
  ctx.fillRect(x - 18, y - 10, 36, 8)
  ctx.fillRect(x - 24, y - 2, 48, 14)
  ctx.fillRect(x - 14, y + 12, 8, 8)
  ctx.fillRect(x + 6, y + 12, 8, 8)
  ctx.fillStyle = '#050509'
  ctx.fillRect(x - 10, y, 6, 6)
  ctx.fillRect(x + 4, y, 6, 6)
  ctx.fillStyle = '#fffb8f'
  ctx.fillRect(x - 24 + wobble, y + 18, 10, 4)
  ctx.fillRect(x + 14 - wobble, y + 18, 10, 4)
}

function buildInvaders() {
  const invaders: Invader[] = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      invaders.push({
        x: 145 + col * 68,
        y: 92 + row * 52,
        row,
        col,
        alive: true,
      })
    }
  }
  return invaders
}

function GameCanvas({
  runId,
  onEnd,
  onScore,
}: {
  runId: string
  onEnd: (phase: Exclude<GamePhase, 'idle' | 'running'>) => void
  onScore: (score: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const keysRef = useRef(new Set<string>())
  const touchRef = useRef({ left: false, right: false, fire: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let active = true
    let frame = 0

    const state = {
      playerX: GAME_WIDTH / 2,
      playerY: GAME_HEIGHT - 70,
      lives: 3,
      score: 0,
      direction: 1,
      invaderSpeed: 25,
      invaders: buildInvaders(),
      shots: [] as Shot[],
      particles: [] as Particle[],
      lastTime: performance.now(),
      shotCooldown: 0,
      enemyCooldown: 900,
      ended: false,
      resultPhase: null as Exclude<GamePhase, 'idle' | 'running'> | null,
      tick: 0,
    }

    onScore(0)

    const burst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 14; i += 1) {
        const angle = (Math.PI * 2 * i) / 14
        state.particles.push({
          x,
          y,
          vx: Math.cos(angle) * (50 + Math.random() * 120),
          vy: Math.sin(angle) * (50 + Math.random() * 120),
          life: 420,
          color,
        })
      }
    }

    const endGame = (nextPhase: Exclude<GamePhase, 'idle' | 'running'>) => {
      if (state.ended) return
      state.ended = true
      state.resultPhase = nextPhase
      onEnd(nextPhase)
    }

    const shoot = () => {
      if (state.shotCooldown > 0) return
      state.shots.push({ x: state.playerX, y: state.playerY - 18, vy: -520, owner: 'player' })
      state.shotCooldown = 260
    }

    const loop = (now: number) => {
      if (!active) return
      const dt = Math.min(0.032, (now - state.lastTime) / 1000)
      state.lastTime = now
      state.tick += dt * 1000

      const keys = keysRef.current
      const touch = touchRef.current
      const movingLeft = keys.has('ArrowLeft') || keys.has('a') || keys.has('A') || touch.left
      const movingRight = keys.has('ArrowRight') || keys.has('d') || keys.has('D') || touch.right
      const firing = keys.has(' ') || keys.has('Spacebar') || touch.fire

      if (!state.ended) {
        if (movingLeft) state.playerX -= 330 * dt
        if (movingRight) state.playerX += 330 * dt
        state.playerX = Math.max(38, Math.min(GAME_WIDTH - 38, state.playerX))
        state.shotCooldown = Math.max(0, state.shotCooldown - dt * 1000)
        state.enemyCooldown -= dt * 1000
        if (firing) shoot()

        const alive = state.invaders.filter((invader) => invader.alive)
        let edgeHit = false
        for (const invader of alive) {
          invader.x += state.direction * state.invaderSpeed * dt
          if (invader.x > GAME_WIDTH - 50 || invader.x < 50) edgeHit = true
        }
        if (edgeHit) {
          state.direction *= -1
          state.invaderSpeed += 4
          for (const invader of alive) invader.y += 18
        }

        if (state.enemyCooldown <= 0 && alive.length > 0) {
          const shooter = alive[Math.floor(Math.random() * alive.length)]
          state.shots.push({ x: shooter.x, y: shooter.y + 26, vy: 250 + state.invaderSpeed, owner: 'enemy' })
          state.enemyCooldown = Math.max(260, 980 - state.invaderSpeed * 8)
        }

        for (const shot of state.shots) {
          shot.y += shot.vy * dt
        }

        for (const shot of state.shots) {
          if (shot.owner !== 'player') continue
          for (const invader of alive) {
            if (!invader.alive) continue
            if (Math.abs(shot.x - invader.x) < 28 && Math.abs(shot.y - invader.y) < 24) {
              invader.alive = false
              shot.y = -100
              state.score += 10
              onScore(state.score)
              burst(invader.x, invader.y, invader.row % 2 === 0 ? '#ff4fd8' : '#56e7ff')
              break
            }
          }
        }

        for (const shot of state.shots) {
          if (shot.owner !== 'enemy') continue
          if (Math.abs(shot.x - state.playerX) < 24 && Math.abs(shot.y - state.playerY) < 22) {
            shot.y = GAME_HEIGHT + 100
            state.lives -= 1
            burst(state.playerX, state.playerY, '#75ff83')
            if (state.lives <= 0) endGame('lost')
          }
        }

        state.shots = state.shots.filter((shot) => shot.y > -40 && shot.y < GAME_HEIGHT + 40)
        if (state.invaders.every((invader) => !invader.alive)) endGame('won')
        if (alive.some((invader) => invader.y > state.playerY - 42)) endGame('lost')
      }

      for (const particle of state.particles) {
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.life -= dt * 1000
      }
      state.particles = state.particles.filter((particle) => particle.life > 0)

      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
      gradient.addColorStop(0, '#070710')
      gradient.addColorStop(0.58, '#101018')
      gradient.addColorStop(1, '#050509')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      ctx.fillStyle = 'rgba(255,255,255,0.46)'
      for (let i = 0; i < 80; i += 1) {
        const x = (i * 97 + Math.floor(state.tick / 20)) % GAME_WIDTH
        const y = (i * 53 + Math.floor(state.tick / 35)) % GAME_HEIGHT
        ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
      }

      ctx.strokeStyle = 'rgba(117,255,131,0.34)'
      ctx.lineWidth = 2
      ctx.strokeRect(18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36)

      for (const invader of state.invaders) {
        if (invader.alive) drawInvader(ctx, invader, state.tick)
      }

      drawPixelShip(ctx, state.playerX, state.playerY)
      for (const shot of state.shots) {
        ctx.fillStyle = shot.owner === 'player' ? '#fff589' : '#ff6a8d'
        ctx.fillRect(shot.x - 3, shot.y - 12, 6, 18)
      }

      for (const particle of state.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / 420)
        ctx.fillStyle = particle.color
        ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6)
      }
      ctx.globalAlpha = 1

      ctx.fillStyle = '#effff0'
      ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(`SCORE ${String(state.score).padStart(4, '0')}`, 34, 48)
      ctx.fillText(`LIFE ${state.lives}`, GAME_WIDTH - 120, 48)

      if (state.ended) {
        ctx.fillStyle = 'rgba(5,5,9,0.74)'
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
        ctx.fillStyle = state.resultPhase === 'won' ? '#75ff83' : '#ff6a8d'
        ctx.font = '900 54px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(state.resultPhase === 'won' ? 'CLEAR' : 'GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12)
        ctx.fillStyle = '#f7f7ff'
        ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.fillText('もう一度遊ぶには新しく1トークン消費します', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32)
        ctx.textAlign = 'left'
      }

      frame = requestAnimationFrame(loop)
    }

    const down = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(event.key)) event.preventDefault()
      keysRef.current.add(event.key)
    }
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key)

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    frame = requestAnimationFrame(loop)

    return () => {
      active = false
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keysRef.current.clear()
      touchRef.current = { left: false, right: false, fire: false }
    }
  }, [runId, onEnd, onScore])

  const setTouch = (key: keyof typeof touchRef.current, value: boolean) => {
    touchRef.current[key] = value
  }

  return (
    <div className="game-shell">
      <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="game-canvas" />
      <div className="mobile-controls" aria-label="モバイル操作">
        <button
          type="button"
          onPointerDown={() => setTouch('left', true)}
          onPointerUp={() => setTouch('left', false)}
          onPointerLeave={() => setTouch('left', false)}
        >
          LEFT
        </button>
        <button
          type="button"
          onPointerDown={() => setTouch('fire', true)}
          onPointerUp={() => setTouch('fire', false)}
          onPointerLeave={() => setTouch('fire', false)}
        >
          FIRE
        </button>
        <button
          type="button"
          onPointerDown={() => setTouch('right', true)}
          onPointerUp={() => setTouch('right', false)}
          onPointerLeave={() => setTouch('right', false)}
        >
          RIGHT
        </button>
      </div>
    </div>
  )
}

export function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [tickets, setTickets] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [runId, setRunId] = useState('')
  const [message, setMessage] = useState('読み込み中...')
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    fetchConfig()
      .then((nextConfig) => {
        setConfig(nextConfig)
        setClient(
          createClient(nextConfig.supabaseUrl, nextConfig.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          }),
        )
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '設定の取得に失敗しました。'))
  }, [])

  useEffect(() => {
    if (!client) return
    client.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setMessage(data.session ? 'トークンを確認しています。' : 'Googleログインするとプレイできます。')
    })
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setMessage(nextSession ? 'トークンを確認しています。' : 'Googleログインするとプレイできます。')
      if (!nextSession) setTickets(null)
    })
    return () => subscription.unsubscribe()
  }, [client])

  useEffect(() => {
    if (!client || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const hasCode = url.searchParams.has('code')
    const hasState = url.searchParams.has('state')
    if (!hasCode || !hasState) return

    client.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        setMessage(error.message)
        return
      }
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState({}, document.title, url.toString())
    })
  }, [client])

  const refreshTickets = useCallback(async () => {
    if (!session) return
    const response = await apiFetch('/api/tickets', session)
    const data = await parseApiJson(response)
    if (!response.ok) throw new Error(asString(data.error) || 'トークン情報の取得に失敗しました。')
    setTickets(Number(data.tickets ?? 0))
    setMessage('')
  }, [session])

  useEffect(() => {
    if (!session) return
    refreshTickets().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'トークン情報の取得に失敗しました。')
    })
  }, [refreshTickets, session])

  const login = async () => {
    if (!client) return
    setMessage('Googleログインへ移動します。')
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        skipBrowserRedirect: true,
      },
    })
    if (error) {
      setMessage(error.message)
      return
    }
    if (data?.url) window.location.assign(data.url)
  }

  const logout = async () => {
    if (!client) return
    await client.auth.signOut()
    setRunId('')
    setScore(0)
  }

  const handleGameEnd = useCallback((phase: Exclude<GamePhase, 'idle' | 'running'>) => {
    setMessage(phase === 'won' ? 'クリアしました。' : 'ゲーム終了です。')
  }, [])

  const startGame = async () => {
    if (!session || isStarting) return
    setIsStarting(true)
    setMessage('トークンを消費しています。')
    try {
      const response = await apiFetch('/api/play', session, { method: 'POST' })
      const data = await parseApiJson(response)
      if (!response.ok) throw new Error(asString(data.error) || 'プレイ開始に失敗しました。')
      setTickets(Number(data.tickets ?? 0))
      setRunId(String(data.playId || Date.now()))
      setScore(0)
      setMessage('プレイ中です。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'プレイ開始に失敗しました。')
    } finally {
      setIsStarting(false)
    }
  }

  const canStart = Boolean(session && !isStarting)
  const ticketLabel = session ? (tickets === null ? '--' : tickets) : '--'
  const userLabel = useMemo(() => session?.user.email ?? '未ログイン', [session])
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isPurchasePath = ['/purchage', '/purchase'].includes(pathname)
  const legalType = pathname === '/terms' ? 'terms' : pathname === '/tokushoho' ? 'tokushoho' : null

  if (legalType) {
    return <LegalPage type={legalType} />
  }

  if (isPurchasePath) {
    return (
      <PurchasePage
        configReady={Boolean(config)}
        session={session}
        tickets={tickets}
        message={message}
        login={login}
        logout={logout}
        refreshTickets={refreshTickets}
      />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p>Civitai UK</p>
            <strong>Token Invaders</strong>
          </div>
        </div>
        <div className="account">
          <span>{userLabel}</span>
          <a className="button button--ghost" href="/purchage">
            購入
          </a>
          {session ? (
            <button type="button" className="button button--ghost" onClick={logout}>
              ログアウト
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={login} disabled={!config}>
              Googleログイン
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="game-panel" aria-label="インベーダーゲーム">
          {runId ? (
            <GameCanvas
              runId={runId}
              onScore={setScore}
              onEnd={handleGameEnd}
            />
          ) : (
            <div className="attract">
              <div className="attract-invader" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h1>Token Invaders</h1>
              <p>Googleログイン後、1トークンを消費して1プレイ開始します。</p>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="ステータス">
          <div className="meter">
            <span>トークン</span>
            <strong>{ticketLabel}</strong>
          </div>
          <div className="meter">
            <span>消費</span>
            <strong>{PLAY_COST}</strong>
          </div>
          <div className="meter">
            <span>スコア</span>
            <strong>{score}</strong>
          </div>
          <button type="button" className="button button--primary button--start" onClick={session ? startGame : login} disabled={session ? !canStart : !config}>
            {session ? (isStarting ? '開始中...' : '1トークンでプレイ') : 'Googleログイン'}
          </button>
          <a className="button button--ghost button--store" href="/purchage">
            トークン購入
          </a>
          <p className="status">{message}</p>
          <div className="howto">
            <span>操作</span>
            <p>← → / A D で移動、Spaceでショット。スマホは下のボタンで操作できます。</p>
          </div>
        </aside>
      </main>

      <footer className="legal-footer">
        <a href="/terms">利用規約</a>
        <a href="/tokushoho">特商法に基づく表記</a>
      </footer>
    </div>
  )
}
