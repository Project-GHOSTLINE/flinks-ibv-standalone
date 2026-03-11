'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Shield, Mail, Home } from 'lucide-react'

function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const [ibvSessionId, setIbvSessionId] = useState<string | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)

  useEffect(() => {
    const loginId = searchParams.get('loginId')
    const state = searchParams.get('state')
    const useSandbox = searchParams.get('sandbox') === 'true'

    if (!loginId || !state) {
      setStatus('error')
      setError('Paramètres manquants (loginId ou state)')
      return
    }

    // Lancer le traitement en arrière-plan et afficher succès immédiatement
    const startProcessing = async () => {
      try {
        const res = await fetch('/api/ibv/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, state, useSandbox })
        })

        const data = await res.json()

        // Si erreur (sauf duplicate qui est OK)
        if (!res.ok && !data.error?.includes('duplicate') && !data.error?.includes('already exists')) {
          setStatus('error')
          setError(data.error || 'Erreur lors du traitement')
          return
        }

        // Sauvegarder l'ID de session pour le tracking
        if (data.session_id) {
          setIbvSessionId(data.session_id)
        }

        // Succès! Le traitement continue en arrière-plan
        // On n'attend PAS que les données soient prêtes
        setStatus('success')

      } catch (err: unknown) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    }

    startProcessing()
  }, [searchParams])

  // Fonction pour créer le tracking et rediriger vers le suivi
  const handleViewTracking = async () => {
    if (!ibvSessionId) {
      // Si pas d'ID session, rediriger vers l'accueil
      router.push('/')
      return
    }

    setTrackingLoading(true)

    try {
      const res = await fetch('/api/tracking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ibv_session_id: ibvSessionId })
      })

      const data = await res.json()

      if (data.success && data.magic_link) {
        // Extraire le token du magic link et rediriger
        const url = new URL(data.magic_link)
        router.push(url.pathname)
      } else if (data.need_email) {
        // L'email n'est pas disponible dans les données Flinks
        // Pour l'instant, rediriger vers l'accueil avec un message
        alert('Votre email n\'est pas disponible. Notre équipe vous contactera bientôt.')
        router.push('/')
      } else {
        console.error('Erreur création tracking:', data.error)
        router.push('/')
      }
    } catch (err) {
      console.error('Erreur:', err)
      router.push('/')
    } finally {
      setTrackingLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">

        {/* Loading initial (très bref) */}
        {status === 'loading' && (
          <>
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Un instant...
            </h1>
          </>
        )}

        {/* Succès - Message de remerciement immédiat */}
        {status === 'success' && (
          <>
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Merci!
            </h1>

            <p className="text-lg text-gray-600 mb-6">
              Votre vérification bancaire a été soumise avec succès.
            </p>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Un email de suivi vous sera envoyé
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Dès que vos données bancaires seront traitées (environ 2-5 minutes),
                    vous recevrez un email avec un lien pour suivre votre demande en temps réel.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    Traitement en cours
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Notre équipe analysera votre dossier et vous contactera sous peu.
                    Vous n'avez rien d'autre à faire pour le moment.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Retour à l'accueil
              </button>

              <button
                onClick={handleViewTracking}
                disabled={trackingLoading}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {trackingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  'Voir mon suivi maintenant (si déjà prêt)'
                )}
              </button>
            </div>
          </>
        )}

        {/* Erreur */}
        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Erreur
            </h1>
            <p className="text-gray-600 mb-4">
              Une erreur est survenue lors de la soumission.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={() => router.push('/IBV_FLINKS')}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function IBVCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
