/**
 * VotEth 2.0 — Verified Artifact Synchronization Script
 *
 * Sourced directly from Hardhat compiled artifacts (contracts/artifacts/contracts/).
 * 
 * Freshness & Integrity Protections:
 * 1. Invokes "npx hardhat compile" in the contracts directory to guarantee artifacts are never stale.
 * 2. Compares compiled bytecodes against cryptographically pinned trusted checksums.
 * 3. Fails closed with an error if artifacts are missing, malformed, stale, or tampered with.
 *
 * Usage:
 *   node scripts/sync-artifacts.mjs
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts')
const CONTRACTS_ARTIFACTS_DIR = path.resolve(CONTRACTS_DIR, 'artifacts/contracts')
const OUTPUT_FILE = path.resolve(__dirname, '../src/contracts/artifacts.ts')

// Trusted expected SHA-256 checksums from clean compilation of reviewed Solidity sources
export const TRUSTED_CONTRACT_CHECKSUMS = {
  VotEthRegistry: {
    creationSha256: '718d304e59d653f31048de700eefe9291b80aa8c864bdac6d4bf12091f857851',
    deployedSha256: '95a8ec9ce8035feba1151ffe177b1b8b0835c2b0f57d33cd1509fe4f1a75a38e',
    creationBytes: 3282,
    deployedBytes: 3228,
  },
  VotEthElection: {
    creationSha256: '6196563e6309a7d8867ab470a7bcc6252ea296ea26708a428040db6b3d1d1877',
    deployedSha256: '0e1f34abfecde9580c3ed12da2dd5e4ffd37ccbef80b20d6181e6f13bcd5297b',
    creationBytes: 4445,
    deployedBytes: 4331,
  },
  VotEthVerifier: {
    creationSha256: '7e9403ac81545c2794ef4fdd46b44a76a281b1459e42ea0e8ecbfb1ddf328643',
    deployedSha256: 'a8994653bfb809fd5d75eab600f53363c18372f0cce11218777e88ec80bdebe7',
    creationBytes: 2623,
    deployedBytes: 2568,
  },
}

const CONTRACT_CONFIGS = [
  {
    name: 'VotEthRegistry',
    file: 'VotEthRegistry.sol/VotEthRegistry.json',
    constructorArgs: [],
    description: 'Central registry contract managing organizations and election mappings.',
  },
  {
    name: 'VotEthElection',
    file: 'VotEthElection.sol/VotEthElection.json',
    constructorArgs: [],
    description: 'Core ballot ledger enforcing one-vote-per-voter and election state machine.',
  },
  {
    name: 'VotEthVerifier',
    file: 'VotEthVerifier.sol/VotEthVerifier.json',
    constructorArgs: [],
    description: 'Cryptographic proof verifier for vote hashes and Merkle root tallies.',
  },
]

function compileContracts() {
  console.log('[sync-artifacts] Triggering Hardhat compilation in:', CONTRACTS_DIR)
  const cmd = process.platform === 'win32' ? 'npx.cmd hardhat compile' : 'npx hardhat compile'
  try {
    execSync(cmd, { cwd: CONTRACTS_DIR, stdio: 'pipe' })
    console.log('[sync-artifacts] ✓ Hardhat compilation verified.')
  } catch (err) {
    throw new Error(`Hardhat compilation failed: ${err.message}`)
  }
}

function sync() {
  compileContracts()

  if (!fs.existsSync(CONTRACTS_ARTIFACTS_DIR)) {
    throw new Error(`Hardhat artifacts directory not found: ${CONTRACTS_ARTIFACTS_DIR}`)
  }

  const exportedContracts = {}

  for (const config of CONTRACT_CONFIGS) {
    const artifactPath = path.join(CONTRACTS_ARTIFACTS_DIR, config.file)
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact for ${config.name} not found at ${artifactPath}.`)
    }

    const artifactJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))

    // 1. Structural validation
    if (!Array.isArray(artifactJson.abi) || artifactJson.abi.length === 0) {
      throw new Error(`Invalid ABI in ${config.name}: ABI must be a non-empty array.`)
    }

    if (!artifactJson.bytecode || typeof artifactJson.bytecode !== 'string' || !artifactJson.bytecode.startsWith('0x') || artifactJson.bytecode.length < 10) {
      throw new Error(`Invalid bytecode in ${config.name}: creation bytecode is missing or malformed.`)
    }

    if (!artifactJson.deployedBytecode || typeof artifactJson.deployedBytecode !== 'string' || !artifactJson.deployedBytecode.startsWith('0x') || artifactJson.deployedBytecode.length < 10) {
      throw new Error(`Invalid deployedBytecode in ${config.name}: runtime bytecode is missing or malformed.`)
    }

    const creationBytes = (artifactJson.bytecode.length - 2) / 2
    const runtimeBytes = (artifactJson.deployedBytecode.length - 2) / 2
    const bytecodeSha256 = crypto.createHash('sha256').update(artifactJson.bytecode).digest('hex')
    const deployedSha256 = crypto.createHash('sha256').update(artifactJson.deployedBytecode).digest('hex')

    // 2. Cryptographic Checksum Matching against trusted constants
    const trusted = TRUSTED_CONTRACT_CHECKSUMS[config.name]
    if (!trusted) {
      throw new Error(`No trusted checksum defined for ${config.name}`)
    }

    if (bytecodeSha256 !== trusted.creationSha256) {
      throw new Error(
        `Artifact integrity mismatch for ${config.name} creation bytecode!\\n` +
        `Expected: ${trusted.creationSha256}\\n` +
        `Actual:   ${bytecodeSha256}\\n` +
        `Solidity contract source may have changed without authorized security review.`
      )
    }

    if (deployedSha256 !== trusted.deployedSha256) {
      throw new Error(
        `Artifact integrity mismatch for ${config.name} runtime bytecode!\\n` +
        `Expected: ${trusted.deployedSha256}\\n` +
        `Actual:   ${deployedSha256}`
      )
    }

    exportedContracts[config.name] = {
      contractName: config.name,
      sourceName: artifactJson.sourceName || `contracts/${config.name}.sol`,
      description: config.description,
      constructorArgs: config.constructorArgs,
      abi: artifactJson.abi,
      bytecode: artifactJson.bytecode,
      deployedBytecode: artifactJson.deployedBytecode,
      creationBytecodeBytes: creationBytes,
      deployedRuntimeBytes: runtimeBytes,
      sha256: bytecodeSha256,
      deployedSha256: deployedSha256,
      lastSyncedAt: new Date().toISOString(),
    }

    console.log(`[sync-artifacts] ✓ ${config.name}: Verified against trusted checksum (${bytecodeSha256.slice(0, 16)}...)`)
  }

  const tsContent = `/**
 * VotEth 2.0 — Verified Smart Contract Artifacts Module
 *
 * Generated automatically by frontend/scripts/sync-artifacts.mjs.
 * Sourced directly from Hardhat compiled artifacts (contracts/artifacts/contracts/).
 *
 * Freshness & Integrity Invariants:
 * 1. Synchronized strictly against Solidity 0.8.24 compiler outputs.
 * 2. Every artifact creation and runtime bytecode is checked against trusted SHA-256 constants.
 * 3. EIP-170 size limits (<= 24,576 bytes) are strictly verified.
 */

