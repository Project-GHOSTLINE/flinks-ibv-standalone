'use client'

import { useState } from 'react'
import { Shield, ExternalLink, CheckCircle } from 'lucide-react'

export default function IBVFlinksPage() {
  const [showModal, setShowModal] = useState(false)
  const [state, setState] = useState<string>('')
  const [iframeUrl, setIframeUrl] = useState<string>('')

  const handleOpenFlinks = () => {
    // Generate state UUID for session tracking
    const stateToken = crypto.randomUUID()
    setState(stateToken)

    // Build iframe URL with current origin (ngrok or localhost or production)
    const flinksConnectDomain = process.env.NEXT_PUBLIC_FLINKS_CONNECT_DOMAIN ||
      'https://solutionargentrapide-iframe.private.fin.ag/v2/'
    const redirectUrl = encodeURIComponent(`${window.location.origin}/ibv/callback?state=${stateToken}`)
    setIframeUrl(`${flinksConnectDomain}?redirectUrl=${redirectUrl}&innerRedirect=false`)

    // Open modal
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setIframeUrl('')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sar-green rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Connexion bancaire sécurisée (Test IBV Flinks)
          </h1>
          <p className="text-xl text-gray-600">
            Test harness pour vérification bancaire instantanée
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <CheckCircle className="text-sar-green mb-3" size={32} />
            <h3 className="font-semibold mb-2 text-lg">Sécurité garantie</h3>
            <p className="text-gray-600">
              Connexion sécurisée via Flinks. Vos identifiants bancaires ne sont jamais
              transmis à Solution Argent Rapide.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <ExternalLink className="text-sar-gold mb-3" size={32} />
            <h3 className="font-semibold mb-2 text-lg">Redirection automatique</h3>
            <p className="text-gray-600">
              Après connexion réussie, vous serez redirigé automatiquement vers
              notre page de confirmation.
            </p>
          </div>
        </div>

        {/* Main Action */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Prêt à connecter votre compte bancaire?
          </h2>
          <p className="text-gray-600 mb-6">
            Cliquez sur le bouton ci-dessous pour ouvrir la fenêtre de connexion
            sécurisée Flinks Connect.
          </p>

          <button
            onClick={handleOpenFlinks}
            className="bg-sar-green hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-lg
                     transition-colors duration-200 inline-flex items-center gap-2"
          >
            <Shield size={20} />
            Ouvrir Flinks Connect
          </button>

          {state && (
            <p className="text-sm text-gray-500 mt-4">
              Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{state}</code>
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Comment ça fonctionne?</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Cliquez sur &quot;Ouvrir Flinks Connect&quot;</li>
            <li>Sélectionnez votre institution financière</li>
            <li>Connectez-vous avec vos identifiants bancaires</li>
            <li>Autorisez l&apos;accès en lecture seule</li>
            <li>Vous serez redirigé vers la page de confirmation</li>
          </ol>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Flinks Connect - Connexion bancaire</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>

            {/* Modal Body - Iframe */}
            <div className="flex-1 overflow-hidden min-h-[600px]">
              <iframe
                src={iframeUrl}
                className="w-full h-full border-0"
                title="Flinks Connect"
                allow="camera; microphone"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-top-navigation-by-user-activation"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
