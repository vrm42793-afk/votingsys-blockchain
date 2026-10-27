import { useState } from "react";
import { ethers } from "ethers";

export default function Wallet() {
  const [account, setAccount] = useState("");

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not installed");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
  }

  return (
    <div style={{ padding: "10px" }}>
      <button onClick={connectWallet}>
        Connect Wallet
      </button>

      {account && (
        <p>Connected: {account}</p>
      )}
    </div>
  );
}