export interface ConstructorArg {
  readonly name: string
  readonly type: string
}

export interface ContractArtifact {
  readonly contractName: string
  readonly sourceName: string
  readonly description: string
  readonly constructorArgs: readonly ConstructorArg[]
  readonly abi: readonly any[]
  readonly bytecode: string
  readonly deployedBytecode: string
  readonly creationBytecodeBytes: number
  readonly deployedRuntimeBytes: number
  readonly sha256: string
  readonly deployedSha256: string
  readonly lastSyncedAt: string
}

export interface ArtifactValidationResult {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly details: Record<string, { creationBytes: number; runtimeBytes: number; sha256: string; checksumVerified: boolean }>
}

/**
 * Pinned, trusted SHA-256 checksums from clean compilation of reviewed Solidity sources.
 * To update checksums after legitimate, audited contract changes:
 * 1. Recompile via Hardhat and run contract security tests.
 * 2. Update TRUSTED_CONTRACT_CHECKSUMS in sync-artifacts.mjs and artifacts.ts.
 */
export const TRUSTED_CONTRACT_CHECKSUMS = {
  VotEthRegistry: {
    creationSha256: '718d304e59d653f31048de700eefe9291b80aa8c864bdac6d4bf12091f857851',
    deployedSha256: '95a8ec9ce8035feba1151ffe177b1b8b0835c2b0f57d33cd1509fe4f1a75a38e',
    creationBytes: 3282,
    deployedBytes: 3228,
  },
  VotEthElection: {
    creationSha256: '6196563e6309a7d8867ab470a7bcc6252ea296ea26708a428040db6b3d1d1877',
    deployedSha256: '0e1f34abfecde9580c3ed12da2dd5e4ffd37ccbef80b20d6181e6f13bcd5297b',
    creationBytes: 4445,
    deployedBytes: 4331,
  },
  VotEthVerifier: {
    creationSha256: '7e9403ac81545c2794ef4fdd46b44a76a281b1459e42ea0e8ecbfb1ddf328643',
    deployedSha256: 'a8994653bfb809fd5d75eab600f53363c18372f0cce11218777e88ec80bdebe7',
    creationBytes: 2623,
    deployedBytes: 2568,
  },
} as const

