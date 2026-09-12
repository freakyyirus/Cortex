"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Activity, Coins, Globe, Zap } from "lucide-react";

function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 28, stiffness: 80 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      if (ref.current) {
        const formatted =
          decimals > 0
            ? latest.toFixed(decimals)
            : Math.round(latest).toLocaleString("en-US");
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
    return unsubscribe;
  }, [spring, prefix, suffix, decimals]);

  return (
    <span className="tabular" ref={ref}>
      {`${prefix}0${suffix}`}
    </span>
  );
}

const stats = [
  { icon: Coins, label: "Platform fee to post", value: 0.001, prefix: "", suffix: " SOL", decimals: 3 },
  { icon: Globe, label: "Solana clusters", value: 3, suffix: "" },
  { icon: Zap, label: "Avg. settlement", value: 0.4, suffix: " s" },
  { icon: Activity, label: "Verified bounty tx", value: 231, suffix: "+" },
];

export default function Stats() {
  return (
    <section className="relative border-b border-line">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
              className="glass rounded-[10px] border border-line p-5 transition-colors hover:border-line-strong md:p-6"
            >
              <stat.icon className="mb-4 h-5 w-5 text-accent" />
              <p className="text-2xl font-bold tracking-tight text-fg md:text-3xl">
                <Counter value={stat.value} prefix={stat.prefix ?? ""} suffix={stat.suffix ?? ""} decimals={stat.decimals ?? 0} />
              </p>
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}