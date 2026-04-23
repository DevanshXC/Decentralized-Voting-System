import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import VotingArtifact from './contracts/Voting.json';
import contractAddress from './contracts/contract-address.json';
import './App.css';

const LOCAL_RPC = "http://127.0.0.1:8545";

/* ── Helpers ─────────────────────────────── */
const resolveIPFS = (uri) => {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://dweb.link/ipfs/'); // Faster and more reliable gateway
  }
  // Prepend https if the user forgot it, unless it's a data URI
  if (!uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('data:')) {
    return 'https://' + uri;
  }
  return uri;
};

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const hashColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

async function uploadToIPFS(file) {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) {
    throw new Error('VITE_PINATA_JWT not set in .env');
  }
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Pinata upload failed');
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

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
  activity: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeLinecap="round"/></svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
};

/* ── CandidateCard Component ─────────────── */
function CandidateCard({ candidate, totalVotes, onVote, onEdit, loading, isAdmin, isVotingPhase }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const pct = totalVotes > 0 ? (parseInt(candidate.voteCount) / totalVotes) * 100 : 0;
  const hasImage = candidate.imageURI && candidate.imageURI.length > 0;
  const hasLogo = candidate.partyLogoURI && candidate.partyLogoURI.length > 0;

  return (
    <div className="candidate-card">
      {/* Photo container */}
      <div className="candidate-photo-container">
        {hasImage && !imgFailed ? (
          <img
            className="candidate-photo"
            src={resolveIPFS(candidate.imageURI)}
            alt={candidate.name}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={(e) => {
              console.warn('Candidate photo failed to load:', resolveIPFS(candidate.imageURI));
              setImgFailed(true);
            }}
          />
        ) : (
          <div
            className="candidate-initials"
            style={{ backgroundColor: hashColor(candidate.name) }}
          >
            {getInitials(candidate.name)}
          </div>
        )}

        {/* Party logo overlay */}
        <div className="party-logo-badge">
          {hasLogo && !logoFailed ? (
            <img
              className="party-logo-img"
              src={resolveIPFS(candidate.partyLogoURI)}
              alt={candidate.partyName || 'Party'}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(e) => {
                console.warn('Party logo failed to load:', resolveIPFS(candidate.partyLogoURI));
                setLogoFailed(true);
              }}
            />
          ) : (
            <div className="party-logo-fallback">
              {I.shield}
            </div>
          )}
        </div>
      </div>

      {/* Name & Party */}
      <h3 className="candidate-card-name">{candidate.name}</h3>
      {candidate.partyName && (
        <span className="candidate-party-name">{candidate.partyName}</span>
      )}

      {/* Vote count + bar */}
      <div className="candidate-card-stats">
        <span className="vote-count-badge">{candidate.voteCount} vote{candidate.voteCount !== '1' ? 's' : ''}</span>
        <div className="bar-track card-bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Vote & Edit buttons */}
      <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: 'auto' }}>
        {isAdmin && !isVotingPhase && (
          <button
            onClick={() => onEdit(candidate)}
            disabled={loading}
            className="btn btn-ghost"
            style={{ width: 'auto', padding: '10px 16px' }}
          >
            Edit
          </button>
        )}
        {isVotingPhase && (
          <button
            onClick={() => onVote(candidate.id)}
            disabled={loading}
            className="btn btn-vote card-vote-btn"
            style={{ flex: 1 }}
          >
            Cast Vote
          </button>
        )}
      </div>
    </div>
  );
}