export const VOTETH_CONTRACT_ARTIFACTS: {
  readonly VotEthRegistry: ContractArtifact
  readonly VotEthElection: ContractArtifact
  readonly VotEthVerifier: ContractArtifact
} = ${JSON.stringify(exportedContracts, null, 2)} as const

/**
 * Validates the integrity of exported contract artifacts against trusted checksums.
 * Checks that ABIs are non-empty arrays, bytecodes are well-formed hex strings,
 * sizes adhere to EIP-170 limits, and bytecodes match trusted expected cryptographic checksums.
 */
export function validateContractArtifacts(
  artifacts: typeof VOTETH_CONTRACT_ARTIFACTS = VOTETH_CONTRACT_ARTIFACTS
): ArtifactValidationResult {
  const errors: string[] = []
  const details: Record<string, { creationBytes: number; runtimeBytes: number; sha256: string; checksumVerified: boolean }> = {}

  const requiredContracts = ['VotEthRegistry', 'VotEthElection', 'VotEthVerifier'] as const

  for (const name of requiredContracts) {
    const item = artifacts[name]
    const trusted = TRUSTED_CONTRACT_CHECKSUMS[name]

    if (!item) {
      errors.push(\`Missing contract artifact for \${name}\`)
      continue
    }

    if (!Array.isArray(item.abi) || item.abi.length === 0) {
      errors.push(\`\${name}: ABI is missing or empty array\`)
    }

    if (!item.bytecode || typeof item.bytecode !== 'string' || !item.bytecode.startsWith('0x') || item.bytecode.length <= 2) {
      errors.push(\`\${name}: Creation bytecode is missing or invalid hex string\`)
    } else if ((item.bytecode.length - 2) % 2 !== 0) {
      errors.push(\`\${name}: Creation bytecode has uneven hex character count\`)
    }

    if (!item.deployedBytecode || typeof item.deployedBytecode !== 'string' || !item.deployedBytecode.startsWith('0x') || item.deployedBytecode.length <= 2) {
      errors.push(\`\${name}: Deployed runtime bytecode is missing or invalid hex string\`)
    }

    if (item.deployedRuntimeBytes > 24576) {
      errors.push(\`\${name}: Deployed bytecode size (\${item.deployedRuntimeBytes} bytes) exceeds EIP-170 limit of 24,576 bytes\`)
    }

    // Cryptographic checksum verification against trusted constants
    let checksumVerified = false
    if (trusted) {
      if (item.sha256 !== trusted.creationSha256) {
        errors.push(\`\${name}: Creation bytecode SHA-256 does not match trusted checksum (Expected \${trusted.creationSha256.slice(0, 16)}..., got \${item.sha256.slice(0, 16)}...)\`)
      } else if (item.deployedSha256 !== trusted.deployedSha256) {
        errors.push(\`\${name}: Runtime bytecode SHA-256 does not match trusted checksum\`)
      } else {
        checksumVerified = true
      }
    } else {
      errors.push(\`\${name}: No trusted expected checksum constant registered\`)
    }

    details[name] = {
      creationBytes: item.creationBytecodeBytes,
      runtimeBytes: item.deployedRuntimeBytes,
      sha256: item.sha256,
      checksumVerified,
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    details,
  }
}
`

  const targetDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf8')
  console.log('[sync-artifacts] Successfully synchronized verified artifacts to:', OUTPUT_FILE)
}

try {
  sync()
} catch (err) {
  console.error('[sync-artifacts] Failed:', err.message)
  process.exit(1)
}
