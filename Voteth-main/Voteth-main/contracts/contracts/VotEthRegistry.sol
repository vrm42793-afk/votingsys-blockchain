// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotEthRegistry
 * @author VotEth Principal Engineering Team
 * @notice On-chain registry of organizations and elections.
 *         Serves as the entry point for election discovery and verification.
 *
 * @dev Key responsibilities (from Architecture, Ch. 4):
 * - Register organizations on-chain (ORG-01)
 * - Register elections on-chain (ELEC-09)
 * - Provide a lookup for election contract addresses
 * - Emit events for on-chain audit trail
 *
 * Security model:
 * - Only contract owner can register organizations
 * - Only organization admins can register elections
 * - Immutable once registered
 *
 * @custom:volume VIII
 * @custom:chapter 32
 * @custom:requirements ELEC-09, ORG-01
 */
contract VotEthRegistry {
    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    /// @notice Thrown when a non-owner attempts an owner-only action.
    error OnlyOwner();

    /// @notice Thrown when a non-admin attempts an admin-only action on an org.
    error OnlyOrgAdmin();

    /// @notice Thrown when an organization ID is invalid (0 or out of range).
    error InvalidOrgId();

    /// @notice Thrown when an election ID is invalid (0 or out of range).
    error InvalidElectionId();

    /// @notice Thrown when an empty name is provided.
    error EmptyName();

    /// @notice Thrown when a zero address is provided.
    error ZeroAddress();

    /// @notice Thrown when an election contract address is already registered.
    error ElectionAlreadyRegistered();

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a new organization is registered.
    /// @param orgId The unique ID assigned to the organization.
    /// @param name The organization name.
    /// @param admin The initial admin address.
    event OrganizationRegistered(
        uint256 indexed orgId,
        string name,
        address indexed admin
    );

    /// @notice Emitted when an organization's admin is updated.
    /// @param orgId The organization ID.
    /// @param oldAdmin The previous admin address.
    /// @param newAdmin The new admin address.
    event OrgAdminUpdated(
        uint256 indexed orgId,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    /// @notice Emitted when a new election is registered under an organization.
    /// @param electionId The unique ID assigned to the election.
    /// @param orgId The parent organization ID.
    /// @param contractAddress The deployed election contract address.
    /// @param title The election title.
    event ElectionRegistered(
        uint256 indexed electionId,
        uint256 indexed orgId,
        address indexed contractAddress,
        string title
    );

    // =========================================================================
    // STRUCTS
    // =========================================================================

    /// @notice Represents an on-chain organization record.
    struct Organization {
        string name;
        address admin;
        uint256 createdAt;
        bool exists;
    }

    /// @notice Represents an on-chain election record.
    struct ElectionRecord {
        uint256 orgId;
        address contractAddress;
        string title;
        uint256 registeredAt;
        bool exists;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice The contract deployer / owner.
    address public immutable owner;

    /// @notice Auto-incrementing organization ID counter.
    uint256 public orgCount;

    /// @notice Auto-incrementing election ID counter.
    uint256 public electionCount;

    /// @notice orgId => Organization mapping.
    mapping(uint256 => Organization) private _organizations;

    /// @notice electionId => ElectionRecord mapping.
    mapping(uint256 => ElectionRecord) private _elections;

    /// @notice election contract address => electionId reverse lookup.
    mapping(address => uint256) private _electionIdByContract;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyOrgAdmin(uint256 orgId) {
        if (orgId == 0 || orgId > orgCount) revert InvalidOrgId();
        if (msg.sender != _organizations[orgId].admin) revert OnlyOrgAdmin();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    // ORGANIZATION FUNCTIONS
    // =========================================================================

    /**
     * @notice Register a new organization on-chain.
     * @param name The organization name. Must not be empty.
     * @param admin The initial admin address. Must not be zero.
     * @return orgId The newly assigned organization ID.
     */
    function registerOrganization(
        string calldata name,
        address admin
    ) external onlyOwner returns (uint256 orgId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (admin == address(0)) revert ZeroAddress();

        orgCount++;
        orgId = orgCount;

        _organizations[orgId] = Organization({
            name: name,
            admin: admin,
            createdAt: block.timestamp,
            exists: true
        });

        emit OrganizationRegistered(orgId, name, admin);
    }

    /**
     * @notice Update the admin of an existing organization.
     * @param orgId The organization ID to update.
     * @param newAdmin The new admin address. Must not be zero.
     */
    function updateOrgAdmin(
        uint256 orgId,
        address newAdmin
    ) external onlyOrgAdmin(orgId) {
        if (newAdmin == address(0)) revert ZeroAddress();

        address oldAdmin = _organizations[orgId].admin;
        _organizations[orgId].admin = newAdmin;

        emit OrgAdminUpdated(orgId, oldAdmin, newAdmin);
    }

    /**
     * @notice Query an organization by ID.
     * @param orgId The organization ID.
     * @return name The organization name.
     * @return admin The current admin address.
     * @return createdAt The registration timestamp.
     */
    function getOrganization(
        uint256 orgId
    ) external view returns (string memory name, address admin, uint256 createdAt) {
        if (orgId == 0 || orgId > orgCount) revert InvalidOrgId();
        Organization storage org = _organizations[orgId];
        return (org.name, org.admin, org.createdAt);
    }

    // =========================================================================
    // ELECTION FUNCTIONS
    // =========================================================================

    /**
     * @notice Register a new election under an organization.
     * @param orgId The parent organization ID.
     * @param contractAddress The deployed election contract address.
     * @param title The election title.
     * @return electionId The newly assigned election ID.
     */
    function registerElection(
        uint256 orgId,
        address contractAddress,
        string calldata title
    ) external onlyOrgAdmin(orgId) returns (uint256 electionId) {
        if (contractAddress == address(0)) revert ZeroAddress();
        if (bytes(title).length == 0) revert EmptyName();
        if (_electionIdByContract[contractAddress] != 0) revert ElectionAlreadyRegistered();

        electionCount++;
        electionId = electionCount;

        _elections[electionId] = ElectionRecord({
            orgId: orgId,
            contractAddress: contractAddress,
            title: title,
            registeredAt: block.timestamp,
            exists: true
        });

        _electionIdByContract[contractAddress] = electionId;

        emit ElectionRegistered(electionId, orgId, contractAddress, title);
    }

    /**
     * @notice Query an election by ID.
     * @param electionId The election ID.
     * @return orgId The parent organization ID.
     * @return contractAddress The election contract address.
     * @return title The election title.
     * @return registeredAt The registration timestamp.
     */
    function getElection(
        uint256 electionId
    )
        external
        view
        returns (
            uint256 orgId,
            address contractAddress,
            string memory title,
            uint256 registeredAt
        )
    {
        if (electionId == 0 || electionId > electionCount) revert InvalidElectionId();
        ElectionRecord storage e = _elections[electionId];
        return (e.orgId, e.contractAddress, e.title, e.registeredAt);
    }

    /**
     * @notice Reverse lookup: find an election ID by its contract address.
     * @param contractAddress The election contract address.
     * @return electionId The election ID (0 if not found).
     */
    function getElectionIdByContract(
        address contractAddress
    ) external view returns (uint256 electionId) {
        return _electionIdByContract[contractAddress];
    }
}