/* ── ImageUploadField Component ──────────── */
function ImageUploadField({ label, value, onChange, icon }) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    try {
      setUploading(true);
      const uri = await uploadToIPFS(file);
      onChange(uri);
    } catch {
      // Pinata not configured — compress via canvas to avoid exceeding gas limits, then use Base64
      const img = document.createElement("img");
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 100;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          onChange(canvas.toDataURL("image/jpeg", 0.4)); // Compress significantly to save gas
        };
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-upload-field">
      <label className="image-upload-label">
        {icon}
        <span>{label}</span>
      </label>
      <div className="image-upload-row">
        <input
          type="text"
          className="input"
          placeholder="ipfs://... or https://..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setPreview(null);
          }}
        />
        <label className="btn btn-ghost upload-btn">
          {uploading ? <div className="spinner" /> : I.upload}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {(preview || value) && (
        <div className="image-preview">
          <img
            src={preview || resolveIPFS(value)}
            alt="Preview"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('voting-theme') || 'dark';
  });
  const [account, setAccount] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('voting-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const [candidates, setCandidates] = useState([]);
  const [contract, setContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newImageURI, setNewImageURI] = useState('');
  const [newPartyLogoURI, setNewPartyLogoURI] = useState('');
  const [votingStart, setVotingStart] = useState(0);
  const [startDuration, setStartDuration] = useState('1000');
  const [resetDuration, setResetDuration] = useState('1000');
  const [updateDuration, setUpdateDuration] = useState('1000');
  const [demoAccountIndex, setDemoAccountIndex] = useState(0);
  const [voteEvents, setVoteEvents] = useState([]);

  useEffect(() => {
    if (contract && account) {
      checkAdmin();
      loadCandidates();
      loadEvents();
      loadElectionState();

      const onVoted = (voter, candidateId, event) => {
        loadCandidates(); // Refresh candidates on vote
        setVoteEvents((prev) => [
          { 
            voter, 
            candidateId: candidateId.toString(), 
            txHash: event.log ? event.log.transactionHash : "0x..." 
          },
          ...prev
        ]);
      };

      contract.on("Voted", onVoted);

      return () => {
        contract.off("Voted", onVoted);
      };
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

  const loadElectionState = async () => {
    try {
      const vStart = await contract.votingStart();
      setVotingStart(Number(vStart));
    } catch (err) {
      console.error("Error loading election state:", err);
    }
  };

  const loadCandidates = async () => {
    try {
      const data = await contract.getCandidates();
      const parsed = data.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        partyName: c.partyName || '',
        imageURI: c.imageURI || '',
        partyLogoURI: c.partyLogoURI || '',
        voteCount: c.voteCount.toString(),
      }));
      setCandidates(parsed);
    } catch (err) {
      console.error("Error loading candidates:", err);
    }
  };

  const loadEvents = async () => {
    try {
      const pastEvents = await contract.queryFilter("Voted");
      const parsedEvents = pastEvents.map((event) => ({
        voter: event.args[0],
        candidateId: event.args[1].toString(),
        txHash: event.transactionHash
      }));
      setVoteEvents(parsedEvents.reverse());
    } catch (err) {
      console.error("Error loading events:", err);
    }
  };

  const addCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidateName) return;
    setLoading(true);
    try {
      const tx = await contract.addCandidate(
        newCandidateName,
        newPartyName,
        newImageURI,
        newPartyLogoURI
      );
      await tx.wait();
      setNewCandidateName('');
      setNewPartyName('');
      setNewImageURI('');
      setNewPartyLogoURI('');
      loadCandidates();
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const submitEditCandidate = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;
    setLoading(true);
    try {
      const tx = await contract.editCandidate(
        editingCandidate.id,
        editingCandidate.name,
        editingCandidate.partyName || "",
        editingCandidate.imageURI || "",
        editingCandidate.partyLogoURI || ""
      );
      await tx.wait();
      setEditingCandidate(null);
      loadCandidates();
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const startElection = async (e) => {
    e.preventDefault();
    if (!startDuration) return;
    setLoading(true);
    try {
      const tx = await contract.startElection(parseInt(startDuration));
      await tx.wait();
      loadElectionState();
    } catch (err) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const resetElection = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tx = await contract.resetElection();
      await tx.wait();
      setWinner(null);
      loadCandidates();
      loadElectionState();
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

  const formatAddress = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "");

  /* ── Render ─────────────────────────────── */
  return (
    <>
      <div className="scene">
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
      </div>

      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? I.sun : I.moon}
      </button>

      {/* Floating Notifications */}
      <div className="notifications-area">
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
      </div>

      <div className="app-shell">
        <div className={`app-container ${account ? 'dashboard-layout' : ''}`}>

          {/* ── Not Connected (Centered) ────── */}
          {!account ? (
            <div className="solo-wrapper">
              <div className="header motion-item">
                <div className="header-badge">
                  <span className="dot" />
                  Ethereum Blockchain
                </div>
                <h1>Decentralized Voting</h1>
                <p className="tagline">Transparent · Immutable · Trustless</p>
              </div>

              <div className="card connect-card motion-item" style={{ animationDelay: '0.1s' }}>
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
            </div>
          ) : (
            <>
              {/* ── Left Sidebar (Desktop) ──── */}
              <div className="sidebar">
                <div className="header motion-item" style={{ textAlign: "left", padding: "0 0 10px 0" }}>
                  <div className="header-badge">
                    <span className="dot" />
                    Ethereum Mainnet
                  </div>
                  <h1 style={{ fontSize: "1.75rem" }}>Decentralized Voting</h1>
                  <p className="tagline">Transparent · Immutable</p>
                </div>

                <div className="card motion-item" style={{ animationDelay: '0.1s' }}>
                  <div className="card-header">
                    <span className="card-label">Network Status</span>
                    <div className="status-chip">
                      <div className="status-dot" />
                      <span className="status-addr">{formatAddress(account)}</span>
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

                {isAdmin && votingStart === 0 && (
                  <div className="card motion-item" style={{ animationDelay: '0.15s' }}>
                    <div className="card-header">
                      <span className="card-label">Admin Controls</span>
                      <span className="badge badge-restricted">Registration</span>
                    </div>

                    {/* ── Add Candidate Form ── */}
                    <form onSubmit={addCandidate} className="admin-form">
                      <div className="form-row">
                        <input
                          type="text"
                          className="input"
                          placeholder="Candidate name *"
                          value={newCandidateName}
                          onChange={(e) => setNewCandidateName(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <input
                          type="text"
                          className="input"
                          placeholder="Party name"
                          value={newPartyName}
                          onChange={(e) => setNewPartyName(e.target.value)}
                        />
                      </div>

                      <ImageUploadField
                        label="Candidate Photo"
                        icon={I.image}
                        value={newImageURI}
                        onChange={setNewImageURI}
                      />

                      <ImageUploadField
                        label="Party Logo"
                        icon={I.shield}
                        value={newPartyLogoURI}
                        onChange={setNewPartyLogoURI}
                      />

                      <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                        Register Candidate
                      </button>
                    </form>

                  </div>
                )}
              </div>

              {/* ── Right Column (Main View) ── */}
              <div className="main-content">
                {votingStart === 0 && (
                  <div className="card motion-item" style={{ background: 'var(--accent-dim)', borderColor: 'rgba(139, 92, 246, 0.3)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '-8px' }}>
                     <span style={{ display: 'flex', width: '24px', height: '24px', flexShrink: 0, color: 'var(--accent)' }}>{I.activity}</span> 
                     <span><strong>Registration Phase Active:</strong> You can add and edit candidates. Voting will open once the Admin starts the election.</span>
                  </div>
                )}
                <div className="card motion-item" style={{ animationDelay: '0.2s', padding: '32px' }}>
                  <div className="card-header">
                    <span className="card-label" style={{ fontSize: '0.85rem' }}>{I.users} Election Roster</span>
                    <span className="card-label" style={{ color: 'var(--text-secondary)' }}>
                      Total Turnout: {totalVotes} vote{totalVotes !== 1 && 's'}
                    </span>
                  </div>

                  {candidates.length === 0 ? (
                    <div className="empty">
                      {I.box}
                      <p>The ballot is currently empty. Wait for admin registration.</p>
                    </div>
                  ) : (
                    <div className="candidates-card-grid">
                      {candidates.map((c) => (
                        <CandidateCard
                          key={c.id}
                          candidate={c}
                          totalVotes={totalVotes}
                          onVote={vote}
                          onEdit={setEditingCandidate}
                          loading={loading}
                          isAdmin={isAdmin}
                          isVotingPhase={votingStart > 0}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '24px' }}>
                    <button onClick={getWinner} className="btn btn-reveal text-center w-full" style={{ padding: '16px' }}>
                      {I.trophy} Reveal Official Winner
                    </button>

                    {winner && (
                      <div className="winner-reveal">
                        <svg className="trophy-icon" viewBox="0 0 24 24" fill="none">
                          <path d="M8 21h8M12 17v4M7 4h10M5 4h14a1 1 0 011 1v3c0 4.418-3.582 8-8 8S4 12.418 4 8V5a1 1 0 011-1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <h3>{winner.name}</h3>
                        <p>Secured the election with {winner.voteCount} recorded votes.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Live Activity Event Feed ── */}
                <div className="card motion-item" style={{ animationDelay: '0.25s' }}>
                  <div className="card-header">
                    <span className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{color: 'var(--emerald)'}}>{I.activity}</span> Live Vote Tracking
                    </span>
                    <span className="status-dot"></span>
                  </div>

                  {voteEvents.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                      Listening to the blockchain for new cast votes...
                    </p>
                  ) : (
                    <div className="event-feed">
                      {voteEvents.map((ev, i) => {
                        const candidate = candidates.find(c => c.id === ev.candidateId);
                        const assignedName = candidate ? candidate.name : `Candidate ${ev.candidateId}`;
                        return (
                          <div className="event-item" key={i + ev.txHash}>
                            <div className="event-avatar">{I.shield}</div>
                            <div className="event-content">
                              <span className="event-voter">{formatAddress(ev.voter)}</span> 
                              {" "}voted for{" "}
                              <span className="event-candidate">{assignedName}</span>
                            </div>
                            <a 
                              href={`https://etherscan.io/tx/${ev.txHash}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="event-tx"
                              title="View hypothetical Tx on Etherscan"
                            >
                              Tx
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="card motion-item" style={{ animationDelay: '0.3s' }}>
                    <div className="card-header">
                      <span className="card-label">Election Timeline</span>
                      <span className="badge badge-restricted">Admin Control</span>
                    </div>

                    <div style={{ padding: '0 20px 20px 20px' }}>
                      {votingStart === 0 ? (
                        <div style={{ paddingBottom: '8px' }}>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                            <strong>Start Election:</strong> Ready to open the polls? Enter the duration and lock in the candidates.
                          </p>
                          <form onSubmit={startElection} className="form-row">
                            <input
                              type="number" className="input" placeholder="Duration (min)" value={startDuration}
                              onChange={(e) => setStartDuration(e.target.value)} min="1"
                            />
                            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: "0 14px", whiteSpace: "nowrap" }}>
                              Start Election
                            </button>
                          </form>
                        </div>
                      ) : (
                        <>
                          <div style={{ paddingBottom: '8px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                              <strong>Update Duration:</strong> Extend or shorten the current election deadline.
                            </p>
                            <form onSubmit={changeDuration} className="form-row">
                              <input type="number" className="input" placeholder="Duration (min)" value={updateDuration} onChange={(e) => setUpdateDuration(e.target.value)} min="1" />
                              <button type="submit" disabled={loading} className="btn btn-emerald" style={{ padding: "0 14px", whiteSpace: "nowrap" }}>Update</button>
                            </form>
                          </div>
                          <div className="form-divider" style={{ margin: '16px 0' }} />
                          <div style={{ paddingBottom: '8px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                              <strong>Reset Election:</strong> Clear everything and enter a new Registration Phase.
                            </p>
                            <form onSubmit={resetElection} className="form-row">
                              <button type="submit" disabled={loading} className="btn btn-danger" style={{ width: '100%' }}>Reset Entire Election</button>
                            </form>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editingCandidate && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '30px', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <span className="card-label">Edit Candidate #{editingCandidate.id}</span>
              <button 
                className="btn btn-ghost" 
                onClick={() => setEditingCandidate(null)}
                style={{ padding: '4px 10px' }}
              >✕</button>
            </div>
            
            <form onSubmit={submitEditCandidate} className="admin-form">
              <div className="form-row">
                <input
                  type="text" className="input" placeholder="Candidate name *"
                  value={editingCandidate.name}
                  onChange={(e) => setEditingCandidate({...editingCandidate, name: e.target.value})}
                />
              </div>
              <div className="form-row">
                <input
                  type="text" className="input" placeholder="Party name"
                  value={editingCandidate.partyName}
                  onChange={(e) => setEditingCandidate({...editingCandidate, partyName: e.target.value})}
                />
              </div>

              <ImageUploadField
                label="Candidate Photo" icon={I.image}
                value={editingCandidate.imageURI}
                onChange={(uri) => setEditingCandidate({...editingCandidate, imageURI: uri})}
              />

              <ImageUploadField
                label="Party Logo" icon={I.shield}
                value={editingCandidate.partyLogoURI}
                onChange={(uri) => setEditingCandidate({...editingCandidate, partyLogoURI: uri})}
              />

              <div style={{ height: '10px' }} />

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
