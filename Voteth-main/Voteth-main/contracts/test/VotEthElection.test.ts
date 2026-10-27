/**
 * VotEth 2.0 — VotEthElection Contract Test Suite
 *
 * Tests the full election lifecycle, vote casting, double-vote prevention,
 * state machine enforcement, tallying, and query functions.
 *
 * @see docs/requirements/traceability.md for requirement-to-test mapping
 * @custom:requirements VOTE-02, VOTE-03, VOTE-04, VOTE-05, VOTE-06
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { VotEthElection } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('VotEthElection', function () {
  let election: VotEthElection
  let owner: SignerWithAddress
  let voter1: SignerWithAddress
  let voter2: SignerWithAddress
  let voter3: SignerWithAddress
  let nonOwner: SignerWithAddress

  // Helper: compute a deterministic vote hash
  function computeVoteHash(voter: string, candidate: string, timestamp: number): string {
    return ethers.keccak256(
      ethers.solidityPacked(['address', 'string', 'uint256'], [voter, candidate, timestamp])
    )
  }

  // Helper: compute a candidate hash
  function computeCandidateHash(candidate: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(candidate))
  }

  beforeEach(async function () {
    ;[owner, voter1, voter2, voter3, nonOwner] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('VotEthElection')
    election = await Factory.deploy()
    await election.waitForDeployment()
  })

  // =========================================================================
  // DEPLOYMENT
  // =========================================================================

  describe('Deployment', function () {
    it('Should set the deployer as owner', async function () {
      expect(await election.owner()).to.equal(owner.address)
    })

    it('Should start in DRAFT state (0)', async function () {
      expect(await election.state()).to.equal(0)
    })

    it('Should start with zero votes', async function () {
      expect(await election.getTotalVotes()).to.equal(0)
    })
  })

  // =========================================================================
  // LIFECYCLE STATE MACHINE
  // =========================================================================

  describe('Election Lifecycle', function () {
    it('Should transition DRAFT → OPEN', async function () {
      await expect(election.openElection())
        .to.emit(election, 'StateChanged')
        .withArgs(0, 1) // DRAFT → OPEN
      expect(await election.state()).to.equal(1)
    })

    it('Should transition OPEN → CLOSED', async function () {
      await election.openElection()
      await expect(election.closeElection())
        .to.emit(election, 'StateChanged')
        .withArgs(1, 2) // OPEN → CLOSED
      expect(await election.state()).to.equal(2)
    })

    it('Should transition CLOSED → PUBLISHED', async function () {
      await election.openElection()
      await election.closeElection()
      await expect(election.publishResults())
        .to.emit(election, 'StateChanged')
        .withArgs(2, 3) // CLOSED → PUBLISHED
      expect(await election.state()).to.equal(3)
    })

    it('Should revert DRAFT → CLOSED (invalid transition)', async function () {
      await expect(election.closeElection()).to.be.revertedWithCustomError(
        election,
        'InvalidState'
      )
    })

    it('Should revert DRAFT → PUBLISHED (invalid transition)', async function () {
      await expect(election.publishResults()).to.be.revertedWithCustomError(
        election,
        'InvalidState'
      )
    })

    it('Should revert OPEN → PUBLISHED (must close first)', async function () {
      await election.openElection()
      await expect(election.publishResults()).to.be.revertedWithCustomError(
        election,
        'InvalidState'
      )
    })

    it('Should revert when non-owner tries to open', async function () {
      await expect(
        election.connect(nonOwner).openElection()
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')
    })

    it('Should revert when non-owner tries to close', async function () {
      await election.openElection()
      await expect(
        election.connect(nonOwner).closeElection()
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')
    })

    it('Should revert when non-owner tries to publish', async function () {
      await election.openElection()
      await election.closeElection()
      await expect(
        election.connect(nonOwner).publishResults()
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')
    })
  })

  // =========================================================================
  // VOTE CASTING
  // =========================================================================

  describe('Vote Casting', function () {
    const candidateHash = ethers.keccak256(ethers.toUtf8Bytes('Alice'))
    const voteHash = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))

    beforeEach(async function () {
      await election.openElection()
    })

    it('Should cast a vote successfully', async function () {
      await expect(election.connect(voter1).castVote(voteHash, candidateHash))
        .to.emit(election, 'VoteCast')
        .withArgs(voter1.address, voteHash, candidateHash)
    })

    it('Should increment total votes', async function () {
      await election.connect(voter1).castVote(voteHash, candidateHash)
      expect(await election.getTotalVotes()).to.equal(1)
    })

    it('Should mark voter as having voted', async function () {
      await election.connect(voter1).castVote(voteHash, candidateHash)
      expect(await election.hasVoted(voter1.address)).to.equal(true)
      expect(await election.hasVoted(voter2.address)).to.equal(false)
    })

    it('Should store the vote receipt hash', async function () {
      await election.connect(voter1).castVote(voteHash, candidateHash)
      expect(await election.getVoteReceipt(voter1.address)).to.equal(voteHash)
    })

    it('Should tally votes per candidate', async function () {
      const candidateA = computeCandidateHash('Alice')
      const candidateB = computeCandidateHash('Bob')
      const voteA1 = ethers.keccak256(ethers.toUtf8Bytes('vote-a1'))
      const voteA2 = ethers.keccak256(ethers.toUtf8Bytes('vote-a2'))
      const voteB1 = ethers.keccak256(ethers.toUtf8Bytes('vote-b1'))

      await election.connect(voter1).castVote(voteA1, candidateA)
      await election.connect(voter2).castVote(voteA2, candidateA)
      await election.connect(voter3).castVote(voteB1, candidateB)

      expect(await election.getCandidateVoteCount(candidateA)).to.equal(2)
      expect(await election.getCandidateVoteCount(candidateB)).to.equal(1)
    })

    it('Should track candidate hashes', async function () {
      const candidateA = computeCandidateHash('Alice')
      const candidateB = computeCandidateHash('Bob')
      const voteA = ethers.keccak256(ethers.toUtf8Bytes('vote-a'))
      const voteB = ethers.keccak256(ethers.toUtf8Bytes('vote-b'))

      await election.connect(voter1).castVote(voteA, candidateA)
      await election.connect(voter2).castVote(voteB, candidateB)

      const hashes = await election.getCandidateHashes()
      expect(hashes).to.have.lengthOf(2)
      expect(hashes).to.include(candidateA)
      expect(hashes).to.include(candidateB)
    })

    it('Should track all vote hashes', async function () {
      const voteA = ethers.keccak256(ethers.toUtf8Bytes('vote-a'))
      const voteB = ethers.keccak256(ethers.toUtf8Bytes('vote-b'))

      await election.connect(voter1).castVote(voteA, candidateHash)
      await election.connect(voter2).castVote(voteB, candidateHash)

      const hashes = await election.getVoteHashes()
      expect(hashes).to.have.lengthOf(2)
      expect(hashes[0]).to.equal(voteA)
      expect(hashes[1]).to.equal(voteB)
    })
  })

  // =========================================================================
  // DOUBLE-VOTE PREVENTION (VOTE-04)
  // =========================================================================

  describe('Double-Vote Prevention', function () {
    const candidateHash = ethers.keccak256(ethers.toUtf8Bytes('Alice'))
    const voteHash1 = ethers.keccak256(ethers.toUtf8Bytes('vote-1'))
    const voteHash2 = ethers.keccak256(ethers.toUtf8Bytes('vote-2'))

    beforeEach(async function () {
      await election.openElection()
      await election.connect(voter1).castVote(voteHash1, candidateHash)
    })

    it('Should revert when the same voter tries to vote again', async function () {
      await expect(
        election.connect(voter1).castVote(voteHash2, candidateHash)
      ).to.be.revertedWithCustomError(election, 'AlreadyVoted')
    })

    it('Should allow different voters to vote', async function () {
      await expect(
        election.connect(voter2).castVote(voteHash2, candidateHash)
      ).not.to.be.reverted
    })
  })

  // =========================================================================
  // STATE ENFORCEMENT ON VOTING
  // =========================================================================

  describe('State Enforcement on Voting', function () {
    const candidateHash = ethers.keccak256(ethers.toUtf8Bytes('Alice'))
    const voteHash = ethers.keccak256(ethers.toUtf8Bytes('vote'))

    it('Should revert voting in DRAFT state', async function () {
      await expect(
        election.connect(voter1).castVote(voteHash, candidateHash)
      ).to.be.revertedWithCustomError(election, 'InvalidState')
    })

    it('Should revert voting in CLOSED state', async function () {
      await election.openElection()
      await election.closeElection()
      await expect(
        election.connect(voter1).castVote(voteHash, candidateHash)
      ).to.be.revertedWithCustomError(election, 'InvalidState')
    })

    it('Should revert voting in PUBLISHED state', async function () {
      await election.openElection()
      await election.closeElection()
      await election.publishResults()
      await expect(
        election.connect(voter1).castVote(voteHash, candidateHash)
      ).to.be.revertedWithCustomError(election, 'InvalidState')
    })
  })

  // =========================================================================
  // INPUT VALIDATION
  // =========================================================================

  describe('Input Validation', function () {
    beforeEach(async function () {
      await election.openElection()
    })

    it('Should revert with empty vote hash', async function () {
      const candidateHash = ethers.keccak256(ethers.toUtf8Bytes('Alice'))
      await expect(
        election.connect(voter1).castVote(ethers.ZeroHash, candidateHash)
      ).to.be.revertedWithCustomError(election, 'EmptyVoteHash')
    })

    it('Should revert with empty candidate hash', async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes('vote'))
      await expect(
        election.connect(voter1).castVote(voteHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(election, 'EmptyCandidateHash')
    })
  })

  // =========================================================================
  // QUERY FUNCTIONS
  // =========================================================================

  describe('Query Functions', function () {
    it('Should return false for hasVoted on non-voter', async function () {
      expect(await election.hasVoted(voter1.address)).to.equal(false)
    })

    it('Should return bytes32(0) for getVoteReceipt on non-voter', async function () {
      expect(await election.getVoteReceipt(voter1.address)).to.equal(ethers.ZeroHash)
    })

    it('Should return 0 for getCandidateVoteCount on unknown candidate', async function () {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes('unknown'))
      expect(await election.getCandidateVoteCount(unknownHash)).to.equal(0)
    })

    it('Should return empty array for getVoteHashes when no votes', async function () {
      const hashes = await election.getVoteHashes()
      expect(hashes).to.have.lengthOf(0)
    })

    it('Should return empty array for getCandidateHashes when no votes', async function () {
      const hashes = await election.getCandidateHashes()
      expect(hashes).to.have.lengthOf(0)
    })
  })

  // =========================================================================
  // CANDIDATE REGISTRATION & VALIDATION (Unauthorized Actions & Invalid Candidates)
  // =========================================================================

  describe('Candidate Registration & Validation', function () {
    const candidateA = computeCandidateHash('Alice')
    const candidateB = computeCandidateHash('Bob')
    const unregCandidate = computeCandidateHash('Mallory')
    const voteHash = ethers.keccak256(ethers.toUtf8Bytes('vote-cand-test'))

    it('Should allow owner to register candidates in DRAFT state', async function () {
      await expect(election.registerCandidate(candidateA))
        .to.emit(election, 'CandidateRegistered')
        .withArgs(candidateA)

      expect(await election.isCandidateRegistered(candidateA)).to.equal(true)
      expect(await election.candidateValidationEnabled()).to.equal(true)
    })

    it('Should revert when non-owner tries to register candidate (Unauthorized)', async function () {
      await expect(
        election.connect(nonOwner).registerCandidate(candidateA)
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')
    })

    it('Should revert when registering duplicate candidate', async function () {
      await election.registerCandidate(candidateA)
      await expect(
        election.registerCandidate(candidateA)
      ).to.be.revertedWithCustomError(election, 'CandidateAlreadyRegistered')
    })

    it('Should revert registering candidate once election is OPEN (Timing check)', async function () {
      await election.openElection()
      await expect(
        election.registerCandidate(candidateA)
      ).to.be.revertedWithCustomError(election, 'InvalidState')
    })

    it('Should revert vote for invalid unregistered candidate when validation is enabled', async function () {
      await election.registerCandidate(candidateA)
      await election.openElection()

      await expect(
        election.connect(voter1).castVote(voteHash, unregCandidate)
      ).to.be.revertedWithCustomError(election, 'InvalidCandidate')
    })

    it('Should accept vote for valid registered candidate', async function () {
      await election.registerCandidate(candidateA)
      await election.openElection()

      await expect(
        election.connect(voter1).castVote(voteHash, candidateA)
      ).not.to.be.reverted
    })
  })

  // =========================================================================
  // VOTER ELIGIBILITY & ALLOWLISTING (Unauthorized Actions & Not Eligible)
  // =========================================================================

  describe('Voter Eligibility Allowlisting', function () {
    const candidateHash = computeCandidateHash('Alice')
    const voteHash1 = ethers.keccak256(ethers.toUtf8Bytes('vote-elig-1'))
    const voteHash2 = ethers.keccak256(ethers.toUtf8Bytes('vote-elig-2'))

    it('Should allow owner to set voter eligibility', async function () {
      await expect(election.setVoterEligibility(voter1.address, true))
        .to.emit(election, 'VoterEligibilitySet')
        .withArgs(voter1.address, true)

      expect(await election.isVoterEligible(voter1.address)).to.equal(true)
    })

    it('Should allow owner to set voter eligibility in batch', async function () {
      await election.setVoterEligibilityBatch([voter1.address, voter2.address], true)
      expect(await election.isVoterEligible(voter1.address)).to.equal(true)
      expect(await election.isVoterEligible(voter2.address)).to.equal(true)
    })

    it('Should revert when non-owner tries to set voter eligibility (Unauthorized)', async function () {
      await expect(
        election.connect(nonOwner).setVoterEligibility(voter1.address, true)
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')

      await expect(
        election.connect(nonOwner).setVoterEligibilityBatch([voter1.address], true)
      ).to.be.revertedWithCustomError(election, 'OnlyOwner')
    })

    it('Should revert vote if voter is not eligible when eligibility is enabled', async function () {
      await election.enableVoterEligibility(true)
      await election.setVoterEligibility(voter1.address, true)
      // voter2 is not eligible
      await election.openElection()

      await expect(
        election.connect(voter2).castVote(voteHash2, candidateHash)
      ).to.be.revertedWithCustomError(election, 'NotEligible')

      // voter1 can vote successfully
      await expect(
        election.connect(voter1).castVote(voteHash1, candidateHash)
      ).not.to.be.reverted
    })

    it('Should revert setting eligibility once election is OPEN (Timing check)', async function () {
      await election.openElection()
      await expect(
        election.setVoterEligibility(voter1.address, true)
      ).to.be.revertedWithCustomError(election, 'InvalidState')

      await expect(
        election.setVoterEligibilityBatch([voter1.address], true)
      ).to.be.revertedWithCustomError(election, 'InvalidState')

      await expect(
        election.enableVoterEligibility(true)
      ).to.be.revertedWithCustomError(election, 'InvalidState')
    })
  })
})
