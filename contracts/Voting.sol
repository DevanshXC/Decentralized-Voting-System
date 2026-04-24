// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string partyName;
        string imageURI;
        string partyLogoURI;
        uint voteCount;
    }

    mapping(uint => Candidate) public candidates;
    uint public electionRound;

    // Tracks whether an address has voted in the current round
    mapping(uint => mapping(address => bool)) public voters;

    // ── TRANSPARENCY MODULE: stores each voter's candidate choice ──
    // Only the voter themselves can retrieve their own choice (via verifyMyVote)
    mapping(uint => mapping(address => uint)) public votedFor;

    uint public candidateCount;
    address public admin;
    uint public votingStart;
    uint public votingEnd;

    // Original event (kept for backward compatibility with existing frontend)
    event Voted(address indexed voter, uint indexed candidateId);

    // ── TRANSPARENCY MODULE: detailed event for blockchain proof ──
    // Emitted on every vote — enables independent verification via event logs
    event VoteCast(address indexed voter, uint indexed candidateId, uint timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    modifier votingActive() {
        require(votingStart > 0 && block.timestamp >= votingStart, "Election has not started");
        require(block.timestamp <= votingEnd, "Voting has ended");
        _;
    }

    modifier electionNotStarted() {
        require(votingStart == 0, "Election has already started");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionRound = 1;
        votingStart = 0;
        votingEnd = 0;
    }

    function addCandidate(
        string memory _name,
        string memory _partyName,
        string memory _imageURI,
        string memory _partyLogoURI
    ) public onlyAdmin electionNotStarted {
        candidateCount++;
        candidates[candidateCount] = Candidate(
            candidateCount,
            _name,
            _partyName,
            _imageURI,
            _partyLogoURI,
            0
        );
    }

    function editCandidate(
        uint _candidateId,
        string memory _name,
        string memory _partyName,
        string memory _imageURI,
        string memory _partyLogoURI
    ) public onlyAdmin electionNotStarted {
        require(_candidateId > 0 && _candidateId <= candidateCount, "Invalid candidate ID");
        candidates[_candidateId].name = _name;
        candidates[_candidateId].partyName = _partyName;
        candidates[_candidateId].imageURI = _imageURI;
        candidates[_candidateId].partyLogoURI = _partyLogoURI;
    }

    function vote(uint _candidateId) public votingActive {
        // Prevent double voting
        require(!voters[electionRound][msg.sender], "You have already voted");
        // Validate candidate ID
        require(_candidateId > 0 && _candidateId <= candidateCount, "Invalid candidate ID");

        // Record that voter has voted
        voters[electionRound][msg.sender] = true;

        // ── TRANSPARENCY MODULE: store which candidate the voter chose ──
        votedFor[electionRound][msg.sender] = _candidateId;

        // Update candidate vote count
        candidates[_candidateId].voteCount++;

        // Emit both events for full transparency and backward compatibility
        emit Voted(msg.sender, _candidateId);
        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }

    // ═══════════════════════════════════════════
    // TRANSPARENCY & VERIFIABILITY FUNCTIONS
    // ═══════════════════════════════════════════

    /// @notice Allows a voter to verify their own vote (privacy-preserving)
    /// @return The candidate ID the caller voted for (0 if not voted)
    function verifyMyVote() public view returns (uint) {
        require(voters[electionRound][msg.sender], "You have not voted yet");
        return votedFor[electionRound][msg.sender];
    }

    /// @notice Check if a specific address has voted in the current round
    /// @param _user The address to check
    /// @return true if the address has voted, false otherwise
    function checkIfVoted(address _user) public view returns (bool) {
        return voters[electionRound][_user];
    }

    /// @notice Get the total number of votes across all candidates (for audit)
    /// @return The sum of all candidate vote counts
    function getTotalVotes() public view returns (uint) {
        uint total = 0;
        for (uint i = 1; i <= candidateCount; i++) {
            total += candidates[i].voteCount;
        }
        return total;
    }

    // ═══════════════════════════════════════════
    // EXISTING ADMIN & QUERY FUNCTIONS
    // ═══════════════════════════════════════════

    function getCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory candidateArray = new Candidate[](candidateCount);
        for (uint i = 1; i <= candidateCount; i++) {
            candidateArray[i - 1] = candidates[i];
        }
        return candidateArray;
    }

    function getWinner() public view returns (Candidate memory) {
        require(block.timestamp > votingEnd, "Voting has not ended yet");
        require(candidateCount > 0, "No candidates available");

        uint highestVoteCount = 0;
        uint winningCandidateId = 1;

        for (uint i = 1; i <= candidateCount; i++) {
            if (candidates[i].voteCount > highestVoteCount) {
                highestVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }

        return candidates[winningCandidateId];
    }

    function startElection(uint _durationInMinutes) public onlyAdmin electionNotStarted {
        require(candidateCount > 0, "Must register at least one candidate");
        votingStart = block.timestamp;
        votingEnd = block.timestamp + (_durationInMinutes * 1 minutes);
    }

    function resetElection() public onlyAdmin {
        electionRound++;
        candidateCount = 0;
        votingStart = 0;
        votingEnd = 0;
    }

    function updateVotingEnd(uint _newDurationInMinutes) public onlyAdmin {
        require(votingStart > 0, "Election has not started");
        votingEnd = votingStart + (_newDurationInMinutes * 1 minutes);
    }
}
