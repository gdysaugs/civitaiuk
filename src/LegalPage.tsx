import type { ReactNode } from 'react'

type LegalPageProps = {
  type: 'terms' | 'tokushoho'
}

const sellerRows = [
  ['販売事業者', '要請があれば開示'],
  ['運営責任者', '要請があれば開示'],
  ['所在地', '要請があれば開示'],
  ['電話番号', '要請があれば開示'],
  ['販売価格', '購入ページに表示された金額'],
  ['商品代金以外の必要料金', 'インターネット接続料金、通信料金等はお客様の負担となります。'],
  ['支払方法', 'クレジットカードその他Stripeが提供する決済方法'],
  ['支払時期', '購入手続き完了時に決済されます。'],
  ['商品の引渡時期', '決済完了後、通常ただちにアカウントのトークン残高へ反映されます。'],
  ['返品・キャンセル', 'デジタル商品の性質上、購入完了後のお客様都合による返品・キャンセルには対応していません。'],
  ['動作環境', '最新版の主要ブラウザおよび安定したインターネット接続が必要です。'],
] as const

function LegalShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="app legal-app">
      <header className="topbar">
        <a className="brand brand-link" href="/" aria-label="トップへ戻る">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p>SparkBeat</p>
            <strong>{title}</strong>
          </div>
        </a>
      </header>

      <main className="legal-layout">
        <section className="legal-document">
          <p className="eyebrow">LEGAL</p>
          <h1>{title}</h1>
          <p className="legal-lead">{subtitle}</p>
          {children}
        </section>
      </main>
    </div>
  )
}

function Terms() {
  return (
    <LegalShell title="利用規約" subtitle="Civitai UKのToken Invadersおよびトークン購入に関する条件です。">
      <article className="legal-section">
        <h2>第1条 サービス内容</h2>
        <p>
          本サービスは、ログインユーザーがトークンを消費してブラウザゲームをプレイできるサービスです。
          トークンは本サービス内で利用できます。
        </p>
      </article>

      <article className="legal-section">
        <h2>第2条 アカウント</h2>
        <p>
          本サービスの利用にはGoogleログインが必要です。利用者は、自身のアカウントを適切に管理し、
          第三者に利用させないものとします。
        </p>
      </article>

      <article className="legal-section">
        <h2>第3条 トークン</h2>
        <p>
          ゲームの開始時に所定数のトークンを消費します。通信障害、不正利用、システム保守等により、
          一時的に残高表示や反映が遅れる場合があります。
        </p>
      </article>

      <article className="legal-section">
        <h2>第4条 決済</h2>
        <p>
          トークン購入はStripeが提供する決済機能を通じて行われます。決済完了後、購入したトークンが付与されます。
        </p>
      </article>

      <article className="legal-section">
        <h2>第5条 禁止事項</h2>
        <p>
          不正アクセス、システムへの過度な負荷、リバースエンジニアリング、第三者の権利侵害、
          その他運営者が不適切と判断する行為を禁止します。
        </p>
      </article>

      <article className="legal-section">
        <h2>第6条 免責</h2>
        <p>
          運営者は、サービスの中断、停止、仕様変更、データの遅延や消失等により利用者に生じた損害について、
          法令上認められる範囲で責任を負いません。
        </p>
      </article>

      <article className="legal-section">
        <h2>第7条 規約変更</h2>
        <p>
          運営者は、必要に応じて本規約を変更できます。変更後の規約は、本ページに掲載した時点から効力を生じます。
        </p>
      </article>

      <p className="legal-updated">制定日: 2026年6月13日</p>
    </LegalShell>
  )
}

function Tokushoho() {
  return (
    <LegalShell title="特定商取引法に基づく表記" subtitle="トークン販売に関する事業者情報です。">
      <div className="legal-table">
        {sellerRows.map(([label, value]) => (
          <div className="legal-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </div>
      <p className="legal-updated">制定日: 2026年6月13日</p>
    </LegalShell>
  )
}

export function LegalPage({ type }: LegalPageProps) {
  return type === 'terms' ? <Terms /> : <Tokushoho />
}
