# VotEth 2.0 — Complete Setup & Run Guide

> This guide walks you through every step to get VotEth 2.0 running locally, from zero to a fully operational blockchain voting platform. No prior session context is assumed.

---

## Prerequisites Checklist

Before touching any code, confirm you have everything installed:

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Node.js | v20+ | `node --version` |
| npm | v10+ | `npm --version` |
| Git | Any recent | `git --version` |
| MetaMask | Latest browser extension | Install from [metamask.io](https://metamask.io) |

You will also need **free accounts** on:
- [Supabase](https://supabase.com) — the backend database & auth
- [Alchemy](https://alchemy.com) — the blockchain RPC provider
- [Polygonscan](https://polygonscan.com) — for contract verification (optional but recommended)

---

## Part 1 — Clone & Install Dependencies

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/voteth-2.0.git
cd voteth-2.0
```

### Step 2 — Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Step 3 — Install Smart Contract Dependencies

```bash
cd contracts
npm install
cd ..
```

> ⚠️ **Important:** The `frontend/` and `contracts/` workspaces each have their own `package.json`. You must run `npm install` in **both** directories separately.

---

## Part 2 — Supabase Backend Setup

### Step 4 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Fill in:
   - **Project name**: `voteth-2`
   - **Database password**: choose a strong password and **save it** — you'll need it
   - **Region**: pick the one closest to you
4. Click **Create new project** and wait ~2 minutes for provisioning.

### Step 5 — Collect Your Supabase Keys

Once your project is ready:

1. In the left sidebar, go to **Project Settings → API**.
2. You will see two values you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public key** — a long JWT string under "Project API keys"
3. Copy both. You will use them in Step 9.

> 🔒 **Security:** The `anon` key is safe to use in the frontend. Never use the `service_role` key in the browser.

### Step 6 — Run Database Migrations

The schema (tables, RLS policies, indexes) is defined in migration files inside `supabase/migrations/`.

**Option A — Using the Supabase CLI (recommended):**

```bash
# Install the CLI globally if you haven't
npm install -g supabase

# Log in to your Supabase account
supabase login

# Link this project to your remote Supabase project
# (your project ref is the ID in your project URL, e.g. "abcdefgh")
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations to your remote database
supabase db push
```

**Option B — Manual via SQL Editor:**

1. In the Supabase dashboard, go to **SQL Editor**.
2. Open each file in `supabase/migrations/` in order (they are numbered/timestamped).
3. Paste the content into the SQL Editor and click **Run** for each one.

### Step 7 — Configure Authentication Providers

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. **Email** is enabled by default — leave it on.
3. (Optional) Enable **Google OAuth**:
   - Toggle Google on.
   - You'll need a Google Cloud OAuth 2.0 Client ID and Secret.
   - Set the redirect URL shown in Supabase as an Authorised Redirect URI in Google Cloud Console.
4. (Optional) Enable **GitHub OAuth** the same way.

### Step 8 — Set Up Storage Buckets

1. In the Supabase dashboard, go to **Storage**.
2. Create the following buckets (click **New bucket** for each):

   | Bucket Name | Public? |
   |------------|---------|
   | `candidate-photos` | ✅ Yes |
   | `candidate-documents` | ❌ No (private) |
   | `campaign-media` | ✅ Yes |
   | `org-assets` | ✅ Yes |

3. For private buckets, access is controlled via RLS policies already set in the migrations.

---

## Part 3 — Environment Variables

### Step 9 — Create `frontend/.env.local`

In the `frontend/` directory, create a file named `.env.local`:

```env
# --- Supabase (required) ---
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# --- Blockchain (required for on-chain voting) ---
VITE_POLYGON_AMOY_RPC=https://polygon-amoy.g.alchemy.com/v2/your-alchemy-key
VITE_REGISTRY_CONTRACT_ADDRESS=
VITE_ELECTION_CONTRACT_ADDRESS=
VITE_VERIFIER_CONTRACT_ADDRESS=
```

> ℹ️ **Note:** Leave the three contract address fields blank for now. You will fill them in after deploying contracts in Part 5.

### Step 10 — Create `contracts/.env.local`

In the `contracts/` directory, create a file named `.env.local`:

```env
# Your deployer wallet private key (must have Amoy testnet MATIC)
PRIVATE_KEY=your-wallet-private-key-here

# Alchemy RPC API key
ALCHEMY_API_KEY=your-alchemy-api-key-here

# Polygonscan API key (for contract verification — get free at polygonscan.com)
POLYGONSCAN_API_KEY=your-polygonscan-api-key-here
```

> 🔒 **CRITICAL:** Never commit `.env.local` to Git. It contains your private key. Verify `.gitignore` lists `*.env.local` before proceeding.

---

## Part 4 — MetaMask & Polygon Amoy Configuration

### Step 11 — Install MetaMask

1. Go to [metamask.io/download](https://metamask.io/download/).
2. Install the browser extension for Chrome, Firefox, or Brave.
3. Create a new wallet (or import an existing one).
4. **Copy your wallet address** — you will need it to get test MATIC.

### Step 12 — Add Polygon Amoy Testnet to MetaMask

MetaMask does not include Amoy by default. Add it manually:

1. Open MetaMask → click the network selector at the top → **Add network**.
2. Click **Add a network manually**.
3. Fill in the following:

   | Field | Value |
   |-------|-------|
   | **Network Name** | Polygon Amoy Testnet |
   | **New RPC URL** | `https://rpc-amoy.polygon.technology` |
   | **Chain ID** | `80002` |
   | **Currency Symbol** | `MATIC` |
   | **Block Explorer URL** | `https://amoy.polygonscan.com` |

4. Click **Save** and then switch to this network.

### Step 13 — Get Free Test MATIC

Your wallet needs test MATIC to pay for gas when deploying contracts and casting on-chain votes.

1. Go to the **Polygon Faucet**: [faucet.polygon.technology](https://faucet.polygon.technology)
2. Select **Amoy** network.
3. Paste your MetaMask wallet address.
4. Request MATIC (you may need to sign in with Discord or Twitter to pass the spam filter).
5. Wait ~30 seconds. Check your MetaMask balance — you should see test MATIC appear.

> ℹ️ **Alternative faucet:** [alchemy.com/faucets/polygon-amoy](https://www.alchemy.com/faucets/polygon-amoy) — requires a free Alchemy account.

---

## Part 5 — Smart Contract Compilation & Deployment

### Step 14 — Get an Alchemy API Key

1. Go to [alchemy.com](https://alchemy.com) and sign up for a free account.
2. Click **Create App**.
3. Fill in:
   - **Name**: `VotEth 2.0`
   - **Network**: `Polygon Amoy`
4. Once created, click **View Key** and copy the API key.
5. Paste it into `contracts/.env.local` as `ALCHEMY_API_KEY`.

### Step 15 — Compile the Smart Contracts

```bash
cd contracts
npx hardhat compile
```

Expected output:
```
Compiled 3 Solidity files successfully
```

If you see errors, check that:
- You are in the `contracts/` directory
- `npm install` was run in this directory
- The Solidity version in `hardhat.config.ts` matches the `pragma` in your `.sol` files (should be `^0.8.20`)

### Step 16 — Run the Contract Test Suite

Before deploying, verify all tests pass:

```bash
npx hardhat test
```

Expected output:
```
  VotEthRegistry
    ✓ deploys with correct owner
    ✓ registers an organization
    ✓ reverts if unauthorized
    ...

  VotEthElection
    ✓ lifecycle: DRAFT → OPEN → CLOSED → PUBLISHED
    ✓ prevents double voting
    ...

  VotEthVerifier
    ✓ verifies vote hash
    ✓ computes Merkle root
    ...

  X passing (Xs)
```

### Step 17 — Deploy Contracts to Polygon Amoy

```bash
npx hardhat ignition deploy ignition/modules/VotEthDeploy.ts --network amoy
```

> ℹ️ **If using a legacy deploy script instead of Ignition:**
> ```bash
> npx hardhat run scripts/deploy.ts --network amoy
> ```

After deployment, the terminal will print three contract addresses. Copy them:

```
VotEthRegistry deployed to:  0xAAAA...
VotEthElection deployed to:  0xBBBB...
VotEthVerifier deployed to:  0xCCCC...
```

### Step 18 — Update Frontend Environment Variables

Open `frontend/.env.local` and fill in the addresses from Step 17:

```env
VITE_REGISTRY_CONTRACT_ADDRESS=0xAAAA...
VITE_ELECTION_CONTRACT_ADDRESS=0xBBBB...
VITE_VERIFIER_CONTRACT_ADDRESS=0xCCCC...
```

### Step 19 — (Optional) Verify Contracts on Polygonscan

Contract verification makes your source code publicly visible on the block explorer — important for a portfolio project.

```bash
npx hardhat verify --network amoy 0xAAAA... # VotEthRegistry
npx hardhat verify --network amoy 0xBBBB... # VotEthElection
npx hardhat verify --network amoy 0xCCCC... # VotEthVerifier
```

> ℹ️ This requires `POLYGONSCAN_API_KEY` to be set in `contracts/.env.local`.

After verification, you can view the contracts at:
`https://amoy.polygonscan.com/address/0xAAAA...#code`

---

## Part 6 — Running the Frontend

### Step 20 — Start the Development Server

```bash
cd frontend
npm run dev
```

The terminal will show:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Part 7 — First-Time Account Setup

### Step 21 — Register a Web2 Account (Email Auth)

1. On the landing page, click **Get Started** or **Sign Up**.
2. Enter your email and a password.
3. Check your email inbox for a **confirmation link** from Supabase.
4. Click the link to verify your email.
5. Return to the app and log in.

> ℹ️ For local development, you can disable email confirmation in Supabase: **Authentication → Email → "Confirm email"** toggle → Off.

### Step 22 — Create Your First Organization

1. After logging in, you will be prompted to create or join an organization.
2. Click **Create Organization**.
3. Fill in:
   - **Name**: e.g., `Student Union 2026`
   - **Slug**: e.g., `student-union-2026` (URL-safe identifier)
4. Click **Create**.
5. You are now the **Organization Admin** for this org.

### Step 23 — Connect Your MetaMask Wallet (Web3 Auth)

Wallet connection is needed to cast on-chain votes and deploy elections.

1. Navigate to your **Profile / Settings** page, or look for a **Connect Wallet** button in the dashboard.
2. Click **Connect Wallet**.
3. MetaMask will open and ask for permission — click **Connect**.
4. The app will check your network:
   - If you are on the wrong network, a prompt will appear: **"Switch to Polygon Amoy Testnet"** — click it.
   - MetaMask will ask to switch — approve it.
5. Your wallet address (e.g., `0x1234...abcd`) will now appear in the UI as connected.

---

## Part 8 — Using the Platform

### Step 24 — Create an Election (Admin)

1. From the admin dashboard, click **New Election**.
2. Fill in:
   - **Title**: e.g., `Student President 2026`
   - **Description**: optional
   - **Start Date / End Date**: set the window
   - **Election Type**: Single Choice or Multi-Choice
   - **Max Votes Per Voter**: typically `1`
3. Click **Create Election** — it will be created in **DRAFT** state.

### Step 25 — Add Candidates (Admin)

1. Open your election from the dashboard.
2. Go to the **Candidates** tab.
3. Click **Add Candidate** and fill in name, bio, and photo.
4. The candidate status starts as **Pending**.
5. Click **Approve** to move them to the ballot.

### Step 26 — Add Voters to the Allowlist (Admin)

1. In the election, go to the **Voters** tab.
2. Click **Invite Members** — enter email addresses of eligible voters.
3. Invited users receive an email to join the organization and gain eligibility.
4. You can also bulk-add from existing org members.

### Step 27 — Open the Election (Admin)

1. Once candidates are approved and voters are allowlisted, go to the election dashboard.
2. Click **Open Election**.
3. The state changes from **DRAFT → OPEN**.
4. Voters can now cast their votes.

### Step 28 — Cast a Vote (Voter)

1. Log in as an eligible voter.
2. From the voter dashboard, you will see open elections.
3. Click on the election to enter the **Voting Ballot**.
4. Select your candidate(s).
5. Click **Cast Vote**.
6. A confirmation modal appears — review your selection.
7. Click **Confirm Vote**.
8. If wallet voting is enabled, MetaMask opens to sign the transaction — approve it.
9. Wait for blockchain confirmation (~5–15 seconds on Amoy).
10. A **Vote Receipt** is displayed showing:
    - Your vote hash
    - Blockchain transaction ID
    - Timestamp
    - Confirmation status

### Step 29 — Close & Publish Results (Admin)

1. When the election period ends (or manually), click **Close Election**.
2. State changes to **CLOSED**.
3. Review the final tally and on-chain verification indicators.
4. Click **Publish Results** to move to **PUBLISHED** state.
5. Results are now visible to all eligible voters.

---

## Part 9 — Verification & Troubleshooting

### TypeScript Strict Mode Check

```bash
cd frontend
npx tsc --noEmit
```

Should complete with no errors.

### Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `VITE_SUPABASE_URL` not found | Missing `.env.local` | Create `frontend/.env.local` with your keys |
| Login redirects to blank page | Email not confirmed | Disable email confirmation in Supabase Auth settings (dev mode) |
| MetaMask shows wrong network | Not on Polygon Amoy | Follow Step 12 to add and switch to Amoy |
| Contract deploy fails: "insufficient funds" | No test MATIC | Return to Step 13 and use the faucet |
| `npx hardhat compile` fails | Wrong Solidity version | Check `hardhat.config.ts` compiler version matches `.sol` pragma |
| Supabase auth error 400 | Anon key wrong or expired | Re-copy key from Supabase → Project Settings → API |
| Votes not appearing on-chain | Contract addresses not updated | Fill in `VITE_*_CONTRACT_ADDRESS` in `frontend/.env.local` after deploy |
| RLS permission denied | User not in org or allowlist | Ensure the voter is added to the election's allowlist (Step 26) |

---

## Quick Reference — All Commands

```bash
# ─── Install ───────────────────────────────────────
cd frontend && npm install && cd ..
cd contracts && npm install && cd ..

# ─── Supabase ──────────────────────────────────────
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# ─── Contracts ─────────────────────────────────────
cd contracts
npx hardhat compile
npx hardhat test
npx hardhat ignition deploy ignition/modules/VotEthDeploy.ts --network amoy
npx hardhat verify --network amoy <CONTRACT_ADDRESS>

# ─── Frontend ──────────────────────────────────────
cd frontend
npm run dev              # development server → localhost:5173
npx tsc --noEmit         # TypeScript strict check
npm run build            # production build
npm run preview          # preview production build locally
```

---

## Environment Variable Reference

### `frontend/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key |
| `VITE_POLYGON_AMOY_RPC` | ✅ | Alchemy RPC URL for Polygon Amoy |
| `VITE_REGISTRY_CONTRACT_ADDRESS` | ✅ (after deploy) | Deployed VotEthRegistry address |
| `VITE_ELECTION_CONTRACT_ADDRESS` | ✅ (after deploy) | Deployed VotEthElection address |
| `VITE_VERIFIER_CONTRACT_ADDRESS` | ✅ (after deploy) | Deployed VotEthVerifier address |

### `contracts/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | ✅ | Deployer wallet private key (must hold Amoy MATIC) |
| `ALCHEMY_API_KEY` | ✅ | Alchemy project API key |
| `POLYGONSCAN_API_KEY` | Optional | For source verification on explorer |

---

## Deployment Order Summary

```
Step 1–3   →  Clone & install npm packages
Step 4–8   →  Set up Supabase project, schema, auth, storage
Step 9–10  →  Create .env.local files
Step 11–13 →  Set up MetaMask + Polygon Amoy + get test MATIC
Step 14    →  Get Alchemy API key
Step 15–16 →  Compile contracts + run tests
Step 17    →  Deploy contracts to Polygon Amoy
Step 18–19 →  Update .env with addresses + verify on Polygonscan
Step 20    →  Start the frontend dev server
Step 21–23 →  Register user, create org, connect wallet
Step 24–29 →  Full election workflow (create → open → vote → publish)
```

---

*Guide version: 2.0.0 | Last updated: June 2026*
