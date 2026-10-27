import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { electionService } from '@/services/electionService'
import { ipfsService } from '@/services/ipfsService'
import { toast } from 'sonner'
import type { CreateElectionFormData } from '@/types/domain'
import { 
  ArrowLeft, ArrowRight, Check, Calendar, Settings, 
  Database, Info, AlertTriangle, FileText, CheckCircle, Globe
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const now = () => new Date()

const createElectionSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(120, 'Title must be 120 characters or fewer'),
    description: z
      .string()
      .max(1000, 'Description must be 1000 characters or fewer')
      .optional()
      .default(''),
    election_type: z.enum(['single_choice', 'multi_choice']),
    max_votes_per_voter: z
      .number({ invalid_type_error: 'Must be a number' })
      .int('Must be a whole number')
      .min(1, 'Must be at least 1'),
    start_date: z.string().refine(val => {
      if (!val) return false
      return new Date(val) > now()
    }, 'Start date must be in the future'),
    end_date: z.string().min(1, 'End date is required'),
  })
  .refine(
    data => {
      if (!data.start_date || !data.end_date) return true
      return new Date(data.end_date) > new Date(data.start_date)
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

type FormState = 'idle' | 'submitting' | 'error'

export function CreateElectionPage() {
  const { activeMembership } = useAuth()
  const navigate = useNavigate()
  const [formState, setFormState] = useState<FormState>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1)
  const [timezone, setTimezone] = useState('UTC')
  const [blockchainNetwork, setBlockchainNetwork] = useState('ethereum_sepolia')

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<CreateElectionFormData>({
    resolver: zodResolver(createElectionSchema),
    defaultValues: {
      election_type: 'single_choice',
      max_votes_per_voter: 1,
    },
  })

  const electionType = watch('election_type')
  const electionTitle = watch('title')
  const electionDescription = watch('description')
  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const maxVotes = watch('max_votes_per_voter')

  const handleNextStep1 = async () => {
    const isValid = await trigger(['title', 'description'])
    if (isValid) setCurrentStep(2)
  }

  const handleNextStep2 = async () => {
    const isValid = await trigger(['election_type', 'max_votes_per_voter'])
    if (isValid) setCurrentStep(3)
  }

  const handleNextStep3 = async () => {
    const isValid = await trigger(['start_date', 'end_date'])
    if (isValid) setCurrentStep(4)
  }

  const onSubmit = async (data: CreateElectionFormData) => {
    if (!activeMembership?.org_id) {
      setServerError('No active organization found. Please refresh and try again.')
      return
    }

    setFormState('submitting')
    setServerError(null)

    try {
      // 1. Pin public non-sensitive manifest to IPFS
      let ipfsCid: string | null = null
      try {
        const ipfsResult = await ipfsService.uploadElectionManifest({
          version: '1.0.0',
          election_id: 'draft',
          org_id: activeMembership.org_id,
          title: data.title,
          description: data.description || null,
          election_type: data.election_type,
          max_votes_per_voter:
            data.election_type === 'single_choice' ? 1 : data.max_votes_per_voter,
          start_date: new Date(data.start_date).toISOString(),
          end_date: new Date(data.end_date).toISOString(),
          created_at: new Date().toISOString(),
          candidates: [],
        })
        ipfsCid = ipfsResult.cid
      } catch (ipfsErr) {
        console.warn('[CreateElectionPage] IPFS pinning notice:', ipfsErr)
      }

      // 2. Persist election with ipfs_cid to Supabase
      const created = await electionService.create({
        org_id: activeMembership.org_id,
        title: data.title,
        description: data.description || null,
        election_type: data.election_type,
        max_votes_per_voter:
          data.election_type === 'single_choice' ? 1 : data.max_votes_per_voter,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        status: 'draft',
        ipfs_cid: ipfsCid,
      })

      toast.success(ipfsCid ? 'Election created & pinned to IPFS!' : 'Election created successfully!')
      navigate(`/organizer/elections/${created.id}`, { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      setServerError(message)
      toast.error(message)
      setFormState('error')
    }
  }

  const orgName = activeMembership?.organization?.name ?? 'your organization'

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          <Link to="/organizer" className="hover:text-accent-400 transition-colors">
            Organizer Panel
          </Link>
          <span>/</span>
          <span className="text-neutral-300">Create Election</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
          Create Election Wizard
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Complete the steps to deploy a ballot on the secure ledger.
        </p>
      </div>

      {/* Progress Wizard Indicator */}
      <div className="relative flex items-center justify-between w-full px-4 mb-4 select-none">
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand-700/60 z-0" />
        <div 
          className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-accent-600 transition-all duration-300 z-0" 
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        />
        {[1, 2, 3, 4].map((step) => (
          <button
            key={step}
            type="button"
            disabled={step > currentStep && !errors}
            onClick={() => setCurrentStep(step)}
            className={`relative z-10 flex items-center justify-center h-9 w-9 rounded-full font-bold text-xs border transition-all duration-200 ${
              currentStep === step
                ? 'bg-accent-600 border-accent-500 text-neutral-100 ring-4 ring-accent-950 shadow-md shadow-accent-600/20'
                : currentStep > step
                  ? 'bg-brand-900 border-accent-600 text-accent-400'
                  : 'bg-brand-900 border-brand-700 text-neutral-500'
            }`}
          >
            {currentStep > step ? <Check className="h-4 w-4" /> : step}
          </button>
        ))}
      </div>

      {/* Server Error Banner */}
      {serverError && (
        <div className="p-4 rounded-xl bg-danger-950 border border-danger-900/60 text-xs text-danger-400 flex items-start gap-2 animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Form Area */}
      <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
          
          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-sm font-bold text-neutral-200 border-b border-brand-700/40 pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent-500" />
                Step 1: General Information
              </h3>
              
              <Field label="Election Title" error={errors.title?.message} required>
                <input
                  type="text"
                  placeholder="e.g. Student Union President 2026"
                  className={inputClass(!!errors.title)}
                  {...register('title')}
                />
              </Field>

              <Field label="Description" error={errors.description?.message}>
                <textarea
                  rows={4}
                  placeholder="Describe the purpose, candidate requirements, and voting regulations of this ballot..."
                  className={inputClass(!!errors.description)}
                  {...register('description')}
                />
              </Field>

              <div className="p-3 bg-brand-900 border border-brand-700/40 rounded-xl flex items-center justify-between text-2xs">
                <span className="text-neutral-500">Host Organization</span>
                <span className="font-semibold text-neutral-300">{orgName}</span>
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-700/40">
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="px-5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all flex items-center gap-1.5 shadow-md shadow-accent-600/10"
                >
                  Configure Ballot
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Election Type */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-sm font-bold text-neutral-200 border-b border-brand-700/40 pb-2 flex items-center gap-2">
                <Settings className="h-4 w-4 text-accent-500" />
                Step 2: Ballot Configuration
              </h3>

              <Field label="Election Type" error={errors.election_type?.message} required>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      {
                        value: 'single_choice',
                        label: 'Single Choice',
                        description: 'Each voter selects exactly one candidate.',
                        icon: CheckCircle,
                        disabled: false,
                      },
                      {
                        value: 'multi_choice',
                        label: 'Multi Choice (Approval)',
                        description: 'Voters can select multiple candidates up to a defined limit.',
                        icon: Check,
                        disabled: false,
                      },
                    ] as const
                  ).map(opt => (
                    <label
                      key={opt.value}
                      className={`flex flex-col gap-1 rounded-xl border p-4.5 cursor-pointer transition-all ${
                        electionType === opt.value
                          ? 'border-accent-500 bg-accent-950/20'
                          : 'border-brand-700 bg-brand-900 hover:border-brand-600'
                      }`}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        className="sr-only"
                        {...register('election_type')}
                      />
                      <opt.icon className="h-5 w-5 text-accent-400 mb-1" />
                      <span className="text-xs font-bold text-neutral-100">
                        {opt.label}
                      </span>
                      <span className="text-3xs text-neutral-500 leading-normal">{opt.description}</span>
                    </label>
                  ))}
                  
                  {/* Ranked Choice (Placeholder visual mock matching target request) */}
                  <div className="flex flex-col gap-1 rounded-xl border p-4.5 border-brand-700/40 bg-brand-900/40 opacity-50 cursor-not-allowed">
                    <span className="text-lg">🔢</span>
                    <span className="text-xs font-bold text-neutral-400">
                      Ranked Choice (ZKP Mock)
                    </span>
                    <span className="text-3xs text-neutral-500 leading-normal">
                      Voters rank candidates. ZK-Snark validation coming soon.
                    </span>
                  </div>
                </div>
              </Field>

              {/* Max Votes (Only for Multi Choice) */}
              {electionType === 'multi_choice' && (
                <Field
                  label="Max Candidates Selectable"
                  error={errors.max_votes_per_voter?.message}
                  required
                  hint="Specify the candidate limit each voter is allowed to submit."
                >
                  <input
                    type="number"
                    min={1}
                    className={inputClass(!!errors.max_votes_per_voter)}
                    {...register('max_votes_per_voter', { valueAsNumber: true })}
                  />
                </Field>
              )}

              <div className="flex justify-between pt-4 border-t border-brand-700/40">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-brand-900 transition-colors flex items-center gap-1.5 border border-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="px-5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all flex items-center gap-1.5 shadow-md shadow-accent-600/10"
                >
                  Schedule dates
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Dates & Blockchain */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-sm font-bold text-neutral-200 border-b border-brand-700/40 pb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent-500" />
                Step 3: Scheduling & Network
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Start Date & Time" error={errors.start_date?.message} required>
                  <input
                    type="datetime-local"
                    className={inputClass(!!errors.start_date)}
                    {...register('start_date')}
                  />
                </Field>
                <Field label="End Date & Time" error={errors.end_date?.message} required>
                  <input
                    type="datetime-local"
                    className={inputClass(!!errors.end_date)}
                    {...register('end_date')}
                  />
                </Field>
              </div>

              {/* Timezone Selector */}
              <Field label="Timezone" required>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="EST">EST (Eastern Standard Time)</option>
                  <option value="GMT">GMT (Greenwich Mean Time)</option>
                  <option value="IST">IST (Indian Standard Time)</option>
                </select>
              </Field>

              {/* Blockchain Network */}
              <Field label="Target Ledger Network" required>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                    blockchainNetwork === 'ethereum_sepolia' ? 'border-accent-500 bg-accent-950/20' : 'border-brand-700 bg-brand-900'
                  }`}>
                    <input 
                      type="radio" 
                      name="network" 
                      value="ethereum_sepolia" 
                      checked={blockchainNetwork === 'ethereum_sepolia'} 
                      onChange={() => setBlockchainNetwork('ethereum_sepolia')} 
                      className="sr-only" 
                    />
                    <Database className="h-4 w-4 text-accent-400" />
                    <div>
                      <div className="text-xs font-bold text-neutral-100">Ethereum Sepolia</div>
                      <div className="text-[10px] text-neutral-400">Chain ID: 11155111 (Free Test ETH)</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 rounded-xl border p-3.5 border-brand-700/40 bg-brand-900/40 opacity-60 cursor-pointer">
                    <Database className="h-4 w-4 text-neutral-500" />
                    <div>
                      <div className="text-xs font-bold text-neutral-300">Polygon Amoy</div>
                      <div className="text-[10px] text-neutral-500">Secondary L2 testnet backup</div>
                    </div>
                  </label>
                </div>
              </Field>

              <div className="flex justify-between pt-4 border-t border-brand-700/40">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-brand-900 transition-colors flex items-center gap-1.5 border border-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep3}
                  className="px-5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all flex items-center gap-1.5 shadow-md shadow-accent-600/10"
                >
                  Review election
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-sm font-bold text-neutral-200 border-b border-brand-700/40 pb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success-500" />
                Step 4: Final Verification
              </h3>

              <div className="p-4 bg-brand-905 border border-brand-700/50 rounded-xl flex flex-col gap-3 text-xs leading-normal">
                <div className="flex justify-between border-b border-brand-700/30 pb-2">
                  <span className="text-neutral-500">Ballot Name:</span>
                  <span className="font-semibold text-neutral-200">{electionTitle}</span>
                </div>
                <div className="flex justify-between border-b border-brand-700/30 pb-2">
                  <span className="text-neutral-500">Description:</span>
                  <span className="text-neutral-300 max-w-[280px] truncate" title={electionDescription}>
                    {electionDescription || 'None'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-brand-700/30 pb-2">
                  <span className="text-neutral-500">Choice Type:</span>
                  <span className="font-semibold text-neutral-200 capitalize">
                    {electionType === 'single_choice' ? 'Single Choice' : `Multi Choice (Max: ${maxVotes})`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-brand-700/30 pb-2">
                  <span className="text-neutral-500">Dates:</span>
                  <span className="text-neutral-300">
                    {new Date(startDate).toLocaleString()} &rarr; {new Date(endDate).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-brand-700/30 pb-2">
                  <span className="text-neutral-500">Network / Ledger:</span>
                  <span className="font-semibold text-accent-400 capitalize">
                    Ethereum Sepolia Testnet ({timezone})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-accent-400" />
                    Decentralized Storage:
                  </span>
                  <span className="font-semibold text-accent-400 text-3xs bg-accent-950/60 border border-accent-800/40 px-2 py-0.5 rounded-full">
                    IPFS Manifest (Decentralized & Immutable)
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-brand-900 border border-brand-700/40 rounded-xl flex items-start gap-3">
                <Info className="h-4.5 w-4.5 text-accent-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-neutral-500 leading-normal">
                  Elections deploy initially in Draft. You will configure candidate manifests and ZK proofs before triggering final release transactions on-chain.
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t border-brand-700/40">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-brand-900 transition-colors flex items-center gap-1.5 border border-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  className="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-xs font-bold text-neutral-100 transition-all flex items-center gap-1.5 shadow-md shadow-accent-600/10"
                >
                  {formState === 'submitting' ? 'Deploying...' : 'Deploy Draft Election'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Input Styling Helpers
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 text-xs bg-brand-900 border rounded-lg text-neutral-100 placeholder-neutral-600
    focus:outline-none focus:ring-2 transition-colors
    ${
      hasError
        ? 'border-danger-600 focus:ring-danger-500 focus:border-danger-500'
        : 'border-brand-700 focus:ring-accent-500 focus:border-accent-500'
    }`
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean | undefined
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-2xs font-bold text-neutral-400 uppercase tracking-widest">
        {label}
        {required && <span className="text-danger-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-[10px] text-neutral-500 -mt-1">{hint}</p>}
      {children}
      {error && (
        <p className="text-[10px] text-danger-400 flex items-center gap-1 mt-0.5">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}
