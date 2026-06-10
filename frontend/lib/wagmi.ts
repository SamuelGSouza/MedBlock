import { createConfig, http } from "wagmi"
import { sepolia } from "wagmi/chains"
import { injected } from "wagmi/connectors"

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    // Sem NEXT_PUBLIC_RPC_URL, usa o RPC público (limitado a ~1000 blocos no getLogs)
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
  },
})
