/**
 * Client-safe Solana payout helpers (bounty creation x402 + winner pay).
 *
 * Everything on Solana: fees and payouts are native SOL transfers verified
 * on-chain with TransactionSignatures. There's no chain-switching step — the
 * connected Solana wallet pays through the adapter and the server re-checks
 * the transfer with getParsedTransaction before recording anything.
 */

import { getSolanaRpcUrl } from "@/app/lib/blockchain/config";

/** Explorer link for a Solana transaction signature, honoring the app cluster. */
export function getSolanaTxExplorerUrl(signature: string): string {
  const rpc = getSolanaRpcUrl();
  const cluster = rpc.includes("devnet")
    ? "?cluster=devnet"
    : rpc.includes("testnet")
      ? "?cluster=testnet"
      : rpc.includes("mainnet")
        ? ""
        : "?cluster=custom";
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

/** Explorer link for a Solana address, honoring the app cluster. */
export function getSolanaAddressExplorerUrl(address: string): string {
  const rpc = getSolanaRpcUrl();
  const cluster = rpc.includes("devnet")
    ? "?cluster=devnet"
    : rpc.includes("testnet")
      ? "?cluster=testnet"
      : rpc.includes("mainnet")
        ? ""
        : "?cluster=custom";
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

/**
 * Loose client-side shape check for a Solana base58 transaction signature
 * (64 bytes → 87–88 base58 chars). The server does the authoritative check.
 */
export function signatureLooksValid(signature: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}