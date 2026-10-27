import { createContext, useContext, useState, useEffect } from 'react'
import { ethers } from 'ethers'

// ---------------------------------------------------------------------------
// Wallet connect implementation using ethers.js + MetaMask
// See VotEth Development Bible Ch. 22 (WalletConnect).
// ---------------------------------------------------------------------------

export type WalletStatus = 'not_connected' | 'connecting' | 'connected' | 'wrong_network' | 'locked'

interface WalletContextType {
  address: string | null
  balance: string | null
  isConnected: boolean
  isCorrectNetwork: boolean
  status: WalletStatus
  connect: (forceSelect?: boolean) => Promise<void>
  disconnect: () => void
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const SEPOLIA_CHAIN_ID = '0xaa36a7' // 11155111 in hex

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)
  const [status, setStatus] = useState<WalletStatus>('not_connected')

  const isConnected = !!address

  // Dynamic balance checker
  const fetchBalance = async (addr: string) => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return
    try {
      const balHex = await ethereum.request({
        method: 'eth_getBalance',
        params: [addr, 'latest']
      })
      const balDecimal = BigInt(balHex)
      const formatted = ethers.formatEther(balDecimal)
      // Limit to 4 decimal places
      setBalance(parseFloat(formatted).toFixed(4))
    } catch (err) {
      console.error('[WalletContext] Failed to fetch balance:', err)
      setBalance('0.0000')
    }
  }

  useEffect(() => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    const handleAccounts = (accounts: any) => {
      const list = accounts as string[]
      if (list.length === 0) {
        setAddress(null)
        setBalance(null)
        setIsCorrectNetwork(false)
        setStatus('not_connected')
      } else {
        const addr = list[0] ?? null
        setAddress(addr)
        if (addr) fetchBalance(addr)
        ethereum.request({ method: 'eth_chainId' }).then((chainId: any) => {
          const correct = chainId === SEPOLIA_CHAIN_ID
          setIsCorrectNetwork(correct)
          setStatus(correct ? 'connected' : 'wrong_network')
        })
      }
    }

    const handleChain = (chainId: any) => {
      const correct = (chainId as string) === SEPOLIA_CHAIN_ID
      setIsCorrectNetwork(correct)
      if (address) {
        setStatus(correct ? 'connected' : 'wrong_network')
        if (correct) {
          fetchBalance(address)
        }
      }
    }

    ethereum.on('accountsChanged', handleAccounts)
    ethereum.on('chainChanged', handleChain)

    // Initial check
    const checkConnection = async () => {
      if (localStorage.getItem('voteth:wallet:disconnected') === 'true') {
        setStatus('not_connected')
        return
      }
      try {
        const isUnlocked = ethereum._metamask && typeof ethereum._metamask.isUnlocked === 'function' 
          ? await ethereum._metamask.isUnlocked() 
          : true
        
        if (!isUnlocked) {
          setStatus('locked')
          return
        }

        const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[]
        if (accounts && accounts.length > 0) {
          const addr = accounts[0] ?? null
          setAddress(addr)
          if (addr) fetchBalance(addr)
          const chainId = await ethereum.request({ method: 'eth_chainId' })
          const correct = chainId === SEPOLIA_CHAIN_ID
          setIsCorrectNetwork(correct)
          setStatus(correct ? 'connected' : 'wrong_network')
        } else {
          setAddress(null)
          setBalance(null)
          setIsCorrectNetwork(false)
          setStatus('not_connected')
        }
      } catch (err) {
        console.error('[WalletContext] Initial check error:', err)
        setStatus('not_connected')
      }
    }

    checkConnection()

    return () => {
      ethereum.removeListener('accountsChanged', handleAccounts)
      ethereum.removeListener('chainChanged', handleChain)
    }
  }, [address])

  const connect = async (forceSelect = false) => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed. Please install it to connect a wallet.')
      return
    }

    try {
      setStatus('connecting')
      localStorage.removeItem('voteth:wallet:disconnected')
      
      if (forceSelect) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          })
        } catch (permError) {
          console.warn('[WalletContext] Permission request denied:', permError)
        }
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]

      if (accounts.length === 0) {
        setStatus('locked')
        return
      }
      const addr = accounts[0] ?? null
      setAddress(addr)
      if (addr) fetchBalance(addr)

      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      }) as string
      
      const correct = chainId === SEPOLIA_CHAIN_ID
      setIsCorrectNetwork(correct)

      if (!correct) {
        setStatus('wrong_network')
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          })
          setIsCorrectNetwork(true)
          setStatus('connected')
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: SEPOLIA_CHAIN_ID,
                  chainName: 'Ethereum Sepolia Testnet',
                  nativeCurrency: {
                    name: 'Sepolia ETH',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: [
                    'https://ethereum-sepolia-rpc.publicnode.com',
                    'https://rpc.sepolia.org'
                  ],
                  blockExplorerUrls: ['https://sepolia.etherscan.io/'],
                },
              ],
            })
            setIsCorrectNetwork(true)
            setStatus('connected')
          } else {
            setStatus('wrong_network')
          }
        }
      } else {
        setStatus('connected')
      }
    } catch (err) {
      console.error('[WalletContext] Connection error:', err)
      setStatus('not_connected')
    }
  }

  const disconnect = () => {
    localStorage.setItem('voteth:wallet:disconnected', 'true')
    setAddress(null)
    setBalance(null)
    setIsCorrectNetwork(false)
    setStatus('not_connected')
  }

  const refreshBalance = async () => {
    if (address) {
      await fetchBalance(address)
    }
  }

  return (
    <WalletContext.Provider
      value={{ address, balance, isConnected, isCorrectNetwork, status, connect, disconnect, refreshBalance }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
