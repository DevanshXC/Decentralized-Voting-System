import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  console.log("Fast-forwarding blockchain time...");
  
  // Increase time by 1001 minutes (60060 seconds)
  await provider.send("evm_increaseTime", [60060]);
  
  // Mine a new block so the blockchain timestamp updates
  await provider.send("evm_mine", []);
  
  console.log("Fast-forwarded Hardhat blockchain by over 1000 minutes!");
  console.log("The voting period has now officially ended.");
}

main().catch(console.error);
