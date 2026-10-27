/**
 * VotEth 2.0 — Focused Tests: Wallet Context
 *
 * Verifies connection state, balance fetching, network change handling,
 * and the exposed refreshBalance() functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { WalletProvider, useWallet } from '@/contexts/WalletContext'

describe('WalletContext', () => {
  let mockEthereum: {
    request: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    removeListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    mockEthereum = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    ;(window as any).ethereum = mockEthereum
  })

  it('exposes refreshBalance in context', async () => {
    mockEthereum.request.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return []
      if (method === 'eth_chainId') return '0xaa36a7'
      return null
    })

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    })

    expect(result.current.refreshBalance).toBeDefined()
    expect(typeof result.current.refreshBalance).toBe('function')
  })

  it('fetches balance when connect is called and formats correctly', async () => {
    mockEthereum.request.mockImplementation(async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0x171134414a74101c2a339cfde6f17ccb5c87b38b']
      if (method === 'eth_accounts') return ['0x171134414a74101c2a339cfde6f17ccb5c87b38b']
      if (method === 'eth_chainId') return '0xaa36a7'
      if (method === 'eth_getBalance') return '0x1a91e5e0a0000000' // 1.9145 ETH in hex
      return null
    })

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.address).toBe('0x171134414a74101c2a339cfde6f17ccb5c87b38b')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isCorrectNetwork).toBe(true)
    expect(result.current.balance).toBe('1.9146')
  })

  it('refreshes balance on refreshBalance() call', async () => {
    let balanceVal = '0x1a91e5e0a0000000' // 1.9145 ETH
    mockEthereum.request.mockImplementation(async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0x171134414a74101c2a339cfde6f17ccb5c87b38b']
      if (method === 'eth_accounts') return ['0x171134414a74101c2a339cfde6f17ccb5c87b38b']
      if (method === 'eth_chainId') return '0xaa36a7'
      if (method === 'eth_getBalance') return balanceVal
      return null
    })

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    })

    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.balance).toBe('1.9146')

    // Simulate balance change after transaction gas deduction
    balanceVal = '0x1800000000000000' // ~1.7293 ETH
    await act(async () => {
      await result.current.refreshBalance()
    })

    expect(result.current.balance).toBe('1.7294')
  })
})
