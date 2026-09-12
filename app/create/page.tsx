"use client";

import { useState, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Wallet,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { MarkdownEditor } from "@/app/components/MarkdownEditor";
import { useToast } from "@/app/components/ui/Toast";
import { ConnectWalletPrompt } from "@/app/components/WalletModal";
import Link from "next/link";
import { PLATFORM_FEE, SOLANA_NATIVE_SYMBOL, getPrizeCurrencySymbol } from "@/app/lib/blockchain/config";
import { getSolanaAddressExplorerUrl, getSolanaTxExplorerUrl, signatureLooksValid } from "@/app/lib/payout";
import { useSolanaWallet } from "@/app/hooks/useSolanaWallet";

/** Payment target returned by the server in its 402 body — single source of truth on the client. */
interface PaymentDetails {
  address: string;
  amount: string;
  currency: string;
  chainId: string;
  chainName?: string;
}

interface PaymentError {
  code?: string;
  message: string;
  hint?: string;
  /** When set, the "retry" button should re-submit the same tx signature. */
  reuseHash?: boolean;
}

type FlowState = "form" | "awaiting-payment" | "verifying" | "success";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isErrorLike(err: unknown): err is { message?: string; code?: number | string; name?: string } {
  return typeof err === "object" && err !== null;
}

export default function CreateBountyPage() {
  const { authenticated, login, ready, user } = usePrivy();
  const { connected, connecting, address: solanaAddress, selectWallet, nativeBalance, sendSol } = useSolanaWallet();
  const router = useRouter();
  const { toast } = useToast();
  const CURRENCY = getPrizeCurrencySymbol();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prize: "",
  });
  const [status, setStatus] = useState("");
  const [flow, setFlow] = useState<FlowState>("form");

  // x402 payment state
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [signature, setSignature] = useState("");
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const verifyInFlight = useRef(false);

  const solBalance = nativeBalance ? parseFloat(nativeBalance.balance) || 0 : 0;
  const hasEnoughFunds = connected && solBalance >= parseFloat(PLATFORM_FEE);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // ---- x402 state machine -------------------------------------------------

  /** Step 1: POST the bounty without a payment signature → get the 402 + paymentDetails. */
  const requestPaymentDetails = async () => {
    if (!solanaAddress || !ready || !user) return;
    setPaymentError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creatorAddress: solanaAddress,
          userId: user.id,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status !== 402) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Unexpected response: ${res.status}`);
      }
      const data = await res.json();
      const pd = data.paymentDetails as PaymentDetails;
      if (!pd?.address || !pd?.amount) {
        throw new Error("Invalid payment details from server: missing recipient address or amount.");
      }
      setPaymentDetails(pd);
      setSignature("");
      setFlow("awaiting-payment");
    } catch (error) {
      clearTimeout(timeoutId);
      if (isErrorLike(error) && error.name === "AbortError") {
        setPaymentError({ code: "TIMEOUT", message: "Request timed out. Please try again." });
      } else {
        setPaymentError({ message: isErrorLike(error) ? error.message || "Unknown error" : String(error) });
      }
      setFlow("form");
    }
  };

  /**
   * Step 2: POST with the x-payment-signature to verify the on-chain payment.
   * Never hangs: every attempt is bounded by a 30s timeout. TX_UNCONFIRMED is
   * auto-retried once (same signature) after 10s.
   */
  const verifyPayment = async (sig: string, autoRetriesLeft = 1) => {
    if (verifyInFlight.current || !solanaAddress) return;
    verifyInFlight.current = true;
    setPaymentError(null);
    setSignature(sig);
    setFlow("verifying");
    setStatus("Verifying on Solana…");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment-signature": sig,
        },
        body: JSON.stringify({
          ...formData,
          creatorAddress: solanaAddress,
          userId: user?.id,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const bounty = await res.json();
        setFlow("success");
        toast("Bounty created", "success");
        router.push(`/bounties/${bounty.id}`);
        return;
      }

      const errorData = await res.json().catch(() => ({}));
      const code: string | undefined = errorData?.code;

      // Auto-retry once for unconfirmed txs with the same signature.
      if (code === "TX_UNCONFIRMED" && autoRetriesLeft > 0) {
        setStatus("Transaction pending — re-checking in 10s…");
        await new Promise((r) => setTimeout(r, 10_000));
        verifyInFlight.current = false;
        await verifyPayment(sig, 0);
        return;
      }

      const mapError = (): PaymentError => {
        switch (code) {
          case "TX_NOT_FOUND":
            return {
              code,
              message: "Transaction not found on Solana yet.",
              hint: "Check the signature and wait for confirmation, then retry.",
              reuseHash: true,
            };
          case "TX_UNCONFIRMED":
            return {
              code,
              message: "Transaction is still pending.",
              hint: "Wait a moment, then retry with the same signature.",
              reuseHash: true,
            };
          case "LOW_AMOUNT":
            return {
              code,
              message: `You sent less than the required ${PLATFORM_FEE} ${SOLANA_NATIVE_SYMBOL}.`,
              hint: `${errorData?.hint || "Send the difference to the platform wallet and verify again."}`,
              reuseHash: false,
            };
          case "BAD_RECIPIENT":
            return {
              code,
              message: "Payment went to the wrong address.",
              hint: `It must be the platform wallet (${paymentDetails?.address ?? ""}).`,
              reuseHash: false,
            };
          case "TX_REVERTED":
            return {
              code,
              message: "The payment transaction failed on-chain.",
              hint: "Send a fresh SOL transfer and verify again.",
              reuseHash: false,
            };
          case "RPC_UNAVAILABLE":
            return {
              code,
              message: "Solana's RPC is flaky right now.",
              hint: "Try again in a few seconds — your payment is likely fine.",
              reuseHash: true,
            };
          case "INVALID_PAYMENT_HASH":
            return {
              code,
              message: "That doesn't look like a valid Solana transaction signature.",
              hint: "A Solana signature is 87–88 base58 characters.",
              reuseHash: false,
            };
          default:
            return {
              code,
              message: errorData?.error || "Could not verify the payment.",
              hint: errorData?.hint || "If you already paid, contact support.",
              reuseHash: true,
            };
        }
      };

      setPaymentError(mapError());
      setFlow("awaiting-payment");
    } catch (error) {
      if (isErrorLike(error) && error.name === "AbortError") {
        setPaymentError({
          code: "TIMEOUT",
          message: "Verification timed out (30s).",
          hint: "Your payment may have gone through. Retry with the same signature.",
          reuseHash: true,
        });
      } else {
        setPaymentError({
          message: isErrorLike(error) ? error.message || "Unknown error" : String(error),
          reuseHash: true,
        });
      }
      setFlow("awaiting-payment");
    } finally {
      verifyInFlight.current = false;
    }
  };

  /** Pay with the connected Solana wallet, then auto-verify. */
  const payWithWallet = async () => {
    if (!solanaAddress || !paymentDetails) return;
    if (!connected) {
      setShowWalletPrompt(true);
      return;
    }
    setIsPaying(true);
    setPaymentError(null);
    try {
      setStatus("Requesting wallet approval…");
      const result = await sendSol(paymentDetails.address, paymentDetails.amount);

      if (!result?.hash) {
        setPaymentError({
          message: "The SOL transfer could not be completed.",
          hint: "Make sure your wallet has SOL for the transfer + network fee (a ~0.000005 SOL rent-exempt fee covers this).",
          reuseHash: false,
        });
        return;
      }

      await verifyPayment(result.hash);
    } catch (error) {
      let message = isErrorLike(error) ? error.message || "Unknown error" : String(error);
      if (isErrorLike(error) && (error.code === 4001 || message.includes("User rejected"))) {
        message = "Transaction cancelled by the wallet.";
      }
      setPaymentError({ message, reuseHash: false });
    } finally {
      setIsPaying(false);
    }
  };

  const copyPaymentAddress = () => {
    if (!paymentDetails) return;
    navigator.clipboard.writeText(paymentDetails.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated) {
      login();
      return;
    }

    if (!solanaAddress) {
      setShowWalletPrompt(true);
      return;
    }

    if (!hasEnoughFunds) {
      setShowWalletPrompt(true);
      return;
    }

    await requestPaymentDetails();
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6">
        <Link href="/bounties" className="mb-8 inline-flex items-center text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest no-underline transition-colors">
          <ArrowLeft className="mr-2 h-3 w-3" />
          Registry / Browse Bounties
        </Link>

        <div className="mb-12">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Bounty Creation</p>
          <h1 className="text-4xl font-medium tracking-tighter text-primary">
            Create a New Bounty
          </h1>
          <p className="mt-2 text-sm font-medium text-primary/50">
            Define the task and secure the settlement asset on Solana.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-10 space-y-10 rounded-[24px]">
            {/* Title Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Bounty Title
              </label>
              <input
                type="text"
                required
                disabled={flow !== "form"}
                className="w-full border border-line bg-white/5 rounded-xl px-4 py-4 text-xs font-semibold text-white placeholder-white/20 transition-all focus:border-accent focus:outline-none disabled:opacity-50"
                placeholder="e.g. Build a parallel execution layer in TypeScript"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            {/* Prize Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Prize Amount ({CURRENCY})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  required
                  disabled={flow !== "form"}
                  className="w-full border border-line bg-white/5 rounded-xl px-4 py-4 text-xs font-semibold text-white placeholder-white/20 transition-all focus:border-accent focus:outline-none disabled:opacity-50"
                  placeholder="0.00"
                  value={formData.prize}
                  onChange={(e) =>
                    setFormData({ ...formData, prize: e.target.value })
                  }
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                  {CURRENCY}
                </div>
              </div>
            </div>

            {/* Description Input */}
            <div>
              <MarkdownEditor
                label="Submission Requirements"
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                placeholder="Describe technical requirements, acceptance criteria, and documentation standards..."
              />
            </div>
          </div>

          {/* Platform Fee Info */}
          <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-6 flex items-center gap-4 rounded-2xl">
            <div className="p-3 border border-white/10 bg-white/5 text-white/40 rounded-xl">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Platform Fee
              </p>
              <p className="text-[10px] font-medium text-primary/40 uppercase tracking-tight">
                A non-refundable platform fee of {PLATFORM_FEE} {SOLANA_NATIVE_SYMBOL} on Solana is required to post a bounty.
              </p>
            </div>
          </div>

          {/* x402 payment panel — shown once the server returns paymentDetails */}
          {flow === "awaiting-payment" && paymentDetails && (
            <div className="border border-accent/30 bg-accent/5 backdrop-blur-xl p-8 rounded-[24px]">
              <div className="mb-6 flex items-center gap-3">
                <div className="p-2 border border-accent/20 bg-accent/10 text-accent rounded-xl">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest">
                    Payment Required
                  </h3>
                  <p className="text-[10px] font-medium text-primary/40 uppercase tracking-tight">
                    Send {paymentDetails.amount} {paymentDetails.currency} on Solana to the platform wallet below.
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="mb-4 rounded-xl border border-line bg-white/5 p-4">
                <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Amount</p>
                <p className="text-2xl font-semibold text-primary tracking-tight">
                  {paymentDetails.amount} <span className="text-primary/40">{paymentDetails.currency}</span>
                </p>
              </div>

              {/* Platform address + copy */}
              <div className="mb-6 rounded-xl border border-line bg-white/5 p-4">
                <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Platform Wallet</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs text-primary font-mono break-all">{paymentDetails.address}</code>
                  <button
                    type="button"
                    onClick={copyPaymentAddress}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Error state (per-error code mapping) */}
              {paymentError && (
                <div className="mb-6 border border-accent/40 bg-accent/10 p-4 rounded-xl">
                  <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                    {paymentError.code ? `${paymentError.code.replace(/_/g, " ")}` : "Payment error"}
                  </p>
                  <p className="text-xs font-medium text-primary/80">{paymentError.message}</p>
                  {paymentError.hint && (
                    <p className="mt-1 text-[10px] font-medium text-primary/50">{paymentError.hint}</p>
                  )}
                </div>
              )}

              {/* Pay with wallet button */}
              <button
                type="button"
                onClick={payWithWallet}
                disabled={isPaying || !connected}
                className="btn-primary w-full py-4 text-xs tracking-[0.2em] font-bold uppercase disabled:opacity-50 mb-4"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {status || "Requesting approval…"}
                  </>
                ) : !connected ? (
                  "CONNECT WALLET TO PAY"
                ) : (
                  "PAY WITH WALLET"
                )}
              </button>

              {/* Manual signature entry */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  placeholder="Paste your Solana tx signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="w-full border border-line bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => verifyPayment(signature)}
                  disabled={!signatureLooksValid(signature)}
                  className="border border-line bg-white/5 px-6 py-3 text-[10px] font-bold text-primary uppercase tracking-widest transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  I&apos;ve sent it
                </button>
              </div>

              {signatureLooksValid(signature) && (
                <a
                  href={getSolanaTxExplorerUrl(signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on Solana explorer
                </a>
              )}

              <button
                type="button"
                onClick={() => setFlow("form")}
                className="mt-4 text-[10px] font-bold text-primary/30 hover:text-primary uppercase tracking-widest"
              >
                ← Back to form
              </button>
            </div>
          )}

          {/* Wallet selection & submit — only in the form state */}
          {flow === "form" && (
            <>
              {/* Solana wallet status */}
              {authenticated && (
                <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-8 rounded-[24px]">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                      Settlement Source
                    </h3>
                    {connected ? (
                      <button
                        type="button"
                        onClick={selectWallet}
                        className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest transition-colors"
                      >
                        SWITCH WALLET
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={selectWallet}
                        disabled={connecting}
                        className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest transition-colors"
                      >
                        {connecting ? "CONNECTING..." : "CONNECT SOLANA WALLET"}
                      </button>
                    )}
                  </div>

                  {connecting ? (
                    <div className="flex items-center gap-3 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Awaiting wallet authorization...
                    </div>
                  ) : !solanaAddress ? (
                    <div className="text-[10px] font-bold text-accent bg-accent/5 border border-accent/10 p-4 uppercase tracking-widest">
                      <AlertCircle className="mr-2 inline h-3 w-3" />
                      No Solana wallet connected. Connect Phantom, Solflare, or Backpack to post.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <div className={`flex w-full items-center justify-between border p-4 rounded-xl border-accent bg-accent/10`}>
                        <div className="flex items-center gap-4">
                          <div className="p-2 border border-white/20 text-white/60 rounded-lg">
                            <Wallet className="h-3 w-3" />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-tight">
                              {truncateAddress(solanaAddress)}
                            </p>
                            <span className="inline-block text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                              SOLANA WALLET
                              <a
                                href={getSolanaAddressExplorerUrl(solanaAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-accent"
                              >
                                VIEW
                              </a>
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-[10px] font-bold tracking-tighter ${hasEnoughFunds ? "text-primary" : "text-accent"}`}>
                            {solBalance.toFixed(4)} {SOLANA_NATIVE_SYMBOL}
                          </p>
                          {!hasEnoughFunds && (
                            <p className="text-[8px] font-bold text-accent uppercase tracking-widest">Insufficient</p>
                          )}
                        </div>
                      </div>

                      {!hasEnoughFunds && (
                        <div className="mt-4 border border-accent/20 bg-accent/5 p-4">
                          <p className="text-[10px] font-bold text-accent uppercase tracking-widest">
                            <AlertCircle className="mr-2 inline h-3 w-3" />
                            Insufficient Balance
                          </p>
                          <p className="mt-1 text-[10px] font-medium text-accent/60 uppercase tracking-tight leading-relaxed">
                            The connected wallet needs at least {PLATFORM_FEE} {SOLANA_NATIVE_SYMBOL} to pay the platform fee. <br />
                            Fund it on devnet via the <span className="text-accent">Solana Faucet</span>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={authenticated && (!connected || !hasEnoughFunds)}
                className="btn-primary w-full py-5 text-xs tracking-[0.2em] font-bold uppercase disabled:opacity-50"
              >
                {!authenticated ? (
                  "AUTHENTICATE TO POST"
                ) : !solanaAddress ? (
                  "CONNECT SOLANA WALLET"
                ) : !hasEnoughFunds ? (
                  "REPLENISH SOL TO CONTINUE"
                ) : (
                  "REGISTER BOUNTY"
                )}
              </button>
            </>
          )}

          {/* Verifying/success states */}
          {flow === "verifying" && (
            <div className="border border-accent/30 bg-accent/5 backdrop-blur-xl p-10 rounded-[24px]">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Verifying on Solana…</p>
                  <p className="text-[10px] font-medium text-primary/50 mt-1">
                    {status} Tx {truncateAddress(signature)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {flow === "success" && (
            <div className="border border-accent-success/30 bg-accent-success/5 backdrop-blur-xl p-10 rounded-[24px]">
              <div className="flex items-center gap-4">
                <Check className="h-5 w-5 text-accent-success" />
                <p className="text-xs font-bold text-success uppercase tracking-widest">
                  Bounty created — redirecting…
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Wallet Connection Modal */}
        <ConnectWalletPrompt
          isOpen={showWalletPrompt}
          onClose={() => setShowWalletPrompt(false)}
          onConnect={() => {
            selectWallet();
            setShowWalletPrompt(false);
          }}
          isLoading={connecting}
          title="Solana Wallet Required"
          description={`Connect a Solana wallet funded with at least ${PLATFORM_FEE} ${SOLANA_NATIVE_SYMBOL} to post a bounty.`}
        />
      </div>
    </div>
  );
}