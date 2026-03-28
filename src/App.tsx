import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { Account } from './pages/Account'
import { Home } from './pages/Home'
import { Image } from './pages/Image'
import { Purchase } from './pages/Purchase'
import { Terms } from './pages/Terms'
import { Tokushoho } from './pages/Tokushoho'
import { Video } from './pages/Video'

function HomeRouteGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) return null
  if (session) return <Navigate to='/video' replace />
  return <Home />
}

function PurchaseRouteGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) return null
  if (!session) return <Navigate to='/' replace />
  return <Purchase />
}

export function App() {
  return (
    <Routes>
      <Route path='/' element={<HomeRouteGate />} />
      <Route path='/video' element={<Video />} />
      <Route path='/video-rapid' element={<Navigate to='/video?model=v4' replace />} />
      <Route path='/video-remix' element={<Navigate to='/video?model=v3' replace />} />
      <Route path='/fastmove' element={<Navigate to='/video?model=v1' replace />} />
      <Route path='/smoothmix' element={<Navigate to='/video?model=v2' replace />} />
      <Route path='/t2v' element={<Navigate to='/video' replace />} />
      <Route path='/image' element={<Image />} />
      <Route path='/purchase' element={<PurchaseRouteGate />} />
      <Route path='/account' element={<Account />} />
      <Route path='/terms' element={<Terms />} />
      <Route path='/tokushoho' element={<Tokushoho />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
