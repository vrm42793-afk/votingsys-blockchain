const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
  let voting;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();

    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();

    await voting.addCandidate("Alice");
    await voting.addCandidate("Bob");

    await voting.startVoting();
  });

  it("Owner can add candidate", async function () {
    await voting.addCandidate("Charlie");

    const candidate = await voting.candidates(3);
    expect(candidate.name).to.equal("Charlie");
  });

  it("Non-owner cannot add candidate", async function () {
    await expect(
      voting.connect(voter1).addCandidate("Charlie")
    ).to.be.revertedWith("Only owner");
  });

  it("User can vote", async function () {
    await voting.connect(voter1).vote(1);

    const candidate = await voting.candidates(1);
    expect(candidate.voteCount).to.equal(1);
  });

  it("User cannot vote twice", async function () {
    await voting.connect(voter1).vote(1);

    await expect(
      voting.connect(voter1).vote(2)
    ).to.be.revertedWith("Already voted");
  });

  it("Invalid candidate rejected", async function () {
    await expect(
      voting.connect(voter1).vote(99)
    ).to.be.revertedWith("Invalid candidate");
  });

  it("Winner calculation works", async function () {
    await voting.connect(voter1).vote(1);
    await voting.connect(voter2).vote(1);

    await voting.endVoting();

    const winner = await voting.getWinner();

    expect(winner[1]).to.equal("Alice");
    expect(winner[2]).to.equal(2);
  });
});