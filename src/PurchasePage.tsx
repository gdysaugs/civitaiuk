import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

type PurchasePageProps = {
  configReady: boolean
  session: Session | null
  tickets: number | null
  message: string
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshTickets: () => Promise<void>
}

const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 30,
    price: '570円',
  },
  {
    id: 'standard',
    name: 'Standard',
    tokens: 110,
    price: '1,980円',
  },
  {
    id: 'premium',
    name: 'Premium',
    tokens: 280,
    price: '4,980円',
  },
] as const

type PackageOption = (typeof PACKAGES)[number]

const PENDING_CHECKOUT_KEY = 'civitaiuk_pending_checkout_package'

const parseApiJson = async (response: Response) => {
  const value = await response.json().catch(() => ({}))
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '')

export function PurchasePage({
  configReady,
  session,
  tickets,
  message,
  login,
  logout,
  refreshTickets,
}: PurchasePageProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<(typeof PACKAGES)[number]['id']>('standard')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const selectedPackage = useMemo(
    () => PACKAGES.find((item) => item.id === selectedPackageId) ?? PACKAGES[0],
    [selectedPackageId],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get('checkout')
    if (checkoutStatus === 'success') {
      setStatus('購入後すぐに残高に反映されます。')
      refreshTickets().catch(() => null)
    }
    if (checkoutStatus === 'cancel') {
      setStatus('購入はキャンセルされました。')
    }
  }, [refreshTickets])

  const startCheckout = async (targetPackage: PackageOption = selectedPackage) => {
    if (isLoading) return
    setSelectedPackageId(targetPackage.id)
    if (!session) {
      window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, targetPackage.id)
      await login()
      return
    }
    setIsLoading(true)
    setStatus('Stripe購入ページを作成しています。')
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageId: targetPackage.id }),
      })
      const data = await parseApiJson(response)
      if (!response.ok || typeof data.url !== 'string') {
        throw new Error(asString(data.error) || '購入ページの作成に失敗しました。')
      }
      window.location.assign(data.url)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '購入ページの作成に失敗しました。')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!session || !configReady || isLoading) return

    const pendingPackageId = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)
    const pendingPackage = PACKAGES.find((item) => item.id === pendingPackageId)
    if (!pendingPackage) {
      if (pendingPackageId) window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
      return
    }

    window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
    void startCheckout(pendingPackage)
  }, [configReady, isLoading, session])

  return (
    <div className="app purchase-app">
      <header className="topbar">
        <div className="brand" aria-label="Token Store">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p>SparkBeat</p>
            <strong>Token Store</strong>
          </div>
        </div>
        <div className="account">
          <span>{session?.user.email ?? '未ログイン'}</span>
          {session ? (
            <button type="button" className="button button--ghost" onClick={logout}>
              ログアウト
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={login} disabled={!configReady}>
              Googleログイン
            </button>
          )}
        </div>
      </header>

      <main className="purchase-layout">
        <section className="purchase-hero" aria-label="トークン購入">
          <p className="eyebrow">CHECKOUT</p>
          <h1>トークンを購入する</h1>
          <p>購入後すぐに残高に反映されます。</p>
          <div className="purchase-summary">
            <span>現在のトークン</span>
            <strong>{session ? tickets ?? '--' : '--'}</strong>
          </div>
        </section>

        <section className="purchase-panel" aria-label="購入プラン">
          <div className="package-grid">
            {PACKAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`package-card${selectedPackage.id === item.id ? ' is-active' : ''}`}
                onClick={() => {
                  void startCheckout(item)
                }}
                disabled={isLoading || !configReady}
                aria-label={`${item.name} ${item.tokens}トークン ${item.price}で購入`}
              >
                <span>{item.name}</span>
                <strong>{item.tokens}トークン</strong>
                <em>{item.price}</em>
              </button>
            ))}
          </div>

          <div className="purchase-status">
            <p>{status || message}</p>
            {session && (
              <button type="button" className="button button--ghost" onClick={refreshTickets}>
                残高を更新
              </button>
            )}
          </div>
        </section>
      </main>

    </div>
  )
}
