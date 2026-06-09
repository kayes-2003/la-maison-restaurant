import { useState } from 'react'
import { X, Trash2, Plus, Minus, ShoppingBag, CreditCard } from 'lucide-react'
import { discountedPrice, formatPrice, isValidUrl } from '@/lib/utils'
import { PaymentModal } from '@/components/customer/PaymentModal'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { CartSummary } from '@/types'

interface CartDrawerProps {
  summary:     CartSummary
  userId:      string | null
  onClose:     () => void
  onRemove:    (cartItemId: string) => void
  onUpdateQty: (cartItemId: string, qty: number) => void
  onClear:     () => void
}

export function CartDrawer({
  summary, userId, onClose, onRemove, onUpdateQty, onClear,
}: CartDrawerProps) {
  const [showPayment, setShowPayment] = useState(false)

  // Save happens HERE (not inside PaymentModal) so the component
  // is never unmounted before the async Supabase calls finish
  const saveOrderToSupabase = async (paymentIntentId: string) => {
    if (!userId) return

    const orderItems = summary.items.map(ci => ({
      id:       ci.menu_item_id,
      name:     ci.menu_items.name,
      price:    ci.menu_items.price,
      quantity: ci.quantity,
    }))

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({ user_id: userId, items: orderItems, total: summary.total, status: 'paid' })
      .select().single()

    if (orderErr) console.error('[orders] FAILED:', orderErr.code, orderErr.message)
    else          console.log('[orders] ✅ saved:', order.id)

    const { data: pay, error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id:                  userId,
        stripe_payment_intent_id: paymentIntentId,
        amount:                   Math.round(summary.total * 100),
        currency:                 'usd',
        status:                   'succeeded',
        description:              `La Maison — ${summary.count} item${summary.count !== 1 ? 's' : ''}`,
      })
      .select().single()

    if (payErr) console.error('[payments] FAILED:', payErr.code, payErr.message)
    else        console.log('[payments] ✅ saved:', pay.id)
  }

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    await saveOrderToSupabase(paymentIntentId)   // save FIRST
    toast.success('🎉 Order placed successfully!', { duration: 4000 })
    onClear()
    setShowPayment(false)
    onClose()
  }

  const handleCheckout = () => {
    if (!userId) { toast.error('Please sign in to checkout'); return }
    setShowPayment(true)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col bg-surface-50 border-l border-brand-800/30 shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-900/30">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-brand-400" />
            <h2 className="font-display font-bold text-brand-200 text-lg">Your Cart</h2>
            {summary.count > 0 && (
              <span className="bg-brand-800/50 text-brand-400 text-xs px-2 py-0.5 rounded-full font-mono">
                {summary.count}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-brand-700 hover:text-brand-400 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {summary.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <span className="text-6xl opacity-40">🛒</span>
              <p className="font-display text-lg text-brand-600">Cart is empty</p>
              <p className="text-sm text-brand-800">Add something delicious!</p>
            </div>
          ) : (
            summary.items.map(ci => {
              const price    = discountedPrice(ci.menu_items.price, ci.menu_items.offer_percent)
              const hasImage = isValidUrl(ci.menu_items.image_url)
              return (
                <div key={ci.id} className="flex gap-3 bg-surface-100/60 border border-brand-900/30 rounded-xl p-3 hover:border-brand-800/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-surface-200 flex items-center justify-center overflow-hidden shrink-0">
                    {hasImage
                      ? <img src={ci.menu_items.image_url} alt={ci.menu_items.name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">{ci.menu_items.image_url}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-200 text-sm font-semibold truncate">{ci.menu_items.name}</p>
                    <p className="text-brand-600 text-xs font-mono">{formatPrice(price)} each</p>
                    {ci.menu_items.offer_percent > 0 && (
                      <p className="text-red-400 text-[10px]">-{ci.menu_items.offer_percent}% off</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => onUpdateQty(ci.id, ci.quantity - 1)} className="w-6 h-6 rounded-full bg-brand-900/50 hover:bg-brand-800/60 text-brand-300 flex items-center justify-center transition-colors">
                        <Minus size={10} />
                      </button>
                      <span className="text-brand-200 text-sm font-mono w-5 text-center">{ci.quantity}</span>
                      <button onClick={() => onUpdateQty(ci.id, ci.quantity + 1)} className="w-6 h-6 rounded-full bg-brand-900/50 hover:bg-brand-800/60 text-brand-300 flex items-center justify-center transition-colors">
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between shrink-0">
                    <span className="font-mono font-bold text-brand-300 text-sm">{formatPrice(price * ci.quantity)}</span>
                    <button onClick={() => onRemove(ci.id)} className="text-red-700/60 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {summary.items.length > 0 && (
          <div className="px-5 py-4 border-t border-brand-900/30 bg-surface space-y-3">
            <div className="space-y-1.5 pb-3 border-b border-brand-900/20">
              <div className="flex justify-between items-center">
                <span className="text-brand-700 text-xs">Subtotal ({summary.count} items)</span>
                <span className="text-brand-500 text-xs font-mono">{formatPrice(summary.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-700 text-xs">Delivery</span>
                <span className="text-green-500 text-xs font-mono">Free</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-brand-400 text-sm">Total</span>
              <span className="font-mono font-bold text-brand-200 text-xl">{formatPrice(summary.total)}</span>
            </div>
            <button onClick={handleCheckout} className="btn-primary w-full py-3 text-base gap-2">
              <CreditCard size={16} />
              Checkout with Stripe
            </button>
            <button onClick={onClear} className="btn-ghost w-full text-brand-700 hover:text-red-400 text-xs">
              Clear cart
            </button>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          summary={summary}
          userId={userId}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}