<p align="center">
  <img src="https://img.shields.io/badge/Chain-Solana%20devnet-16A34A" alt="Solana devnet" />
  <img src="https://img.shields.io/badge/Protocol-x402-7C3AED" alt="x402" />
  <img src="https://img.shields.io/badge/Framework-Next.js%2014-000000" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-violet" alt="Gemini 2.5 Flash" />
  <img src="https://img.shields.io/badge/Auth-Privy%20%2B%20Phantom%2FSolflare-6366f1" alt="Privy + Solana wallets" />
  <img src="https://img.shields.io/badge/Checks-tsc%20%C2%B7%20lint%20%C2%B7%20build-green" alt="tsc · lint · build" />
</p>

# MonQuest — Solana-native, AI-judged bounty marketplace

**Post a technical bounty. Hunters submit markdown + screenshots. Gemini writes the review. The winner is paid on-chain — and every step that costs money is verified on Solana before it counts.**

A payments app first: bounty creation runs through the **x402** micro-payment protocol (a 0.001 SOL platform fee, verified on-chain), and winner payouts are validated against the winning submission before a bounty ever flips to `PAID`.

> **What is x402?** An HTTP payment protocol: a server replies `402 Payment Required` plus machine-readable payment details, the client pays in native crypto, then re-requests with the transaction signature as proof. No API keys, no credit cards — settlement happens on the chain you're already on (here: **Solana**).

### Three things that make MonQuest different

- **Solana-native settlement** — a 0.001 SOL platform fee gates bounty creation via x402; every fee and payout tx is re-checked on-chain (`getParsedTransaction`, recipient + amount + status) before the server records it.
- **AI-judged submissions** — creators run one-click audits where **Gemini 2.5 Flash** streams a ranked top-3 with per-submission feedback, and screenshots embedded in submissions are fed into the evaluation.
- **Real wallet UX** — authenticate with email (Privy), then connect **Phantom, Solflare, or Backpack** straight from the app. Your SOL powers the fee and the prize — signed in your wallet, no custodian in between. No network-switching guesswork.

---

## How it works

```mermaid
flowchart LR
  A["Sign in · Privy (email) + connect Solana wallet"] --> B["Create bounty form"]
  B --> C["POST /api/bounties → HTTP 402 + payment details"]
  C --> D["Send 0.001 SOL to platform wallet"]
  D --> E["Re-POST with x-payment-signature · verify on Solana"]
  E --> F["Bounty OPEN"]
  F --> G["Hunters submit markdown + images"]
  G --> H["Creator runs AI audit · Gemini streams top-3"]
  H --> I["Creator pays winner on Solana"]
  I --> J["POST /api/bounties/payout · verify recipient & amount"]
  J --> K["Bounty PAID"]
```

In one breath:

1. **Sign in** — Privy SSO (email or wallet) identifies you; no embedded-wallet plumbing needed.
2. **Post a bounty** — the server returns an x402 challenge; connect a Solana wallet, pay **0.001 SOL** to the platform wallet from your UI, and the bounty goes live as soon as the transfer is confirmed.
3. **Hunters submit** — markdown descriptions with optional images, reviewed live with a markdown preview.
4. **Get judged & paid** — the creator runs an AI audit (Gemini streams a top-3 with feedback), picks a winner, and pays them wallet-to-wallet. The payout is verified on-chain before the bounty becomes `PAID`.

---

## Screenshots

<!-- TODO: capture — drop 4 PNGs in public/screenshots/ and delete this line -->

| | |
|---|---|
| `screenshots/landing.png` — hero landing: value prop, live stats, CTAs | `screenshots/bounties.png` — bounty registry list with prize + status pills |
| `screenshots/bounty-detail-ai-review.png` — detail page mid AI-audit with ranked top-3 + feedback | `screenshots/create-pay.png` — create flow showing the x402 wallet-panel (address, amount, tx state machine) |

> **TODO: capture** — each slot above is an image you must shoot on a running instance (see Quickstart). Replace the table with an `<img>` grid and delete this note.

---

## Quickstart

> Recommended: Node.js 18+, a Privy project, a Supabase project, and a Google AI Studio API key. Foundry (`anvil`) is used by the local demo scripts. A Phantom/Solflare/Backpack wallet with devnet SOL is enough to run the pay flows end-to-end.

```bash
git clone <your-repo-url> && cd Monquest
npm install
cp .env.example .env.local
```

### Required environment variables

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | yes | Privy dashboard → your app → **Keys** (starts with `pub_`) |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | no | same screen (starts with `client_`); used only when present |
| `NEXT_PUBLIC_PLATFORM_WALLET` | yes | your own **Solana** address (base58) — where the 0.001 SOL fee is sent; unset → a devnet placeholder |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → **Project Settings → API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same screen → **anon public key** |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | same screen → **service_role** key (**server-only**, never `NEXT_PUBLIC_`) |
| `GOOGLE_GEMINI_API_KEY` | yes | Google AI Studio → **Get API key** |
| `SOLANA_RPC_URL` | no | optional RPC override; defaults to Solana devnet (`https://api.devnet.solana.com`) |

