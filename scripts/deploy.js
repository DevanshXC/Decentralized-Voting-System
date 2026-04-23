import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const signer = await provider.getSigner(0);
  console.log("Deploying contract with account:", signer.address);

  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Voting.sol", "Voting.json");
  const artifactData = fs.readFileSync(artifactPath, "utf8");
  const artifact = JSON.parse(artifactData);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const voting = await factory.deploy();

  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log(`Voting contract deployed to: ${address}`);

  saveFrontendFiles(address, artifact);
}

function saveFrontendFiles(contractAddress, VotingArtifact) {
  const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");

  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendDir, "contract-address.json"),
    JSON.stringify({ Voting: contractAddress }, undefined, 2)
  );

  fs.writeFileSync(
    path.join(frontendDir, "Voting.json"),
    JSON.stringify(VotingArtifact, null, 2)
  );
  console.log("Artifacts saved to frontend/src/contracts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
