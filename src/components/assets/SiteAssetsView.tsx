'use client'

import { useState } from 'react'
import { AssetsList } from '@/components/assets/AssetsList'
import { AssetsTree } from '@/components/assets/AssetsTree'
import { Card } from '@/components/ui/card'
import type { AssetType, AssetStatus } from '@/types/database'

interface AssetRow {
  id: string
  name: string
  type: AssetType
  code: string | null
  tag: string | null
  priority: number
  parent_id: string | null
  brand: string | null
  model: string | null
  serial: string | null
  status: AssetStatus
  install_date: string | null
}

interface AssetTreeNode {
  id: string
  parent_id: string | null
  name: string
  type: AssetType
  code: string | null
  tag: string | null
  priority: number
  brand: string | null
  model: string | null
  status: AssetStatus
  children: AssetTreeNode[]
}

type ViewMode = 'tree' | 'list'

export function SiteAssetsView({
  assets,
  treeNodes,
  siteId,
}: {
  assets: AssetRow[]
  treeNodes: AssetTreeNode[]
  siteId: string
}) {
  const [view, setView] = useState<ViewMode>('tree')

  return (
    <div>
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setView('tree')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'tree'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          Arbol
        </button>
        <button
          onClick={() => setView('list')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'list'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          Lista
        </button>
      </div>

      {view === 'tree' ? (
        <Card>
          <AssetsTree nodes={treeNodes} />
        </Card>
      ) : (
        <AssetsList assets={assets} siteId={siteId} />
      )}
    </div>
  )
}
