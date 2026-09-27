import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { PageLoading, RouteFailure } from './components/RouteFeedback'

// Load each page only when it is visited. Chat and voice providers stay above the
// router, so downloading a route never starts a second conversation/controller.
export const router = createBrowserRouter([
  {
    path: '/welcome',
    lazy: async () => ({ Component: (await import('./pages/WelcomePage')).WelcomePage }),
    HydrateFallback: PageLoading,
    ErrorBoundary: RouteFailure,
  },
  {
    Component: AppShell,
    HydrateFallback: PageLoading,
    ErrorBoundary: RouteFailure,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/HomePage')).HomePage }) },
      { path: '/portfolio', lazy: async () => ({ Component: (await import('./pages/PortfolioPage')).PortfolioPage }) },
      { path: '/advisor', lazy: async () => ({ Component: (await import('./features/advisor/AdvisorPage')).AdvisorPage }) },
      { path: '/markets', lazy: async () => ({ Component: (await import('./pages/MarketsPage')).MarketsPage }) },
      { path: '/learn', lazy: async () => ({ Component: (await import('./pages/LearnPage')).LearnPage }) },
      { path: '/learn/:lessonId', lazy: async () => ({ Component: (await import('./features/learn/LessonPage')).LessonPage }) },
      { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFoundPage')).NotFoundPage }) },
    ],
  },
])
