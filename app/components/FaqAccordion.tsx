"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is MonQuest?",
    answer:
      "MonQuest is a Solana-native bounty marketplace. Creators post technical tasks for a flat 0.001 SOL x402 fee, hunters submit markdown + screenshots, and Gemini 2.5 Flash ranks the work. The winner is paid wallet-to-wallet on Solana.",
  },
  {
    question: "What is the x402 platform fee?",
    answer:
      "Publishing a bounty costs a flat 0.001 SOL, requested through the x402 payment protocol: the server replies with HTTP 402 + payment details, your Solana wallet signs a native transfer, and the tx is verified on-chain (recipient, amount, and status) before your bounty appears.",
  },
  {
    question: "How does the AI review work?",
    answer:
      "Creators run a one-click audit powered by Gemini 2.5 Flash. It streams a ranked top-3 with per-submission feedback, and screenshots embedded in submissions are included in the evaluation.",
  },
  {
    question: "Do I need a crypto wallet to participate?",
    answer:
      "You authenticate with email (via Privy), then connect a Solana wallet — Phantom, Solflare, or Backpack — straight from the app. On devnet you can grab free test SOL from the faucet in a minute.",
  },
  {
    question: "How are winners paid?",
    answer:
      "Wallet-to-wallet. The creator sends the prize from the app, and the server verifies the payout transaction on-chain — recipient must be the winning hunter, value must cover the prize — before the bounty flips to PAID.",
  },
  {
    question: "What chains does MonQuest run on?",
    answer:
      "The core bounty + payment loop runs entirely on Solana (devnet by default, mainnet with a one-line RPC swap). A bonus wallets page also reads EVM and BTC balances for convenience.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative w-full py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Common questions
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl md:text-5xl">
            Protocol <span className="text-gradient">FAQ</span>.
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`overflow-hidden rounded-[10px] border transition-colors duration-200 ${
                  isOpen ? "border-accent/40 bg-bg-elevated" : "border-line bg-bg-elevated hover:border-line-strong"
                }`}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold tracking-tight text-fg sm:text-base">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-fg-faint transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <p className="px-5 pb-5 text-sm font-medium leading-relaxed text-fg-muted">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}