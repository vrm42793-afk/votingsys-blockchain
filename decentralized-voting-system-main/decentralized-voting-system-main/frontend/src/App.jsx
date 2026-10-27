import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Voter from "./pages/Voter";
import KYC from "./pages/KYC";
import Results from "./pages/Results";

function App() {
  return (
    <BrowserRouter>
      <div style={{ textAlign: "center" }}>
        <h1>Decentralized Voting System</h1>

        <nav style={{ marginBottom: "20px" }}>
          <Link to="/">Home</Link> |{" "}
          <Link to="/admin">Admin</Link> |{" "}
          <Link to="/kyc">KYC</Link> |{" "}
          <Link to="/vote">Vote</Link> |{" "}
          <Link to="/results">Results</Link>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/kyc" element={<KYC />} />
          <Route path="/vote" element={<Voter />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;