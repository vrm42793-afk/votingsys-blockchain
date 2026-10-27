import { useQuery } from '@tanstack/react-query'
import { supabase } from '@services/supabase/client'
import { Link } from 'react-router-dom'

export function MyVotesPage() {
  const { data: votes, isLoading } = useQuery({
    queryKey: ['my-votes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('*, election:elections(*), candidate:candidates(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
          <span>📜</span> My Vote Receipts
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Review cryptographic receipts, block numbers, and explorer validation paths for every ballot you have submitted.
        </p>
      </div>

      <div className="bg-brand-900 border border-brand-700 rounded-xl p-6 min-h-[300px]">
        {isLoading ? (
          <div className="h-48 bg-brand-950 rounded-xl animate-pulse" />
        ) : !votes || votes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <span className="text-4xl mb-3">🗳️</span>
            <h3 className="text-sm font-semibold text-neutral-200 mb-1">No votes cast yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm leading-relaxed mb-4">
              Your voting history is empty. Go to the elections ballot to connect your MetaMask ledger and participate in open elections.
            </p>
            <Link
              to="/elections"
              className="px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all shadow-md"
            >
              Browse Open Elections
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-700 text-neutral-500 font-semibold">
                  <th className="pb-3 px-2">Election Name</th>
                  <th className="pb-3 px-2">Choice</th>
                  <th className="pb-3 px-2">Timestamp</th>
                  <th className="pb-3 px-2">Tx Hash</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((vote) => {
                  const explorerUrl = `https://sepolia.etherscan.io/tx/${vote.chain_tx_hash}`
                  return (
                    <tr key={vote.id} className="border-b border-brand-850 hover:bg-brand-950/20 text-neutral-300">
                      <td className="py-3.5 px-2 font-medium text-neutral-200">{vote.election?.title}</td>
                      <td className="py-3.5 px-2 text-neutral-400">Candidate: {vote.candidate?.name || 'Choice Recorded'}</td>
                      <td className="py-3.5 px-2 text-neutral-500">{new Date(vote.created_at).toLocaleString()}</td>
                      <td className="py-3.5 px-2 font-mono text-3xs text-neutral-500 truncate max-w-[120px]" title={vote.chain_tx_hash || ''}>
                        {vote.chain_tx_hash || 'Off-chain'}
                      </td>
                      <td className="py-3.5 px-2 text-right flex items-center justify-end gap-2">
                        <Link
                          to={`/elections/${vote.election_id}/receipt`}
                          className="px-2 py-1 rounded text-3xs font-semibold bg-brand-850 hover:bg-brand-800 text-neutral-200 transition-all"
                        >
                          Details
                        </Link>
                        {vote.chain_tx_hash && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded text-3xs font-semibold bg-accent-950 text-accent-400 hover:bg-accent-900 transition-all"
                          >
                            Scan
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
