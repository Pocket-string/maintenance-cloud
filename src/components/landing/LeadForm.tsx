'use client'

import { useState } from 'react'
import { submitLead } from '@/actions/leads'

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const formData = new FormData(form)

    const result = await submitLead(formData)

    if (result.success) {
      setStatus('success')
      form.reset()
    } else {
      setStatus('error')
      setErrorMsg(result.error || 'Error desconocido')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-neu-bg rounded-2xl shadow-neu-lg p-8 text-center animate-scale-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-50 flex items-center justify-center shadow-neu-inset">
          <CheckIcon className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Mensaje Enviado</h3>
        <p className="text-foreground-secondary">
          Gracias por tu interes. Nos pondremos en contacto contigo pronto.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-blue-600 text-sm hover:underline"
        >
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-neu-bg rounded-2xl shadow-neu-lg p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="lead-name" className="block text-sm font-medium text-foreground mb-1.5">
            Nombre *
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            required
            placeholder="Tu nombre completo"
            className="w-full px-4 py-3 rounded-xl bg-neu-bg shadow-neu-inset text-foreground placeholder:text-foreground-muted focus:shadow-neu-inset-md focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
        </div>
        <div>
          <label htmlFor="lead-email" className="block text-sm font-medium text-foreground mb-1.5">
            Email *
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            required
            placeholder="tu@empresa.com"
            className="w-full px-4 py-3 rounded-xl bg-neu-bg shadow-neu-inset text-foreground placeholder:text-foreground-muted focus:shadow-neu-inset-md focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="lead-company" className="block text-sm font-medium text-foreground mb-1.5">
            Empresa *
          </label>
          <input
            id="lead-company"
            name="company"
            type="text"
            required
            placeholder="Nombre de tu empresa"
            className="w-full px-4 py-3 rounded-xl bg-neu-bg shadow-neu-inset text-foreground placeholder:text-foreground-muted focus:shadow-neu-inset-md focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
        </div>
        <div>
          <label htmlFor="lead-phone" className="block text-sm font-medium text-foreground mb-1.5">
            Telefono *
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            required
            placeholder="+56 9 1234 5678"
            className="w-full px-4 py-3 rounded-xl bg-neu-bg shadow-neu-inset text-foreground placeholder:text-foreground-muted focus:shadow-neu-inset-md focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
        </div>
      </div>
      <div>
        <label htmlFor="lead-message" className="block text-sm font-medium text-foreground mb-1.5">
          Mensaje <span className="text-foreground-muted">(opcional)</span>
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={3}
          placeholder="Cuentanos sobre tus necesidades de mantenimiento..."
          className="w-full px-4 py-3 rounded-xl bg-neu-bg shadow-neu-inset text-foreground placeholder:text-foreground-muted focus:shadow-neu-inset-md focus:ring-2 focus:ring-blue-500 outline-none transition-shadow resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-500 text-sm">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold shadow-neu-sm hover:shadow-neu-inset-sm active:shadow-neu-inset transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Enviando...' : 'Solicitar Evaluacion Gratuita'}
      </button>
    </form>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
