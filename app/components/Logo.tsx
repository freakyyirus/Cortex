"use client";

import type { SVGProps } from "react";
import { cn } from "@/app/lib/utils";
import { motion } from "framer-motion";

type LogoProps = SVGProps<SVGSVGElement> & {
  showWordmark?: boolean;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
};

export function Logo({ 
  showWordmark = false, 
  className,
  iconClassName,
  wordmarkClassName,
  ...props 
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <motion.svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MonQuest"
        className={cn("w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg", iconClassName)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        {...(props as any)}
      >
        <defs>
          <linearGradient id="mq-gradient-1" x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10B981" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="mq-gradient-2" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
          <filter id="mq-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glowing ring - subtle pulse */}
        <motion.circle 
          cx="50" 
          cy="50" 
          r="48" 
          fill="#022C22" 
          stroke="url(#mq-gradient-1)" 
          strokeWidth="2" 
          animate={{ 
            opacity: [0.6, 0.9, 0.6],
            scale: [0.98, 1, 0.98]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        />
        
        {/* Dynamic 'M' shape combining a quest marker / chevron - draw in then float */}
        <motion.path
          d="M25 70 V35 L50 60 L75 35 V70"
          stroke="url(#mq-gradient-2)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#mq-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Quest / AI dot - floating */}
        <motion.circle 
          cx="50" 
          cy="22" 
          r="7" 
          fill="#6EE7B7" 
          filter="url(#mq-glow)" 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            y: [0, -3, 0]
          }}
          transition={{
            scale: { duration: 0.5, delay: 1 },
            opacity: { duration: 0.5, delay: 1 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }
          }}
        />
      </motion.svg>
      
      {showWordmark && (
        <motion.span 
          className={cn(
            "text-lg sm:text-xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-[#FAFAFA] to-white/40",
            wordmarkClassName
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          MonQuest
        </motion.span>
      )}
    </span>
  );
}

export default Logo;