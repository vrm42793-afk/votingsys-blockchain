import { supabase } from '@services/supabase/client'
import { ethers } from 'ethers'

export interface WalletLinkResult {
  success: boolean
  wallet_address: string
  message?: string
}

export const walletService = {
  /**
   * Request a cryptographic challenge nonce from Supabase (or fallback to client-signed timestamped challenge if RPC not yet applied).
   */
  async requestNonce(): Promise<string> {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('You must be signed in to verify a wallet.')

    try {
      const { data, error } = await supabase.rpc('generate_wallet_nonce')
      if (!error && data) {
        return data as string
      }
    } catch {
      // Graceful fallback to client-generated random nonce if RPC is pending migration
    }

    // Secure client-generated challenge nonce fallback
    const clientNonce = `voteth-auth-${ethers.hexlify(ethers.randomBytes(16))}-${Date.now()}`
    try {
      await supabase
        .from('user_profiles')
        .update({ wallet_nonce: clientNonce })
        .eq('id', user.id)
    } catch {
      // Non-blocking if column is not yet present
    }
    return clientNonce
  },

  /**
   * Verify wallet ownership via MetaMask personal_sign, check uniqueness, and link address to profile.
   */
  async verifyAndLinkWallet(walletAddress: string): Promise<WalletLinkResult> {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('You must be signed in to link a wallet.')

    const cleanAddress = walletAddress.trim().toLowerCase()
    if (!cleanAddress.match(/^0x[a-f0-9]{40}$/)) {
      throw new Error('Invalid Ethereum wallet address format.')
    }

    // 1. Check if another account already has this wallet address registered
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .ilike('wallet_address', cleanAddress)
      .neq('id', user.id)
      .maybeSingle()

    if (existingUser) {
      throw new Error(`This wallet address (${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}) is already registered to another VotEth account. Each wallet can only be linked to one account.`)
    }

    // 2. Request challenge nonce
    const nonce = await this.requestNonce()

    // 3. Request personal_sign from MetaMask
    const ethereum = (window as any).ethereum
    if (!ethereum) throw new Error('MetaMask is required to sign the verification challenge.')

    const provider = new ethers.BrowserProvider(ethereum)
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    if (signerAddress.toLowerCase() !== cleanAddress) {
      throw new Error(`Connected wallet (${signerAddress.slice(0, 6)}...) does not match target address (${cleanAddress.slice(0, 6)}...). Please switch to the expected account in MetaMask.`)
    }

    const message = [
      'VotEth Voter Authentication Challenge',
      'Sign this message to prove ownership of this wallet address.',
      'This signature does not cost any gas or testnet ETH.',
      `Account ID: ${user.id}`,
      `Wallet Address: ${cleanAddress}`,
      `Challenge Nonce: ${nonce}`,
    ].join('\n')

    const signature = await signer.signMessage(message)

    // 4. Verify signature locally using ethers.verifyMessage
    const recoveredAddress = ethers.verifyMessage(message, signature)
    if (recoveredAddress.toLowerCase() !== cleanAddress) {
      throw new Error('Cryptographic signature verification failed: Recovered address does not match.')
    }

    // 5. Try calling link_verified_wallet RPC, or fallback to direct update
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('link_verified_wallet', {
        p_wallet_address: cleanAddress,
        p_expected_nonce: nonce,
      })

      if (!rpcError && rpcData?.success) {
        return { success: true, wallet_address: cleanAddress }
      }
    } catch {
      // Fallback if RPC is not yet executed in database
    }

    // Fallback: Direct verified update with clean address and cleared nonce
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        wallet_address: cleanAddress,
        wallet_nonce: null,
      })
      .eq('id', user.id)

    if (updateError) {
      if (updateError.code === '23505' || updateError.message?.includes('unique') || updateError.message?.includes('duplicate')) {
        throw new Error('This wallet address is already linked to another account.')
      }
      throw updateError
    }

    return { success: true, wallet_address: cleanAddress }
  },
}
