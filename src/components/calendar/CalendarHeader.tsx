'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

interface CalendarHeaderProps {
  currentMonth: number
  currentYear: number
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  sites: Array<{ id: string; name: string }>
  siteFilter: string
  onSiteChange: (siteId: string) => void
}

export function CalendarHeader({
  currentMonth,
  currentYear,
  onPrev,
  onNext,
  onToday,
  sites,
  siteFilter,
  onSiteChange,
}: CalendarHeaderProps) {
  const monthDate = new Date(currentYear, currentMonth - 1)
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es })
  // Capitalize first letter
  const monthLabelFormatted = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          aria-label="Mes anterior"
          className="px-2"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Button>

        <h2 className="text-base font-semibold text-foreground w-40 text-center select-none">
          {monthLabelFormatted}
        </h2>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          aria-label="Mes siguiente"
          className="px-2"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Center: today shortcut */}
      <Button variant="outline" size="sm" onClick={onToday}>
        Hoy
      </Button>

      {/* Right: site filter */}
      <select
        value={siteFilter}
        onChange={(e) => onSiteChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-foreground"
        aria-label="Filtrar por sitio"
      >
        <option value="">Todos los sitios</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  )
}
