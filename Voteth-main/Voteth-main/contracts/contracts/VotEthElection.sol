// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotEthElection
 * @author VotEth Principal Engineering Team
 * @notice Per-election smart contract for vote recording, double-vote prevention,
 *         and result tallying. This is the security-critical contract in VotEth 2.0.
 *
 * @dev Key responsibilities (from Architecture, Ch. 4):
 * - Record vote hashes on-chain to anchor the election (VOTE-03)
 * - Enforce one-vote-per-wallet via `hasVoted` mapping (VOTE-04)
 * - Preserve privacy: NEVER record plaintext candidate IDs on-chain during OPEN state (VOTE-07)
 * - Emit VoteCast events for on-chain audit trail
 *
 * Security model:
 * - `hasVoted[address]` mapping prevents double-voting at contract level
 * - Election must be in OPEN state to accept vote hashes
 * - No admin override for vote records — immutable once written
 *
 * Trust boundary (from Architecture, Ch. 4.4):
 *   Browser → Supabase (off-chain first) → Smart Contract (on-chain anchor)
 *   Both layers must independently enforce vote validity.
 *
 * @custom:volume VIII
 * @custom:chapter 33
 * @custom:requirements VOTE-02, VOTE-03, VOTE-04, CAND-04, ANLT-04
 */
