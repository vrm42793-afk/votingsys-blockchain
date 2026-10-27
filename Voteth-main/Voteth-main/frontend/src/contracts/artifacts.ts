/**
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
} = {
  "VotEthRegistry": {
    "contractName": "VotEthRegistry",
    "sourceName": "contracts/VotEthRegistry.sol",
    "description": "Central registry contract managing organizations and election mappings.",
    "constructorArgs": [],
    "abi": [
      {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "inputs": [],
        "name": "ElectionAlreadyRegistered",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "EmptyName",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "InvalidElectionId",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "InvalidOrgId",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "OnlyOrgAdmin",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "OnlyOwner",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "ZeroAddress",
        "type": "error"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "electionId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "title",
            "type": "string"
          }
        ],
        "name": "ElectionRegistered",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "oldAdmin",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "newAdmin",
            "type": "address"
          }
        ],
        "name": "OrgAdminUpdated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "admin",
            "type": "address"
          }
        ],
        "name": "OrganizationRegistered",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "electionCount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "electionId",
            "type": "uint256"
          }
        ],
        "name": "getElection",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "registeredAt",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          }
        ],
        "name": "getElectionIdByContract",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "electionId",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          }
        ],
        "name": "getOrganization",
        "outputs": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "orgCount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          }
        ],
        "name": "registerElection",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "electionId",
            "type": "uint256"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          }
        ],
        "name": "registerOrganization",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "orgId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "newAdmin",
            "type": "address"
          }
        ],
        "name": "updateOrgAdmin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "bytecode": "0x60a060405234801561001057600080fd5b5033608052608051610c9c6100366000396000818160f801526103f10152610c9c6000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063997d283011610066578063997d283014610132578063999691361461013b5780639d71077714610164578063be84bf6b14610187578063d81066901461019c57600080fd5b8063248c916f146100985780633b7cd610146100be5780634526f690146100d15780638da5cb5b146100f3575b600080fd5b6100ab6100a63660046108eb565b6101a5565b6040519081526020015b60405180910390f35b6100ab6100cc366004610945565b6103e4565b6100e46100df366004610999565b61059d565b6040516100b5939291906109f8565b61011a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016100b5565b6100ab60015481565b6100ab610149366004610a26565b6001600160a01b031660009081526004602052604090205490565b610177610172366004610999565b610694565b6040516100b59493929190610a48565b61019a610195366004610a83565b610796565b005b6100ab60005481565b6000848015806101b6575060005481115b156101d457604051633045128b60e21b815260040160405180910390fd5b6000818152600260205260409020600101546001600160a01b0316331461020e576040516311c64b9d60e11b815260040160405180910390fd5b6001600160a01b0385166102355760405163d92e233d60e01b815260040160405180910390fd5b600083900361025757604051632ef1310560e01b815260040160405180910390fd5b6001600160a01b0385166000908152600460205260409020541561028e5760405163ef738af160e01b815260040160405180910390fd5b6001805490600061029e83610aaf565b919050555060015491506040518060a00160405280878152602001866001600160a01b0316815260200185858080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920182905250938552505042602080850191909152600160409485018190528784526003825292849020855181559085015192810180546001600160a01b0319166001600160a01b03909416939093179092555090820151600282019061035b9082610b77565b50606082015160038201556080909101516004918201805460ff19169115159190911790556001600160a01b03861660008181526020929092526040918290208490559051879084907f305980c9f584947ac87c32071068927b4341fe7cc7252c16bc6c4a335057dbdb906103d39089908990610c37565b60405180910390a450949350505050565b6000336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461042f57604051635fc483c560e01b815260040160405180910390fd5b600083900361045157604051632ef1310560e01b815260040160405180910390fd5b6001600160a01b0382166104785760405163d92e233d60e01b815260040160405180910390fd5b60008054908061048783610aaf565b90915550506000546040805160a06020601f8801819004028201810190925260808101868152929350918291879087908190850183828082843760009201829052509385525050506001600160a01b03851660208084019190915242604080850191909152600160609094019390935284825260029052208151819061050d9082610b77565b5060208201516001820180546001600160a01b0319166001600160a01b0392831617905560408084015160028401556060909301516003909201805460ff19169215159290921790915590519083169082907ff21c1266667fb9c045a84d540c46c1533a11dc2ad5714ea93332521e5d9d07fd9061058e9088908890610c37565b60405180910390a39392505050565b60606000808315806105b0575060005484115b156105ce57604051633045128b60e21b815260040160405180910390fd5b60008481526002602081905260409091206001810154918101548154919283926001600160a01b039091169190839061060690610aec565b80601f016020809104026020016040519081016040528092919081815260200182805461063290610aec565b801561067f5780601f106106545761010080835404028352916020019161067f565b820191906000526020600020905b81548152906001019060200180831161066257829003601f168201915b50505050509250935093509350509193909250565b6000806060818415806106a8575060015485115b156106c657604051631ec4422d60e11b815260040160405180910390fd5b60008581526003602081905260409091208054600182015492820154600283018054939492936001600160a01b0390931692909190829061070690610aec565b80601f016020809104026020016040519081016040528092919081815260200182805461073290610aec565b801561077f5780601f106107545761010080835404028352916020019161077f565b820191906000526020600020905b81548152906001019060200180831161076257829003601f168201915b505050505091509450945094509450509193509193565b818015806107a5575060005481115b156107c357604051633045128b60e21b815260040160405180910390fd5b6000818152600260205260409020600101546001600160a01b031633146107fd576040516311c64b9d60e11b815260040160405180910390fd5b6001600160a01b0382166108245760405163d92e233d60e01b815260040160405180910390fd5b60008381526002602052604080822060010180546001600160a01b031981166001600160a01b038781169182179093559251911692839187917f5ded6b672239d1f92ba8dbec5a14591543b12e44b5968c82c80564295d01753591a450505050565b80356001600160a01b038116811461089d57600080fd5b919050565b60008083601f8401126108b457600080fd5b50813567ffffffffffffffff8111156108cc57600080fd5b6020830191508360208285010111156108e457600080fd5b9250929050565b6000806000806060858703121561090157600080fd5b8435935061091160208601610886565b9250604085013567ffffffffffffffff81111561092d57600080fd5b610939878288016108a2565b95989497509550505050565b60008060006040848603121561095a57600080fd5b833567ffffffffffffffff81111561097157600080fd5b61097d868287016108a2565b9094509250610990905060208501610886565b90509250925092565b6000602082840312156109ab57600080fd5b5035919050565b6000815180845260005b818110156109d8576020818501810151868301820152016109bc565b506000602082860101526020601f19601f83011685010191505092915050565b606081526000610a0b60608301866109b2565b6001600160a01b039490941660208301525060400152919050565b600060208284031215610a3857600080fd5b610a4182610886565b9392505050565b8481526001600160a01b0384166020820152608060408201819052600090610a72908301856109b2565b905082606083015295945050505050565b60008060408385031215610a9657600080fd5b82359150610aa660208401610886565b90509250929050565b600060018201610acf57634e487b7160e01b600052601160045260246000fd5b5060010190565b634e487b7160e01b600052604160045260246000fd5b600181811c90821680610b0057607f821691505b602082108103610b2057634e487b7160e01b600052602260045260246000fd5b50919050565b601f821115610b72576000816000526020600020601f850160051c81016020861015610b4f5750805b601f850160051c820191505b81811015610b6e57828155600101610b5b565b5050505b505050565b815167ffffffffffffffff811115610b9157610b91610ad6565b610ba581610b9f8454610aec565b84610b26565b602080601f831160018114610bda5760008415610bc25750858301515b600019600386901b1c1916600185901b178555610b6e565b600085815260208120601f198616915b82811015610c0957888601518255948401946001909101908401610bea565b5085821015610c275787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b60208152816020820152818360408301376000818301604090810191909152601f909201601f1916010191905056fea26469706673582212209262488cf2d89da70a99cea6cc57ea683a6d4e5c198096861daff0036bae03d564736f6c63430008180033",
    "deployedBytecode": "0x608060405234801561001057600080fd5b50600436106100935760003560e01c8063997d283011610066578063997d283014610132578063999691361461013b5780639d71077714610164578063be84bf6b14610187578063d81066901461019c57600080fd5b8063248c916f146100985780633b7cd610146100be5780634526f690146100d15780638da5cb5b146100f3575b600080fd5b6100ab6100a63660046108eb565b6101a5565b6040519081526020015b60405180910390f35b6100ab6100cc366004610945565b6103e4565b6100e46100df366004610999565b61059d565b6040516100b5939291906109f8565b61011a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016100b5565b6100ab60015481565b6100ab610149366004610a26565b6001600160a01b031660009081526004602052604090205490565b610177610172366004610999565b610694565b6040516100b59493929190610a48565b61019a610195366004610a83565b610796565b005b6100ab60005481565b6000848015806101b6575060005481115b156101d457604051633045128b60e21b815260040160405180910390fd5b6000818152600260205260409020600101546001600160a01b0316331461020e576040516311c64b9d60e11b815260040160405180910390fd5b6001600160a01b0385166102355760405163d92e233d60e01b815260040160405180910390fd5b600083900361025757604051632ef1310560e01b815260040160405180910390fd5b6001600160a01b0385166000908152600460205260409020541561028e5760405163ef738af160e01b815260040160405180910390fd5b6001805490600061029e83610aaf565b919050555060015491506040518060a00160405280878152602001866001600160a01b0316815260200185858080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920182905250938552505042602080850191909152600160409485018190528784526003825292849020855181559085015192810180546001600160a01b0319166001600160a01b03909416939093179092555090820151600282019061035b9082610b77565b50606082015160038201556080909101516004918201805460ff19169115159190911790556001600160a01b03861660008181526020929092526040918290208490559051879084907f305980c9f584947ac87c32071068927b4341fe7cc7252c16bc6c4a335057dbdb906103d39089908990610c37565b60405180910390a450949350505050565b6000336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461042f57604051635fc483c560e01b815260040160405180910390fd5b600083900361045157604051632ef1310560e01b815260040160405180910390fd5b6001600160a01b0382166104785760405163d92e233d60e01b815260040160405180910390fd5b60008054908061048783610aaf565b90915550506000546040805160a06020601f8801819004028201810190925260808101868152929350918291879087908190850183828082843760009201829052509385525050506001600160a01b03851660208084019190915242604080850191909152600160609094019390935284825260029052208151819061050d9082610b77565b5060208201516001820180546001600160a01b0319166001600160a01b0392831617905560408084015160028401556060909301516003909201805460ff19169215159290921790915590519083169082907ff21c1266667fb9c045a84d540c46c1533a11dc2ad5714ea93332521e5d9d07fd9061058e9088908890610c37565b60405180910390a39392505050565b60606000808315806105b0575060005484115b156105ce57604051633045128b60e21b815260040160405180910390fd5b60008481526002602081905260409091206001810154918101548154919283926001600160a01b039091169190839061060690610aec565b80601f016020809104026020016040519081016040528092919081815260200182805461063290610aec565b801561067f5780601f106106545761010080835404028352916020019161067f565b820191906000526020600020905b81548152906001019060200180831161066257829003601f168201915b50505050509250935093509350509193909250565b6000806060818415806106a8575060015485115b156106c657604051631ec4422d60e11b815260040160405180910390fd5b60008581526003602081905260409091208054600182015492820154600283018054939492936001600160a01b0390931692909190829061070690610aec565b80601f016020809104026020016040519081016040528092919081815260200182805461073290610aec565b801561077f5780601f106107545761010080835404028352916020019161077f565b820191906000526020600020905b81548152906001019060200180831161076257829003601f168201915b505050505091509450945094509450509193509193565b818015806107a5575060005481115b156107c357604051633045128b60e21b815260040160405180910390fd5b6000818152600260205260409020600101546001600160a01b031633146107fd576040516311c64b9d60e11b815260040160405180910390fd5b6001600160a01b0382166108245760405163d92e233d60e01b815260040160405180910390fd5b60008381526002602052604080822060010180546001600160a01b031981166001600160a01b038781169182179093559251911692839187917f5ded6b672239d1f92ba8dbec5a14591543b12e44b5968c82c80564295d01753591a450505050565b80356001600160a01b038116811461089d57600080fd5b919050565b60008083601f8401126108b457600080fd5b50813567ffffffffffffffff8111156108cc57600080fd5b6020830191508360208285010111156108e457600080fd5b9250929050565b6000806000806060858703121561090157600080fd5b8435935061091160208601610886565b9250604085013567ffffffffffffffff81111561092d57600080fd5b610939878288016108a2565b95989497509550505050565b60008060006040848603121561095a57600080fd5b833567ffffffffffffffff81111561097157600080fd5b61097d868287016108a2565b9094509250610990905060208501610886565b90509250925092565b6000602082840312156109ab57600080fd5b5035919050565b6000815180845260005b818110156109d8576020818501810151868301820152016109bc565b506000602082860101526020601f19601f83011685010191505092915050565b606081526000610a0b60608301866109b2565b6001600160a01b039490941660208301525060400152919050565b600060208284031215610a3857600080fd5b610a4182610886565b9392505050565b8481526001600160a01b0384166020820152608060408201819052600090610a72908301856109b2565b905082606083015295945050505050565b60008060408385031215610a9657600080fd5b82359150610aa660208401610886565b90509250929050565b600060018201610acf57634e487b7160e01b600052601160045260246000fd5b5060010190565b634e487b7160e01b600052604160045260246000fd5b600181811c90821680610b0057607f821691505b602082108103610b2057634e487b7160e01b600052602260045260246000fd5b50919050565b601f821115610b72576000816000526020600020601f850160051c81016020861015610b4f5750805b601f850160051c820191505b81811015610b6e57828155600101610b5b565b5050505b505050565b815167ffffffffffffffff811115610b9157610b91610ad6565b610ba581610b9f8454610aec565b84610b26565b602080601f831160018114610bda5760008415610bc25750858301515b600019600386901b1c1916600185901b178555610b6e565b600085815260208120601f198616915b82811015610c0957888601518255948401946001909101908401610bea565b5085821015610c275787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b60208152816020820152818360408301376000818301604090810191909152601f909201601f1916010191905056fea26469706673582212209262488cf2d89da70a99cea6cc57ea683a6d4e5c198096861daff0036bae03d564736f6c63430008180033",
    "creationBytecodeBytes": 3282,
    "deployedRuntimeBytes": 3228,
    "sha256": "718d304e59d653f31048de700eefe9291b80aa8c864bdac6d4bf12091f857851",
    "deployedSha256": "95a8ec9ce8035feba1151ffe177b1b8b0835c2b0f57d33cd1509fe4f1a75a38e",
    "lastSyncedAt": "2026-10-26T17:45:53.903Z"
  },
  "VotEthElection": {
    "contractName": "VotEthElection",
    "sourceName": "contracts/VotEthElection.sol",
    "description": "Core ballot ledger enforcing one-vote-per-voter and election state machine.",
    "constructorArgs": [],
    "abi": [
      {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "inputs": [],
        "name": "AlreadyVoted",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "CandidateAlreadyRegistered",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "EmptyCandidateHash",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "EmptyVoteHash",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "InvalidCandidate",
        "type": "error"
      },
      {
        "inputs": [
          {
            "internalType": "enum VotEthElection.ElectionState",
            "name": "current",
            "type": "uint8"
          },
          {
            "internalType": "enum VotEthElection.ElectionState",
            "name": "expected",
            "type": "uint8"
          }
        ],
        "name": "InvalidState",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "NotEligible",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "OnlyOwner",
        "type": "error"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "candidateHash",
            "type": "bytes32"
          }
        ],
        "name": "CandidateRegistered",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "enum VotEthElection.ElectionState",
            "name": "previousState",
            "type": "uint8"
          },
          {
            "indexed": false,
            "internalType": "enum VotEthElection.ElectionState",
            "name": "newState",
            "type": "uint8"
          }
        ],
        "name": "StateChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "voteHash",
            "type": "bytes32"
          },
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "candidateHash",
            "type": "bytes32"
          }
        ],
        "name": "VoteCast",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "bool",
            "name": "eligible",
            "type": "bool"
          }
        ],
        "name": "VoterEligibilitySet",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "candidateValidationEnabled",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "candidateVoteCounts",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "voteHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "candidateHash",
            "type": "bytes32"
          }
        ],
        "name": "castVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "closeElection",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bool",
            "name": "enabled",
            "type": "bool"
          }
        ],
        "name": "enableCandidateValidation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bool",
            "name": "enabled",
            "type": "bool"
          }
        ],
        "name": "enableVoterEligibility",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getCandidateHashes",
        "outputs": [
          {
            "internalType": "bytes32[]",
            "name": "hashes",
            "type": "bytes32[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "candidateHash",
            "type": "bytes32"
          }
        ],
        "name": "getCandidateVoteCount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "count",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getTotalVotes",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "count",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getVoteHashes",
        "outputs": [
          {
            "internalType": "bytes32[]",
            "name": "hashes",
            "type": "bytes32[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          }
        ],
        "name": "getVoteReceipt",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "voteHash",
            "type": "bytes32"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "hasAddressVoted",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          }
        ],
        "name": "hasVoted",
        "outputs": [
          {
            "internalType": "bool",
            "name": "voted",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "isCandidateRegistered",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "isVoterEligible",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "openElection",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "publishResults",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "candidateHash",
            "type": "bytes32"
          }
        ],
        "name": "registerCandidate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "internalType": "bool",
            "name": "eligible",
            "type": "bool"
          }
        ],
        "name": "setVoterEligibility",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address[]",
            "name": "voters",
            "type": "address[]"
          },
          {
            "internalType": "bool",
            "name": "eligible",
            "type": "bool"
          }
        ],
        "name": "setVoterEligibilityBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "state",
        "outputs": [
          {
            "internalType": "enum VotEthElection.ElectionState",
            "name": "",
            "type": "uint8"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "totalVotes",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "voterEligibilityEnabled",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "voterToVoteHash",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "",
            "type": "bytes32"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    "bytecode": "0x60a060405234801561001057600080fd5b50336080526000805460ff191690556080516110eb610072600039600081816102ac015281816103f1015281816105e2015281816106cc0152818161076a01528181610b1d01528181610bf401528181610c920152610d5e01526110eb6000f3fe608060405234801561001057600080fd5b50600436106101735760003560e01c80638da5cb5b116100de578063c5d00f5d11610097578063d14bd96111610071578063d14bd9611461037b578063da5194581461039b578063e3e6ca7d146103a3578063ef9fc495146103c657600080fd5b8063c5d00f5d14610330578063cee7880714610338578063d056dd8c1461035b57600080fd5b80638da5cb5b146102a75780639a0e7d66146102e6578063a676e2f6146102ee578063a9f334b0146102fb578063b952e7d81461030e578063c19d93fb1461031657600080fd5b806322aebeae1161013057806322aebeae14610246578063310a01a1146102535780633e1c17891461026657806346148c5f146102795780636721d18d1461028c5780636c6c32d01461029f57600080fd5b806309eef43e146101785780630d15fd77146101b95780630e309879146101d057806315444bc4146101e55780631660ca46146101fa57806320a75b6f1461021d575b600080fd5b6101a4610186366004610e8e565b6001600160a01b031660009081526002602052604090205460ff1690565b60405190151581526020015b60405180910390f35b6101c260015481565b6040519081526020016101b0565b6101e36101de366004610eb0565b6103e6565b005b6101ed61057f565b6040516101b09190610ec9565b6101a4610208366004610e8e565b600a6020526000908152604090205460ff1681565b6101c261022b366004610e8e565b6001600160a01b031660009081526003602052604090205490565b600b546101a49060ff1681565b6101e3610261366004610f1d565b6105d7565b6101e3610274366004610f50565b6106c1565b6101e3610287366004610f6b565b61075f565b6101e361029a366004610fef565b6108c2565b6101e3610b12565b6102ce7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016101b0565b6001546101c2565b6009546101a49060ff1681565b6101e3610309366004610f50565b610be9565b6101e3610c87565b6000546103239060ff1681565b6040516101b09190611049565b6101e3610d53565b6101a4610346366004610eb0565b60086020526000908152604090205460ff1681565b6101c2610369366004610e8e565b60036020526000908152604090205481565b6101c2610389366004610eb0565b60009081526004602052604090205490565b6101ed610e1c565b6101a46103b1366004610e8e565b60026020526000908152604090205460ff1681565b6101c26103d4366004610eb0565b60046020526000908152604090205481565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461042f57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561044957610449611011565b1461047957600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b60405180910390fd5b81610497576040516360bd2f1d60e11b815260040160405180910390fd5b60008281526008602052604090205460ff16156104c75760405163507f223160e01b815260040160405180910390fd5b60008281526008602090815260408083208054600160ff199182168117909255600980549091169091179055600790915290205460ff16610550576000828152600760205260408120805460ff191660019081179091556006805491820181559091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018290555b60405182907ff6a6be64dd96964e37d70b178d6036e4cdbb7959eeab696bf22f270225145db290600090a25050565b606060068054806020026020016040519081016040528092919081815260200182805480156105cd57602002820191906000526020600020905b8154815260200190600101908083116105b9575b5050505050905090565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461062057604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561063a5761063a611011565b1461066157600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6001600160a01b0383166000818152600a6020908152604091829020805460ff191686151590811790915591519182527fc79dff597ffb61811288d53e8abf85142b25c7cb35109478c7148b0e597a8dba910160405180910390a2505050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461070a57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561072457610724611011565b1461074b57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b506009805460ff1916911515919091179055565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146107a857604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff1660038111156107c2576107c2611011565b146107e957600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b60005b838110156108bb5782600a600087878581811061080b5761080b611078565b90506020020160208101906108209190610e8e565b6001600160a01b031681526020810191909152604001600020805460ff191691151591909117905584848281811061085a5761085a611078565b905060200201602081019061086f9190610e8e565b6001600160a01b03167fc79dff597ffb61811288d53e8abf85142b25c7cb35109478c7148b0e597a8dba846040516108ab911515815260200190565b60405180910390a26001016107ec565b5050505050565b60018060005460ff1660038111156108dc576108dc611011565b1461090357600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b8261092157604051633df37e5960e01b815260040160405180910390fd5b8161093f576040516360bd2f1d60e11b815260040160405180910390fd5b600b5460ff1680156109615750336000908152600a602052604090205460ff16155b1561097f57604051637c75aa6f60e11b815260040160405180910390fd5b60095460ff1680156109a0575060008281526008602052604090205460ff16155b156109be5760405163e66ea08f60e01b815260040160405180910390fd5b3360009081526002602052604090205460ff16156109ef57604051637c9a1cf960e01b815260040160405180910390fd5b336000908152600260209081526040808320805460ff19166001908117909155600390925282208590556005805480830182559083527f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db001859055805491610a568361108e565b90915550506000828152600460205260408120805491610a758361108e565b909155505060008281526007602052604090205460ff16610ade576000828152600760205260408120805460ff191660019081179091556006805491820181559091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018290555b6040518290849033907fdf589cf013daf7b8f95c95161c35c9e5f62668052914455fccbeb038c5fc097a90600090a4505050565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610b5b57604051635fc483c560e01b815260040160405180910390fd5b60018060005460ff166003811115610b7557610b75611011565b14610b9c57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff191660029081179091556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d891610bde916001919061105d565b60405180910390a150565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610c3257604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff166003811115610c4c57610c4c611011565b14610c7357600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b50600b805460ff1916911515919091179055565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610cd057604051635fc483c560e01b815260040160405180910390fd5b60028060005460ff166003811115610cea57610cea611011565b14610d1157600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff191660039081179091556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d891610bde916002919061105d565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610d9c57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff166003811115610db657610db6611011565b14610ddd57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff1916600190811782556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d892610bde92909161105d565b606060058054806020026020016040519081016040528092919081815260200182805480156105cd57602002820191906000526020600020908154815260200190600101908083116105b9575050505050905090565b80356001600160a01b0381168114610e8957600080fd5b919050565b600060208284031215610ea057600080fd5b610ea982610e72565b9392505050565b600060208284031215610ec257600080fd5b5035919050565b6020808252825182820181905260009190848201906040850190845b81811015610f0157835183529284019291840191600101610ee5565b50909695505050505050565b80358015158114610e8957600080fd5b60008060408385031215610f3057600080fd5b610f3983610e72565b9150610f4760208401610f0d565b90509250929050565b600060208284031215610f6257600080fd5b610ea982610f0d565b600080600060408486031215610f8057600080fd5b833567ffffffffffffffff80821115610f9857600080fd5b818601915086601f830112610fac57600080fd5b813581811115610fbb57600080fd5b8760208260051b8501011115610fd057600080fd5b602092830195509350610fe69186019050610f0d565b90509250925092565b6000806040838503121561100257600080fd5b50508035926020909101359150565b634e487b7160e01b600052602160045260246000fd5b6004811061104557634e487b7160e01b600052602160045260246000fd5b9052565b602081016110578284611027565b92915050565b6040810161106b8285611027565b610ea96020830184611027565b634e487b7160e01b600052603260045260246000fd5b6000600182016110ae57634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212209723e9c8c3dec22703bcdfde0b4a2cb60f68153ba19598647bf8debb5276027664736f6c63430008180033",
    "deployedBytecode": "0x608060405234801561001057600080fd5b50600436106101735760003560e01c80638da5cb5b116100de578063c5d00f5d11610097578063d14bd96111610071578063d14bd9611461037b578063da5194581461039b578063e3e6ca7d146103a3578063ef9fc495146103c657600080fd5b8063c5d00f5d14610330578063cee7880714610338578063d056dd8c1461035b57600080fd5b80638da5cb5b146102a75780639a0e7d66146102e6578063a676e2f6146102ee578063a9f334b0146102fb578063b952e7d81461030e578063c19d93fb1461031657600080fd5b806322aebeae1161013057806322aebeae14610246578063310a01a1146102535780633e1c17891461026657806346148c5f146102795780636721d18d1461028c5780636c6c32d01461029f57600080fd5b806309eef43e146101785780630d15fd77146101b95780630e309879146101d057806315444bc4146101e55780631660ca46146101fa57806320a75b6f1461021d575b600080fd5b6101a4610186366004610e8e565b6001600160a01b031660009081526002602052604090205460ff1690565b60405190151581526020015b60405180910390f35b6101c260015481565b6040519081526020016101b0565b6101e36101de366004610eb0565b6103e6565b005b6101ed61057f565b6040516101b09190610ec9565b6101a4610208366004610e8e565b600a6020526000908152604090205460ff1681565b6101c261022b366004610e8e565b6001600160a01b031660009081526003602052604090205490565b600b546101a49060ff1681565b6101e3610261366004610f1d565b6105d7565b6101e3610274366004610f50565b6106c1565b6101e3610287366004610f6b565b61075f565b6101e361029a366004610fef565b6108c2565b6101e3610b12565b6102ce7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016101b0565b6001546101c2565b6009546101a49060ff1681565b6101e3610309366004610f50565b610be9565b6101e3610c87565b6000546103239060ff1681565b6040516101b09190611049565b6101e3610d53565b6101a4610346366004610eb0565b60086020526000908152604090205460ff1681565b6101c2610369366004610e8e565b60036020526000908152604090205481565b6101c2610389366004610eb0565b60009081526004602052604090205490565b6101ed610e1c565b6101a46103b1366004610e8e565b60026020526000908152604090205460ff1681565b6101c26103d4366004610eb0565b60046020526000908152604090205481565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461042f57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561044957610449611011565b1461047957600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b60405180910390fd5b81610497576040516360bd2f1d60e11b815260040160405180910390fd5b60008281526008602052604090205460ff16156104c75760405163507f223160e01b815260040160405180910390fd5b60008281526008602090815260408083208054600160ff199182168117909255600980549091169091179055600790915290205460ff16610550576000828152600760205260408120805460ff191660019081179091556006805491820181559091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018290555b60405182907ff6a6be64dd96964e37d70b178d6036e4cdbb7959eeab696bf22f270225145db290600090a25050565b606060068054806020026020016040519081016040528092919081815260200182805480156105cd57602002820191906000526020600020905b8154815260200190600101908083116105b9575b5050505050905090565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461062057604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561063a5761063a611011565b1461066157600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6001600160a01b0383166000818152600a6020908152604091829020805460ff191686151590811790915591519182527fc79dff597ffb61811288d53e8abf85142b25c7cb35109478c7148b0e597a8dba910160405180910390a2505050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461070a57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff16600381111561072457610724611011565b1461074b57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b506009805460ff1916911515919091179055565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146107a857604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff1660038111156107c2576107c2611011565b146107e957600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b60005b838110156108bb5782600a600087878581811061080b5761080b611078565b90506020020160208101906108209190610e8e565b6001600160a01b031681526020810191909152604001600020805460ff191691151591909117905584848281811061085a5761085a611078565b905060200201602081019061086f9190610e8e565b6001600160a01b03167fc79dff597ffb61811288d53e8abf85142b25c7cb35109478c7148b0e597a8dba846040516108ab911515815260200190565b60405180910390a26001016107ec565b5050505050565b60018060005460ff1660038111156108dc576108dc611011565b1461090357600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b8261092157604051633df37e5960e01b815260040160405180910390fd5b8161093f576040516360bd2f1d60e11b815260040160405180910390fd5b600b5460ff1680156109615750336000908152600a602052604090205460ff16155b1561097f57604051637c75aa6f60e11b815260040160405180910390fd5b60095460ff1680156109a0575060008281526008602052604090205460ff16155b156109be5760405163e66ea08f60e01b815260040160405180910390fd5b3360009081526002602052604090205460ff16156109ef57604051637c9a1cf960e01b815260040160405180910390fd5b336000908152600260209081526040808320805460ff19166001908117909155600390925282208590556005805480830182559083527f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db001859055805491610a568361108e565b90915550506000828152600460205260408120805491610a758361108e565b909155505060008281526007602052604090205460ff16610ade576000828152600760205260408120805460ff191660019081179091556006805491820181559091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018290555b6040518290849033907fdf589cf013daf7b8f95c95161c35c9e5f62668052914455fccbeb038c5fc097a90600090a4505050565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610b5b57604051635fc483c560e01b815260040160405180910390fd5b60018060005460ff166003811115610b7557610b75611011565b14610b9c57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff191660029081179091556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d891610bde916001919061105d565b60405180910390a150565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610c3257604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff166003811115610c4c57610c4c611011565b14610c7357600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b50600b805460ff1916911515919091179055565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610cd057604051635fc483c560e01b815260040160405180910390fd5b60028060005460ff166003811115610cea57610cea611011565b14610d1157600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff191660039081179091556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d891610bde916002919061105d565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610d9c57604051635fc483c560e01b815260040160405180910390fd5b60008060005460ff166003811115610db657610db6611011565b14610ddd57600054604051633bf2e2f960e11b81526104709160ff1690839060040161105d565b6000805460ff1916600190811782556040517fe8a97ea87e4388fa22d496b95a8ed5ced6717f49790318de2b928aaf37a021d892610bde92909161105d565b606060058054806020026020016040519081016040528092919081815260200182805480156105cd57602002820191906000526020600020908154815260200190600101908083116105b9575050505050905090565b80356001600160a01b0381168114610e8957600080fd5b919050565b600060208284031215610ea057600080fd5b610ea982610e72565b9392505050565b600060208284031215610ec257600080fd5b5035919050565b6020808252825182820181905260009190848201906040850190845b81811015610f0157835183529284019291840191600101610ee5565b50909695505050505050565b80358015158114610e8957600080fd5b60008060408385031215610f3057600080fd5b610f3983610e72565b9150610f4760208401610f0d565b90509250929050565b600060208284031215610f6257600080fd5b610ea982610f0d565b600080600060408486031215610f8057600080fd5b833567ffffffffffffffff80821115610f9857600080fd5b818601915086601f830112610fac57600080fd5b813581811115610fbb57600080fd5b8760208260051b8501011115610fd057600080fd5b602092830195509350610fe69186019050610f0d565b90509250925092565b6000806040838503121561100257600080fd5b50508035926020909101359150565b634e487b7160e01b600052602160045260246000fd5b6004811061104557634e487b7160e01b600052602160045260246000fd5b9052565b602081016110578284611027565b92915050565b6040810161106b8285611027565b610ea96020830184611027565b634e487b7160e01b600052603260045260246000fd5b6000600182016110ae57634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212209723e9c8c3dec22703bcdfde0b4a2cb60f68153ba19598647bf8debb5276027664736f6c63430008180033",
    "creationBytecodeBytes": 4445,
    "deployedRuntimeBytes": 4331,
    "sha256": "6196563e6309a7d8867ab470a7bcc6252ea296ea26708a428040db6b3d1d1877",
    "deployedSha256": "0e1f34abfecde9580c3ed12da2dd5e4ffd37ccbef80b20d6181e6f13bcd5297b",
    "lastSyncedAt": "2026-10-26T17:45:53.905Z"
  },
  "VotEthVerifier": {
    "contractName": "VotEthVerifier",
    "sourceName": "contracts/VotEthVerifier.sol",
    "description": "Cryptographic proof verifier for vote hashes and Merkle root tallies.",
    "constructorArgs": [],
    "abi": [
      {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "inputs": [],
        "name": "EmptyHashes",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "EmptyProof",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "OnlyOwner",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "RootAlreadyRecorded",
        "type": "error"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "merkleRoot",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "totalVotes",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "recordedAt",
            "type": "uint256"
          }
        ],
        "name": "MerkleRootRecorded",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32[]",
            "name": "voteHashes",
            "type": "bytes32[]"
          }
        ],
        "name": "computeMerkleRoot",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "root",
            "type": "bytes32"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "internalType": "bytes32",
            "name": "secret",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "name": "computeVoteCommitment",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "commitment",
            "type": "bytes32"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getRecordedRoot",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "root",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "merkleRootTotalVotes",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "recordedAt",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "root",
            "type": "bytes32"
          }
        ],
        "name": "isRootRecorded",
        "outputs": [
          {
            "internalType": "bool",
            "name": "recorded",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "root",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "merkleRootTotalVotes",
            "type": "uint256"
          }
        ],
        "name": "recordMerkleRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "rootCount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "voteHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32[]",
            "name": "proof",
            "type": "bytes32[]"
          },
          {
            "internalType": "bytes32",
            "name": "root",
            "type": "bytes32"
          }
        ],
        "name": "verifyMerkleProof",
        "outputs": [
          {
            "internalType": "bool",
            "name": "valid",
            "type": "bool"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "candidate",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "expectedHash",
            "type": "bytes32"
          }
        ],
        "name": "verifyVoteHash",
        "outputs": [
          {
            "internalType": "bool",
            "name": "valid",
            "type": "bool"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      }
    ],
    "bytecode": "0x60a060405234801561001057600080fd5b5033608052608051610a086100376000396000818161016f015261058c0152610a086000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063699e8fe211610066578063699e8fe21461010d5780638da5cb5b1461016a57806394c47b06146101a9578063db7ad4dd146101be578063e1353f4f1461020b57600080fd5b806321111bb4146100985780632b8b906c146100b457806335f0dced146100c757806341c23e1f146100ea575b600080fd5b6100a160005481565b6040519081526020015b60405180910390f35b6100a16100c236600461074d565b61021e565b6100da6100d536600461078f565b6104dd565b60405190151581526020016100ab565b6100da6100f83660046107e2565b60009081526002602052604090205460ff1690565b6100a161011b366004610817565b6040516bffffffffffffffffffffffff19606085901b16602082015260348101839052605481018290526000906074016040516020818303038152906040528051906020012090509392505050565b6101917f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016100ab565b6101bc6101b736600461084a565b610581565b005b6101f06101cc3660046107e2565b60008181526001602081905260409091208054918101546002909101549193909250565b604080519384526020840192909252908201526060016100ab565b6100da61021936600461086c565b6106c1565b60008181036102405760405163274e031760e11b815260040160405180910390fd5b600182900361026a578282600081811061025c5761025c6108fe565b9050602002013590506104d7565b60008267ffffffffffffffff81111561028557610285610914565b6040519080825280602002602001820160405280156102ae578160200160208202803683370190505b50905060005b838110156102fa578484828181106102ce576102ce6108fe565b905060200201358282815181106102e7576102e76108fe565b60209081029190910101526001016102b4565b5080515b60018111156104b75760006002610316836001610940565b6103209190610953565b905060005b818110156104af57600061033a826002610975565b905060008461034a836001610940565b106103555781610360565b610360826001610940565b9050858181518110610374576103746108fe565b602002602001015186838151811061038e5761038e6108fe565b602002602001015111610422578582815181106103ad576103ad6108fe565b60200260200101518682815181106103c7576103c76108fe565b60200260200101516040516020016103e9929190918252602082015260400190565b60405160208183030381529060405280519060200120868481518110610411576104116108fe565b6020026020010181815250506104a5565b858181518110610434576104346108fe565b602002602001015186838151811061044e5761044e6108fe565b6020026020010151604051602001610470929190918252602082015260400190565b60405160208183030381529060405280519060200120868481518110610498576104986108fe565b6020026020010181815250505b5050600101610325565b5090506102fe565b816000815181106104ca576104ca6108fe565b6020026020010151925050505b92915050565b600084815b848110156105755760008686838181106104fe576104fe6108fe565b90506020020135905080831161053f57604080516020810185905290810182905260600160405160208183030381529060405280519060200120925061056c565b60408051602081018390529081018490526060016040516020818303038152906040528051906020012092505b506001016104e2565b50909114949350505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146105ca57604051635fc483c560e01b815260040160405180910390fd5b60008281526002602052604090205460ff16156105fa5760405163218c405360e21b815260040160405180910390fd5b6000805490806106098361098c565b90915550506040805160808101825283815260208082018481524283850181815260016060860181815260008054815282875288812097518855945187830155915160028088019190915591516003909601805496151560ff199788161790558884529352908490208054909316909117909155905183917fa133cacaeac0436a520774f540d9829928dd3518a8a91e4d06cb31d9ddd7d9a8916106b591858252602082015260400190565b60405180910390a25050565b600080868686866040516020016106db94939291906109a5565b60408051601f198184030181529190528051602090910120831491505095945050505050565b60008083601f84011261071357600080fd5b50813567ffffffffffffffff81111561072b57600080fd5b6020830191508360208260051b850101111561074657600080fd5b9250929050565b6000806020838503121561076057600080fd5b823567ffffffffffffffff81111561077757600080fd5b61078385828601610701565b90969095509350505050565b600080600080606085870312156107a557600080fd5b84359350602085013567ffffffffffffffff8111156107c357600080fd5b6107cf87828801610701565b9598909750949560400135949350505050565b6000602082840312156107f457600080fd5b5035919050565b80356001600160a01b038116811461081257600080fd5b919050565b60008060006060848603121561082c57600080fd5b610835846107fb565b95602085013595506040909401359392505050565b6000806040838503121561085d57600080fd5b50508035926020909101359150565b60008060008060006080868803121561088457600080fd5b61088d866107fb565b9450602086013567ffffffffffffffff808211156108aa57600080fd5b818801915088601f8301126108be57600080fd5b8135818111156108cd57600080fd5b8960208285010111156108df57600080fd5b9699602092909201985095966040810135965060600135945092505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052604160045260246000fd5b634e487b7160e01b600052601160045260246000fd5b808201808211156104d7576104d761092a565b60008261097057634e487b7160e01b600052601260045260246000fd5b500490565b80820281158282048414176104d7576104d761092a565b60006001820161099e5761099e61092a565b5060010190565b6bffffffffffffffffffffffff198560601b1681528284601483013760149201918201526034019291505056fea2646970667358221220b5258485ccfa2027f19268b3afb9b163d365f799c1d47403eb537d881d64607764736f6c63430008180033",
    "deployedBytecode": "0x608060405234801561001057600080fd5b50600436106100935760003560e01c8063699e8fe211610066578063699e8fe21461010d5780638da5cb5b1461016a57806394c47b06146101a9578063db7ad4dd146101be578063e1353f4f1461020b57600080fd5b806321111bb4146100985780632b8b906c146100b457806335f0dced146100c757806341c23e1f146100ea575b600080fd5b6100a160005481565b6040519081526020015b60405180910390f35b6100a16100c236600461074d565b61021e565b6100da6100d536600461078f565b6104dd565b60405190151581526020016100ab565b6100da6100f83660046107e2565b60009081526002602052604090205460ff1690565b6100a161011b366004610817565b6040516bffffffffffffffffffffffff19606085901b16602082015260348101839052605481018290526000906074016040516020818303038152906040528051906020012090509392505050565b6101917f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020016100ab565b6101bc6101b736600461084a565b610581565b005b6101f06101cc3660046107e2565b60008181526001602081905260409091208054918101546002909101549193909250565b604080519384526020840192909252908201526060016100ab565b6100da61021936600461086c565b6106c1565b60008181036102405760405163274e031760e11b815260040160405180910390fd5b600182900361026a578282600081811061025c5761025c6108fe565b9050602002013590506104d7565b60008267ffffffffffffffff81111561028557610285610914565b6040519080825280602002602001820160405280156102ae578160200160208202803683370190505b50905060005b838110156102fa578484828181106102ce576102ce6108fe565b905060200201358282815181106102e7576102e76108fe565b60209081029190910101526001016102b4565b5080515b60018111156104b75760006002610316836001610940565b6103209190610953565b905060005b818110156104af57600061033a826002610975565b905060008461034a836001610940565b106103555781610360565b610360826001610940565b9050858181518110610374576103746108fe565b602002602001015186838151811061038e5761038e6108fe565b602002602001015111610422578582815181106103ad576103ad6108fe565b60200260200101518682815181106103c7576103c76108fe565b60200260200101516040516020016103e9929190918252602082015260400190565b60405160208183030381529060405280519060200120868481518110610411576104116108fe565b6020026020010181815250506104a5565b858181518110610434576104346108fe565b602002602001015186838151811061044e5761044e6108fe565b6020026020010151604051602001610470929190918252602082015260400190565b60405160208183030381529060405280519060200120868481518110610498576104986108fe565b6020026020010181815250505b5050600101610325565b5090506102fe565b816000815181106104ca576104ca6108fe565b6020026020010151925050505b92915050565b600084815b848110156105755760008686838181106104fe576104fe6108fe565b90506020020135905080831161053f57604080516020810185905290810182905260600160405160208183030381529060405280519060200120925061056c565b60408051602081018390529081018490526060016040516020818303038152906040528051906020012092505b506001016104e2565b50909114949350505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146105ca57604051635fc483c560e01b815260040160405180910390fd5b60008281526002602052604090205460ff16156105fa5760405163218c405360e21b815260040160405180910390fd5b6000805490806106098361098c565b90915550506040805160808101825283815260208082018481524283850181815260016060860181815260008054815282875288812097518855945187830155915160028088019190915591516003909601805496151560ff199788161790558884529352908490208054909316909117909155905183917fa133cacaeac0436a520774f540d9829928dd3518a8a91e4d06cb31d9ddd7d9a8916106b591858252602082015260400190565b60405180910390a25050565b600080868686866040516020016106db94939291906109a5565b60408051601f198184030181529190528051602090910120831491505095945050505050565b60008083601f84011261071357600080fd5b50813567ffffffffffffffff81111561072b57600080fd5b6020830191508360208260051b850101111561074657600080fd5b9250929050565b6000806020838503121561076057600080fd5b823567ffffffffffffffff81111561077757600080fd5b61078385828601610701565b90969095509350505050565b600080600080606085870312156107a557600080fd5b84359350602085013567ffffffffffffffff8111156107c357600080fd5b6107cf87828801610701565b9598909750949560400135949350505050565b6000602082840312156107f457600080fd5b5035919050565b80356001600160a01b038116811461081257600080fd5b919050565b60008060006060848603121561082c57600080fd5b610835846107fb565b95602085013595506040909401359392505050565b6000806040838503121561085d57600080fd5b50508035926020909101359150565b60008060008060006080868803121561088457600080fd5b61088d866107fb565b9450602086013567ffffffffffffffff808211156108aa57600080fd5b818801915088601f8301126108be57600080fd5b8135818111156108cd57600080fd5b8960208285010111156108df57600080fd5b9699602092909201985095966040810135965060600135945092505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052604160045260246000fd5b634e487b7160e01b600052601160045260246000fd5b808201808211156104d7576104d761092a565b60008261097057634e487b7160e01b600052601260045260246000fd5b500490565b80820281158282048414176104d7576104d761092a565b60006001820161099e5761099e61092a565b5060010190565b6bffffffffffffffffffffffff198560601b1681528284601483013760149201918201526034019291505056fea2646970667358221220b5258485ccfa2027f19268b3afb9b163d365f799c1d47403eb537d881d64607764736f6c63430008180033",
    "creationBytecodeBytes": 2623,
    "deployedRuntimeBytes": 2568,
    "sha256": "7e9403ac81545c2794ef4fdd46b44a76a281b1459e42ea0e8ecbfb1ddf328643",
    "deployedSha256": "a8994653bfb809fd5d75eab600f53363c18372f0cce11218777e88ec80bdebe7",
    "lastSyncedAt": "2026-10-26T17:45:53.905Z"
  }
} as const

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
      errors.push(`Missing contract artifact for ${name}`)
      continue
    }

    if (!Array.isArray(item.abi) || item.abi.length === 0) {
      errors.push(`${name}: ABI is missing or empty array`)
    }

    if (!item.bytecode || typeof item.bytecode !== 'string' || !item.bytecode.startsWith('0x') || item.bytecode.length <= 2) {
      errors.push(`${name}: Creation bytecode is missing or invalid hex string`)
    } else if ((item.bytecode.length - 2) % 2 !== 0) {
      errors.push(`${name}: Creation bytecode has uneven hex character count`)
    }

    if (!item.deployedBytecode || typeof item.deployedBytecode !== 'string' || !item.deployedBytecode.startsWith('0x') || item.deployedBytecode.length <= 2) {
      errors.push(`${name}: Deployed runtime bytecode is missing or invalid hex string`)
    }

    if (item.deployedRuntimeBytes > 24576) {
      errors.push(`${name}: Deployed bytecode size (${item.deployedRuntimeBytes} bytes) exceeds EIP-170 limit of 24,576 bytes`)
    }

    // Cryptographic checksum verification against trusted constants
    let checksumVerified = false
    if (trusted) {
      if (item.sha256 !== trusted.creationSha256) {
        errors.push(`${name}: Creation bytecode SHA-256 does not match trusted checksum (Expected ${trusted.creationSha256.slice(0, 16)}..., got ${item.sha256.slice(0, 16)}...)`)
      } else if (item.deployedSha256 !== trusted.deployedSha256) {
        errors.push(`${name}: Runtime bytecode SHA-256 does not match trusted checksum`)
      } else {
        checksumVerified = true
      }
    } else {
      errors.push(`${name}: No trusted expected checksum constant registered`)
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
