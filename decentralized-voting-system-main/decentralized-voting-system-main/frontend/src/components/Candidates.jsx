import { useEffect, useState } from "react";
import { ethers } from "ethers";
import VotingABI from "../abi/Voting.json";

const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [contract, setContract] = useState(null);

  // Connect to contract
  const loadContract = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        VotingABI.abi,
        signer
      );

      setContract(contractInstance);
    } catch (err) {
      console.error(err);
    }
  };

  // Load candidates
  const loadCandidates = async (contractInstance) => {
    try {
      const count = await contractInstance.candidatesCount();

      const list = [];

      for (let i = 1; i <= Number(count); i++) {
        const candidate = await contractInstance.candidates(i);
        list.push(candidate);
      }

      setCandidates(list);
    } catch (err) {
      console.error("Error loading candidates:", err);
    }
  };

  // Vote function
  const vote = async (candidateId) => {
    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();

      alert("Vote cast successfully!");

      await loadCandidates(contract);
    } catch (err) {
      console.error("Voting failed:", err);
      alert("Voting failed. Check console for details.");
    }
  };

  useEffect(() => {
    loadContract();
  }, []);

  useEffect(() => {
    if (contract) {
      loadCandidates(contract);
    }
  }, [contract]);

  return (
    <div>
      <h2>Candidates</h2>

      {candidates.length === 0 ? (
        <p>No candidates found</p>
      ) : (
        candidates.map((c) => (
          <div
            key={c.id.toString()}
            style={{
              border: "1px solid #ccc",
              margin: "10px",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            <h3>{c.name}</h3>

            <p>
              Votes: <strong>{c.voteCount.toString()}</strong>
            </p>

            <button
              onClick={() => vote(c.id)}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Vote
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default Candidates;