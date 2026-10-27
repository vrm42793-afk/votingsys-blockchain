import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiService } from '@/services/aiService'
import type { FraudSeverity, FraudStatus, AiFraudFlag } from '@/types/domain'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FraudAlertPanelProps {
  electionId: string
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// Component
// Requirements: AI-01, AI-02, AI-03
// ---------------------------------------------------------------------------

/**
 * FraudAlertPanel — AI fraud detection dashboard.
 * Displays AI-detected anomalies by severity.
 * Allows admins to dismiss or escalate flags.
 */
export function FraudAlertPanel({ electionId, isAdmin }: FraudAlertPanelProps) {
  const queryClient = useQueryClient()

  // Fetch fraud flags
  const { data: flags, isLoading } = useQuery({
    queryKey: ['fraud-flags', electionId],
    queryFn: () => aiService.getFraudFlags(electionId),
    refetchInterval: 30000, // Refresh every 30s
  })

  // Trigger fraud analysis
  const detectMutation = useMutation({
    mutationFn: () => aiService.detectFraud(electionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-flags', electionId] })
    },
  })

  // Dismiss flag
  const dismissMutation = useMutation({
    mutationFn: (flagId: string) => aiService.dismissFraudFlag(flagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-flags', electionId] })
    },
  })

  // Escalate flag
  const escalateMutation = useMutation({
    mutationFn: (flagId: string) => aiService.escalateFraudFlag(flagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-flags', electionId] })
    },
  })

  const severityConfig: Record<FraudSeverity, { color: string; icon: string; bg: string }> = {
    low: {
      color: 'text-neutral-400',
      icon: '🔵',
      bg: 'bg-brand-900 border-brand-700',
    },
    medium: {
      color: 'text-yellow-400',
      icon: '🟡',
      bg: 'bg-yellow-900/10 border-yellow-800/40',
    },
    high: {
      color: 'text-danger-400',
      icon: '🔴',
      bg: 'bg-danger-900/10 border-danger-800/40',
    },
  }

  const statusConfig: Record<FraudStatus, { label: string; color: string }> = {
    open: { label: 'Open', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700' },
    dismissed: { label: 'Dismissed', color: 'text-neutral-500 bg-brand-800 border-brand-600' },
    escalated: { label: 'Escalated', color: 'text-danger-400 bg-danger-900/30 border-danger-700' },
  }

  // Separate flags by status
  const openFlags = flags?.filter((f) => f.status === 'open') ?? []
  const escalatedFlags = flags?.filter((f) => f.status === 'escalated') ?? []
  const dismissedFlags = flags?.filter((f) => f.status === 'dismissed') ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-100">Fraud Detection</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            AI-powered anomaly detection for this election
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => detectMutation.mutate()}
            disabled={detectMutation.isPending}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-neutral-100 transition-all shadow-md shadow-accent-600/20"
          >
            {detectMutation.isPending ? 'Analyzing...' : '🔍 Run Analysis'}
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open Alerts" value={openFlags.length} icon="⚠️" />
        <StatCard label="Escalated" value={escalatedFlags.length} icon="🚨" />
        <StatCard label="Dismissed" value={dismissedFlags.length} icon="✅" />
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-brand-900 border border-brand-700 animate-pulse"
            />
          ))}
        </div>
      ) : !flags || flags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-12 px-6 text-center">
          <span className="text-4xl mb-3">🛡️</span>
          <h3 className="text-sm font-semibold text-neutral-200 mb-1">
            No Fraud Alerts
          </h3>
          <p className="text-xs text-neutral-500 max-w-xs">
            No anomalies detected. Run an analysis to scan for suspicious patterns.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Escalated Flags (shown first in red) */}
          {escalatedFlags.length > 0 && (
            <FlagSection title="🚨 Escalated" flags={escalatedFlags} />
          )}

          {/* Open Flags */}
          {openFlags.length > 0 && (
            <FlagSection
              title="⚠️ Open Alerts"
              flags={openFlags}
              isAdmin={isAdmin}
              onDismiss={(id) => dismissMutation.mutate(id)}
              onEscalate={(id) => escalateMutation.mutate(id)}
            />
          )}

          {/* Dismissed Flags (collapsed) */}
          {dismissedFlags.length > 0 && (
            <FlagSection title="✅ Dismissed" flags={dismissedFlags} collapsed />
          )}
        </div>
      )}
    </div>
  )

  // -- Sub-components inline --

  function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
    return (
      <div className="rounded-xl bg-brand-900 border border-brand-700 p-4 flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
            {label}
          </div>
          <div className="text-lg font-bold text-neutral-100">{value}</div>
        </div>
      </div>
    )
  }

  function FlagSection({
    title,
    flags: sectionFlags,
    isAdmin: sectionAdmin,
    onDismiss,
    onEscalate,
    collapsed,
  }: {
    title: string
    flags: AiFraudFlag[]
    isAdmin?: boolean
    onDismiss?: (id: string) => void
    onEscalate?: (id: string) => void
    collapsed?: boolean
  }) {
    const [isOpen, setIsOpen] = useState(!collapsed)

    return (
      <div>
        <button
          onClick={() => setIsOpen((v: boolean) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-2 hover:text-neutral-100 transition-colors w-full text-left"
        >
          <span className="transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>
            ▶
          </span>
          {title} ({sectionFlags.length})
        </button>
        {isOpen && (
          <ul className="flex flex-col gap-2">
            {sectionFlags.map((flag) => {
              const sev = severityConfig[flag.severity]
              const stat = statusConfig[flag.status]

              return (
                <li
                  key={flag.id}
                  className={`rounded-lg border p-4 ${sev.bg} transition-colors`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-lg mt-0.5">{sev.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-100 font-medium">
                          {flag.description}
                        </p>
                        {flag.affected_pattern && (
                          <p className="text-xs text-neutral-500 mt-1 font-mono">
                            Pattern: {flag.affected_pattern}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${stat.color}`}
                          >
                            {stat.label}
                          </span>
                          <span className="text-xs text-neutral-600">
                            {new Date(flag.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {sectionAdmin && flag.status === 'open' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => onDismiss?.(flag.id)}
                          className="px-3 py-1 text-xs rounded bg-brand-800 text-neutral-400 hover:text-neutral-200 hover:bg-brand-700 border border-brand-600 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => onEscalate?.(flag.id)}
                          className="px-3 py-1 text-xs rounded bg-danger-900/30 text-danger-400 hover:bg-danger-900/60 border border-danger-800 transition-colors"
                        >
                          Escalate
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }
}
