/**
 * VotEth 2.0 — VotEthVerifier Contract Test Suite
 *
 * Tests vote hash verification, Merkle root computation,
 * Merkle proof verification, vote commitments, and root recording.
 *
 * @see docs/requirements/traceability.md for requirement-to-test mapping
 * @custom:requirements VOTE-05, VOTE-06, ANLT-04
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { VotEthVerifier } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('VotEthVerifier', function () {
  let verifier: VotEthVerifier
  let owner: SignerWithAddress
  let nonOwner: SignerWithAddress
  let voter: SignerWithAddress

  beforeEach(async function () {
    ;[owner, nonOwner, voter] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('VotEthVerifier')
    verifier = await Factory.deploy()
    await verifier.waitForDeployment()
  })

  // =========================================================================
  // DEPLOYMENT
  // =========================================================================

  describe('Deployment', function () {
    it('Should set the deployer as owner', async function () {
      expect(await verifier.owner()).to.equal(owner.address)
    })

    it('Should start with zero recorded roots', async function () {
      expect(await verifier.rootCount()).to.equal(0)
    })
  })

  // =========================================================================
  // VOTE HASH VERIFICATION (VOTE-05)
  // =========================================================================

  describe('Vote Hash Verification', function () {
    it('Should return true for a valid vote hash', async function () {
      const candidate = 'Alice'
      const timestamp = 1719700000

      // Compute the expected hash the same way the contract does
      const expectedHash = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'string', 'uint256'],
          [voter.address, candidate, timestamp]
        )
      )

      const result = await verifier.verifyVoteHash(
        voter.address,
        candidate,
        timestamp,
        expectedHash
      )
      expect(result).to.equal(true)
    })

    it('Should return false for a tampered hash', async function () {
      const candidate = 'Alice'
      const timestamp = 1719700000
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('tampered'))

      const result = await verifier.verifyVoteHash(
        voter.address,
        candidate,
        timestamp,
        fakeHash
      )
      expect(result).to.equal(false)
    })

    it('Should return false when voter address is wrong', async function () {
      const candidate = 'Alice'
      const timestamp = 1719700000

      const expectedHash = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'string', 'uint256'],
          [voter.address, candidate, timestamp]
        )
      )

      // Use a different voter address for verification
      const result = await verifier.verifyVoteHash(
        nonOwner.address,
        candidate,
        timestamp,
        expectedHash
      )
      expect(result).to.equal(false)
    })
  })

  // =========================================================================
  // VOTE COMMITMENTS (ZK-ready)
  // =========================================================================

  describe('Vote Commitments', function () {
    it('Should compute a deterministic commitment', async function () {
      const secret = ethers.keccak256(ethers.toUtf8Bytes('my-secret'))
      const timestamp = 1719700000

      const commitment1 = await verifier.computeVoteCommitment(
        voter.address,
        secret,
        timestamp
      )
      const commitment2 = await verifier.computeVoteCommitment(
        voter.address,
        secret,
        timestamp
      )

      expect(commitment1).to.equal(commitment2)
    })

    it('Should produce different commitments for different secrets', async function () {
      const secret1 = ethers.keccak256(ethers.toUtf8Bytes('secret-1'))
      const secret2 = ethers.keccak256(ethers.toUtf8Bytes('secret-2'))
      const timestamp = 1719700000

      const commitment1 = await verifier.computeVoteCommitment(
        voter.address,
        secret1,
        timestamp
      )
      const commitment2 = await verifier.computeVoteCommitment(
        voter.address,
        secret2,
        timestamp
      )

      expect(commitment1).to.not.equal(commitment2)
    })
  })

  // =========================================================================
  // MERKLE ROOT COMPUTATION
  // =========================================================================

  describe('Merkle Root Computation', function () {
    it('Should return the hash itself for a single leaf', async function () {
      const leaf = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
      const root = await verifier.computeMerkleRoot([leaf])
      expect(root).to.equal(leaf)
    })

    it('Should compute a root for two leaves', async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('vote-2'))

      const root = await verifier.computeMerkleRoot([leaf1, leaf2])
      expect(root).to.not.equal(ethers.ZeroHash)

      // The root should be deterministic
      const root2 = await verifier.computeMerkleRoot([leaf1, leaf2])
      expect(root).to.equal(root2)
    })

    it('Should compute a root for four leaves', async function () {
      const leaves = [
        ethers.keccak256(ethers.toUtf8Bytes('vote-1')),
        ethers.keccak256(ethers.toUtf8Bytes('vote-2')),
        ethers.keccak256(ethers.toUtf8Bytes('vote-3')),
        ethers.keccak256(ethers.toUtf8Bytes('vote-4')),
      ]

      const root = await verifier.computeMerkleRoot(leaves)
      expect(root).to.not.equal(ethers.ZeroHash)
    })

    it('Should handle odd number of leaves (3 leaves)', async function () {
      const leaves = [
        ethers.keccak256(ethers.toUtf8Bytes('vote-1')),
        ethers.keccak256(ethers.toUtf8Bytes('vote-2')),
        ethers.keccak256(ethers.toUtf8Bytes('vote-3')),
      ]

      const root = await verifier.computeMerkleRoot(leaves)
      expect(root).to.not.equal(ethers.ZeroHash)
    })

    it('Should revert for empty hashes array', async function () {
      await expect(
        verifier.computeMerkleRoot([])
      ).to.be.revertedWithCustomError(verifier, 'EmptyHashes')
    })
  })

  // =========================================================================
  // MERKLE PROOF VERIFICATION (VOTE-06)
  // =========================================================================

  describe('Merkle Proof Verification', function () {
    it('Should verify a valid proof for two leaves', async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('vote-2'))

      // Compute root
      const root = await verifier.computeMerkleRoot([leaf1, leaf2])

      // For a 2-leaf tree, the proof for leaf1 is [leaf2]
      const isValid = await verifier.verifyMerkleProof(leaf1, [leaf2], root)
      expect(isValid).to.equal(true)
    })

    it('Should reject an invalid proof', async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('vote-2'))
      const fakeLeaf = ethers.keccak256(ethers.toUtf8Bytes('fake'))

      const root = await verifier.computeMerkleRoot([leaf1, leaf2])

      // Use a fake proof element
      const isValid = await verifier.verifyMerkleProof(leaf1, [fakeLeaf], root)
      expect(isValid).to.equal(false)
    })

    it('Should reject a valid hash against wrong root', async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('vote-2'))
      const wrongRoot = ethers.keccak256(ethers.toUtf8Bytes('wrong'))

      const isValid = await verifier.verifyMerkleProof(leaf1, [leaf2], wrongRoot)
      expect(isValid).to.equal(false)
    })
  })

  // =========================================================================
  // MERKLE ROOT RECORDING
  // =========================================================================

  describe('Merkle Root Recording', function () {
    const testRoot = ethers.keccak256(ethers.toUtf8Bytes('test-root'))

    it('Should record a Merkle root', async function () {
      await expect(verifier.recordMerkleRoot(testRoot, 42))
        .to.emit(verifier, 'MerkleRootRecorded')
        .withArgs(testRoot, 42, (value: bigint) => value > 0n)

      expect(await verifier.rootCount()).to.equal(1)
      expect(await verifier.isRootRecorded(testRoot)).to.equal(true)
    })

    it('Should retrieve a recorded root by index', async function () {
      await verifier.recordMerkleRoot(testRoot, 42)

      const [root, totalVotes, recordedAt] = await verifier.getRecordedRoot(1)
      expect(root).to.equal(testRoot)
      expect(totalVotes).to.equal(42)
      expect(recordedAt).to.be.greaterThan(0)
    })

    it('Should revert when recording the same root twice', async function () {
      await verifier.recordMerkleRoot(testRoot, 42)
      await expect(
        verifier.recordMerkleRoot(testRoot, 42)
      ).to.be.revertedWithCustomError(verifier, 'RootAlreadyRecorded')
    })

    it('Should revert when non-owner tries to record', async function () {
      await expect(
        verifier.connect(nonOwner).recordMerkleRoot(testRoot, 42)
      ).to.be.revertedWithCustomError(verifier, 'OnlyOwner')
    })

    it('Should return false for unrecorded root', async function () {
      const unrecorded = ethers.keccak256(ethers.toUtf8Bytes('not-recorded'))
      expect(await verifier.isRootRecorded(unrecorded)).to.equal(false)
    })
  })
})
