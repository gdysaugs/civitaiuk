import { Link } from 'react-router-dom'
import { TopNav } from '../components/TopNav'
import './camera.css'
import './home.css'

type HomeCard = {
  title: string
  subtitle: string
  tag: string
  to: string
}

const I2V_CARDS: HomeCard[] = [
  {
    title: 'I2V Core',
    subtitle: 'Default i2v endpoint',
    tag: 'I2V',
    to: '/video?model=v0',
  },
  {
    title: 'I2V V1 Rapid',
    subtitle: 'Dynamic motion, fast scene transition',
    tag: 'I2V',
    to: '/video?model=v1',
  },
  {
    title: 'I2V V2 Smoothmix',
    subtitle: 'Smoother and stable movement',
    tag: 'I2V',
    to: '/video?model=v2',
  },
  {
    title: 'I2V V3 Remix',
    subtitle: 'Cinematic style and flexible prompts',
    tag: 'I2V',
    to: '/video?model=v3',
  },
  {
    title: 'I2V V4 Fastmove',
    subtitle: 'High-detail and stable quality',
    tag: 'I2V',
    to: '/video?model=v4',
  },
]

const I2I_CARD: HomeCard = {
  title: 'I2I Model',
  subtitle: 'Generate image from image prompt',
  tag: 'I2I',
  to: '/image',
}

export function Home() {
  return (
    <div className='home-page'>
      <TopNav />
      <main className='home-wrap'>
        <section className='home-hero'>
          <h1>Choose a Model</h1>
          <p>Select one model card to open its generation page.</p>
        </section>

        <section className='home-grid' aria-label='Model list'>
          {I2V_CARDS.map((card) => (
            <Link key={card.title} to={card.to} className='home-card'>
              <span className='home-card__tag'>{card.tag}</span>
              <h2>{card.title}</h2>
              <p>{card.subtitle}</p>
            </Link>
          ))}

          <Link to={I2I_CARD.to} className='home-card home-card--i2i'>
            <span className='home-card__tag'>{I2I_CARD.tag}</span>
            <h2>{I2I_CARD.title}</h2>
            <p>{I2I_CARD.subtitle}</p>
          </Link>
        </section>
      </main>
    </div>
  )
}
