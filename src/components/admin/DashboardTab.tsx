import { TrendingUp, ShoppingBag, DollarSign, Star, BarChart2 } from 'lucide-react'
import type { DashboardData } from '@/hooks/useDashboard'

function fmt(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

interface Props { data: DashboardData }

export function DashboardTab({ data }: Props) {
  const { todayRevenue, todayOrders, totalRevenue, totalOrders, itemSales, dailySales } = data

  const maxRevenue = Math.max(...dailySales.map(d => d.revenue), 1)
  const maxQty     = Math.max(...itemSales.slice(0, 8).map(i => i.qty), 1)

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Revenue", value: fmt(todayRevenue),  icon: DollarSign,  color: 'text-green-400',  bg: 'bg-green-950/40 border-green-800/40'   },
          { label: "Today's Orders",  value: todayOrders.length, icon: ShoppingBag, color: 'text-brand-400',  bg: 'bg-brand-900/30 border-brand-800/30'   },
          { label: 'Total Revenue',   value: fmt(totalRevenue),  icon: TrendingUp,  color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-800/40'     },
          { label: 'Total Orders',    value: totalOrders,        icon: BarChart2,   color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 flex items-center gap-3 ${k.bg}`}>
            <div className={`p-2 rounded-lg bg-surface-100/30 ${k.color}`}>
              <k.icon size={18} />
            </div>
            <div>
              <p className="font-mono font-bold text-brand-100 text-xl leading-tight">{k.value}</p>
              <p className="text-brand-600 text-xs">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Revenue Bar Chart */}
      <div className="bg-surface-50 border border-brand-900/30 rounded-xl p-5">
        <h3 className="font-display font-bold text-brand-300 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-brand-500" /> Revenue — Last 7 Days
        </h3>
        <div className="flex items-end gap-2 h-36">
          {dailySales.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-brand-600 text-[10px] font-mono">
                {d.revenue > 0 ? fmt(d.revenue) : ''}
              </span>
              <div className="w-full rounded-t-md bg-brand-800/30 relative overflow-hidden" style={{ height: '80px' }}>
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-md transition-all duration-500"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-brand-700 text-[10px]">{d.date}</span>
              <span className="text-brand-800 text-[9px]">{d.orders} orders</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">

        {/* Item Sales Table */}
        <div className="bg-surface-50 border border-brand-900/30 rounded-xl p-5">
          <h3 className="font-display font-bold text-brand-300 mb-4 flex items-center gap-2">
            <Star size={16} className="text-amber-500" /> Item Sales Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-900/30">
                  <th className="text-left text-brand-600 text-xs pb-2 font-medium">Item</th>
                  <th className="text-right text-brand-600 text-xs pb-2 font-medium">Qty</th>
                  <th className="text-right text-brand-600 text-xs pb-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-900/20">
                {itemSales.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-brand-700 text-xs py-6 text-center">
                      No sales yet
                    </td>
                  </tr>
                ) : itemSales.map((item, i) => (
                  <tr key={item.name}>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {i < 3 && <span className="text-amber-400 text-xs">#{i + 1}</span>}
                        <span className="text-brand-300 text-xs truncate max-w-[140px]">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono text-brand-400 text-xs">{item.qty}</td>
                    <td className="py-2 text-right font-mono text-green-400 text-xs">{fmt(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              {itemSales.length > 0 && (
                <tfoot>
                  <tr className="border-t border-brand-900/30">
                    <td className="pt-2 text-brand-500 text-xs font-semibold">Total</td>
                    <td className="pt-2 text-right font-mono text-brand-300 text-xs font-bold">
                      {itemSales.reduce((s, i) => s + i.qty, 0)}
                    </td>
                    <td className="pt-2 text-right font-mono text-green-300 text-xs font-bold">
                      {fmt(itemSales.reduce((s, i) => s + i.revenue, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Most Ordered Items */}
        <div className="bg-surface-50 border border-brand-900/30 rounded-xl p-5">
          <h3 className="font-display font-bold text-brand-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" /> Most Ordered Items
          </h3>
          <div className="space-y-2.5">
            {itemSales.length === 0 ? (
              <p className="text-brand-700 text-xs text-center py-4">No data yet</p>
            ) : itemSales.slice(0, 8).map((item, i) => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-brand-400 text-xs truncate max-w-[160px]">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {item.name}
                  </span>
                  <span className="text-brand-600 text-xs font-mono shrink-0 ml-2">{item.qty} sold</span>
                </div>
                <div className="h-1.5 bg-brand-900/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-700"
                    style={{ width: `${(item.qty / maxQty) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Today's Summary */}
      <div className="bg-surface-50 border border-brand-900/30 rounded-xl p-5">
        <h3 className="font-display font-bold text-brand-300 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Orders placed',   value: todayOrders.length },
            { label: 'Items sold',      value: todayOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0) },
            { label: 'Avg order value', value: todayOrders.length ? fmt(todayRevenue / todayOrders.length) : '$0.00' },
            { label: 'Total revenue',   value: fmt(todayRevenue) },
          ].map(s => (
            <div key={s.label} className="text-center py-3 rounded-lg bg-surface-100/50 border border-brand-900/20">
              <p className="font-mono font-bold text-brand-200 text-2xl">{s.value}</p>
              <p className="text-brand-700 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}