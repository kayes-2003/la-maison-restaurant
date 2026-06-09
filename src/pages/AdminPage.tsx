import { useState } from 'react'
import { Plus, LayoutGrid, List, BarChart2, Receipt, UtensilsCrossed } from 'lucide-react'
import { AdminItemCard }  from '@/components/admin/AdminItemCard'
import { AdminItemModal } from '@/components/admin/AdminItemModal'
import { CategoryTabs }   from '@/components/shared/CategoryTabs'
import { Loader }         from '@/components/shared/Loader'
import { DashboardTab }   from '@/components/admin/DashboardTab'
import { OrdersTab }      from '@/components/admin/OrdersTab'
import { useDashboard }   from '@/hooks/useDashboard'
import type { MenuItem, MenuItemFormData, Category } from '@/types'

interface AdminPageProps {
  items:    MenuItem[]
  loading:  boolean
  onAdd:    (form: MenuItemFormData) => Promise<{ error: unknown }>
  onUpdate: (id: string, form: MenuItemFormData) => Promise<{ error: unknown }>
  onDelete: (id: string) => Promise<{ error: unknown }>
}

type Tab = 'dashboard' | 'orders' | 'menu'

export function AdminPage({ items, loading, onAdd, onUpdate, onDelete }: AdminPageProps) {
  const [tab,       setTab]       = useState<Tab>('dashboard')
  const [modalItem, setModalItem] = useState<MenuItem | null | undefined>(undefined)
  const [category,  setCategory]  = useState<Category>('All')
  const [layout,    setLayout]    = useState<'grid' | 'list'>('grid')

  const dash     = useDashboard()
  const filtered = category === 'All' ? items : items.filter(i => i.category === category)

  if (loading) return <Loader />

  const tabs: { id: Tab; label: string; icon: typeof BarChart2; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard',  icon: BarChart2,       badge: undefined },
    { id: 'orders',    label: 'Orders',     icon: Receipt,         badge: dash.todayOrders.length || undefined },
    { id: 'menu',      label: 'Menu Items', icon: UtensilsCrossed, badge: undefined },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-300">Admin Panel</h1>
          <p className="text-brand-700 text-sm mt-0.5">Restaurant management & analytics</p>
        </div>
        {tab === 'menu' && (
          <button onClick={() => setModalItem(null)} className="btn-primary self-start sm:self-auto">
            <Plus size={16} /> Add New Item
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-100/60 border border-brand-900/30 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-brand-700/50 text-brand-200 shadow-sm'
                : 'text-brand-700 hover:text-brand-400'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.badge ? (
              <span className="bg-brand-500 text-surface text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        dash.loading ? <Loader /> : <DashboardTab data={dash} />
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        dash.loading ? <Loader /> : <OrdersTab orders={dash.orders} />
      )}

      {/* Menu Items tab */}
      {tab === 'menu' && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Items',  value: items.length },
              { label: 'Categories',   value: new Set(items.map(i => i.category)).size },
              { label: 'On Offer',     value: items.filter(i => i.offer_percent > 0).length },
              { label: 'Unavailable',  value: items.filter(i => !i.available).length },
            ].map(s => (
              <div key={s.label} className="bg-surface-50 border border-brand-900/30 rounded-xl p-4 text-center">
                <p className="font-mono font-bold text-brand-200 text-2xl">{s.value}</p>
                <p className="text-brand-700 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <CategoryTabs active={category} onChange={setCategory} items={items} />
            </div>
            <div className="flex gap-1 bg-surface-100 border border-brand-900/40 rounded-lg p-1 self-start">
              {(['grid', 'list'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`p-1.5 rounded transition-all ${layout === l ? 'bg-brand-700/40 text-brand-300' : 'text-brand-700 hover:text-brand-400'}`}
                >
                  {l === 'grid' ? <LayoutGrid size={15} /> : <List size={15} />}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-brand-800">
              <p className="font-display text-xl">No items in this category</p>
            </div>
          ) : layout === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filtered.map(item => (
                <AdminItemCard key={item.id} item={item}
                  onEdit={() => setModalItem(item)}
                  onDelete={() => onDelete(item.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(item => (
                <AdminItemCard key={item.id} item={item} layout="list"
                  onEdit={() => setModalItem(item)}
                  onDelete={() => onDelete(item.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit modal */}
      {modalItem !== undefined && (
        <AdminItemModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSave={async form => {
            if (modalItem?.id) return onUpdate(modalItem.id, form)
            return onAdd(form)
          }}
        />
      )}

    </div>
  )
}