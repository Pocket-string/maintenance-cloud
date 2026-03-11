import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bitalize Cloud Mantenimiento',
  description: 'Plataforma de gestion de mantenimiento para activos FV PMGD y diesel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
