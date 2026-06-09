import { useRef, useEffect, useState } from 'react'
import { X, Printer, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types'

interface Props {
  order:   Order
  onClose: () => void
}

function fmt(n: number) {
  return '$' + Number(n).toFixed(2)
}

export function ReceiptModal({ order, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('payments')
      .select('stripe_payment_intent_id')
      .eq('user_id', order.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPaymentIntentId(data.stripe_payment_intent_id)
      })
  }, [order.user_id])

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=480,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Receipt #${order.id.slice(0, 8).toUpperCase()}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: #111;
        background: #fff;
        padding: 28px 24px;
      }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>${content}</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const date       = new Date(order.created_at)
  const subtotal   = order.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax        = subtotal * 0.08
  const grandTotal = subtotal + tax
  const totalQty   = order.items.reduce((s, i) => s + i.quantity, 0)
  const isDemo     = paymentIntentId?.startsWith('pi_demo_')
  const payMethod  = isDemo ? 'Demo (Test Mode)' : 'Stripe — Credit / Debit Card'

  const receipt = (
    <div style={{
      fontFamily: "'Courier New', monospace",
      fontSize: '13px',
      color: '#111',
      maxWidth: '360px',
      margin: '0 auto',
    }}>

      {/* ── Restaurant header ── */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px' }}>
          🍽 LA MAISON
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>
          Fine Dining Restaurant
        </div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
          Tel: +1 (555) 123-4567 · lamaison.com
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #aaa', margin: '10px 0' }} />

      {/* ── Order meta ── */}
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
        <tbody>
          {(
            [
              ['Receipt #', order.id.slice(0, 8).toUpperCase()],
              ['Date',      date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
              ['Time',      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
              ['Payment',   payMethod],
              ['Status',    '✓  PAID'],
            ] as [string, string][]
          ).map(([label, value]) => (
            <tr key={label}>
              <td style={{ color: '#666', paddingBottom: '4px', width: '80px' }}>
                {label}
              </td>
              <td style={{
                fontWeight: 'bold',
                paddingBottom: '4px',
                color: label === 'Status' ? 'green' : '#111',
              }}>
                {value}
              </td>
            </tr>
          ))}
          {paymentIntentId && !isDemo && (
            <tr>
              <td style={{ color: '#666', paddingBottom: '4px', verticalAlign: 'top' }}>Txn ID</td>
              <td style={{ fontSize: '10px', color: '#555', paddingBottom: '4px', wordBreak: 'break-all' }}>
                {paymentIntentId}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #aaa', margin: '10px 0' }} />

      {/* ── Items table ── */}
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left',   paddingBottom: '5px', color: '#444' }}>ITEM</th>
            <th style={{ textAlign: 'center', paddingBottom: '5px', color: '#444', width: '32px' }}>QTY</th>
            <th style={{ textAlign: 'right',  paddingBottom: '5px', color: '#444', width: '65px' }}>UNIT</th>
            <th style={{ textAlign: 'right',  paddingBottom: '5px', color: '#444', width: '68px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px dotted #e5e5e5' }}>
              <td style={{ paddingTop: '5px', paddingBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>
                {item.name || '—'}
              </td>
              <td style={{ textAlign: 'center', paddingTop: '5px', paddingBottom: '5px' }}>
                {item.quantity}
              </td>
              <td style={{ textAlign: 'right', paddingTop: '5px', paddingBottom: '5px', color: '#555' }}>
                {fmt(item.price)}
              </td>
              <td style={{ textAlign: 'right', paddingTop: '5px', paddingBottom: '5px', fontWeight: 'bold' }}>
                {fmt(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #aaa', margin: '10px 0' }} />

      {/* ── Totals ── */}
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ paddingBottom: '3px', color: '#555' }}>
              Subtotal ({totalQty} item{totalQty !== 1 ? 's' : ''})
            </td>
            <td style={{ textAlign: 'right', paddingBottom: '3px' }}>{fmt(subtotal)}</td>
          </tr>
          <tr>
            <td style={{ paddingBottom: '3px', color: '#555' }}>Tax (8%)</td>
            <td style={{ textAlign: 'right', paddingBottom: '3px' }}>{fmt(tax)}</td>
          </tr>
          <tr>
            <td style={{ paddingBottom: '3px', color: '#555' }}>Delivery</td>
            <td style={{ textAlign: 'right', paddingBottom: '3px', color: 'green' }}>FREE</td>
          </tr>
          <tr style={{ borderTop: '2px solid #111' }}>
            <td style={{ paddingTop: '6px', fontWeight: 'bold', fontSize: '15px' }}>GRAND TOTAL</td>
            <td style={{ textAlign: 'right', paddingTop: '6px', fontWeight: 'bold', fontSize: '15px' }}>
              {fmt(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #aaa', margin: '12px 0' }} />

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#888', lineHeight: '1.8' }}>
        <div>Thank you for dining with us!</div>
        <div>We hope to see you again soon.</div>
        <div style={{ marginTop: '6px', fontSize: '10px' }}>
          Generated: {new Date().toLocaleString()}
        </div>
      </div>

    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-surface-50 border border-brand-900/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <h2 className="font-display font-bold text-brand-200">Receipt</h2>
            <span className="text-brand-700 text-xs font-mono">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-brand-700 hover:text-brand-300 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* White receipt preview */}
        <div className="overflow-y-auto flex-1 bg-white px-4 py-5">
          <div ref={printRef}>{receipt}</div>
        </div>

        {/* Print button */}
        <div className="px-5 py-4 border-t border-brand-900/30 bg-surface-50 shrink-0">
          <button onClick={handlePrint} className="btn-primary w-full py-3 gap-2">
            <Printer size={16} /> Print Receipt
          </button>
        </div>

      </div>
    </div>
  )
}