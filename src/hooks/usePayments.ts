import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  description: string | null
  created_at: string
  stripe_payment_intent_id: string
}

export function usePayments(userId: string | null) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const savePayment = useCallback(async (payment: {
    stripe_payment_intent_id: string
    amount: number
    currency: string
    status: string
    description?: string
  }) => {
    if (!userId) return { error: 'Not authenticated' }
    const { error } = await supabase.from('payments').insert({
      user_id: userId,
      ...payment,
    })
    return { error }
  }, [userId])

  const fetchPayments = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setPayments(data as PaymentRecord[])
  }, [userId])

  return { payments, savePayment, fetchPayments }
}
