import { startTransition, useEffect, useState } from 'react'

import { AppShell, type AppPage } from '../components/layout/AppShell'
import { useEchoSuggestApp } from '../hooks/useEchoSuggestApp'
import { DiscoverPage } from './DiscoverPage'
import { InsightsPage } from './InsightsPage'
import { SavedPage } from './SavedPage'

function pageFromHash(): AppPage {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'saved' || hash === 'insights') return hash
  return 'discover'
}

export default function WorkspacePage() {
  const app = useEchoSuggestApp()
  const [page, setPage] = useState<AppPage>(() => pageFromHash())

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#discover')
    }

    const onHashChange = () => {
      startTransition(() => {
        setPage(pageFromHash())
      })
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (nextPage: AppPage) => {
    if (window.location.hash !== `#${nextPage}`) {
      window.location.hash = nextPage
    } else {
      setPage(nextPage)
    }
  }

  const heroProduct = app.heroId ? app.byId.get(app.heroId) : undefined

  const shuffleHero = () => {
    const next = app.catalogIndex[Math.floor(Math.random() * app.catalogIndex.length)]
    if (next) {
      app.setHeroId(next.id)
    }
  }

  let pageContent
  if (page === 'saved') {
    pageContent = (
      <SavedPage
        user={app.user}
        savedProducts={app.savedProducts}
        fallbackProducts={app.catalogIndex}
        savedIds={app.savedIds}
        saveBusy={app.saveBusy}
        onToggleSave={app.toggleSave}
        onSelectProduct={(productId) => app.selectProduct(productId, 'catalog')}
      />
    )
  } else if (page === 'insights') {
    pageContent = (
      <InsightsPage
        health={app.health}
        dbPing={app.dbPing}
        loading={app.loading}
        error={app.error}
        metrics={app.metrics}
        jobStatus={app.jobStatus}
        pAtK={app.pAtK}
        pAtKLoading={app.pAtKLoading}
        precomputeBusy={app.precomputeBusy}
        onRefreshMetrics={app.loadMetrics}
        onRunPrecompute={app.runPrecompute}
        onRunPrecisionEval={app.runPrecisionEval}
      />
    )
  } else {
    pageContent = (
      <DiscoverPage
        products={app.products}
        byId={app.byId}
        heroProduct={heroProduct}
        productsError={app.productsError}
        catalogQ={app.catalogQ}
        catalogCategory={app.catalogCategory}
        onCatalogQChange={app.setCatalogQ}
        onCatalogCategoryChange={app.setCatalogCategory}
        onSearch={() => void app.loadProducts()}
        onClear={() => void app.clearCatalogFilters()}
        onPlayHero={() => {
          if (app.heroId) {
            app.trackClick(app.heroId, 'catalog')
          }
        }}
        onShuffleHero={shuffleHero}
        onSelectProduct={app.selectProduct}
        coldStartRec={app.coldStartRec}
        contentRec={app.contentRec}
        hybridRec={app.hybridRec}
        cfRec={app.cfRec}
        recLoading={app.recLoading}
        savedIds={app.savedIds}
        canSave={Boolean(app.user)}
        saveBusy={app.saveBusy}
        onToggleSave={app.toggleSave}
      />
    )
  }

  return (
    <AppShell
      page={page}
      onNavigate={navigate}
      user={app.user}
      authBusy={app.authBusy}
      authError={app.authError}
      onLogin={app.login}
      onRegister={app.register}
      onLogout={app.logout}
      profileId={app.profileId}
      onProfileChange={app.setProfileId}
      onUseAccountProfile={() => {
        if (app.user?.id) app.setProfileId(app.user.id)
      }}
      onRefreshCatalog={app.refreshCatalog}
      catalogCount={app.catalogIndex.length}
      savedCount={app.savedProducts.length}
      redisConnected={app.metrics?.redis_connected ?? null}
    >
      {pageContent}
    </AppShell>
  )
}
