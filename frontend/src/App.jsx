import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import VotingArtifact from './contracts/Voting.json';
import contractAddress from './contracts/contract-address.json';
import './App.css';

const LOCAL_RPC = "http://127.0.0.1:8545";

/* ── Minimal SVG Icons ──────────────────── */
const I = {
  wallet: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor"/><circle cx="17" cy="12" r="1" fill="currentColor"/></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeLinejoin="round"/></svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="currentColor"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke="currentColor"/><circle cx="19" cy="7" r="3" stroke="currentColor"/><path d="M22 21v-1a3 3 0 00-3-3" stroke="currentColor"/></svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M8 21h8M12 17v4M7 4h10M5 4h14a1 1 0 011 1v3c0 4.418-3.582 8-8 8S4 12.418 4 8V5a1 1 0 011-1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor"/><path d="M12 8v4" stroke="currentColor" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" stroke="currentColor" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" stroke="currentColor" strokeLinejoin="round"/></svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor"/><path d="M9 9h6M9 13h4" stroke="currentColor" strokeLinecap="round"/></svg>
  ),
};

function App() {
  const [account, setAccount] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [contract, setContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [resetDuration, setResetDuration] = useState('1000');
  const [updateDuration, setUpdateDuration] = useState('1000');
  const [demoAccountIndex, setDemoAccountIndex] = useState(0);

  useEffect(() => {
    if (contract && account) {
      checkAdmin();
      loadCandidates();
    }
  }, [contract, account]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        const signer = await provider.getSigner();
        const votingContract = new ethers.Contract(contractAddress.Voting, VotingArtifact.abi, signer);
        setContract(votingContract);
        setDemoMode(false);
        setError('');
      } catch (err) {
        setError('Error connecting to MetaMask');
        console.error(err);
      }
    } else {
      setError('MetaMask not detected. Use Local Mode instead.');
    }
  };

  const connectDemoMode = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(LOCAL_RPC);
      const signer = await provider.getSigner(0);
      const address = await signer.getAddress();
      setAccount(address);
      const votingContract = new ethers.Contract(contractAddress.Voting, VotingArtifact.abi, signer);
      setContract(votingContract);
      setDemoMode(true);
      setDemoAccountIndex(0);
      setError('');
    } catch (err) {
      setError('Cannot connect to Hardhat node. Run "npx hardhat node".');
      console.error(err);
    }
  };

  const switchDemoAccount = async (index) => {
    try {
      const provider = new ethers.JsonRpcProvider(LOCAL_RPC);
      const signer = await provider.getSigner(index);
      const address = await signer.getAddress();
      setAccount(address);
      setDemoAccountIndex(index);
      const votingContract = new ethers.Contract(contractAddress.Voting, VotingArtifact.abi, signer);
      setContract(votingContract);
      setError('');
    } catch (err) {
      setError('Error switching account');
    }
  };

  const checkAdmin = async () => {
    try {
      const adminAddress = await contract.admin();
      setIsAdmin(adminAddress.toLowerCase() === account.toLowerCase());
    } catch (err) {
      console.error("Error checking admin:", err);
    }
  };

  const loadCandidates = async () => {
    try {
      const data = await contract.getCandidates();
      const parsed = data.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        voteCount: c.voteCount.toString(),
      }));
      setCandidates(parsed);
    } catch (err) {
      console.error("Error loading candidates:", err);
    }
  };

  const addCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidateName) return;
    setLoading(true);
    try {
      const tx = await contract.addCandidate(newCandidateName);
      await tx.wait();
      setNewCandidateName('');
      loadCandidates();
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const resetElection = async (e) => {
    e.preventDefault();
    if (!resetDuration) return;
    setLoading(true);
    try {
      const tx = await contract.resetElection(parseInt(resetDuration));
      await tx.wait();
      setWinner(null);
      loadCandidates();
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const changeDuration = async (e) => {
    e.preventDefault();
    if (!updateDuration) return;
    setLoading(true);
    try {
      const tx = await contract.updateVotingEnd(parseInt(updateDuration));
      await tx.wait();
      setError('Duration updated successfully');
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const vote = async (candidateId) => {
    setLoading(true);
    setError('');
    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();
      loadCandidates();
    } catch (err) {
      let msg = err.reason || 'Transaction failed';
      if (err.message?.includes('already voted')) msg = 'You have already voted';
      else if (err.message?.includes('not active')) msg = 'Voting is closed';
      setError(msg);
    }
    setLoading(false);
  };

  const getWinner = async () => {
    try {
      const w = await contract.getWinner();
      setWinner({ name: w.name, voteCount: w.voteCount.toString() });
    } catch (err) {
      setError(err.reason || 'Voting may still be active');
    }
  };

  const totalVotes = candidates.reduce((s, c) => s + parseInt(c.voteCount), 0);

  /* ── Render ─────────────────────────────── */
  return (
    <>
      {/* Animated background orbs */}
      <div className="scene">
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
      </div>

      <div className="app-shell">
        <div className="app-container">

          {/* Header */}
          <div className="header motion-item">
            <div className="header-badge">
              <span className="dot" />
              Ethereum Blockchain
            </div>
            <h1>Decentralized Voting</h1>
            <p className="tagline">Transparent · Immutable · Trustless</p>
          </div>

          {/* Toasts */}
          {error && (
            <div className="toast toast-error motion-item">
              {I.alert} <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="toast toast-loading motion-item">
              <div className="spinner" />
              <span>Processing on-chain transaction…</span>
            </div>
          )}

          {/* ── Not Connected ──────────────── */}
          {!account ? (
            <div className="card connect-card motion-item">
              <div className="connect-icon-ring">{I.wallet}</div>
              <h2>Connect Wallet</h2>
              <p className="connect-desc">
                Link your Web3 wallet to participate in decentralized, tamper-proof elections.
              </p>
              <div className="connect-buttons">
                <button className="btn btn-primary" onClick={connectWallet}>
                  Connect MetaMask
                </button>
                <div className="or-divider">or</div>
                <button className="btn btn-ghost" onClick={connectDemoMode}>
                  Local Demo Mode
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Network Status ─────────── */}
              <div className="card motion-item">
                <div className="card-header">
                  <span className="card-label">Network Status</span>
                  <div className="status-chip">
                    <div className="status-dot" />
                    <span className="status-addr">
                      {account.slice(0, 6)}…{account.slice(-4)}
                    </span>
                    {isAdmin && <span className="badge badge-admin">Admin</span>}
                  </div>
                </div>

                {demoMode && (
                  <div className="demo-bar">
                    {[0, 1, 2, 3].map((i) => (
                      <button
                        key={i}
                        onClick={() => switchDemoAccount(i)}
                        className={`demo-btn ${demoAccountIndex === i ? 'active' : ''}`}
                      >
                        {i === 0 ? 'Admin' : `Voter ${i}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Admin Panel ────────────── */}
              {isAdmin && (
                <div className="card motion-item">
                  <div className="card-header">
                    <span className="card-label">Admin Controls</span>
                    <span className="badge badge-restricted">Restricted</span>
                  </div>

                  <form onSubmit={addCandidate} className="form-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="Candidate name…"
                      value={newCandidateName}
                      onChange={(e) => setNewCandidateName(e.target.value)}
                    />
                    <button type="submit" disabled={loading} className="btn btn-primary">
                      Register
                    </button>
                  </form>

                  <div className="form-divider" />

                  <form onSubmit={changeDuration} className="form-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="Duration (min)"
                      value={updateDuration}
                      onChange={(e) => setUpdateDuration(e.target.value)}
                      min="1"
                    />
                    <button type="submit" disabled={loading} className="btn btn-emerald">
                      Update
                    </button>
                  </form>

                  <div className="form-divider" />

                  <form onSubmit={resetElection} className="form-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="New duration (min)"
                      value={resetDuration}
                      onChange={(e) => setResetDuration(e.target.value)}
                      min="1"
                    />
                    <button type="submit" disabled={loading} className="btn btn-danger">
                      Reset Election
                    </button>
                  </form>
                </div>
              )}

              {/* ── Candidates Roster ─────── */}
              <div className="card motion-item">
                <div className="card-header">
                  <span className="card-label">Election Roster</span>
                  <span className="card-label" style={{ color: 'var(--text-secondary)' }}>
                    {totalVotes} vote{totalVotes !== 1 && 's'}
                  </span>
                </div>

                {candidates.length === 0 ? (
                  <div className="empty">
                    {I.box}
                    <p>No candidates registered yet.</p>
                  </div>
                ) : (
                  <div className="candidates-grid">
                    {candidates.map((c, idx) => {
                      const pct = totalVotes > 0 ? (parseInt(c.voteCount) / totalVotes) * 100 : 0;
                      return (
                        <div key={c.id} className="candidate-row">
                          <div className="candidate-rank">{idx + 1}</div>
                          <div className="candidate-body">
                            <div className="candidate-top">
                              <span className="candidate-name">{c.name}</span>
                              <span className="candidate-count">{c.voteCount}</span>
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="candidate-action">
                            <button
                              onClick={() => vote(c.id)}
                              disabled={loading}
                              className="btn btn-vote"
                            >
                              Vote
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Winner ────────────────── */}
              <div className="card motion-item">
                <button onClick={getWinner} className="btn btn-reveal">
                  {I.trophy} Reveal Winner
                </button>

                {winner && (
                  <div className="winner-reveal">
                    <svg className="trophy-icon" viewBox="0 0 24 24" fill="none">
                      <path d="M8 21h8M12 17v4M7 4h10M5 4h14a1 1 0 011 1v3c0 4.418-3.582 8-8 8S4 12.418 4 8V5a1 1 0 011-1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h3>{winner.name}</h3>
                    <p>{winner.voteCount} votes — verified on-chain</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
