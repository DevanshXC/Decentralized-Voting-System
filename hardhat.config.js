import "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000"; // Dummy fallback

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};

if (SEPOLIA_RPC_URL) {
  config.networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY],
  };
}

export default config;
