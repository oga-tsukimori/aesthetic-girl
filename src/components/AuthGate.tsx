import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase, supabaseConfigured } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [checking, setChecking] = React.useState(true)
  const [mode, setMode] = React.useState<Mode>('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!supabaseConfigured) {
      setChecking(false)
      return
    }

    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setChecking(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (!supabaseConfigured) return children

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#FF6B8A]" />
      </div>
    )
  }

  if (session) return children

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('Check your email to confirm the account, then sign in here.')
          setMode('signin')
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not authenticate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#F8F7FA] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-[-90px] h-72 w-72 rounded-full bg-[#FFD3DC]/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-[-70px] h-80 w-80 rounded-full bg-[#D9D4FF]/45 blur-3xl" />

      <section className="fadeup relative w-full max-w-[420px] rounded-[28px] border border-black/[.06] bg-white p-7 shadow-[0_24px_80px_-35px_rgba(35,28,45,.35)] sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#FF6B8A] text-[18px] font-black text-white shadow-sm">
            ae
          </span>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight">Aesthetic Instocks</h1>
            <p className="text-[12px] font-semibold text-black/40">Private inventory workspace</p>
          </div>
        </div>

        <div className="mb-6 rounded-[18px] bg-[#FFF3F6] p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-[#B33455]">
            <LockKeyhole className="h-4 w-4" />
            Your shop data is protected
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-black/50">
            Sign in to sync inventory, orders, sales and expenses across devices.
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-black/55">Email</span>
            <Input
              autoComplete="email"
              className="h-11 rounded-[13px] bg-white px-3.5"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-black/55">Password</span>
            <Input
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="h-11 rounded-[13px] bg-white px-3.5"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">{error}</p>}
          {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">{message}</p>}

          <Button className="h-11 w-full rounded-[13px] font-bold" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          className="mt-5 w-full text-center text-[12px] font-bold text-black/45 transition-colors hover:text-black/70"
          onClick={() => {
            setMode((current) => (current === 'signin' ? 'signup' : 'signin'))
            setError(null)
            setMessage(null)
          }}
          type="button"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}