contract VotEthElection {
    // =========================================================================
    // ENUMS
    // =========================================================================

    /// @notice Election lifecycle states: DRAFT → OPEN → CLOSED → PUBLISHED
    enum ElectionState {
        DRAFT,
        OPEN,
        CLOSED,
        PUBLISHED
    }

    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    /// @notice Thrown when a non-owner attempts an owner-only action.
    error OnlyOwner();

    /// @notice Thrown when the election is not in the expected state.
    /// @param current The current state.
    /// @param expected The expected state.
    error InvalidState(ElectionState current, ElectionState expected);

    /// @notice Thrown when a voter has already cast their vote.
    error AlreadyVoted();

    /// @notice Thrown when a zero-length vote hash is provided.
    error EmptyVoteHash();

    /// @notice Thrown when a zero-length candidate hash is provided.
    error EmptyCandidateHash();

    /// @notice Thrown when a voter is not on the eligibility allowlist.
    error NotEligible();

    /// @notice Thrown when voting for an unregistered candidate.
    error InvalidCandidate();

    /// @notice Thrown when attempting to register an already registered candidate.
    error CandidateAlreadyRegistered();

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a vote is cast.
    /// @param voter The voter's address.
    /// @param voteHash The deterministic hash of the vote.
    /// @param candidateHash The hashed candidate identifier.
    event VoteCast(
        address indexed voter,
        bytes32 indexed voteHash,
        bytes32 indexed candidateHash
    );

    /// @notice Emitted when the election state transitions.
    /// @param previousState The state before the transition.
    /// @param newState The state after the transition.
    event StateChanged(ElectionState previousState, ElectionState newState);

    /// @notice Emitted when a candidate hash is registered for the election.
    event CandidateRegistered(bytes32 indexed candidateHash);

    /// @notice Emitted when voter eligibility status is updated.
    event VoterEligibilitySet(address indexed voter, bool eligible);

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice The election creator/owner (admin).
    address public immutable owner;

    /// @notice Current election state.
    ElectionState public state;

    /// @notice Total number of votes cast.
    uint256 public totalVotes;

    /// @notice Tracks whether an address has voted.
    mapping(address => bool) public hasAddressVoted;

    /// @notice Stores the vote hash for each voter (for receipt verification).
    mapping(address => bytes32) public voterToVoteHash;

    /// @notice Tallies votes per candidate hash.
    mapping(bytes32 => uint256) public candidateVoteCounts;

    /// @notice Ordered list of all vote hashes (for Merkle tree construction).
    bytes32[] private _voteHashes;

    /// @notice Ordered list of unique candidate hashes (for enumeration).
    bytes32[] private _candidateHashes;

    /// @notice Tracks whether a candidate hash has been seen (to avoid duplicates in array).
    mapping(bytes32 => bool) private _candidateHashSeen;

    /// @notice Tracks candidate registration status.
    mapping(bytes32 => bool) public isCandidateRegistered;

    /// @notice Flag to enforce candidate pre-registration.
    bool public candidateValidationEnabled;

    /// @notice Tracks voter eligibility allowlist.
    mapping(address => bool) public isVoterEligible;

    /// @notice Flag to enforce voter allowlisting.
    bool public voterEligibilityEnabled;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier inState(ElectionState expected) {
        if (state != expected) revert InvalidState(state, expected);
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /// @notice Deploys the election in DRAFT state.
    constructor() {
        owner = msg.sender;
        state = ElectionState.DRAFT;
    }

    // =========================================================================
    // LIFECYCLE FUNCTIONS
    // =========================================================================

    /**
     * @notice Transition from DRAFT to OPEN. Starts accepting votes.
     * @dev Only the owner can open the election. Config is locked once open.
     */
    function openElection() external onlyOwner inState(ElectionState.DRAFT) {
        state = ElectionState.OPEN;
        emit StateChanged(ElectionState.DRAFT, ElectionState.OPEN);
    }

    /**
     * @notice Transition from OPEN to CLOSED. Stops accepting votes.
     * @dev Only the owner can close the election.
     */
    function closeElection() external onlyOwner inState(ElectionState.OPEN) {
        state = ElectionState.CLOSED;
        emit StateChanged(ElectionState.OPEN, ElectionState.CLOSED);
    }

    /**
     * @notice Transition from CLOSED to PUBLISHED. Makes results visible.
     * @dev Only the owner can publish. Results are hidden until this point.
     */
    function publishResults() external onlyOwner inState(ElectionState.CLOSED) {
        state = ElectionState.PUBLISHED;
        emit StateChanged(ElectionState.CLOSED, ElectionState.PUBLISHED);
    }

    // =========================================================================
    // CANDIDATE & VOTER MANAGEMENT
    // =========================================================================

    /**
     * @notice Register an official candidate hash before opening election.
     * @param candidateHash Keccak256 hash of candidate identifier.
     */
    function registerCandidate(bytes32 candidateHash) external onlyOwner inState(ElectionState.DRAFT) {
        if (candidateHash == bytes32(0)) revert EmptyCandidateHash();
        if (isCandidateRegistered[candidateHash]) revert CandidateAlreadyRegistered();

        isCandidateRegistered[candidateHash] = true;
        candidateValidationEnabled = true;

        if (!_candidateHashSeen[candidateHash]) {
            _candidateHashSeen[candidateHash] = true;
            _candidateHashes.push(candidateHash);
        }

        emit CandidateRegistered(candidateHash);
    }

    /**
     * @notice Enable or disable candidate validation requirement.
     */
    function enableCandidateValidation(bool enabled) external onlyOwner inState(ElectionState.DRAFT) {
        candidateValidationEnabled = enabled;
    }

    /**
     * @notice Set eligibility status for a single voter address. Only callable in DRAFT.
     */
    function setVoterEligibility(address voter, bool eligible) external onlyOwner inState(ElectionState.DRAFT) {
        isVoterEligible[voter] = eligible;
        emit VoterEligibilitySet(voter, eligible);
    }

    /**
     * @notice Set eligibility status for a batch of voter addresses. Only callable in DRAFT.
     */
    function setVoterEligibilityBatch(address[] calldata voters, bool eligible) external onlyOwner inState(ElectionState.DRAFT) {
        for (uint256 i = 0; i < voters.length; i++) {
            isVoterEligible[voters[i]] = eligible;
            emit VoterEligibilitySet(voters[i], eligible);
        }
    }

    /**
     * @notice Enable or disable voter eligibility allowlist enforcement. Only callable in DRAFT.
     */
    function enableVoterEligibility(bool enabled) external onlyOwner inState(ElectionState.DRAFT) {
        voterEligibilityEnabled = enabled;
    }

    // =========================================================================
    // VOTING FUNCTIONS
    // =========================================================================

    /**
     * @notice Cast a vote by recording a vote hash and candidate hash on-chain.
     * @dev Enforces one-vote-per-address and optional eligibility/candidate allowlists.
     *      Privacy: candidateHash is a keccak256 hash, not plaintext.
     * @param voteHash A deterministic hash of (voter, candidate, timestamp, salt).
     * @param candidateHash A keccak256 hash of the candidate identifier.
     */
    function castVote(
        bytes32 voteHash,
        bytes32 candidateHash
    ) external inState(ElectionState.OPEN) {
        if (voteHash == bytes32(0)) revert EmptyVoteHash();
        if (candidateHash == bytes32(0)) revert EmptyCandidateHash();
        if (voterEligibilityEnabled && !isVoterEligible[msg.sender]) revert NotEligible();
        if (candidateValidationEnabled && !isCandidateRegistered[candidateHash]) revert InvalidCandidate();
        if (hasAddressVoted[msg.sender]) revert AlreadyVoted();

        // Record the vote
        hasAddressVoted[msg.sender] = true;
        voterToVoteHash[msg.sender] = voteHash;
        _voteHashes.push(voteHash);
        totalVotes++;

        // Tally the candidate
        candidateVoteCounts[candidateHash]++;
        if (!_candidateHashSeen[candidateHash]) {
            _candidateHashSeen[candidateHash] = true;
            _candidateHashes.push(candidateHash);
        }

        emit VoteCast(msg.sender, voteHash, candidateHash);
    }

    // =========================================================================
    // QUERY FUNCTIONS
    // =========================================================================

    /**
     * @notice Get the total number of votes cast.
     * @return count The total vote count.
     */
    function getTotalVotes() external view returns (uint256 count) {
        return totalVotes;
    }

    /**
     * @notice Get the vote count for a specific candidate hash.
     * @param candidateHash The hashed candidate identifier.
     * @return count The number of votes for this candidate.
     */
    function getCandidateVoteCount(
        bytes32 candidateHash
    ) external view returns (uint256 count) {
        return candidateVoteCounts[candidateHash];
    }

    /**
     * @notice Get all vote hashes (for Merkle tree construction).
     * @return hashes Array of all vote hashes in order of casting.
     */
    function getVoteHashes() external view returns (bytes32[] memory hashes) {
        return _voteHashes;
    }

    /**
     * @notice Get all unique candidate hashes that received votes.
     * @return hashes Array of unique candidate hashes.
     */
    function getCandidateHashes() external view returns (bytes32[] memory hashes) {
        return _candidateHashes;
    }

    /**
     * @notice Check if a specific address has already voted.
     * @param voter The address to check.
     * @return voted True if the address has voted.
     */
    function hasVoted(address voter) external view returns (bool voted) {
        return hasAddressVoted[voter];
    }

    /**
     * @notice Get the vote hash for a specific voter (for receipt verification).
     * @param voter The voter's address.
     * @return voteHash The voter's vote hash (bytes32(0) if not voted).
     */
    function getVoteReceipt(address voter) external view returns (bytes32 voteHash) {
        return voterToVoteHash[voter];
    }
}
