import React, { useState } from 'react';
import { HaqdarReasoningResponse, Language } from '../types';
import { t } from '../utils/i18n';
import { KeyRound, AlertTriangle, ExternalLink, Database, CheckCircle2, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

interface ReasoningViewProps {
  reasoningData: HaqdarReasoningResponse | null;
  language: Language;
  onNavigateToGraph: () => void;
  onNavigateToAction: () => void;
}

export const ReasoningView: React.FC<ReasoningViewProps> = ({
  reasoningData,
  language,
  onNavigateToGraph,
  onNavigateToAction
}) => {
  const [expandedTraceIdx, setExpandedTraceIdx] = useState<number | null>(0);

  if (!reasoningData) {
    return (
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-12 text-center space-y-4">
        <Database className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-base font-semibold text-slate-300">
          No Graph Deductions Yet
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Configure a citizen profile in Citizen Intake or load a sample persona, then click "Analyze Eligibility & Prerequisites" to query the FalkorDB graph.
        </p>
      </div>
    );
  }

  const {
    profile_summary,
    eligible_schemes,
    top_unlock_document,
    conflicts_detected,
    execution_traces,
    disclaimer
  } = reasoningData;

  return (
    <div className="space-y-8">
      {/* Profile Header & Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-white/[0.06] rounded-2xl p-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {profile_summary}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <span>FalkorDB Traversal</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-emerald-400 font-semibold tabular-nums">
              {eligible_schemes.length} Schemes Qualified
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400 font-semibold tabular-nums">
              {top_unlock_document ? `+${top_unlock_document.unlocks_count} Unlock Leverage` : 'Complete Documentation'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onNavigateToGraph}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Explore Graph</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNavigateToAction}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
          >
            <span>Action Roadmap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Unlock Document Callout Card */}
      {top_unlock_document ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/80 border border-amber-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Highest Impact Unlock Document</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {top_unlock_document.name}
              </h2>
              <p className="text-sm text-slate-300 max-w-xl">
                Obtaining this single document directly unlocks{' '}
                <strong className="text-amber-300 font-semibold">{top_unlock_document.unlocks_count} eligible schemes</strong>{' '}
                for the applicant.
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 pt-1">
                <span>Issuing Authority: <strong className="text-slate-200">{top_unlock_document.issued_by}</strong></span>
                {top_unlock_document.portal_url && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={top_unlock_document.portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>Digital Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
                {top_unlock_document.prerequisites && top_unlock_document.prerequisites.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Required Proofs: <span className="text-slate-300">{top_unlock_document.prerequisites.join(', ')}</span></span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0 bg-slate-950/80 border border-amber-500/20 rounded-2xl p-4 text-center min-w-[130px]">
              <div className="text-3xl font-extrabold text-amber-400 font-mono tabular-nums">
                +{top_unlock_document.unlocks_count}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Schemes Unlocked
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
              Complete Documentation Portfolio
            </div>
            <div className="text-xs text-slate-200 mt-0.5">
              The citizen possesses all foundational prerequisite documents required for eligible schemes.
            </div>
          </div>
        </div>
      )}

      {/* Scheme Mutual Exclusivity & Conflict Alerts (Query 3) */}
      {conflicts_detected && conflicts_detected.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Scheme Mutual Exclusivity Detected (Query 3)</span>
          </div>
          {conflicts_detected.map((conflict, idx) => (
            <div key={idx} className="text-xs text-slate-300 leading-relaxed">
              Conflict between <strong className="text-rose-300">{conflict.scheme_a}</strong> and{' '}
              <strong className="text-rose-300">{conflict.scheme_b}</strong>. Under Single Benefit Provision, an applicant cannot receive concurrent monthly pensions.
            </div>
          ))}
        </div>
      )}

      {/* Eligible Schemes Grid (Query 1) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>{t(language, 'sec_eligible_schemes')}</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold tabular-nums">
              ({eligible_schemes.length})
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">openCypher Grounded</span>
        </div>

        {eligible_schemes.length === 0 ? (
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-8 text-center text-xs text-slate-400">
            No welfare schemes matched the current parameters. Try adjusting the state or occupation criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eligible_schemes.map((scheme, idx) => (
              <div
                key={idx}
                className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {scheme.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Verified Government Entitlement
                    </div>
                  </div>
                  <a
                    href={scheme.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Visit Official Portal"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/[0.04]">
                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                    Statutory Benefit
                  </div>
                  <div className="text-xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">
                    {scheme.benefit}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Direct Benefit Transfer (DBT)</span>
                  <a
                    href={scheme.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-medium text-xs flex items-center gap-1"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FalkorDB openCypher Query Execution Traces */}
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>{t(language, 'sec_traces')}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            FalkorDB Cloud Engine
          </span>
        </div>

        <div className="space-y-3">
          {execution_traces.map((trace, idx) => {
            const isExpanded = expandedTraceIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-xl bg-slate-950/70 border border-white/[0.06] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedTraceIdx(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      0{idx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {trace.stepDescription}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                    <span className="text-emerald-400 tabular-nums">
                      {trace.executionTimeMs} ms
                    </span>
                    <span className="text-slate-500">
                      {trace.recordsCount} records
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-white/[0.06] bg-black/40 space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                        Executed openCypher Query
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-950 border border-white/[0.04] text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                        {trace.query}
                      </pre>
                    </div>

                    {trace.params && Object.keys(trace.params).length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                          Query Parameters ($params)
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-950 border border-white/[0.04] text-[11px] font-mono text-amber-300 overflow-x-auto">
                          {JSON.stringify(trace.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mandatory Statutory Disclaimer */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 leading-relaxed text-center">
        {disclaimer}
      </div>
    </div>
  );
};
