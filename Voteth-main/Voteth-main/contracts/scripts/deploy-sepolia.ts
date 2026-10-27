import { ethers, network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  console.log('========================================================')
  console.log('🚀 VotEth 2.0 Smart Contract Deployment — Sepolia')
  console.log('========================================================')

  const [deployer] = await ethers.getSigners()
  if (!deployer) {
    throw new Error('No deployer signer available. Please check PRIVATE_KEY in contracts/.env.local')
  }

  const deployerAddress = await deployer.getAddress()
  const balance = await ethers.provider.getBalance(deployerAddress)
  const networkName = network.name
  const chainId = (await ethers.provider.getNetwork()).chainId

  console.log(`Target Network : ${networkName} (Chain ID: ${chainId})`)
  console.log(`Deployer Address: ${deployerAddress}`)
  console.log(`Account Balance : ${ethers.formatEther(balance)} ETH`)

  if (chainId !== 11155111n) {
    console.warn(`⚠️ Warning: Expected Sepolia Chain ID 11155111, got ${chainId}`)
  }

  if (balance === 0n) {
    throw new Error('Deployer account has 0 ETH. Please fund this account with Sepolia test ETH.')
  }

  console.log('\nDeploying contracts sequentially...')

  // 1. Deploy VotEthRegistry
  console.log('\n[1/3] Deploying VotEthRegistry...')
  const RegistryFactory = await ethers.getContractFactory('VotEthRegistry', deployer)
  const registry = await RegistryFactory.deploy()
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  console.log(`✅ VotEthRegistry deployed at: ${registryAddress}`)

  // 2. Deploy VotEthElection
  console.log('\n[2/3] Deploying VotEthElection...')
  const ElectionFactory = await ethers.getContractFactory('VotEthElection', deployer)
  const election = await ElectionFactory.deploy()
  await election.waitForDeployment()
  const electionAddress = await election.getAddress()
  console.log(`✅ VotEthElection deployed at: ${electionAddress}`)

  // 3. Deploy VotEthVerifier
  console.log('\n[3/3] Deploying VotEthVerifier...')
  const VerifierFactory = await ethers.getContractFactory('VotEthVerifier', deployer)
  const verifier = await VerifierFactory.deploy()
  await verifier.waitForDeployment()
  const verifierAddress = await verifier.getAddress()
  console.log(`✅ VotEthVerifier deployed at: ${verifierAddress}`)

  console.log('\n========================================================')
  console.log('🎉 All Contracts Successfully Deployed!')
  console.log('========================================================')
  console.log(`Registry Address : ${registryAddress}`)
  console.log(`Election Address : ${electionAddress}`)
  console.log(`Verifier Address : ${verifierAddress}`)
  console.log('========================================================')
  console.log('\nUpdate frontend/.env with the following lines:')
  console.log(`VITE_REGISTRY_CONTRACT_ADDRESS=${registryAddress}`)
  console.log(`VITE_ELECTION_CONTRACT_ADDRESS=${electionAddress}`)
  console.log(`VITE_VERIFIER_CONTRACT_ADDRESS=${verifierAddress}`)
  console.log('========================================================\n')

  const deploymentData = {
    network: networkName,
    chainId: chainId.toString(),
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      VotEthRegistry: registryAddress,
      VotEthElection: electionAddress,
      VotEthVerifier: verifierAddress,
    },
  }

  const outputPath = path.resolve(__dirname, '../deployments-sepolia.json')
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2))
  console.log(`Deployment summary written to: ${outputPath}`)
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error)
  process.exitCode = 1
})
