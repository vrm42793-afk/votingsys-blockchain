// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
    }

    struct Voter {
        bool verified;
        bool voted;
    }

    uint256 public candidateCount;

    bool public electionStarted;
    bool public electionEnded;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;

    event CandidateAdded(
        uint256 id,
        string name
    );

    event VoterVerified(
        address voter
    );

    event VoteCast(
        address voter,
        uint256 candidateId
    );

    constructor(address initialOwner)
        Ownable(initialOwner)
    {}

    function addCandidate(
        string memory _name,
        string memory _party
    )
        public
        onlyOwner
    {
        require(
            !electionStarted,
            "Election already started"
        );

        candidateCount++;

        candidates[candidateCount] =
            Candidate(
                candidateCount,
                _name,
                _party,
                0
            );

        emit CandidateAdded(
            candidateCount,
            _name
        );
    }

    function verifyVoter(
        address voter
    )
        public
        onlyOwner
    {
        voters[voter].verified = true;

        emit VoterVerified(voter);
    }

    function startElection()
        public
        onlyOwner
    {
        electionStarted = true;
        electionEnded = false;
    }

    function endElection()
        public
        onlyOwner
    {
        electionEnded = true;
    }

    function vote(
        uint256 candidateId
    )
        public
    {
        require(
            electionStarted,
            "Election not started"
        );

        require(
            !electionEnded,
            "Election ended"
        );

        require(
            voters[msg.sender].verified,
            "Not verified"
        );

        require(
            !voters[msg.sender].voted,
            "Already voted"
        );

        candidates[candidateId].voteCount++;

        voters[msg.sender].voted = true;

        emit VoteCast(
            msg.sender,
            candidateId
        );
    }
}