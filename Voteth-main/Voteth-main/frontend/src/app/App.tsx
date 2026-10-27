import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppRouter } from '@routes/AppRouter'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { WalletProvider } from '@/contexts/WalletContext'

/**
 * VotEth 2.0 — Root Application Component
 *
 * Responsibilities:
 * - Composes all top-level providers in dependency order
 * - Does NOT contain any UI logic — this is purely provider composition
 *
 * Provider order:
 *   ThemeProvider (manages light/dark styling baseline)
 *   └── AuthProvider (manages Supabase session & user profile state)
 *       └── WalletProvider (manages MetaMask & Ethereum Sepolia connection)
 *           └── QueryClientProvider (managed data fetching layer)
 *               └── BrowserRouter (client routing)
 *                   └── AppRouter (route definitions)
 *
 * @see Volume IV, Chapter 14 for full provider composition pattern
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes
      gcTime: 1000 * 60 * 10,         // 10 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,                        // Don't retry mutations — votes must not be submitted twice
    },
  },
})

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WalletProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
            <Toaster
              theme="dark"
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(228 35% 12%)',
                  border: '1px solid hsl(228 20% 25%)',
                  color: 'hsl(220 20% 90%)',
                },
              }}
              richColors
              closeButton
            />
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
