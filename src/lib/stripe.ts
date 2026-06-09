import { loadStripe } from '@stripe/stripe-js'

// Replace VITE_STRIPE_PUBLISHABLE_KEY in your .env file
const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

// Returns null if key is missing → PaymentModal falls back to demo mode automatically
export const stripePromise = key ? loadStripe(key) : null
