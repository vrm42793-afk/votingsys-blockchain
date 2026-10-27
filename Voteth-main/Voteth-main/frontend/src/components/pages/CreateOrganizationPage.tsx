import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { organizationService, OrganizationServiceError } from '@/services/organizationService'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Error Details Interface
// ---------------------------------------------------------------------------

interface ErrorDetails {
  code?: string | undefined
  details?: string | null | undefined
  hint?: string | null | undefined
}

function extractErrorInfo(err: unknown): { message: string; details: ErrorDetails } {
  if (err instanceof OrganizationServiceError) {
    return {
      message: err.message,
      details: {
        code: err.code,
        details: err.details,
        hint: err.hint,
      },
    }
  }

  if (err instanceof Error) {
    const e = err as any
    return {
      message: err.message || 'An error occurred during organization creation.',
      details: {
        code: e.code,
        details: e.details,
        hint: e.hint,
      },
    }
  }

  if (typeof err === 'string' && err.trim().length > 0) {
    return { message: err, details: {} }
  }

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, any>
    const msg =
      e.message ||
      e.error?.message ||
      e.error_description ||
      (typeof e.error === 'string' ? e.error : null) ||
      e.details ||
      'Failed to create organization. Check permissions and database settings.'

    return {
      message: String(msg),
      details: {
        code: e.code || e.error?.code,
        details: e.details || e.error?.details,
        hint: e.hint || e.error?.hint,
      },
    }
  }

  return {
    message: 'An unknown error occurred while communicating with Supabase.',
    details: {},
  }
}

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be 100 characters or fewer'),
  slug: z
    .string()
    .min(2, 'URL slug must be at least 2 characters')
    .max(50, 'URL slug must be 50 characters or fewer')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase, alphanumeric, and separated by hyphens'
    ),
})

type CreateOrgFormData = z.infer<typeof createOrgSchema>

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'submitting' | 'error'

/**
 * CreateOrganizationPage — Organization creation form.
 * Validates organization name and URL slug. Creator becomes admin via RLS.
 * Requirement: ORG-01
 */
export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [formState, setFormState] = useState<FormState>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: '', slug: '' },
  })

  const nameValue = watch('name')

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setValue('slug', slug, { shouldValidate: true })
  }

  const onSubmit = async (data: CreateOrgFormData) => {
    setFormState('submitting')
    setServerError(null)
    setErrorDetails(null)

    try {
      await organizationService.create({
        name: data.name,
        slug: data.slug,
      })

      await refreshProfile()
      toast.success('Organization created successfully!')
      navigate('/organizer', { replace: true })
    } catch (err: unknown) {
      const { message, details } = extractErrorInfo(err)

      // Capture and log actual Supabase error code, message, details, and hint (safely, no secrets)
      console.error('[CreateOrganizationPage] Organization creation failed:', {
        code: details.code ?? 'N/A',
        message,
        details: details.details ?? 'N/A',
        hint: details.hint ?? 'N/A',
        raw: err,
      })

      setServerError(message)
      setErrorDetails(details)
      toast.error(message)
      setFormState('error')
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
          <Link to="/organizer" className="hover:text-accent-400 transition-colors">
            Organizer Panel
          </Link>
          <span>/</span>
          <span className="text-neutral-300">Create Organization</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">
          Create Organization
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Organizations group your elections and team members.
          You'll become the{' '}
          <span className="text-accent-400 font-medium">admin</span> automatically.
        </p>
      </div>

      {/* Server Error Banner */}
      {serverError && (
        <div className="p-4 rounded-lg bg-danger-900/40 border border-danger-700 text-sm text-danger-300 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <div className="font-semibold">{serverError}</div>
          </div>

          {(errorDetails?.code || errorDetails?.details || errorDetails?.hint) && (
            <div className="bg-neutral-950/70 border border-danger-900/60 rounded p-3 text-xs font-mono space-y-1.5 text-neutral-300">
              {errorDetails.code && (
                <div>
                  <span className="text-neutral-500">Error Code:</span>{' '}
                  <span className="text-danger-400 font-bold">{errorDetails.code}</span>
                </div>
              )}
              {errorDetails.details && (
                <div>
                  <span className="text-neutral-500">Details:</span> {errorDetails.details}
                </div>
              )}
              {errorDetails.hint && (
                <div>
                  <span className="text-neutral-500">Hint:</span> {errorDetails.hint}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        {/* Organization Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Organization Name
            <span className="text-danger-500 ml-1">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Riverside University"
            className={inputClass(!!errors.name)}
            {...register('name', { onChange: handleNameChange })}
          />
          {errors.name && (
            <p className="text-xs text-danger-400 flex items-center gap-1">
              <span>⚠</span> {errors.name.message}
            </p>
          )}
        </div>

        {/* URL Slug */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            URL Slug
            <span className="text-danger-500 ml-1">*</span>
          </label>
          <p className="text-xs text-neutral-600 -mt-1">
            This creates a unique URL for your organization.
          </p>
          <div className="flex items-center gap-0">
            <span className="px-3 py-2 text-sm bg-brand-800 border border-r-0 border-brand-700 rounded-l-lg text-neutral-500">
              voteth.app/
            </span>
            <input
              type="text"
              placeholder="riverside-university"
              className={`${inputClass(!!errors.slug)} rounded-l-none`}
              {...register('slug')}
            />
          </div>
          {nameValue && !errors.slug && (
            <p className="text-xs text-neutral-500">
              Preview: <span className="text-accent-400">voteth.app/{watch('slug')}</span>
            </p>
          )}
          {errors.slug && (
            <p className="text-xs text-danger-400 flex items-center gap-1">
              <span>⚠</span> {errors.slug.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-brand-700">
          <button
            type="submit"
            disabled={formState === 'submitting'}
            className="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-sm font-semibold text-neutral-100 transition-all shadow-md shadow-accent-600/20"
          >
            {formState === 'submitting' ? 'Creating...' : 'Create Organization'}
          </button>
          <Link
            to="/dashboard"
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-brand-800 transition-all"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 text-sm bg-brand-950 border rounded-lg text-neutral-100 placeholder-neutral-600
    focus:outline-none focus:ring-1 transition-colors
    ${
      hasError
        ? 'border-danger-600 focus:ring-danger-500 focus:border-danger-500'
        : 'border-brand-700 focus:ring-accent-500 focus:border-accent-500'
    }`
}
