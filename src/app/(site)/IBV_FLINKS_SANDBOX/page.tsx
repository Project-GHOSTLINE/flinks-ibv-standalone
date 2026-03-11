'use client'

import { useState, useEffect } from 'react'
import { Shield, ExternalLink, CheckCircle, TestTube } from 'lucide-react'

export default function IBVFlinksSandboxPage() {
  const [showModal, setShowModal] = useState(false)
  const [state, setState] = useState<string>('')
  const [iframeUrl, setIframeUrl] = useState<string>('')

  const handleOpenFlinks = () => {
    // Generate state UUID for session tracking
    const stateToken = crypto.randomUUID()
    setState(stateToken)

    // Build iframe URL with SANDBOX domain and customerId
    const customerId = '43387ca6-0391-4c82-857d-70d95f087ecb' // Sandbox Customer ID
    const flinksConnectDomain = process.env.NEXT_PUBLIC_FLINKS_SANDBOX_CONNECT_DOMAIN ||
      'https://toolbox-iframe.private.fin.ag/v2/?demo=true'
    // Add sandbox=true to callback URL to inform backend to use sandbox credentials
    const redirectUrl = encodeURIComponent(`${window.location.origin}/ibv/callback?state=${stateToken}&sandbox=true`)
    setIframeUrl(`${flinksConnectDomain}&redirectUrl=${redirectUrl}&customerId=${customerId}&innerRedirect=false`)

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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500 rounded-full mb-4">
            <TestTube className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Connexion bancaire sécurisée (SANDBOX - Test)
          </h1>
          <p className="text-xl text-gray-600">
            Environnement de test Flinks avec Flinks Capital
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            <TestTube className="text-yellow-600" size={20} />
            <span className="text-sm text-yellow-800 font-semibold">
              MODE SANDBOX - Aucune vraie banque connectée
            </span>
          </div>
        </div>

        {/* Test Credentials */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Shield className="text-blue-600" size={24} />
            Credentials de test
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-blue-700 font-medium">Institution:</p>
              <p className="text-lg font-mono bg-white px-3 py-2 rounded border border-blue-200">
                Flinks Capital
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Username:</p>
              <p className="text-lg font-mono bg-white px-3 py-2 rounded border border-blue-200">
                Greatday
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Password:</p>
              <p className="text-lg font-mono bg-white px-3 py-2 rounded border border-blue-200">
                Everyday
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <CheckCircle className="text-green-500 mb-3" size={32} />
            <h3 className="font-semibold mb-2 text-lg">Test sans risque</h3>
            <p className="text-gray-600">
              Environnement sandbox complètement séparé. Aucune vraie banque
              ne sera contactée.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <ExternalLink className="text-blue-500 mb-3" size={32} />
            <h3 className="font-semibold mb-2 text-lg">Données de test</h3>
            <p className="text-gray-600">
              Flinks Capital retourne des données fictives pour tester
              l&apos;intégration complète.
            </p>
          </div>
        </div>

        {/* Main Action */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Prêt à tester la connexion?
          </h2>
          <p className="text-gray-600 mb-6">
            Cliquez sur le bouton ci-dessous pour ouvrir Flinks Connect
            en mode sandbox avec Flinks Capital.
          </p>

          <button
            onClick={handleOpenFlinks}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8 py-4 rounded-lg
                     transition-colors duration-200 inline-flex items-center gap-2"
          >
            <TestTube size={20} />
            Ouvrir Flinks Connect (Sandbox)
          </button>

          {state && (
            <p className="text-sm text-gray-500 mt-4">
              Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{state}</code>
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="mt-12 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3">Comment tester?</h3>
          <ol className="list-decimal list-inside space-y-2 text-green-800">
            <li>Cliquez sur &quot;Ouvrir Flinks Connect (Sandbox)&quot;</li>
            <li>Cherchez &quot;Flinks Capital&quot; dans la liste</li>
            <li>Username: <code className="bg-white px-2 py-1 rounded">Greatday</code></li>
            <li>Password: <code className="bg-white px-2 py-1 rounded">Everyday</code></li>
            <li>Vous serez redirigé vers la page de confirmation</li>
            <li>Les données fictives seront enregistrées dans Supabase</li>
          </ol>
        </div>

        {/* Production Link */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Prêt à tester avec une vraie banque?
          </p>
          <a
            href="/IBV_FLINKS"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
          >
            <Shield size={20} />
            Aller à la version Production
          </a>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b bg-yellow-50">
              <div className="flex items-center gap-3">
                <TestTube className="text-yellow-600" size={24} />
                <div>
                  <h3 className="text-lg font-semibold">Flinks Connect - SANDBOX</h3>
                  <p className="text-sm text-gray-600">Mode test avec Flinks Capital</p>
                </div>
              </div>
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
                title="Flinks Connect Sandbox"
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
