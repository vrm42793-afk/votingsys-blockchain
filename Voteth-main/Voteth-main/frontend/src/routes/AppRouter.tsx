import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { GuestRoute } from './GuestRoute'

import { LandingPage } from '@/components/pages/LandingPage'
import { LoginPage } from '@/components/pages/LoginPage'
import { RegisterPage } from '@/components/pages/RegisterPage'
import { NotFoundPage } from '@/components/pages/NotFoundPage'
import { DashboardPage } from '@/components/pages/DashboardPage'
import { ElectionsPage } from '@/components/pages/ElectionsPage'
import { AdminPage } from '@/components/pages/AdminPage'
import { AdminLoginPage } from '@/components/pages/AdminLoginPage'
import { CreateElectionPage } from '@/components/pages/CreateElectionPage'
import { CreateOrganizationPage } from '@/components/pages/CreateOrganizationPage'
import { ManageMembersPage } from '@/components/pages/ManageMembersPage'
import { ElectionDetailPage } from '@/components/pages/ElectionDetailPage'
import { VotePage } from '@/components/pages/VotePage'
import { ElectionResultsPage } from '@/components/pages/ElectionResultsPage'
import { ElectionAnalyticsPage } from '@/components/pages/ElectionAnalyticsPage'
import { ElectionFraudPage } from '@/components/pages/ElectionFraudPage'
import { AuthCallbackPage } from '@/components/pages/AuthCallbackPage'
import { PlatformOwnerPage } from '@/components/pages/PlatformOwnerPage'
import { OrgSettingsPage } from '@/components/pages/OrgSettingsPage'
import { VoteReceiptPage } from '@/components/pages/VoteReceiptPage'
import { MyVotesPage } from '@/components/pages/MyVotesPage'
import { ForgotPasswordPage } from '@/components/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/components/pages/ResetPasswordPage'
import { PlatformSettingsPage } from '@/components/pages/PlatformSettingsPage'
import { PlatformDeployPage } from '@/components/pages/PlatformDeployPage'
import { PrivacyPolicyPage } from '@/components/pages/PrivacyPolicyPage'
import { VotingRulesPage } from '@/components/pages/VotingRulesPage'

/**
 * VotEth 2.0 — Application Router
 *
 * Defines all route paths for the VotEth frontend.
 * Routes are wrapped in RLS-matched layouts and boundary guards.
 */

// Placeholder component for routes not yet implemented
function ComingSoon({ page }: { page: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md border border-brand-700 bg-brand-900/60">
        <div className="text-accent-400 text-4xl mb-4">🗳️</div>
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{page}</h1>
        <p className="text-neutral-400 text-xs mb-4">
          This feature module is coming soon in a later development phase.
        </p>
        <p className="text-neutral-500 text-2xs">
          VotEth 2.0 Core Architecture Layout Active.
        </p>
      </div>
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      {/* ------------------------------------------------------------------ */}
      {/* PUBLIC ROUTES (No Auth Required)                                  */}
      {/* ------------------------------------------------------------------ */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<ComingSoon page="About VotEth 2.0" />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/rules" element={<VotingRulesPage />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* GUEST ONLY ROUTES (Redirects authenticated users)                 */}
      {/* ------------------------------------------------------------------ */}
      <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/magic-link" element={<ComingSoon page="Magic Link Login" />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/verify-email" element={<ComingSoon page="Email Verification" />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* PROTECTED VOTER ROUTES                                             */}
      {/* ------------------------------------------------------------------ */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/elections" element={<ElectionsPage />} />
        <Route path="/elections/:electionId" element={<ElectionDetailPage />} />
        <Route path="/elections/:electionId/vote" element={<VotePage />} />
        <Route path="/elections/:electionId/receipt" element={<VoteReceiptPage />} />
        <Route path="/elections/:electionId/results" element={<ElectionResultsPage />} />
        <Route path="/my-votes" element={<MyVotesPage />} />

        {/* Candidate Scope (Voter subrole) */}
        <Route path="/candidates/:candidateId" element={<ComingSoon page="Candidate Campaign Profile" />} />
        <Route path="/candidate/portal" element={<ComingSoon page="Candidate Control Portal" />} />
        <Route path="/candidate/portal/campaign" element={<ComingSoon page="Campaign Content Editor" />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* PROTECTED ORGANIZER ONBOARDING & DASHBOARD                         */}
      {/* ------------------------------------------------------------------ */}
      <Route element={<ProtectedRoute requireOrganizer><DashboardLayout /></ProtectedRoute>}>
        <Route path="/organizer" element={<AdminPage />} />
        <Route path="/organizations/new" element={<CreateOrganizationPage />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* PROTECTED ORGANIZER WORKSPACE SUBROUTES (Requires Admin Membership)*/}
      {/* ------------------------------------------------------------------ */}
      <Route element={<ProtectedRoute requireOrganizer requiredRole="admin"><DashboardLayout /></ProtectedRoute>}>
        <Route path="/organizer/elections/new" element={<CreateElectionPage />} />
        <Route path="/organizer/elections/:electionId" element={<ElectionDetailPage />} />
        <Route path="/organizer/elections/:electionId/analytics" element={<ElectionAnalyticsPage />} />
        <Route path="/organizer/elections/:electionId/fraud" element={<ElectionFraudPage />} />
        <Route path="/organizer/members" element={<ManageMembersPage />} />
        <Route path="/organizer/settings" element={<OrgSettingsPage />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* PROTECTED ADMIN OWNER ROUTES                                       */}
      {/* ------------------------------------------------------------------ */}
      <Route element={<ProtectedRoute requiredPlatformRole="owner"><DashboardLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<PlatformOwnerPage />} />
        <Route path="/admin/organizations" element={<PlatformOwnerPage defaultTab="organizations" />} />
        <Route path="/admin/users" element={<PlatformOwnerPage defaultTab="users" />} />
        <Route path="/admin/elections" element={<PlatformOwnerPage defaultTab="elections" />} />
        <Route path="/admin/settings" element={<PlatformSettingsPage />} />
        <Route path="/admin/deploy" element={<PlatformDeployPage />} />
        <Route path="/admin/audit-log" element={<PlatformOwnerPage defaultTab="logs" />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* FALLBACK                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
