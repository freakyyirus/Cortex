import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";
import {
  PLATFORM_FEE,
  SOLANA_NATIVE_SYMBOL,
  getPlatformWalletAddress,
  getSolanaNetwork,
} from "@/app/lib/blockchain/config";
import { getParsedTransactionWithRetry, findSolTransferTo } from "@/app/lib/blockchain/solana";

const FEE_LAMPORTS = Math.round(Number(PLATFORM_FEE) * LAMPORTS_PER_SOL);

/** Solana transaction signatures are 64 bytes → 87–88 base58 chars. */
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * Solana x402 receipt check.
 *
 * The client calls POST /api/bounties without a payment signature → the server
 * answers 402 + paymentDetails (send PLATFORM_FEE SOL to the platform wallet).
 * The client pays from a connected Solana wallet, then re-posts with the
 * `x-payment-signature` header. This route verifies the parsed on-chain
 * transfer (recipient, amount, status) BEFORE the bounty row is created.
 */
export async function POST(req: NextRequest) {
  try {
    const paymentSignature = req.headers.get("x-payment-signature");
    const chainName = getSolanaNetwork();
    const chainId = chainName === "mainnet" ? "mainnet-beta" : chainName;
    const PLATFORM_WALLET = getPlatformWalletAddress();

    // 1. x402 Check: no signature → 402 with payment details.
    if (!paymentSignature) {
      console.log("[x402] Payment required for bounty creation (Solana)");
      return NextResponse.json(
        {
          error: "Payment Required",
          code: "PAYMENT_REQUIRED",
          hint: `Send ${PLATFORM_FEE} ${SOLANA_NATIVE_SYMBOL} on Solana (${chainName}) to the platform wallet, then repeat the request with the x-payment-signature header.`,
          paymentDetails: {
            address: PLATFORM_WALLET,
            amount: PLATFORM_FEE,
            currency: SOLANA_NATIVE_SYMBOL,
            chainId,
            chainName,
          },
        },
        { status: 402 },
      );
    }

    // 2. Sanitize the signature early.
    if (!SIGNATURE_RE.test(paymentSignature)) {
      return NextResponse.json(
        {
          error: "Invalid transaction signature",
          code: "INVALID_PAYMENT_HASH",
          hint: "x-payment-signature must be a base58 Solana transaction signature (87–88 chars).",
        },
        { status: 400 },
      );
    }

    // 3. Fetch the parsed tx (retry/backoff). RPC down → 503.
    let tx;
    try {
      tx = await getParsedTransactionWithRetry(paymentSignature);
    } catch (err) {
      const known = err as { code?: number; message?: string };
      console.error(
        `[x402] RPC unavailable while verifying ${paymentSignature}:`,
        known.message || (err instanceof Error ? err.message : err),
      );
      return NextResponse.json(
        {
          error: "RPC unavailable. Please try again.",
          code: "RPC_UNAVAILABLE",
          hint: "Solana RPC could not be reached while verifying your payment. Try again in a few seconds.",
        },
        { status: 503 },
      );
    }

    if (!tx) {
      console.error("[x402] Transaction not found:", paymentSignature);
      return NextResponse.json(
        {
          error: "Transaction not found",
          code: "TX_NOT_FOUND",
          hint: "No confirmed transaction found on Solana for this signature yet.",
          hash: paymentSignature,
        },
        { status: 400 },
      );
    }

    if (tx.meta?.err) {
      console.error("[x402] Payment tx reverted/failed:", paymentSignature, tx.meta.err);
      return NextResponse.json(
        {
          error: "Payment transaction failed",
          code: "TX_REVERTED",
          hint: "The on-chain transaction was reverted. Send a fresh SOL transfer to the platform wallet and verify again.",
        },
        { status: 400 },
      );
    }

    // 4. Recipient must be the platform wallet.
    const transfer = findSolTransferTo(tx, PLATFORM_WALLET);
    if (!transfer) {
      console.error(`[x402] Invalid recipient. Expected ${PLATFORM_WALLET}, no SOL transfer found`);
      return NextResponse.json(
        {
          error: "Invalid payment recipient",
          code: "BAD_RECIPIENT",
          hint: `The payment must be a SOL transfer to the platform wallet (${PLATFORM_WALLET}).`,
        },
        { status: 400 },
      );
    }

    if (transfer.lamports < FEE_LAMPORTS) {
      console.error(`[x402] Insufficient amount. Expected ${FEE_LAMPORTS}, got ${transfer.lamports}`);
      return NextResponse.json(
        {
          error: "Insufficient payment amount",
          code: "LOW_AMOUNT",
          hint: `Expected at least ${PLATFORM_FEE} ${SOLANA_NATIVE_SYMBOL}. Sent ${(transfer.lamports / LAMPORTS_PER_SOL).toFixed(9)} ${SOLANA_NATIVE_SYMBOL}.`,
        },
        { status: 400 },
      );
    }

    // 5. Parse & validate bounty.
    const body = await req.json();
    const { title, description, prize, creatorAddress, userId } = body;
    if (!title || !description || !prize || !creatorAddress) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "title, description, prize and creatorAddress are required." },
        { status: 400 },
      );
    }

    // 6. Create bounty.
    try {
      const newBounty = await db.createBounty({
        title,
        description,
        prize,
        creatorAddress,
        userId,
      });
      console.log("[x402] Bounty created successfully:", newBounty.id, "tx:", paymentSignature);
      return NextResponse.json(newBounty, { status: 200 });
    } catch (dbErr) {
      const decorated = decorateSupabaseError(dbErr);
      console.error("[x402] DB create error:", decorated);
      const code = (decorated as { code?: string }).code;
      const hint = (decorated as { hint?: string }).hint;

      // Compensating action: the platform fee was received on-chain but the
      // bounty row failed to persist. Keep the record so it can be reconciled.
      try {
        await db.savePendingBounty({
          title,
          description,
          prize,
          creatorAddress,
          userId,
          txHash: paymentSignature,
        });
        console.log(`[x402] PAID-BUT-NOT-SAVED — recorded in pending_bounties (tx ${paymentSignature})`);
      } catch (pendingErr) {
        console.error("[x402] PAID-BUT-NOT-SAVED — pending_bounties insert failed, full fields:", {
          title,
          description,
          prize,
          creator_address: creatorAddress,
          user_id: userId,
          tx_hash: paymentSignature,
          pending_error: String(pendingErr),
        });
      }

      return NextResponse.json(
        { error: "Could not save bounty. Payment was received, contact support if this persists.", code, hint },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[x402] Bounty creation error (outer):", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR", hint: undefined },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const bounties = await db.getBounties();
    return NextResponse.json(bounties);
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("GET /api/bounties error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Could not load bounties.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}