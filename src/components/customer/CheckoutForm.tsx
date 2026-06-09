import React, { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { ShieldCheck, Lock, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface CheckoutFormProps {
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
}

export function CheckoutForm({ amount, onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsLoading(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/?payment=success` },
      redirect: 'if_required',
    })

    if (error) {
      const msg = error.message ?? 'An unexpected error occurred'
      setMessage(msg)
      onError(msg)
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    } else {
      setMessage('Payment is processing. Please wait.')
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
        }}
      />

      {message && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 text-sm rounded-lg px-4 py-3">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className="w-full py-3.5 rounded-xl font-semibold text-surface text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 active:bg-brand-600"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {formatPrice(amount / 100)} securely
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-brand-700 text-xs">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>256-bit SSL encryption · Powered by Stripe</span>
      </div>
    </form>
  )
}
