"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Code2, Medal, FileText, ListChecks, Coins, Brain } from "lucide-react";

const creatorPoints = [
  { icon: FileText, text: "Write a markdown spec with clear requirements and a prize in SOL." },
  { icon: Coins, text: "Pay a flat 0.001 SOL x402 fee to put your bounty on the registry." },
  { icon: ListChecks, text: "Run an AI audit and let Gemini 2.5 Flash rank the top-3 submissions." },
  { icon: Medal, text: "Pay the winner directly and watch the bounty flip to PAID — verified on Solana." },
];

const hunterPoints = [
  { icon: Code2, text: "Browse the registry and pick bounties in your stack." },
  { icon: FileText, text: "Submit markdown work with screenshots inlined for the AI judge." },
  { icon: Brain, text: "Get ranked, transparent feedback on why a submission placed." },
  { icon: Coins, text: "Get paid wallet-to-wallet the moment the creator settles." },
];

const panel: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export default function SplitShowcase() {
  return (
    <section className="relative w-full overflow-hidden border-y border-line bg-bg-elevated/30 py-20 md:py-28">
      <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-accent/5 blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-content px-4 sm:px-6">
        <div className="mb-12 text-center md:mb-16">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Two roles, one loop
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl md:text-5xl">
            Built for the people <span className="text-gradient">who ship</span>.
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <motion.div variants={panel} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
            <div className="glass h-full rounded-[14px] border border-line p-7 transition-colors hover:border-accent/40 md:p-9">
              <div className="mb-7 flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-fg">For Creators</h3>
                <span className="rounded-full border border-line bg-bg-overlay px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                  Post &amp; judge
                </span>
              </div>
              <ul className="space-y-5">
                {creatorPoints.map((p, i) => (
                  <motion.li
                    key={p.text}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex items-start gap-3.5"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-accent/25 bg-accent-soft">
                      <p.icon className="h-4 w-4 text-accent" />
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-fg-muted">{p.text}</span>
                  </motion.li>
                ))}
              </ul>
              <Link href="/create" className="btn-primary mt-8 group">
                Post a Bounty
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </motion.div>

          <motion.div variants={panel} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
            <div className="glass h-full rounded-[14px] border border-line p-7 transition-colors hover:border-accent/40 md:p-9">
              <div className="mb-7 flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-fg">For Hunters</h3>
                <span className="rounded-full border border-line bg-bg-overlay px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                  Ship &amp; get paid
                </span>
              </div>
              <ul className="space-y-5">
                {hunterPoints.map((p, i) => (
                  <motion.li
                    key={p.text}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex items-start gap-3.5"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-accent/25 bg-accent-soft">
                      <p.icon className="h-4 w-4 text-accent" />
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-fg-muted">{p.text}</span>
                  </motion.li>
                ))}
              </ul>
              <Link href="/bounties" className="btn-secondary mt-8 group">
                Find Work
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}