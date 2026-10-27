/**
 * VotEth 2.0 — VotEthRegistry Contract Test Suite
 *
 * Tests organization registration, election registration,
 * permission enforcement, reverse lookups, and edge cases.
 *
 * @see docs/requirements/traceability.md for requirement-to-test mapping
 * @custom:requirements ORG-01, ELEC-09
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { VotEthRegistry } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('VotEthRegistry', function () {
  let registry: VotEthRegistry
  let owner: SignerWithAddress
  let admin1: SignerWithAddress
  let admin2: SignerWithAddress
  let nonOwner: SignerWithAddress

  beforeEach(async function () {
    ;[owner, admin1, admin2, nonOwner] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('VotEthRegistry')
    registry = await Factory.deploy()
    await registry.waitForDeployment()
  })

  // =========================================================================
  // DEPLOYMENT
  // =========================================================================

  describe('Deployment', function () {
    it('Should set the deployer as owner', async function () {
      expect(await registry.owner()).to.equal(owner.address)
    })

    it('Should start with zero organizations', async function () {
      expect(await registry.orgCount()).to.equal(0)
    })

    it('Should start with zero elections', async function () {
      expect(await registry.electionCount()).to.equal(0)
    })
  })

  // =========================================================================
  // ORGANIZATION REGISTRATION
  // =========================================================================

  describe('Organization Registration', function () {
    it('Should register an organization and return the correct orgId', async function () {
      const tx = await registry.registerOrganization('Test Org', admin1.address)
      const receipt = await tx.wait()
      expect(await registry.orgCount()).to.equal(1)

      const [name, admin, createdAt] = await registry.getOrganization(1)
      expect(name).to.equal('Test Org')
      expect(admin).to.equal(admin1.address)
      expect(createdAt).to.be.greaterThan(0)
    })

    it('Should emit OrganizationRegistered event', async function () {
      await expect(registry.registerOrganization('Event Org', admin1.address))
        .to.emit(registry, 'OrganizationRegistered')
        .withArgs(1, 'Event Org', admin1.address)
    })

    it('Should register multiple organizations with incrementing IDs', async function () {
      await registry.registerOrganization('Org 1', admin1.address)
      await registry.registerOrganization('Org 2', admin2.address)
      expect(await registry.orgCount()).to.equal(2)

      const [name1] = await registry.getOrganization(1)
      const [name2] = await registry.getOrganization(2)
      expect(name1).to.equal('Org 1')
      expect(name2).to.equal('Org 2')
    })

    it('Should revert when non-owner tries to register', async function () {
      await expect(
        registry.connect(nonOwner).registerOrganization('Hack Org', admin1.address)
      ).to.be.revertedWithCustomError(registry, 'OnlyOwner')
    })

    it('Should revert with empty name', async function () {
      await expect(
        registry.registerOrganization('', admin1.address)
      ).to.be.revertedWithCustomError(registry, 'EmptyName')
    })

    it('Should revert with zero address admin', async function () {
      await expect(
        registry.registerOrganization('Org', ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress')
    })
  })

  // =========================================================================
  // ORGANIZATION ADMIN UPDATE
  // =========================================================================

  describe('Admin Update', function () {
    beforeEach(async function () {
      await registry.registerOrganization('Admin Org', admin1.address)
    })

    it('Should allow org admin to update admin', async function () {
      await registry.connect(admin1).updateOrgAdmin(1, admin2.address)
      const [, newAdmin] = await registry.getOrganization(1)
      expect(newAdmin).to.equal(admin2.address)
    })

    it('Should emit OrgAdminUpdated event', async function () {
      await expect(registry.connect(admin1).updateOrgAdmin(1, admin2.address))
        .to.emit(registry, 'OrgAdminUpdated')
        .withArgs(1, admin1.address, admin2.address)
    })

    it('Should revert when non-admin tries to update', async function () {
      await expect(
        registry.connect(nonOwner).updateOrgAdmin(1, admin2.address)
      ).to.be.revertedWithCustomError(registry, 'OnlyOrgAdmin')
    })

    it('Should revert when updating to zero address', async function () {
      await expect(
        registry.connect(admin1).updateOrgAdmin(1, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress')
    })
  })

  // =========================================================================
  // ORGANIZATION QUERIES
  // =========================================================================

  describe('Organization Queries', function () {
    it('Should revert when querying orgId 0', async function () {
      await expect(registry.getOrganization(0)).to.be.revertedWithCustomError(
        registry,
        'InvalidOrgId'
      )
    })

    it('Should revert when querying orgId out of range', async function () {
      await expect(registry.getOrganization(999)).to.be.revertedWithCustomError(
        registry,
        'InvalidOrgId'
      )
    })
  })

  // =========================================================================
  // ELECTION REGISTRATION
  // =========================================================================

  describe('Election Registration', function () {
    const fakeElectionAddr = '0x0000000000000000000000000000000000000001'

    beforeEach(async function () {
      await registry.registerOrganization('Election Org', admin1.address)
    })

    it('Should register an election and return the correct electionId', async function () {
      await registry
        .connect(admin1)
        .registerElection(1, fakeElectionAddr, 'Student Union Vote 2026')

      expect(await registry.electionCount()).to.equal(1)

      const [orgId, contractAddress, title, registeredAt] =
        await registry.getElection(1)
      expect(orgId).to.equal(1)
      expect(contractAddress).to.equal(fakeElectionAddr)
      expect(title).to.equal('Student Union Vote 2026')
      expect(registeredAt).to.be.greaterThan(0)
    })

    it('Should emit ElectionRegistered event', async function () {
      await expect(
        registry
          .connect(admin1)
          .registerElection(1, fakeElectionAddr, 'Test Election')
      )
        .to.emit(registry, 'ElectionRegistered')
        .withArgs(1, 1, fakeElectionAddr, 'Test Election')
    })

    it('Should revert when non-admin tries to register election', async function () {
      await expect(
        registry
          .connect(nonOwner)
          .registerElection(1, fakeElectionAddr, 'Hack Election')
      ).to.be.revertedWithCustomError(registry, 'OnlyOrgAdmin')
    })

    it('Should revert with zero address election contract', async function () {
      await expect(
        registry
          .connect(admin1)
          .registerElection(1, ethers.ZeroAddress, 'Bad Election')
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress')
    })

    it('Should revert with empty election title', async function () {
      await expect(
        registry.connect(admin1).registerElection(1, fakeElectionAddr, '')
      ).to.be.revertedWithCustomError(registry, 'EmptyName')
    })

    it('Should revert when election contract is already registered', async function () {
      await registry
        .connect(admin1)
        .registerElection(1, fakeElectionAddr, 'First')
      await expect(
        registry
          .connect(admin1)
          .registerElection(1, fakeElectionAddr, 'Duplicate')
      ).to.be.revertedWithCustomError(registry, 'ElectionAlreadyRegistered')
    })
  })

  // =========================================================================
  // REVERSE LOOKUPS
  // =========================================================================

  describe('Reverse Lookups', function () {
    const fakeAddr = '0x0000000000000000000000000000000000000042'

    beforeEach(async function () {
      await registry.registerOrganization('Lookup Org', admin1.address)
      await registry
        .connect(admin1)
        .registerElection(1, fakeAddr, 'Lookup Election')
    })

    it('Should return the correct election ID for a contract address', async function () {
      const electionId = await registry.getElectionIdByContract(fakeAddr)
      expect(electionId).to.equal(1)
    })

    it('Should return 0 for unregistered contract address', async function () {
      const electionId = await registry.getElectionIdByContract(
        '0x0000000000000000000000000000000000000099'
      )
      expect(electionId).to.equal(0)
    })
  })

  // =========================================================================
  // ELECTION QUERIES
  // =========================================================================

  describe('Election Queries', function () {
    it('Should revert when querying electionId 0', async function () {
      await expect(registry.getElection(0)).to.be.revertedWithCustomError(
        registry,
        'InvalidElectionId'
      )
    })

    it('Should revert when querying electionId out of range', async function () {
      await expect(registry.getElection(999)).to.be.revertedWithCustomError(
        registry,
        'InvalidElectionId'
      )
    })
  })
})
