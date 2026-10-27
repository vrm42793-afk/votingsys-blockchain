import { ethers } from "ethers";
import abi from "./abi/Voting.json";
import { CONTRACT_ADDRESS } from "./config";

export const getContract = async () => {
  if (!window.ethereum) {
    alert("Install MetaMask");
    return;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    abi.abi,
    signer
  );

  return contract;
};