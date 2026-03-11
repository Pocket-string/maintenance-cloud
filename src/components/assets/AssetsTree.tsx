'use client'

import { useState } from 'react'
// Inline SVG chevrons to avoid external dependency
function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
import type { AssetType, AssetStatus } from '@/types/database'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

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

interface Props {
  nodes: AssetTreeNode[]
}

// ------------------------------------------------------------------
// Constants (consistent with AssetsList)
// ------------------------------------------------------------------

const TYPE_LABELS: Record<AssetType, string> = {
  inverter: 'Inversor',
  panel_string: 'String',
  transformer: 'Transformador',
  meter: 'Medidor',
  diesel_gen: 'Gen. Diesel',
  ats: 'ATS',
  battery_bank: 'Banco Bat.',
  tracker: 'Tracker',
  string_box: 'String Box',
  switchgear: 'Switchgear',
  ncu: 'NCU',
  rack: 'Rack',
  ups: 'UPS',
  sensor: 'Sensor',
  ppc: 'PPC',
  center: 'Centro Transf.',
  module: 'Modulo',
  building: 'Edificio',
  other: 'Otro',
}

const STATUS_BADGES: Record<AssetStatus, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactivo', color: 'bg-yellow-100 text-yellow-800' },
  decommissioned: { label: 'Dado de baja', color: 'bg-red-100 text-red-800' },
}

const PRIORITY_DOT: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-400',
  4: 'bg-green-500',
  5: 'bg-gray-400',
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function collectTopLevelIds(nodes: AssetTreeNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    ids.add(node.id)
  }
  return ids
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function PriorityDot({ priority }: { priority: number }) {
  const colorClass = PRIORITY_DOT[priority] ?? PRIORITY_DOT[3]
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass}`}
      aria-label={`Prioridad ${priority}`}
      title={`Prioridad ${priority}`}
    />
  )
}

interface TreeNodeProps {
  node: AssetTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}

function TreeNode({ node, depth, expanded, onToggle }: TreeNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const statusBadge = STATUS_BADGES[node.status]
  const brandModel = [node.brand, node.model].filter(Boolean).join(' / ')

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={() => hasChildren && onToggle(node.id)}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggle(node.id)
          }
        }}
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:shadow-neu-inset-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
      >
        {/* Expand/collapse chevron — reserves space for alignment */}
        <span className="w-4 h-4 shrink-0 text-gray-400">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : null}
        </span>

        {/* Priority dot */}
        <PriorityDot priority={node.priority} />

        {/* Type label */}
        <span className="text-xs text-gray-500 font-medium shrink-0">
          {TYPE_LABELS[node.type]}
        </span>

        {/* Asset name */}
        <span className="font-semibold text-gray-900 text-sm">{node.name}</span>

        {/* Code */}
        {node.code && (
          <span className="font-mono text-xs text-gray-400 shrink-0">{node.code}</span>
        )}

        {/* Brand / model */}
        {brandModel && (
          <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{brandModel}</span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Children count badge */}
        {hasChildren && (
          <span className="text-xs text-gray-500 bg-neu-bg shadow-neu-inset-sm px-1.5 py-0.5 rounded shrink-0">
            {node.children.length} {node.children.length === 1 ? 'hijo' : 'hijos'}
          </span>
        )}

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${statusBadge.color}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <ul className="pl-4 border-l border-[#b8b9be] ml-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------

export function AssetsTree({ nodes }: Props) {
  // Top-level nodes start expanded; deeper levels start collapsed
  const [expanded, setExpanded] = useState<Set<string>>(() => collectTopLevelIds(nodes))

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay activos registrados
      </p>
    )
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
        />
      ))}
    </ul>
  )
}
