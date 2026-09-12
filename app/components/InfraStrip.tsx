"use client";

import { motion } from "framer-motion";

const stack = [
  { name: "Solana", detail: "Devnet · native SOL" },
  { name: "x402", detail: "HTTP 402 payments" },
  { name: "Phantom · Solflare", detail: "Wallet adapters" },
  { name: "Privy", detail: "SSO / auth" },
  { name: "Supabase", detail: "Postgres + RLS" },
  { name: "Gemini 2.5 Flash", detail: "AI judging" },
  { name: "Next.js 14", detail: "App Router · TS" },
  { name: "@solana/web3.js", detail: "Tx verification" },
  { name: "Anchor", detail: "Solana program" },
];

export default function InfraStrip() {
  return (
    <section className="relative w-full border-y border-line bg-bg-elevated/30 py-16 md:py-20">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Under the hood
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {stack.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
              className="group flex cursor-default items-center gap-2.5 rounded-full border border-line bg-bg-elevated px-4 py-2 transition-all duration-200 hover:border-accent/50 hover:glow-accent"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent transition-transform duration-200 group-hover:scale-125" />
              <span className="text-xs font-semibold tracking-tight text-fg">{tech.name}</span>
              <span className="hidden text-[10px] font-medium text-fg-faint sm:inline">
                {tech.detail}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}