export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";
import { SOLANA_NATIVE_SYMBOL, getSolanaNetwork } from "@/app/lib/blockchain/config";
import { getParsedTransactionWithRetry, findSolTransferTo, solAmountToLamports } from "@/app/lib/blockchain/solana";

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * Marks a bounty as PAID after a winner payout.
 *
 * The client sends the payout tx `signature`; this route verifies the on-chain
 * SOL transfer BEFORE recording it: recipient must be the winning submission's
 * hunter address and the amount must cover the bounty prize. If verification
 * fails the status is NOT flipped. Winner payouts are wallet-to-wallet on
 * Solana — the server never holds prize custody.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, submissionId, signature } = body;

    if (!bountyId || !submissionId) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "bountyId, submissionId and signature are required." },
        { status: 400 },
      );
    }

    if (!signature || !SIGNATURE_RE.test(String(signature))) {
      return NextResponse.json(
        {
          error: "Missing or invalid payout signature",
          code: "MISSING_PAYOUT_TX",
          hint: "Send the Solana transaction signature returned by your wallet so it can be verified on-chain.",
        },
        { status: 400 },
      );
    }

    // Load the bounty and the winning submission to know what to verify against.
    let bounty;
    try {
      bounty = await db.getBounty(bountyId);
    } catch (err) {
      const decorated = decorateSupabaseError(err);
      return NextResponse.json(
        { error: "Could not load bounty.", code: (decorated as { code?: string }).code, hint: (decorated as { hint?: string }).hint },
        { status: 500 },
      );
    }
    if (!bounty) {
      return NextResponse.json(
        { error: "Bounty not found", code: "BOUNTY_NOT_FOUND", hint: "Check the bounty id." },
        { status: 404 },
      );
    }

    const winningSubmission = (bounty.submissions || []).find((s: { id: string }) => s.id === submissionId);
    if (!winningSubmission) {
      return NextResponse.json(
        { error: "Submission not found on bounty", code: "SUBMISSION_NOT_FOUND", hint: "Check the submission id." },
        { status: 404 },
      );
    }

    const expectedRecipient = winningSubmission.hunterAddress;

    // 1. Fetch the parsed tx (with retry/backoff). RPC down → 503.
    let tx;
    try {
      tx = await getParsedTransactionWithRetry(signature);
    } catch (err) {
      const known = err as { code?: number; message?: string };
      console.error("[payout] RPC unavailable while verifying:", signature, known.message || (err instanceof Error ? err.message : err));
      return NextResponse.json(
        {
          error: "RPC unavailable. Please try again.",
          code: "RPC_UNAVAILABLE",
          hint: `Solana RPC (${getSolanaNetwork()}) could not be reached while verifying the payout.`,
        },
        { status: 503 },
      );
    }

    if (!tx) {
      console.error("[payout] Transaction not found:", signature);
      return NextResponse.json(
        { error: "Transaction not found", code: "TX_NOT_FOUND", hint: "No confirmed transaction found on Solana for the payout signature.", signature },
        { status: 400 },
      );
    }

    if (tx.meta?.err) {
      console.error("[payout] Payout tx reverted/failed:", signature, tx.meta.err);
      return NextResponse.json(
        {
          error: "Payout transaction failed",
          code: "TX_REVERTED",
          hint: "The on-chain payout was reverted. Please send the prize to the hunter again.",
        },
        { status: 400 },
      );
    }

    // 2. Recipient must be the winning submission's hunter.
    const transfer = findSolTransferTo(tx, expectedRecipient);
    if (!transfer) {
      console.error(`[payout] Invalid recipient. Expected ${expectedRecipient}, no SOL transfer found`);
      return NextResponse.json(
        {
          error: "Invalid payout recipient",
          code: "BAD_RECIPIENT",
          hint: `The payout must be a SOL transfer to the winning submission's hunter address (${expectedRecipient}).`,
        },
        { status: 400 },
      );
    }

    // 3. Amount must cover the prize.
    let prizeLamports: number;
    try {
      prizeLamports = solAmountToLamports(String(bounty.prize));
    } catch {
      prizeLamports = 0;
    }
    if (transfer.lamports < prizeLamports) {
      console.error(`[payout] Insufficient amount. Expected >= ${prizeLamports}, got ${transfer.lamports}`);
      return NextResponse.json(
        {
          error: "Insufficient payout amount",
          code: "LOW_AMOUNT",
          hint: `Expected at least ${bounty.prize} ${SOLANA_NATIVE_SYMBOL}. Sent ${(transfer.lamports / LAMPORTS_PER_SOL).toFixed(9)} ${SOLANA_NATIVE_SYMBOL}.`,
        },
        { status: 400 },
      );
    }

    // 4. Verified — now record it.
    try {
      await db.markPaid(bountyId, submissionId);
    } catch (dbErr) {
      const decorated = decorateSupabaseError(dbErr);
      console.error("Payout DB error (payout tx verified, status NOT flipped):", decorated, "tx:", signature);
      const code = (decorated as { code?: string }).code;
      const hint = (decorated as { hint?: string }).hint;
      return NextResponse.json(
        { error: "Payout verified on-chain but could not be recorded. Contact support if this persists.", code, hint },
        { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
      );
    }

    console.log(`[payout] Bounty ${bountyId} marked PAID, tx ${signature}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Payout error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Failed to record payout.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}