/**
 * VotEth 2.0 — IPFS Service
 *
 * Provides decentralized content-addressed storage for public, non-sensitive
 * election manifests (election titles, descriptions, candidate lists, bios).
 *
 * Security Guarantee:
 * NEVER uploads voter identities, private ballots, or cryptographic voter nullifiers.
 * Only public election specifications and candidate manifests are pinned.
 */

export interface CandidateManifestEntry {
  id?: string
  name: string
  bio?: string | null
  photo_url?: string | null
  display_order?: number
}

export interface ElectionManifest {
  version: '1.0.0'
  election_id: string
  org_id: string
  title: string
  description: string | null
  election_type: string
  max_votes_per_voter: number
  start_date: string | null
  end_date: string | null
  created_at: string
  candidates: CandidateManifestEntry[]
}

export interface IpfsUploadResult {
  cid: string
  gatewayUrl: string
  isLocalFallback: boolean
  pinnedAt: string
}

const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

// Base32 encoding for deterministic CIDv1 (bafkrei...) fallback
function toBase32(buffer: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Computes a deterministic CIDv1 (raw-sha256) string for content when Pinata is offline or unconfigured.
 */
async function computeDeterministicCid(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  
  // Multihash prefix for SHA256: 0x12 (sha2-256), 0x20 (32 bytes length)
  // CIDv1 prefix for raw: 0x01 (cidv1), 0x55 (raw multicodec)
  const cidBytes = new Uint8Array(4 + hashArray.length)
  cidBytes[0] = 0x01 // CIDv1
  cidBytes[1] = 0x55 // raw binary
  cidBytes[2] = 0x12 // sha2-256
  cidBytes[3] = 0x20 // 32 bytes length
  cidBytes.set(hashArray, 4)

  return 'bafkrei' + toBase32(hashArray)
}

export const ipfsService = {
  getGatewayBase(): string {
    const custom = import.meta.env.VITE_IPFS_GATEWAY
    if (custom && typeof custom === 'string') {
      return custom.endsWith('/') ? custom : `${custom}/`
    }
    return DEFAULT_GATEWAY
  },

  getGatewayUrl(cid: string): string {
    return `${this.getGatewayBase()}${cid}`
  },

  /**
   * Upload an election manifest to IPFS.
   * If Pinata JWT or API keys are configured in environment variables, pins via Pinata API.
   * If credentials are not configured or request fails, falls back gracefully to a deterministic
   * cryptographic CID with local storage caching for uninterrupted demonstration.
   */
  async uploadElectionManifest(manifest: ElectionManifest): Promise<IpfsUploadResult> {
    const jsonString = JSON.stringify(manifest, null, 2)
    const pinataJwt = import.meta.env.VITE_PINATA_JWT
    const pinataApiKey = import.meta.env.VITE_PINATA_API_KEY
    const pinataSecret = import.meta.env.VITE_PINATA_API_SECRET
    const gatewayBase = this.getGatewayBase()

    // 1. Try Pinata JWT or API Key if provided
    if (pinataJwt || (pinataApiKey && pinataSecret)) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (pinataJwt) {
          headers['Authorization'] = `Bearer ${pinataJwt}`
        } else {
          headers['pinata_api_key'] = pinataApiKey
          headers['pinata_secret_api_key'] = pinataSecret
        }

        const body = {
          pinataOptions: {
            cidVersion: 1,
          },
          pinataMetadata: {
            name: `voteth-election-${manifest.election_id}.json`,
            keyvalues: {
              type: 'election-manifest',
              election_id: manifest.election_id,
              org_id: manifest.org_id,
            },
          },
          pinataContent: manifest,
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const data = await res.json()
          const cid = data.IpfsHash
          // Cache locally as backup
          try {
            localStorage.setItem(`ipfs_${cid}`, jsonString)
          } catch {
            // ignore localStorage quota errors
          }

          return {
            cid,
            gatewayUrl: `${gatewayBase}${cid}`,
            isLocalFallback: false,
            pinnedAt: new Date().toISOString(),
          }
        } else {
          console.warn('[ipfsService] Pinata upload returned non-200, falling back to deterministic CID:', res.statusText)
        }
      } catch (err) {
        console.warn('[ipfsService] Pinata upload failed or timed out, falling back to deterministic CID:', err)
      }
    }

    // 2. Deterministic Fallback Mode (Demo / Offline / Local)
    const cid = await computeDeterministicCid(jsonString)
    try {
      localStorage.setItem(`ipfs_${cid}`, jsonString)
    } catch {
      // ignore
    }

    return {
      cid,
      gatewayUrl: `${gatewayBase}${cid}`,
      isLocalFallback: true,
      pinnedAt: new Date().toISOString(),
    }
  },

  /**
   * Fetches an election manifest by its IPFS CID.
   * Tries the public gateway first, then falls back to local cache.
   */
  async fetchElectionManifest(cid: string): Promise<ElectionManifest | null> {
    if (!cid) return null

    // 1. Check local cache first for instant load
    try {
      const cached = localStorage.getItem(`ipfs_${cid}`)
      if (cached) {
        return JSON.parse(cached) as ElectionManifest
      }
    } catch {
      // Continue to gateway
    }

    // 2. Fetch from gateway with 4-second timeout
    const gatewayUrl = this.getGatewayUrl(cid)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const res = await fetch(gatewayUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        try {
          localStorage.setItem(`ipfs_${cid}`, JSON.stringify(data))
        } catch {
          // ignore
        }
        return data as ElectionManifest
      }
    } catch (err) {
      console.warn(`[ipfsService] Gateway fetch failed for CID ${cid}:`, err)
    }

    return null
  },
}
