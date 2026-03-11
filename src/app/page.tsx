'use client'

import { useRouter } from 'next/navigation'
import { Shield, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'

export default function HomePage() {
  const router = useRouter()

  // Auto-redirect après 2 secondes
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/IBV_FLINKS')
    }, 2000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        {/* Logo/Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-500 to-green-700 rounded-full mb-8 shadow-2xl">
          <Shield className="text-white" size={48} />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Flinks IBV
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Vérification bancaire instantanée
        </p>

        {/* Description */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <p className="text-gray-700 mb-6">
            Connectez votre compte bancaire en toute sécurité pour une vérification instantanée.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Redirection automatique...</span>
            <div className="animate-pulse">●</div>
          </div>
        </div>

        {/* Manual button */}
        <button
          onClick={() => router.push('/IBV_FLINKS')}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
        >
          Continuer maintenant
          <ArrowRight size={20} />
        </button>

        {/* Footer */}
        <p className="mt-12 text-sm text-gray-500">
          Powered by{' '}
          <a
            href="https://flinks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 font-medium"
          >
            Flinks
          </a>
        </p>
      </div>
    </div>
  )
}
