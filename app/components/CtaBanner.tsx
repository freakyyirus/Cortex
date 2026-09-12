"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CtaBanner() {
  return (
    <section className="relative w-full overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-bg-elevated via-bg to-bg px-6 py-14 text-center md:py-20"
        >
          {/* Shine sweep */}
          <span className="animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-[90px]" />

          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3.5 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                Ready when you are
              </span>
            </div>
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-fg sm:text-4xl md:text-5xl">
              Your first bounty costs{" "}
              <span className="text-gradient">less than a standard SOL transfer</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-fg-muted md:text-base">
              A flat 0.001&nbsp;SOL x402 fee, an AI judge on standby, and payouts
              that are verified on-chain before they count.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/create" className="btn-primary group h-10 px-5 text-sm">
                Post a Bounty
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/bounties" className="btn-secondary h-10 px-5 text-sm">
                Start Earning
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}