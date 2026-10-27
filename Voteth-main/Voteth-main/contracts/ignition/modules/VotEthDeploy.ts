/**
 * VotEth 2.0 — Hardhat Ignition Deployment Module
 *
 * Ignition modules define the deployment graph for VotEth smart contracts.
 * This is the primary deployment entry point.
 *
 * Usage:
 *   npx hardhat ignition deploy ./ignition/modules/VotEthDeploy.ts --network amoy
 *   npx hardhat ignition deploy ./ignition/modules/VotEthDeploy.ts --network localhost
 *
 * Implementation deferred to Volume VIII, Chapter 35.
 *
 * @see contracts/hardhat.config.ts for network configuration
 * @see docs/architecture/system-overview.md for contract architecture
 */

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const VotEthDeployModule = buildModule('VotEthDeploy', (m) => {
  // 1. Deploy Registry — the root contract
  const registry = m.contract('VotEthRegistry')

  // 2. Deploy Election — references Registry
  const election = m.contract('VotEthElection')

  // 3. Deploy Verifier — QR + ZK-ready
  const verifier = m.contract('VotEthVerifier')

  return { registry, election, verifier }
})

export default VotEthDeployModule
