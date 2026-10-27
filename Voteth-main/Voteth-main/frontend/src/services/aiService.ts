import { supabase } from '@services/supabase/client'
import type { AiFraudFlag } from '@/types/domain'

// ---------------------------------------------------------------------------
// aiService
// AI-powered features via Supabase Edge Functions.
// Requirements: AI-01, AI-02, AI-03, AI-04, AI-05
// ---------------------------------------------------------------------------

/** Response from the fraud detection Edge Function. */
interface FraudDetectionResponse {
  flagsCreated: number
  analysisId: string
}

/** Response from the election assistant Edge Function. */
interface AssistantResponse {
  answer: string
  sources: string[]
}

/** Response from the candidate summary Edge Function. */
interface CandidateSummaryResponse {
  summary: string
  generatedAt: string
}

export const aiService = {
  /**
   * Trigger fraud detection analysis for an election.
   * Calls the `ai-fraud-detect` Edge Function.
   * Requirement: AI-01
   */
  async detectFraud(electionId: string): Promise<FraudDetectionResponse> {
    const { data, error } = await supabase.functions.invoke('ai-fraud-detect', {
      body: { election_id: electionId },
    })

    if (error) throw error
    return data as FraudDetectionResponse
  },

  /**
   * Get all fraud flags for an election.
   * Requirement: AI-02
   */
  async getFraudFlags(electionId: string): Promise<AiFraudFlag[]> {
    const { data, error } = await supabase
      .from('ai_fraud_flags')
      .select('*')
      .eq('election_id', electionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as AiFraudFlag[]
  },

  /**
   * Dismiss a fraud flag (marks as resolved/false positive).
   * Requirement: AI-03
   */
  async dismissFraudFlag(flagId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_fraud_flags')
      .update({ status: 'dismissed' })
      .eq('id', flagId)

    if (error) throw error
  },

  /**
   * Escalate a fraud flag for further investigation.
   * Creates an audit log entry on escalation.
   * Requirement: AI-03
   */
  async escalateFraudFlag(flagId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_fraud_flags')
      .update({ status: 'escalated' })
      .eq('id', flagId)

    if (error) throw error
  },

  /**
   * Ask the election assistant a natural language question.
   * Calls the `ai-assistant` Edge Function.
   * Requirement: AI-04
   */
  async askAssistant(
    electionId: string,
    question: string
  ): Promise<AssistantResponse> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { election_id: electionId, question },
    })

    if (error) throw error
    return data as AssistantResponse
  },

  /**
   * Generate an AI summary for a candidate.
   * Calls the `ai-candidate-summary` Edge Function.
   * Requirement: AI-05
   */
  async generateCandidateSummary(
    candidateId: string
  ): Promise<CandidateSummaryResponse> {
    const { data, error } = await supabase.functions.invoke(
      'ai-candidate-summary',
      {
        body: { candidate_id: candidateId },
      }
    )

    if (error) throw error
    return data as CandidateSummaryResponse
  },
}
