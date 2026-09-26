import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { AdvisorPage } from './features/advisor/AdvisorPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { MarketsPage } from './pages/MarketsPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { WelcomePage } from './pages/WelcomePage'

// Screen map: DESIGN.md §5. The host must serve index.html for unknown paths (SPA fallback).
export const router = createBrowserRouter([
  { path: '/welcome', element: <WelcomePage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '/portfolio', element: <PortfolioPage /> },
      { path: '/advisor', element: <AdvisorPage /> },
      { path: '/markets', element: <MarketsPage /> },
      { path: '/learn', element: <LearnPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
