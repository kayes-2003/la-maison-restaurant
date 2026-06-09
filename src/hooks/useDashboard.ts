import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types'

export interface DashboardData {
  orders:       Order[]
  todayOrders:  Order[]
  todayRevenue: number
  totalRevenue: number
  totalOrders:  number
  itemSales:    { name: string; qty: number; revenue: number }[]
  dailySales:   { date: string; revenue: number; orders: number }[]
  loading:      boolean
}

export function useDashboard(): DashboardData {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
      if (!error && data) setOrders(data as Order[])
      setLoading(false)
    }

    fetchOrders()

    const sub = supabase
      .channel('orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  const today        = new Date().toDateString()
  const todayOrders  = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)

  // Item-wise sales
  const itemMap: Record<string, { qty: number; revenue: number }> = {}
  orders.forEach(o => {
    o.items.forEach(item => {
      if (!itemMap[item.name]) itemMap[item.name] = { qty: 0, revenue: 0 }
      itemMap[item.name].qty     += item.quantity
      itemMap[item.name].revenue += item.price * item.quantity
    })
  })
  const itemSales = Object.entries(itemMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // Daily sales — last 7 days
  const dailyMap: Record<string, { revenue: number; orders: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dailyMap[key] = { revenue: 0, orders: 0 }
  }
  orders.forEach(o => {
    const key = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (dailyMap[key]) {
      dailyMap[key].revenue += Number(o.total)
      dailyMap[key].orders  += 1
    }
  })
  const dailySales = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  return {
    orders, todayOrders, todayRevenue, totalRevenue,
    totalOrders: orders.length, itemSales, dailySales, loading,
  }
}