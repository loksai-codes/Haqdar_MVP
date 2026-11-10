import React from 'react';
import { Language } from '../types';
import { t } from '../utils/i18n';
import { Plus } from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  onNewAssessment: () => void;
  cloudConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  onNewAssessment,
  cloudConnected
}) => {
  const navTabs = [
    { id: 'intake', labelKey: 'tab_intake' },
    { id: 'reasoning', labelKey: 'tab_reasoning' },
    { id: 'graph', labelKey: 'tab_graph' },
    { id: 'action', labelKey: 'tab_action' },
    { id: 'cypher', labelKey: 'tab_cypher' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('intake')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <Logo size="md" showTagline={true} />
            </button>
          </div>

          {/* Zone 2: Concise single-line navigation tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.08] text-white font-semibold shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`}
                >
                  {t(language, tab.labelKey)}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Language Switcher and Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Language Segmented Control */}
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 text-xs">
              {(['en', 'te', 'hi'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 cursor-pointer ${
                    language === lang
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang === 'en' ? 'EN' : lang === 'te' ? 'తెలుగు' : 'हिन्दी'}
                </button>
              ))}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={onNewAssessment}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-white/[0.12] rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-white/[0.2]"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t(language, 'btn_new_assessment')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
