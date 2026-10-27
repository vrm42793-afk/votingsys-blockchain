// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotEthVerifier
 * @author VotEth Principal Engineering Team
 * @notice Cryptographic verification of votes and Merkle proofs.
 *         Provides pure verification functions and Merkle tree utilities.
 *
 * @dev Key responsibilities (from Architecture, Ch. 4):
 * - Verify vote hash integrity (VOTE-05)
 * - Compute and verify Merkle roots/proofs (ANLT-04, VOTE-06)
 * - Generate vote commitments for ZK-ready architecture
 * - Record Merkle roots for audit trail
 *
 * ZK-ready design notes:
 * - Verification interface is abstracted to support both
 *   simple token verification (v2.0) and ZK proof verification (v2.1)
 * - Semaphore group membership proofs will plug into this contract
 *   when anonymous voting is implemented
 *
 * @custom:volume VIII
 * @custom:chapter 34
 * @custom:requirements VOTE-05, VOTE-06, ANLT-04, QR-02, QR-03
 */
contract VotEthVerifier {
    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    /// @notice Thrown when a non-owner attempts an owner-only action.
    error OnlyOwner();

    /// @notice Thrown when an empty proof array is provided.
    error EmptyProof();

    /// @notice Thrown when an empty hashes array is provided for Merkle computation.
    error EmptyHashes();

    /// @notice Thrown when a Merkle root has already been recorded.
    error RootAlreadyRecorded();

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a Merkle root is recorded for an election.
    /// @param merkleRoot The recorded Merkle root.
    /// @param totalVotes The total number of votes in the tree.
    /// @param recordedAt The block timestamp of recording.
    event MerkleRootRecorded(
        bytes32 indexed merkleRoot,
        uint256 totalVotes,
        uint256 recordedAt
    );

    // =========================================================================
    // STRUCTS
    // =========================================================================

    /// @notice A recorded Merkle root with metadata.
    struct MerkleRootRecord {
        bytes32 root;
        uint256 totalVotes;
        uint256 recordedAt;
        bool exists;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice The contract deployer / owner.
    address public immutable owner;

    /// @notice Number of recorded Merkle roots.
    uint256 public rootCount;

    /// @notice rootIndex => MerkleRootRecord mapping.
    mapping(uint256 => MerkleRootRecord) private _roots;

    /// @notice merkleRoot => bool, tracks if a root has been recorded.
    mapping(bytes32 => bool) private _rootRecorded;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    // PURE VERIFICATION FUNCTIONS
    // =========================================================================

    /**
     * @notice Verify that a vote hash matches the expected value.
     * @dev Pure function — no state access. Deterministic hash verification.
     * @param voter The voter's address.
     * @param candidate The candidate identifier (string).
     * @param timestamp The vote timestamp.
     * @param expectedHash The expected vote hash to verify against.
     * @return valid True if the computed hash matches the expected hash.
     */
    function verifyVoteHash(
        address voter,
        string calldata candidate,
        uint256 timestamp,
        bytes32 expectedHash
    ) external pure returns (bool valid) {
        bytes32 computed = keccak256(
            abi.encodePacked(voter, candidate, timestamp)
        );
        return computed == expectedHash;
    }

    /**
     * @notice Compute a vote commitment for ZK-ready architecture.
     * @dev Commitment = hash(voter, secret, timestamp). Used for future
     *      Semaphore integration where voter identity is hidden.
     * @param voter The voter's address.
     * @param secret A secret value known only to the voter.
     * @param timestamp The vote timestamp.
     * @return commitment The computed vote commitment.
     */
    function computeVoteCommitment(
        address voter,
        bytes32 secret,
        uint256 timestamp
    ) external pure returns (bytes32 commitment) {
        return keccak256(abi.encodePacked(voter, secret, timestamp));
    }

    // =========================================================================
    // MERKLE TREE FUNCTIONS
    // =========================================================================

    /**
     * @notice Compute the Merkle root from an array of vote hashes.
     * @dev Builds the Merkle tree bottom-up. If odd number of leaves,
     *      the last leaf is paired with itself.
     * @param voteHashes The array of vote hashes (leaves).
     * @return root The computed Merkle root.
     */
    function computeMerkleRoot(
        bytes32[] calldata voteHashes
    ) external pure returns (bytes32 root) {
        if (voteHashes.length == 0) revert EmptyHashes();
        if (voteHashes.length == 1) return voteHashes[0];

        // Copy to memory for in-place computation
        bytes32[] memory nodes = new bytes32[](voteHashes.length);
        for (uint256 i = 0; i < voteHashes.length; i++) {
            nodes[i] = voteHashes[i];
        }

        uint256 n = nodes.length;
        while (n > 1) {
            uint256 nextN = (n + 1) / 2;
            for (uint256 i = 0; i < nextN; i++) {
                uint256 left = i * 2;
                uint256 right = left + 1 < n ? left + 1 : left;
                // Sort to ensure deterministic ordering
                if (nodes[left] <= nodes[right]) {
                    nodes[i] = keccak256(
                        abi.encodePacked(nodes[left], nodes[right])
                    );
                } else {
                    nodes[i] = keccak256(
                        abi.encodePacked(nodes[right], nodes[left])
                    );
                }
            }
            n = nextN;
        }

        return nodes[0];
    }

    /**
     * @notice Verify that a vote hash is included in a Merkle tree via proof.
     * @param voteHash The vote hash to verify inclusion for.
     * @param proof The Merkle proof (array of sibling hashes).
     * @param root The expected Merkle root.
     * @return valid True if the proof verifies the inclusion of voteHash.
     */
    function verifyMerkleProof(
        bytes32 voteHash,
        bytes32[] calldata proof,
        bytes32 root
    ) external pure returns (bool valid) {
        bytes32 computedHash = voteHash;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            // Sort to ensure deterministic ordering (same as tree construction)
            if (computedHash <= proofElement) {
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
        }

        return computedHash == root;
    }

    // =========================================================================
    // MERKLE ROOT RECORDING
    // =========================================================================

    /**
     * @notice Record a Merkle root on-chain for audit purposes.
     * @dev Only the owner can record roots. Each root can only be recorded once.
     * @param root The Merkle root to record.
     * @param merkleRootTotalVotes The total number of votes in the Merkle tree.
     */
    function recordMerkleRoot(
        bytes32 root,
        uint256 merkleRootTotalVotes
    ) external onlyOwner {
        if (_rootRecorded[root]) revert RootAlreadyRecorded();

        rootCount++;
        _roots[rootCount] = MerkleRootRecord({
            root: root,
            totalVotes: merkleRootTotalVotes,
            recordedAt: block.timestamp,
            exists: true
        });
        _rootRecorded[root] = true;

        emit MerkleRootRecorded(root, merkleRootTotalVotes, block.timestamp);
    }

    /**
     * @notice Get a recorded Merkle root by index.
     * @param index The root record index (1-based).
     * @return root The Merkle root.
     * @return merkleRootTotalVotes The total votes in the tree.
     * @return recordedAt The recording timestamp.
     */
    function getRecordedRoot(
        uint256 index
    )
        external
        view
        returns (bytes32 root, uint256 merkleRootTotalVotes, uint256 recordedAt)
    {
        MerkleRootRecord storage record = _roots[index];
        return (record.root, record.totalVotes, record.recordedAt);
    }

    /**
     * @notice Check if a Merkle root has been recorded.
     * @param root The Merkle root to check.
     * @return recorded True if the root has been recorded.
     */
    function isRootRecorded(bytes32 root) external view returns (bool recorded) {
        return _rootRecorded[root];
    }
}
