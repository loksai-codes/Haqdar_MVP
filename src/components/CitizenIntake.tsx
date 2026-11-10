import React, { useState } from 'react';
import { CitizenProfile, Language } from '../types';
import { t } from '../utils/i18n';
import { Mic, MicOff, Sparkles, ShieldCheck, ArrowRight, UserCheck, RefreshCw, Check } from 'lucide-react';

interface CitizenIntakeProps {
  profile: CitizenProfile;
  setProfile: React.Dispatch<React.SetStateAction<CitizenProfile>>;
  language: Language;
  onRunReasoning: () => void;
  isLoading: boolean;
}

const ALL_DOCUMENTS = [
  'Aadhaar Card',
  'Food Security Card (Ration Card)',
  'Pattadar Passbook (Land Title)',
  'Bank Passbook',
  'Spouse Death Certificate',
  'Income Certificate',
  'Community / Caste Certificate'
];

export const CitizenIntake: React.FC<CitizenIntakeProps> = ({
  profile,
  setProfile,
  language,
  onRunReasoning,
  isLoading
}) => {
  const [naturalText, setNaturalText] = useState('');
  const [isParsingSpeech, setIsParsingSpeech] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);

  // Preset Citizen Profiles
  const handleLoadPreset = (presetKey: 'lakshmi' | 'ramesh' | 'sunita' | 'mallaiah') => {
    if (presetKey === 'lakshmi') {
      setProfile({
        state: 'Telangana',
        age: 42,
        gender: 'female',
        marital_status: 'widow',
        occupation: 'agricultural labourer',
        annual_income: 65000,
        held_documents: ['Aadhaar Card', 'Food Security Card (Ration Card)'],
        preferred_language: language
      });
      setNaturalText('నేను 42 ఏళ్ల వ్యవసాయ కూలీని, భర్త చనిపోయారు. నా దగ్గర ఆధార్ కార్డు, రేషన్ కార్డు ఉన్నాయి. వార్షిక ఆదాయం ₹65,000.');
    } else if (presetKey === 'ramesh') {
      setProfile({
        state: 'Telangana',
        age: 51,
        gender: 'male',
        marital_status: 'married',
        occupation: 'farmer',
        annual_income: 140000,
        held_documents: ['Aadhaar Card', 'Pattadar Passbook (Land Title)', 'Bank Passbook'],
        preferred_language: language
      });
      setNaturalText('I am a 51 year old farmer from Telangana with annual income ₹1,40,000. I hold Aadhaar, Pattadar Passbook, and Bank Passbook.');
    } else if (presetKey === 'sunita') {
      setProfile({
        state: 'Telangana',
        age: 28,
        gender: 'female',
        marital_status: 'married',
        occupation: 'artisan',
        annual_income: 80000,
        held_documents: ['Aadhaar Card'],
        preferred_language: language
      });
      setNaturalText('मैं 28 वर्षीय हथकरघा बुनकर हूँ, आय ₹80,000, केवल आधार कार्ड है।');
    } else if (presetKey === 'mallaiah') {
      setProfile({
        state: 'Telangana',
        age: 65,
        gender: 'male',
        marital_status: 'widow',
        occupation: 'farmer',
        annual_income: 95000,
        held_documents: ['Aadhaar Card', 'Income Certificate', 'Bank Passbook'],
        preferred_language: language
      });
      setNaturalText('65 year old widower farmer in Telangana with Aadhaar, Income certificate, and active bank account.');
    }
  };

  const handleDocumentToggle = (docName: string) => {
    setProfile(prev => {
      const exists = prev.held_documents.includes(docName);
      return {
        ...prev,
        held_documents: exists
          ? prev.held_documents.filter(d => d !== docName)
          : [...prev.held_documents, docName]
      };
    });
  };

  const handleParseNaturalInput = async () => {
    if (!naturalText.trim()) return;
    setIsParsingSpeech(true);
    setPrivacyMessage(null);

    try {
      const res = await fetch('/api/intake/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: naturalText, language })
      });
      const data = await res.json();
      if (data.extracted) {
        setProfile(prev => ({
          ...prev,
          ...data.extracted
        }));
      }
      if (data.privacyNotice) {
        setPrivacyMessage(data.privacyNotice);
      }
    } catch (err) {
      console.error('Error parsing intake:', err);
    } finally {
      setIsParsingSpeech(false);
    }
  };

  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your details in the text box.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNaturalText(transcript);
      };

      recognition.start();
    } catch (err) {
      console.warn('Voice recognition error:', err);
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="border-b border-white/[0.06] pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Citizen Demographics & Document Portfolio
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter citizen parameters in Hindi, Telugu, or English. All inputs are screened for privacy with zero Aadhaar number retention.
        </p>
      </div>

      {/* Verified Preset Citizen Personas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            Quick Test Personas
          </span>
          <span className="text-slate-500">Click to instantly populate profile</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'lakshmi', nameKey: 'preset_lakshmi_name', roleKey: 'preset_lakshmi_role', descKey: 'preset_lakshmi_desc' },
            { key: 'ramesh', nameKey: 'preset_ramesh_name', roleKey: 'preset_ramesh_role', descKey: 'preset_ramesh_desc' },
            { key: 'sunita', nameKey: 'preset_sunita_name', roleKey: 'preset_sunita_role', descKey: 'preset_sunita_desc' },
            { key: 'mallaiah', nameKey: 'preset_mallaiah_name', roleKey: 'preset_mallaiah_role', descKey: 'preset_mallaiah_desc' }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => handleLoadPreset(p.key as any)}
              className="text-left p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-emerald-500/40 hover:bg-slate-900 transition-all duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="font-semibold text-xs text-white group-hover:text-emerald-400 transition-colors">
                  {t(language, p.nameKey)}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {t(language, p.roleKey)}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {t(language, p.descKey)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Clean Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 Cols): Demographic Parameters */}
        <div className="lg:col-span-7 bg-slate-900/40 border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Core Demographic Parameters
            </h2>
            <span className="text-xs text-slate-500 font-mono">FalkorDB Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t(language, 'lbl_state')}
              </label>
              <select
                value={profile.state}
                onChange={e => setProfile(prev => ({ ...prev, state: e.target.value }))}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Telangana">Telangana</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Goa">Goa</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Maharashtra">Maharashtra</option>
              </select>
            </div>

            {/* Marital Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t(language, 'lbl_marital')}
              </label>
              <select
                value={profile.marital_status}
                onChange={e => setProfile(prev => ({ ...prev, marital_status: e.target.value }))}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors capitalize"
              >
                <option value="widow">Widow / Widower</option>
                <option value="married">Married</option>
                <option value="single">Single / Unmarried</option>
                <option value="divorced">Divorced / Separated</option>
              </select>
            </div>

            {/* Age */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t(language, 'lbl_age')}
                </label>
                <span className="text-xs font-mono tabular-nums text-emerald-400 font-bold">
                  {profile.age} years
                </span>
              </div>
              <input
                type="range"
                min={18}
                max={85}
                value={profile.age}
                onChange={e => setProfile(prev => ({ ...prev, age: parseInt(e.target.value, 10) }))}
                className="w-full accent-emerald-400 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t(language, 'lbl_gender')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['female', 'male', 'other'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setProfile(prev => ({ ...prev, gender: g }))}
                    className={`py-2 text-xs font-medium rounded-xl capitalize border transition-all cursor-pointer ${
                      profile.gender === g
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t(language, 'lbl_occupation')}
              </label>
              <select
                value={profile.occupation}
                onChange={e => setProfile(prev => ({ ...prev, occupation: e.target.value }))}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="farmer">Farmer / Agricultural Landowner</option>
                <option value="agricultural labourer">Agricultural Labourer</option>
                <option value="artisan">Artisan / Handloom Weaver</option>
                <option value="daily wage worker">Daily Wage Worker</option>
                <option value="homemaker">Homemaker</option>
                <option value="self-employed">Self-Employed / Small Vendor</option>
              </select>
            </div>

            {/* Annual Income */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t(language, 'lbl_income')}
                </label>
                <span className="text-xs font-mono tabular-nums text-emerald-400 font-bold">
                  ₹{profile.annual_income.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={20000}
                max={300000}
                step={5000}
                value={profile.annual_income}
                onChange={e => setProfile(prev => ({ ...prev, annual_income: parseInt(e.target.value, 10) }))}
                className="w-full accent-emerald-400 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Held Documents Portfolio & Conversational Input */}
        <div className="lg:col-span-5 space-y-6">
          {/* Conversational Assistant Input */}
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase font-mono">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vernacular Voice & Text</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ID Protected</span>
              </span>
            </div>

            <div className="relative">
              <textarea
                value={naturalText}
                onChange={e => setNaturalText(e.target.value)}
                placeholder={t(language, 'lbl_voice_placeholder')}
                rows={3}
                className="w-full bg-slate-950 border border-white/[0.08] rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`p-2 rounded-lg border text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isListening
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-white border-white/[0.08]'
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
                </button>

                <button
                  type="button"
                  disabled={isParsingSpeech || !naturalText.trim()}
                  onClick={handleParseNaturalInput}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  {isParsingSpeech ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {privacyMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300 leading-relaxed">
                {privacyMessage}
              </div>
            )}
          </div>

          {/* Held Documents Checklist */}
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Held Documents Portfolio
              </h3>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {profile.held_documents.length} / {ALL_DOCUMENTS.length} Held
              </span>
            </div>

            <div className="space-y-2">
              {ALL_DOCUMENTS.map(docName => {
                const isChecked = profile.held_documents.includes(docName);
                return (
                  <button
                    key={docName}
                    type="button"
                    onClick={() => handleDocumentToggle(docName)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-100'
                        : 'bg-slate-950/40 border-white/[0.04] text-slate-400 hover:border-white/[0.1] hover:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-medium truncate pr-2">
                      {docName}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Execution Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onRunReasoning}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t(language, 'btn_analyzing')}</span>
            </>
          ) : (
            <>
              <span>{t(language, 'btn_run_reasoning')}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
