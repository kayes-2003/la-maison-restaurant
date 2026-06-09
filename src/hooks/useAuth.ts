import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  uid:          string | null
  profile:      Profile | null
  loading:      boolean
  isAdmin:      boolean
  needsNewPass: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    uid: null, profile: null, loading: true, isAdmin: false, needsNewPass: false,
  })

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()           // ← returns null instead of 406 when row missing

      if (error) {
        console.warn('[useAuth] profile fetch error:', error.message)
        setState(s => ({ ...s, loading: false }))
        return
      }

      setState(s => ({
        ...s,
        loading: false,
        profile: data ?? null,
        isAdmin: (data as Profile | null)?.role === 'admin',
      }))
    } catch (e) {
      console.warn('[useAuth] unexpected profile error:', e)
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only fetch profile when there is a fully confirmed session
      if (session?.user && session.user.email_confirmed_at) {
        setState(s => ({ ...s, uid: session.user.id }))
        fetchProfile(session.user.id)
      } else {
        setState(s => ({ ...s, loading: false }))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setState(s => ({ ...s, needsNewPass: true, loading: false }))
          return
        }

        // SIGNED_IN fires even for unconfirmed users — guard with email_confirmed_at
        if (session?.user && session.user.email_confirmed_at) {
          setState(s => ({ ...s, uid: session.user.id, needsNewPass: false }))
          fetchProfile(session.user.id)
        } else if (!session) {
          setState({ uid: null, profile: null, loading: false, isAdmin: false, needsNewPass: false })
        } else {
          // Unconfirmed user — just stop loading, don't fetch profile
          setState(s => ({ ...s, loading: false }))
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    const m = error.message.toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password'))
      return 'Wrong email or password. Please try again.'
    if (m.includes('not confirmed') || m.includes('email not confirmed'))
      return 'EMAIL_NOT_CONFIRMED'
    if (m.includes('user not found') || m.includes('no user'))
      return 'No account found with this email. Please sign up first.'
    if (m.includes('too many'))
      return 'Too many attempts. Please wait a few minutes and try again.'
    return error.message
  }

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('already registered') || m.includes('user already exists'))
        return 'An account with this email already exists. Please sign in.'
      if (m.includes('password'))
        return 'Password must be at least 6 characters.'
      return error.message
    }
    if (data.user && !data.session) return 'CONFIRM_EMAIL'
    return null
  }

  // ── Resend confirmation ───────────────────────────────────────────────────
  const resendConfirmation = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (!error) return null
    return error.message
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  const sendPasswordReset = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (!error) return null
    const m = error.message.toLowerCase()
    if (m.includes('not found') || m.includes('no user'))
      return 'No account found with this email.'
    return error.message
  }

  // ── Update password ───────────────────────────────────────────────────────
  const updatePassword = async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setState(s => ({ ...s, needsNewPass: false }))
      return null
    }
    return error.message
  }

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = () => supabase.auth.signOut()

  return { ...state, signIn, signUp, signOut, resendConfirmation, sendPasswordReset, updatePassword }
}
