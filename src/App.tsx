/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CitizenProfile, HaqdarReasoningResponse, Language } from './types';
import { Header } from './components/Header';
import { CitizenIntake } from './components/CitizenIntake';
import { ReasoningView } from './components/ReasoningView';
import { GraphVisualizer } from './components/GraphVisualizer';
import { ActionDossier } from './components/ActionDossier';
import { CypherConsole } from './components/CypherConsole';
import { t } from './utils/i18n';
import { ShieldCheck, Award, Landmark, TrendingUp, CheckCircle2 } from 'lucide-react';

const INITIAL_PROFILE: CitizenProfile = {
  state: 'Telangana',
  age: 42,
  gender: 'female',
  marital_status: 'widow',
  occupation: 'agricultural labourer',
  annual_income: 65000,
  held_documents: ['Aadhaar Card', 'Food Security Card (Ration Card)'],
  preferred_language: 'en'
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('intake');
  const [language, setLanguage] = useState<Language>('en');
  const [profile, setProfile] = useState<CitizenProfile>(INITIAL_PROFILE);
  const [reasoningData, setReasoningData] = useState<HaqdarReasoningResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.falkordb?.connected !== undefined) {
          setCloudConnected(data.falkordb.connected);
        }
      })
      .catch(() => {});

    // Automatically perform initial reasoning on mount
    executeReasoning(INITIAL_PROFILE);
  }, []);

  const executeReasoning = async (currentProfile: CitizenProfile = profile) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/graph/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProfile)
      });
      const data = await res.json();
      if (data && !data.error) {
        setReasoningData(data);
      }
    } catch (err) {
      console.error('Reasoning failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunReasoningAndNavigate = async () => {
    await executeReasoning(profile);
    setActiveTab('reasoning');
  };

  const handleNewAssessment = () => {
    setProfile(INITIAL_PROFILE);
    executeReasoning(INITIAL_PROFILE);
    setActiveTab('intake');
  };

  const eligibleCount = reasoningData?.eligible_schemes?.length ?? 0;
  const hasAasara = reasoningData?.eligible_schemes?.some(s => s.name.includes('Aasara')) ?? false;
  const hasRythuBima = reasoningData?.eligible_schemes?.some(s => s.name.includes('Rythu Bima')) ?? false;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        onNewAssessment={handleNewAssessment}
        cloudConnected={cloudConnected}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Sleek KPI Summary Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {t(language, 'stat_total_schemes')}
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
                {eligibleCount} Verified
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {t(language, 'stat_monthly_support')}
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums tracking-tight">
                {hasAasara ? '₹2,016 / mo' : 'Direct DBT'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {t(language, 'stat_insurance_cover')}
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
                {hasRythuBima ? '₹5,00,000' : 'Social Security'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {t(language, 'stat_unlock_potential')}
              </div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums tracking-tight">
                {reasoningData?.top_unlock_document ? `+${reasoningData.top_unlock_document.unlocks_count} Leverage` : 'Complete'}
              </div>
            </div>
          </div>
        </div>

        {/* Viewport Tabs */}
        {activeTab === 'intake' && (
          <CitizenIntake
            profile={profile}
            setProfile={setProfile}
            language={language}
            onRunReasoning={handleRunReasoningAndNavigate}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'reasoning' && (
          <ReasoningView
            reasoningData={reasoningData}
            language={language}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToAction={() => setActiveTab('action')}
          />
        )}

        {activeTab === 'graph' && (
          <GraphVisualizer
            highlightNodes={reasoningData?.highlight_nodes || []}
            eligibleSchemes={reasoningData?.eligible_schemes?.map(s => s.name) || []}
            missingDocuments={reasoningData?.top_unlock_document ? [reasoningData.top_unlock_document.name] : []}
            heldDocuments={profile.held_documents}
          />
        )}

        {activeTab === 'action' && (
          <ActionDossier
            reasoningData={reasoningData}
            language={language}
          />
        )}

        {activeTab === 'cypher' && <CypherConsole />}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-white/[0.06] bg-[#070a12] py-6 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Haqdar</span>
            <span aria-hidden="true">·</span>
            <span>Graph-Powered Welfare Benefit Intelligence</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-400">FalkorDB openCypher</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Aadhaar Zero-Storage Privacy</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500">
              AWS ap-south-1
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
