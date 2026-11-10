import React, { useState } from 'react';
import { HaqdarReasoningResponse, Language } from '../types';
import { t } from '../utils/i18n';
import { MessageSquare, Copy, Check, Share2, Printer, ExternalLink, Calendar, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ActionDossierProps {
  reasoningData: HaqdarReasoningResponse | null;
  language: Language;
}

export const ActionDossier: React.FC<ActionDossierProps> = ({
  reasoningData,
  language
}) => {
  const [copied, setCopied] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  if (!reasoningData) {
    return (
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-12 text-center text-xs text-slate-400">
        Run an assessment in Citizen Intake to generate your Action Roadmap and WhatsApp Summary.
      </div>
    );
  }

  const {
    profile_summary,
    action_roadmap,
    whatsapp_message,
    disclaimer
  } = reasoningData;

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsapp_message).then(() => {
      setCopied(true);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(whatsapp_message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleStepCompletion = (stepNum: number) => {
    setCompletedSteps(prev =>
      prev.includes(stepNum) ? prev.filter(s => s !== stepNum) : [...prev, stepNum]
    );
  };

  return (
    <div className="space-y-8 print:p-0 print:space-y-4">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Action Roadmap & Citizen Dossier
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Chronological roadmap to acquire prerequisite documents, visit designated offices, and claim unlocked benefits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t(language, 'btn_print_dossier')}</span>
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
          >
            <Share2 className="w-4 h-4" />
            <span>{t(language, 'btn_share_whatsapp')}</span>
          </button>
        </div>
      </div>

      {/* Citizen Profile Card in Print Mode */}
      <div className="hidden print:block bg-white text-black p-4 border border-black mb-4">
        <h2 className="text-xl font-bold">HAQDAR - Citizen Welfare Eligibility Dossier</h2>
        <p className="text-xs mt-1">Profile: {profile_summary}</p>
        <p className="text-xs">Navigation based on verified public schemes</p>
      </div>

      {/* Action Roadmap Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>{t(language, 'sec_roadmap')}</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold tabular-nums">
              ({completedSteps.length} of {action_roadmap.length} completed)
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Prioritized Sequence</span>
        </div>

        <div className="space-y-3">
          {action_roadmap.map(step => {
            const isCompleted = completedSteps.includes(step.step);
            return (
              <div
                key={step.step}
                className={`p-5 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-slate-950/30 border-white/[0.03] opacity-60'
                    : 'bg-slate-900/40 border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleStepCompletion(step.step)}
                      className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                          : 'border-white/[0.1] bg-slate-950 text-slate-400 hover:border-emerald-500'
                      }`}
                      title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs font-mono">{step.step}</span>}
                    </button>

                    <div className="space-y-1.5">
                      <h3 className={`text-sm font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-white'}`}>
                        {step.task}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{step.office}</span>
                        </span>

                        {step.portal_url && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a
                              href={step.portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>Official Portal</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}

                        {step.timeline && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3 h-3" />
                              <span>{step.timeline}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {step.requires && step.requires.length > 0 && (
                        <div className="text-[11px] text-slate-500 pt-0.5">
                          Required documents: <span className="text-slate-300">{step.requires.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border uppercase shrink-0 ${
                      step.status === 'ready'
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-950 border-white/[0.06] text-slate-400'
                    }`}
                  >
                    {step.status === 'ready' ? 'Actionable Now' : 'Dependent'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp Ready Share Card */}
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-6 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              {t(language, 'sec_whatsapp')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] hover:border-white/[0.16] text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : t(language, 'btn_copy_whatsapp')}</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-white/[0.04] font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
          {whatsapp_message}
        </div>
      </div>

      {/* Statutory Disclaimer */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 text-center leading-relaxed">
        {disclaimer}
      </div>
    </div>
  );
};
