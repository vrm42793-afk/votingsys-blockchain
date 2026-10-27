import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@services/supabase/client'
import { 
  Printer, ExternalLink, ArrowLeft, CheckCircle2, 
  Copy, ShieldCheck, Download, Fingerprint, Box
} from 'lucide-react'
import { toast } from 'sonner'

export function VoteReceiptPage() {
  const { electionId } = useParams<{ electionId: string }>()

  const { data: vote, isLoading, error } = useQuery({
    queryKey: ['vote-receipt', electionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('*, election:elections(*), candidate:candidates(name)')
        .eq('election_id', electionId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!electionId
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-t-transparent mx-auto"></div>
      </div>
    )
  }

  if (error || !vote) {
    return (
      <div className="p-6 rounded-xl bg-brand-850 border border-brand-700/60 text-center flex flex-col items-center gap-4 max-w-md mx-auto shadow-xl">
        <span className="text-3xl text-neutral-500">⚠️</span>
        <h2 className="text-sm font-semibold text-neutral-200">No Receipt Found</h2>
        <p className="text-xs text-neutral-500 leading-normal">
          We couldn't locate a vote receipt for this election. If you just voted, please allow a few moments for the blockchain block to confirm.
        </p>
        <Link to="/elections" className="text-xs text-accent-400 hover:text-accent-300 font-semibold flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Return to Elections
        </Link>
      </div>
    )
  }

  const hasChainTx = Boolean(vote.is_chain_confirmed && vote.chain_tx_hash && vote.chain_tx_hash !== 'null')
  const explorerUrl = hasChainTx ? `https://sepolia.etherscan.io/tx/${vote.chain_tx_hash}` : null

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto print:p-0">
      {/* Breadcrumb / Top control */}
      <div className="flex items-center justify-between text-xs text-neutral-500 print:hidden">
        <Link to="/my-votes" className="hover:text-accent-400 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Receipts
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="p-2 bg-brand-850 border border-brand-700/60 hover:bg-brand-800 text-neutral-300 hover:text-neutral-100 rounded-lg transition-colors flex items-center gap-1.5 font-semibold text-3xs uppercase tracking-wider"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Ticket Container */}
      <div className="bg-brand-850 border border-brand-700/60 rounded-2xl shadow-2xl overflow-hidden relative print:border-none print:shadow-none">
        
        {/* Ticket Header Graphic */}
        <div className="bg-accent-600 px-6 py-5 text-center flex flex-col items-center gap-1 text-neutral-100 print:bg-neutral-800">
          <CheckCircle2 className="h-10 w-10 text-neutral-100 animate-scale-in" />
          <h2 className="text-md font-extrabold tracking-tight mt-1.5">Vote Submitted</h2>
          <p className="text-[10px] text-accent-200 print:text-neutral-400 uppercase tracking-widest font-bold">
            {hasChainTx ? 'Ethereum Sepolia Blockchain Anchored' : 'Cryptographic Database Ledger Mode'}
          </p>
        </div>

        {/* Dash ticket cut line */}
        <div className="relative h-px border-t-2 border-dashed border-brand-700/80 my-0.5 z-10">
          <div className="absolute -left-3 -top-2.5 h-5 w-5 bg-brand-900 rounded-full border-r border-brand-700/60 print:hidden" />
          <div className="absolute -right-3 -top-2.5 h-5 w-5 bg-brand-900 rounded-full border-l border-brand-700/60 print:hidden" />
        </div>

        {/* Ticket Details Body */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex justify-between border-b border-brand-700/30 pb-2">
              <span className="text-neutral-500 font-medium">Election Name</span>
              <span className="text-neutral-200 font-bold max-w-[200px] truncate" title={vote.election?.title}>
                {vote.election?.title}
              </span>
            </div>
            
            <div className="flex justify-between border-b border-brand-700/30 pb-2">
              <span className="text-neutral-500 font-medium">Option Recorded</span>
              <span className="text-neutral-200 font-semibold">
                {vote.candidate?.name || 'Approved Choice'}
              </span>
            </div>

            <div className="flex justify-between border-b border-brand-700/30 pb-2">
              <span className="text-neutral-500 font-medium">Timestamp</span>
              <span className="text-neutral-400 font-medium">
                {new Date(vote.created_at).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between border-b border-brand-700/30 pb-2">
              <span className="text-neutral-500 font-medium">Ledger Status</span>
              {hasChainTx ? (
                <span className="text-success-400 font-extrabold flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  On-Chain Sepolia Confirmed
                </span>
              ) : (
                <span className="text-accent-300 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  Database Ledger (Demo Mode)
                </span>
              )}
            </div>
          </div>

          {/* Cryptographic Details Container */}
          <div className="bg-brand-900 border border-brand-700/50 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1 select-none">
              <Fingerprint className="h-3.5 w-3.5 text-accent-500" />
              Ballot ledger signatures
            </h3>
            
            <div className="flex flex-col gap-2.5">
              <RecordItem 
                label="Tx Hash (Sepolia)" 
                value={hasChainTx ? vote.chain_tx_hash! : 'Not Broadcast (Contract Not Configured on Sepolia)'} 
                onCopy={copyToClipboard}
              />
              <RecordItem 
                label="Receipt Hash (Audit Proof)" 
                value={vote.vote_hash} 
                onCopy={copyToClipboard}
              />
              <div className="flex items-center justify-between text-3xs pt-1.5 border-t border-brand-850/60">
                <span className="text-neutral-500">Block Anchor</span>
                <span className="font-mono text-neutral-300 font-semibold flex items-center gap-1">
                  <Box className="h-3 w-3 text-accent-500" />
                  {hasChainTx && vote.chain_block_number
                    ? `Block #${vote.chain_block_number}` 
                    : 'Off-Chain Ledger Mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Deck */}
          <div className="flex gap-3 pt-3 border-t border-brand-700/40 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 rounded-lg bg-brand-800 hover:bg-brand-750 border border-brand-700 text-xs font-bold text-neutral-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            {hasChainTx && explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-bold text-neutral-100 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-accent-600/10"
              >
                <span>View Explorer</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <div
                title="Smart contract is not deployed to Sepolia. Operating in database audit mode."
                className="flex-1 py-2.5 rounded-lg bg-brand-900 border border-brand-750 text-neutral-500 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
              >
                <span>No Sepolia Tx</span>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}

function RecordItem({ label, value, onCopy }: { label: string; value: string; onCopy: (txt: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>{label}</span>
        <button 
          onClick={() => onCopy(value)}
          className="text-accent-400 hover:text-accent-300 font-semibold flex items-center gap-0.5 text-3xs"
          title="Copy Value"
          type="button"
        >
          <Copy className="h-3 w-3" />
          Copy
        </button>
      </div>
      <div className="font-mono text-3xs text-neutral-300 bg-brand-850 p-2 rounded border border-brand-750 truncate max-w-full">
        {value}
      </div>
    </div>
  )
}
