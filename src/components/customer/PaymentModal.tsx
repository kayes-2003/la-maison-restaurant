import React, { useState, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { X, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react'
import { stripePromise } from '@/lib/stripe'
import { CheckoutForm } from '@/components/customer/CheckoutForm'
import { formatPrice } from '@/lib/utils'
import type { CartSummary } from '@/types'

interface PaymentModalProps {
  summary:   CartSummary
  userId:    string | null
  onClose:   () => void
  onSuccess: (paymentIntentId: string) => void
}

type ModalState = 'initializing' | 'checkout' | 'demo' | 'success' | 'error'

export function PaymentModal({ summary, userId, onClose, onSuccess }: PaymentModalProps) {
  const [modalState,   setModalState]   = useState<ModalState>('initializing')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [demoCard,     setDemoCard]     = useState('')
  const [demoExpiry,   setDemoExpiry]   = useState('')
  const [demoCVC,      setDemoCVC]      = useState('')
  const [demoName,     setDemoName]     = useState('')
  const [demoLoading,  setDemoLoading]  = useState(false)

  const amountInCents = Math.round(summary.total * 100)

  useEffect(() => { initPayment() }, [])

  const initPayment = async () => {
    setModalState('initializing')
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    const isConfigured = supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT') && stripePromise

    if (isConfigured) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            amount: amountInCents,
            currency: 'usd',
            description: `La Maison — ${summary.count} item${summary.count !== 1 ? 's' : ''}`,
          }),
        })
        if (res.ok) {
          const json = await res.json()
          if (json.demo)          { setModalState('demo'); return }
          if (json.client_secret) { setClientSecret(json.client_secret); setModalState('checkout'); return }
        }
      } catch { /* fall through to demo */ }
    }
    setModalState('demo')
  }

  const handleSuccess = (paymentIntentId: string) => {
    setModalState('success')
    onSuccess(paymentIntentId)  // CartDrawer handles the DB save
  }

  const formatCard   = (v: string) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
  const formatExpiry = (v: string) => { const c = v.replace(/\D/g, ''); return c.length >= 2 ? c.slice(0,2)+'/'+c.slice(2,4) : c }

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDemoLoading(true)
    await new Promise(r => setTimeout(r, 1800))
    setDemoLoading(false)
    handleSuccess('pi_demo_' + Math.random().toString(36).slice(2))
  }

  const inputCls = 'w-full bg-surface-100 border border-brand-800/50 rounded-lg px-3.5 py-2.5 text-brand-100 text-sm placeholder-brand-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-surface-50 border border-brand-900/40 sm:rounded-2xl shadow-2xl animate-fade-up overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-900/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-700/40 flex items-center justify-center">
              <CreditCard size={15} className="text-brand-400" />
            </div>
            <div>
              <h2 className="font-display font-bold text-brand-200 text-base leading-tight">Complete Order</h2>
              <p className="text-brand-700 text-xs">{summary.count} item{summary.count !== 1 ? 's' : ''} · {formatPrice(summary.total)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-brand-700 hover:text-brand-300 hover:bg-brand-900/40 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {/* Order summary */}
          <div className="bg-surface-100/60 border border-brand-900/30 rounded-xl p-4 mb-5">
            <div className="space-y-1.5 mb-3">
              {summary.items.slice(0, 4).map(ci => (
                <div key={ci.id} className="flex justify-between text-sm">
                  <span className="text-brand-500 truncate max-w-[180px]">{ci.quantity}× {ci.menu_items.name}</span>
                  <span className="text-brand-400 font-mono text-xs">{formatPrice(ci.menu_items.price * ci.quantity)}</span>
                </div>
              ))}
              {summary.items.length > 4 && <p className="text-brand-700 text-xs">+{summary.items.length - 4} more items</p>}
            </div>
            <div className="flex justify-between items-center pt-2.5 border-t border-brand-900/30">
              <span className="text-brand-400 text-sm font-medium">Total</span>
              <span className="font-display font-bold text-brand-300 text-xl">{formatPrice(summary.total)}</span>
            </div>
          </div>

          {modalState === 'initializing' && (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-brand-700/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-brand-600 text-sm">Initializing secure payment…</p>
            </div>
          )}

          {modalState === 'checkout' && clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#d4841a', colorBackground: '#1a1209', colorText: '#f5d9a8', colorDanger: '#f09595', fontFamily: '"DM Sans", sans-serif', borderRadius: '8px' }, rules: { '.Input': { border: '1px solid rgba(99,51,21,0.5)', backgroundColor: '#221608' }, '.Input:focus': { border: '1px solid #d4841a', boxShadow: '0 0 0 3px rgba(212,132,26,0.15)' } } } }}>
              <CheckoutForm amount={amountInCents} onSuccess={handleSuccess} onError={msg => { setErrorMsg(msg); setModalState('error') }} />
            </Elements>
          )}

          {modalState === 'demo' && (
            <form onSubmit={handleDemoSubmit} className="space-y-4">
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-950/40 border border-amber-800/40 rounded-lg">
                <span className="text-amber-400 text-sm mt-0.5">⚠</span>
                <div>
                  <p className="text-amber-400/90 text-xs font-semibold">Demo mode</p>
                  <p className="text-amber-400/60 text-xs mt-0.5">No real charge. Set <code className="font-mono bg-amber-900/40 px-1 rounded">STRIPE_SECRET_KEY</code> in Supabase Edge Function secrets to enable live payments.</p>
                </div>
              </div>
              <div>
                <label className="label">Cardholder name</label>
                <input type="text" placeholder="Jane Smith" value={demoName} onChange={e => setDemoName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="label">Card number</label>
                <input type="text" placeholder="4242 4242 4242 4242" value={demoCard} onChange={e => setDemoCard(formatCard(e.target.value))} className={inputCls} maxLength={19} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Expiry</label>
                  <input type="text" placeholder="MM/YY" value={demoExpiry} onChange={e => setDemoExpiry(formatExpiry(e.target.value))} className={inputCls} maxLength={5} required />
                </div>
                <div>
                  <label className="label">CVC</label>
                  <input type="text" placeholder="•••" value={demoCVC} onChange={e => setDemoCVC(e.target.value.replace(/\D/g, '').slice(0, 4))} className={inputCls} maxLength={4} required />
                </div>
              </div>
              <button type="submit" disabled={demoLoading} className="btn-primary w-full py-3 text-base mt-2 flex items-center justify-center gap-2">
                {demoLoading ? <><div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />Processing…</> : <>🔒 Pay {formatPrice(summary.total)}</>}
              </button>
              <p className="text-center text-brand-800 text-xs">Secured by Stripe · 256-bit SSL</p>
            </form>
          )}

          {modalState === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-950/50 border border-green-700/50 flex items-center justify-center animate-fade-up">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl text-brand-200 mb-1">Order placed!</h3>
                <p className="text-brand-600 text-sm">Thank you for your order. We'll start preparing it right away.</p>
              </div>
              <button onClick={onClose} className="btn-primary w-full py-3 mt-2">Back to menu</button>
            </div>
          )}

          {modalState === 'error' && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-700/50 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl text-brand-200 mb-1">Payment failed</h3>
                <p className="text-brand-600 text-sm">{errorMsg}</p>
              </div>
              <button onClick={initPayment} className="btn-primary w-full py-3">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}