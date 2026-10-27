import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-contract-sizer'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config()

const rawPrivateKey = process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY
const formattedKey = rawPrivateKey
  ? (rawPrivateKey.trim().startsWith('0x') ? rawPrivateKey.trim() : `0x${rawPrivateKey.trim()}`)
  : undefined

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

// Accounts array for network configuration: only populate when a key is present
const DEPLOYER_ACCOUNTS = formattedKey ? [formattedKey] : []

const config: HardhatUserConfig = {
  // =========================================================================
  // SOLIDITY COMPILER
  // =========================================================================
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,  // Optimize for deployment cost vs. execution cost balance
      },
      viaIR: false,  // Enable if hitting stack-too-deep errors (Volume VIII)
      evmVersion: 'paris',  // Polygon Amoy EVM compatibility
    },
  },

  // =========================================================================
  // NETWORKS
  // =========================================================================
  networks: {
    // Local in-memory network — used by `hardhat test` by default
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,  // Enforce the 24KB contract size limit
      // Use forking for integration tests against Amoy state (Volume VIII)
      // forking: { url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}` }
    },

    // Local node started by `npm run node`
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },

    // Polygon Amoy Testnet (Chain ID: 80002)
    amoy: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : 'https://rpc-amoy.polygon.technology',  // Public fallback RPC
      chainId: 80002,
      accounts: DEPLOYER_ACCOUNTS,
      gasPrice: 'auto',
    },

    // Ethereum Sepolia Testnet (Chain ID: 11155111)
    sepolia: {
      url: SEPOLIA_RPC_URL ?? (ALCHEMY_API_KEY
        ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : 'https://ethereum-sepolia-rpc.publicnode.com'),
      chainId: 11155111,
      accounts: DEPLOYER_ACCOUNTS,
      gasPrice: 'auto',
    },
  },

  // =========================================================================
  // ETHERSCAN / POLYGONSCAN VERIFICATION
  // =========================================================================
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY ?? '',
      polygonAmoy: POLYGONSCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },

  // =========================================================================
  // GAS REPORTER
  // Activate with: REPORT_GAS=true npm run test
  // =========================================================================
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  // =========================================================================
  // COVERAGE
  // Run with: npm run test:coverage
  // =========================================================================
  // Coverage thresholds enforced via Volume VIII test suite

  // =========================================================================
  // CONTRACT SIZER
  // =========================================================================
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,  // Run explicitly with: npm run size
    disambiguatePaths: false,
  },

  // =========================================================================
  // PATHS
  // =========================================================================
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },

  // =========================================================================
  // MOCHA (TEST RUNNER CONFIG)
  // =========================================================================
  mocha: {
    timeout: 40000,  // 40s — blockchain operations can be slow in CI
  },
}

task('check-deployer', 'Prints the public address and balance of the deployer account')
  .setAction(async (_, hre) => {
    const signers = await hre.ethers.getSigners()
    if (!signers || signers.length === 0) {
      console.log('⚠️ No deployment account configured for this network.')
      console.log('Please set PRIVATE_KEY in contracts/.env.local (or contracts/.env)')
      return
    }
    const deployer = signers[0]
    const address = await deployer.getAddress()
    const balance = await hre.ethers.provider.getBalance(address)
    const network = await hre.ethers.provider.getNetwork()
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`)
    console.log(`Deployer Public Address: ${address}`)
    console.log(`Account Balance: ${hre.ethers.formatEther(balance)} ETH`)
  })

export default config
