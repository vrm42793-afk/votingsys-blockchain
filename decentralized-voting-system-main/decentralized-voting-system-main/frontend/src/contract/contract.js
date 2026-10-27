import { ethers } from "ethers";
import Voting from "./Voting.json";
import { CONTRACT_ADDRESS } from "./config";

export const getContract = async () => {
  if (!window.ethereum) {
    alert("Please install MetaMask");
    return;
  }

  await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  const provider = new ethers.BrowserProvider(
    window.ethereum
  );

  const signer = await provider.getSigner();

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    Voting.abi,
    signer
  );

  return contract;
};