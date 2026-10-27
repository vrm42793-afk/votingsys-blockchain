/**
 * VotEth 2.0 — Vitest Test Setup
 *
 * This file runs before every test file.
 * It configures the testing environment with:
 * - jest-dom matchers for DOM assertions
 * - Mock implementations for browser APIs not in jsdom
 * - Supabase client mock setup
 *
 * @see vite.config.ts for the setupFiles configuration
 */

import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clean up after each test to prevent DOM accumulation
afterEach(() => {
  cleanup()
})

// =============================================================================
// BROWSER API MOCKS
// jsdom does not implement all browser APIs. Mock the ones we use.
// =============================================================================

// Mock window.matchMedia — not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock window.ResizeObserver — not implemented in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.IntersectionObserver — not implemented in jsdom
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// =============================================================================
// ENVIRONMENT VARIABLE MOCKS
// Provide test values for Vite env vars
// =============================================================================

// Override import.meta.env for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_CHAIN_ID: '11155111',
    VITE_APP_ENV: 'test',
    VITE_APP_URL: 'http://localhost:5173',
    VITE_REGISTRY_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000001',
    VITE_ELECTION_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000002',
    VITE_VERIFIER_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000003',
    DEV: false,
    PROD: false,
    MODE: 'test',
  },
})

// =============================================================================
// SUPABASE MOCK
// Tests should mock the Supabase client — never hit a real database in unit tests
// =============================================================================
vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }),
  },
}))

beforeEach(() => {
  // Clear all mocks before each test for isolation
  vi.clearAllMocks()
})
