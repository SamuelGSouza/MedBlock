"use client"

import { useState } from "react"
import { Activity, User, Stethoscope, ShieldCheck } from "lucide-react"
import { WalletButton } from "@/components/wallet-button"
import { PatientView } from "@/components/patient-view"
import { DoctorView } from "@/components/doctor-view"
import { cn } from "@/lib/utils"

type View = "patient" | "doctor"

export default function Page() {
  const [view, setView] = useState<View>("patient")

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Activity className="size-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold leading-none tracking-tight text-foreground">
                MedBlock
              </p>
              <p className="text-xs text-muted-foreground">
                Prontuários na blockchain
              </p>
            </div>
          </div>
          <WalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero / intro */}
        <div className="mb-8">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <ShieldCheck className="size-3.5" />
            Acesso auditável e descentralizado
          </span>
          <h1 className="font-heading text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Compartilhe prontuários médicos com segurança total
          </h1>
          <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Pacientes controlam quem acessa seus dados. Médicos consultam com
            permissão — e cada acesso de emergência fica registrado para
            sempre.
          </p>
        </div>

        {/* View switcher */}
        <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
          <TabButton
            active={view === "patient"}
            onClick={() => setView("patient")}
            icon={<User className="size-4" />}
            label="Área do Paciente"
          />
          <TabButton
            active={view === "doctor"}
            onClick={() => setView("doctor")}
            icon={<Stethoscope className="size-4" />}
            label="Área do Médico"
          />
        </div>

        {view === "patient" ? <PatientView /> : <DoctorView />}
      </div>
    </main>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
