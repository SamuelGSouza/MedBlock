"use client"

import { Wallet, Check, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary",
          )}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/20">
            <Check className="size-3" />
          </span>
          <span className="font-mono">{truncate(address)}</span>
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          title="Desconectar carteira"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => connect({ connector: injected() })}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <Wallet className="size-4" />
      {isPending ? "Conectando..." : "Conectar Carteira"}
    </button>
  )
}
