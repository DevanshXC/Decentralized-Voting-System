// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    mapping(uint => Candidate) public candidates;
    uint public electionRound;
    mapping(uint => mapping(address => bool)) public voters;

    uint public candidateCount;
    address public admin;
    uint public votingStart;
    uint public votingEnd;

    event Voted(address indexed voter, uint indexed candidateId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    modifier votingActive() {
        require(block.timestamp >= votingStart && block.timestamp <= votingEnd, "Voting is not active");
        _;
    }

    constructor(uint _durationInMinutes) {
        admin = msg.sender;
        electionRound = 1;
        votingStart = block.timestamp;
        votingEnd = block.timestamp + (_durationInMinutes * 1 minutes);
    }

    function addCandidate(string memory _name) public onlyAdmin {
        candidateCount++;
        candidates[candidateCount] = Candidate(candidateCount, _name, 0);
    }

    function vote(uint _candidateId) public votingActive {
        // Require that they haven't voted before
        require(!voters[electionRound][msg.sender], "You have already voted");
        // Require a valid candidate
        require(_candidateId > 0 && _candidateId <= candidateCount, "Invalid candidate ID");

        // Record that voter has voted
        voters[electionRound][msg.sender] = true;

        // Update candidate vote count
        candidates[_candidateId].voteCount++;

        // Trigger voted event
        emit Voted(msg.sender, _candidateId);
    }

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

    function resetElection(uint _durationInMinutes) public onlyAdmin {
        electionRound++;
        candidateCount = 0;
        votingStart = block.timestamp;
        votingEnd = block.timestamp + (_durationInMinutes * 1 minutes);
    }

    function updateVotingEnd(uint _newDurationInMinutes) public onlyAdmin {
        votingEnd = votingStart + (_newDurationInMinutes * 1 minutes);
    }
}
