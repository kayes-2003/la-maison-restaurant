import { useState } from 'react'
import { Receipt, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { ReceiptModal } from '@/components/admin/ReceiptModal'
import type { Order } from '@/types'

interface Props { orders: Order[] }

function fmt(n: number) { return '$' + Number(n).toFixed(2) }

export function OrdersTab({ orders }: Props) {
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState<'all' | 'today' | 'week'>('all')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)

  const today   = new Date().toDateString()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const filtered = orders.filter(o => {
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
    const d = new Date(o.created_at)
    const matchFilter =
      filter === 'today' ? d.toDateString() === today :
      filter === 'week'  ? d >= weekAgo : true
    return matchSearch && matchFilter
  })

  const totalFiltered = filtered.reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-700" />
          <input
            type="text"
            placeholder="Search by order ID or item name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-100 border border-brand-800/40 rounded-lg pl-9 pr-4 py-2.5 text-brand-200 text-sm placeholder-brand-800 outline-none focus:border-brand-600 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-surface-100 border border-brand-900/40 rounded-lg p-1 self-start">
          {(['all', 'today', 'week'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${filter === f ? 'bg-brand-700/50 text-brand-200' : 'text-brand-700 hover:text-brand-400'}`}
            >
              {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100/60 border border-brand-900/30 rounded-lg">
        <span className="text-brand-600 text-sm flex items-center gap-1.5">
          <Filter size={13} /> {filtered.length} order{filtered.length !== 1 ? 's' : ''}
        </span>
        <span className="font-mono font-bold text-brand-300 text-sm">{fmt(totalFiltered)}</span>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-700">
          <p className="font-display text-lg">No orders found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const isOpen = expanded === order.id
            const date   = new Date(order.created_at)
            return (
              <div key={order.id} className="bg-surface-50 border border-brand-900/30 rounded-xl overflow-hidden hover:border-brand-800/50 transition-colors">

                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-green-950/50 border border-green-800/40 flex items-center justify-center shrink-0">
                    <Receipt size={14} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-brand-300 text-xs font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="bg-green-950/60 text-green-400 text-[10px] px-1.5 py-0.5 rounded-full border border-green-800/40">PAID</span>
                    </div>
                    <p className="text-brand-700 text-xs mt-0.5">
                      {date.toLocaleDateString()} · {date.toLocaleTimeString()} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-brand-200 text-sm">{fmt(Number(order.total))}</span>
                    {isOpen
                      ? <ChevronUp size={14} className="text-brand-600" />
                      : <ChevronDown size={14} className="text-brand-600" />
                    }
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-brand-900/20">
                    <div className="pt-3 space-y-1.5 mb-4">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-brand-500 text-sm">{item.quantity}× {item.name}</span>
                          <span className="text-brand-400 font-mono text-xs">{fmt(item.price * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t border-brand-900/20">
                        <span className="text-brand-400 text-sm font-semibold">Total</span>
                        <span className="font-mono font-bold text-brand-200 text-base">{fmt(Number(order.total))}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setReceiptOrder(order)}
                      className="btn-primary w-full py-2 text-sm gap-2"
                    >
                      <Receipt size={14} /> Generate & Print Receipt
                    </button>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

    </div>
  )
}