The server validates the six required vars at boot (`app/lib/env.ts`) and throws a descriptive `MissingEnvError` with the names of whatever is missing.

### 1. Database — Supabase SQL Editor

Open your Supabase project → **SQL Editor**, then run the migrations **in order**:

1. `supabase/migrations/001_schema.sql` — `bounties` + `submissions` tables, RLS policies, public `media` storage bucket
2. `supabase/migrations/002_user_id.sql` — `user_id` on bounties/submissions, optional `users` table
3. `supabase/migrations/003_ai_review.sql` — `is_ai_selected` + `ai_feedback` on submissions
4. `supabase/migrations/004_winner.sql` — `winner_submission_id` on bounties
5. `supabase/migrations/005_pending_bounties.sql` — reconciliation table for paid-but-unsaved bounties

See [`supabase/README.md`](supabase/README.md) for details and a `supabase db push` alternative.

### 2. Run & fund

```bash
npm run dev        # → http://localhost:3000
```

The app points at **Solana devnet** out of the box. Fund a devnet wallet via the [Solana faucet](https://faucet.solana.com) (or `npm run demo:solana` to self-airdrop), connect it in the app, and the fee + payout flows work immediately. Every tx in the UI links to the [Solana explorer](https://explorer.solana.com) at the active cluster. To switch clusters to mainnet, set `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com` and restart.

---

## Demo scripts

All demos run from the repo root with `tsx` and read `.env.local` via `dotenv`.

| Command | What it does | Prerequisites |
|---------|--------------|---------------|
| `npm run demo` | EVM demo (local anvil default) **then** Solana demo | anvil for the EVM half; see `--local` note |
| `npm run demo:evm` | balance → send 0.001 ETH → optional contract reads (`get()`/`totalSupply`) | anvil on `:8545` (default) **or** `EVM_RPC_URL`/`EVM_CHAIN_ID`/`PRIVATE_KEY` |
| `npm run demo:solana` | devnet: airdrop 2 SOL → balance → send SOL | none (self-funds on devnet; `SOLANA_PRIVATE_KEY` optional); gracefully skips the send if the airdrop is rate-limited |
| `npm run chain:local` | starts **anvil** (`:8545`, chainId 31337) + **solana-test-validator** (`:8899`), PIDs in `.chain-pids` | Foundry (anvil) + Solana CLI (validator) |
| `npm run chain:stop` | stops what `chain:local` started | — |

Expected EVM output: deployer `0xf39F…`, `balance : 9999.99… ETH`, `sent 0.001 ETH → tx 0x…`, then `SimpleStorage.0xe7f1… get() = 42` and `MonQuestToken.0x9fE4… totalSupply = 1000000 MQ` (only if you deployed contracts first — see below).

> **Note on `--local`:** `npm run demo -- --local` points *both* halves at the local validators. It completes fully only when both anvil **and** `solana-test-validator` are running; on a machine with Foundry but no Solana CLI, the EVM half passes and the Solana half fails on the missing validator.

---

## Smart contracts & programs

Both are **bonus surfaces** — the core Solana bounty flow needs neither one.

### `contracts/` — Hardhat (Solidity 0.8.24)

- **`MonQuestToken`** — ERC-20 `MQ` (18 decimals, initial supply 1,000,000), only-owner mint.
- **`SimpleStorage`** — set/get with an updater record; deployed with initial value `42`.

```bash
npm run contracts:test      # → 9 passing (MonQuestToken + SimpleStorage)
npm run contracts:deploy    # root shortcut for `cd contracts && npm run deploy`
cd contracts && npm run deploy:local      # target the running anvil (+ `deploy:sepolia` for testnet)
```

Deployed addresses are written to `contracts/deployments.json`, keyed by chainId — `npm run demo:evm` reads it for its optional contract step. Deploy **to the same anvil you're demoing against** for those reads to resolve.

### `solana-program/` — Anchor (Rust)

A minimal **permissioned counter** program (`monquest-counter`, anchor-lang 0.30) with a client-side IDL walkthrough — `initialize` sets the authority, `increment` bumps the count (authority only). Requires the Rust + Solana CLI toolchain:

```bash
cd solana-program && npm install
anchor build && anchor test      # or: npm run build / npm run test
```

See its [own README](solana-program/README.md) for prerequisites, program ID, and instruction docs.

---

## Architecture

```
Browser (Next.js 14 · App Router · TS)
│  PrivyProvider (auth) → SolanaWalletProvider (Phantom / Solflare / Backpack)
│  home · create · bounties/[id] · profile  pages · ui/ design-system components
▼
/app/api ──────────────────────────────────────────────────────────┐
  POST /api/bounties           x402: 402→pay→verify (@solana/web3.js) │
  POST /api/bounties/payout    verify winner tx before PAID          │
  POST /api/ai-review          Gemini 2.5 Flash stream → top-3       │
  GET  /api/bounties[/id]      bounty reads                          │
  GET  /api/blockchain/balances  EVM · SOL · BTC (bonus surface)     │
                                                                     ▼
                                                    Supabase (PostgreSQL)
                                                    bounties · submissions
                                                    users · pending_bounties
```

| Module | Role |
|--------|------|
| `app/components/solana/SolanaWalletProvider.tsx` | wallet-adapter provider (Phantom/Solflare/Backpack, devnet by default) |
| `app/hooks/useSolanaWallet.ts` | `useSolanaWallet()` — connect, balances, `sendSol`, wallet picker |
| `app/api/bounties/route.ts` | x402 payment gate + on-chain verification (recipient, amount, status) |
| `app/api/bounties/payout/route.ts` | winner-payout verification before `markPaid` |
| `app/api/ai-review/route.ts` | Gemini 2.5 Flash content stream + ranked top-3 persistence |
| `app/lib/db.ts` | Supabase client (anon) + admin (service role) + typed queries |
| `app/lib/blockchain/config.ts` | chain config; `PLATFORM_FEE = 0.001` SOL; Solana devnet default |
| `app/lib/blockchain/solana.ts` | balances, sends, `getParsedTransactionWithRetry`, transfer parsing |
| `app/lib/blockchain/{evm,btc}.ts` | EVM/BTC read/send helpers (bonus surface) |

---

## Error handling & reliability

Payments route through a small, deliberate error taxonomy — every API returns `{ error, code, hint? }` and the client surfaces code + hint instead of raw server text.

| Code | HTTP | Meaning |
|------|------|---------|
| `PAYMENT_REQUIRED` | 402 | no payment signature — response body *is* the payment challenge (`paymentDetails`) |
| `TX_NOT_FOUND` | 400 | signature not confirmed on-chain yet — retry with the same signature |
| `LOW_AMOUNT` / `BAD_RECIPIENT` | 400 | transfer lamports below fee/prize, or wrong recipient |
| `TX_REVERTED` | 400 | transaction executed but failed on-chain (`meta.err` set) |
| `RPC_UNAVAILABLE` | 503 | Solana RPC unreachable — **retried with backoff first** (3 attempts, 500 → 1250 ms) |
| `INVALID_PAYMENT_HASH` | 400 | signature didn't match the base58 Solana shape (87–88 chars) |
| `SUPABASE_MIGRATIONS_REQUIRED` | 503 | schema guard (`42P01`) wired to a human-readable "run the migrations" hint (dev-only) |
| `MISSING_*` | 400 | request-shape validation (fields, signature format) |

Also enforced: **boot-time env validation** (`app/lib/env.ts`, throws `MissingEnvError` naming every absent var), a client payment state machine that auto-retries once on a slow confirmation, and a `paid-but-not-saved` reconciliation path that parks a verified payment in `pending_bounties` if the DB insert ever fails.

---

## Roadmap & known limitations

Deliberate MVP choices, stated plainly:

- **Winner payout is client-initiated** — the browser sends the SOL payout from its wallet, then the server verifies the transfer on-chain (recipient = winner's `hunter_address`, lamports ≥ prize, `meta.err` null) before flipping `PAID`. The server never holds prize custody; this is wallet-to-wallet, not escrow.
- **Client payments key off the connected Solana wallet** — if a user is signed in (Privy) but hasn't connected Phantom/Solflare/Backpack, the app prompts for the wallet at pay-time. There is no embedded custodian.
- **Supabase RLS is read-permissive (dev posture)** — rows are readable anonymously to keep the registry community-visible. Tighten the storage/auth policies before a public production deploy.
- **Bonus surfaces are exactly that** — EVM/BTC balances and the Hardhat/Anchor projects extend the product but are *not* inputs to the bounty flow; the app's live payment path is exercised on **Solana devnet**, not mainnet.
- **Live-chain smoke is pending** — the x402 and payout code paths are implemented and built-gated, but a faucet-funded end-to-end run on devnet requires a wallet you control (steps in Quickstart).

---

## Contributing

Issues and PRs welcome. Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` (all three are enforced, not decorative) before opening a PR.

## Credits

Built with **Solana · Privy · Supabase · Gemini**. View transactions on the [Solana explorer](https://explorer.solana.com).

## License

**TBD** — no `LICENSE` file yet. Add one (MIT is a sensible default for a hackathon project) before publishing publicly.