import { Sidebar } from '@/components/layout/sidebar'
import { DemoBanner } from '@/components/demo/DemoBanner'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="ml-64 print:ml-0">
        {children}
      </main>
    </div>
  )
}
