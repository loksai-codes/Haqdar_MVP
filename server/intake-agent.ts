import type { CitizenProfile } from './agent-reasoning.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 15000;

// Regex to detect 12-digit Indian Aadhaar numbers or 10-char PAN numbers to redact immediately
export function scrubGovernmentIdTokens(text: string): { cleanedText: string; idsDetected: boolean } {
  const aadhaarPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  const panPattern = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;

  const cleanedText = text
    .replace(aadhaarPattern, '[REDACTED_AADHAAR_REMOVED_FOR_PRIVACY]')
    .replace(panPattern, '[REDACTED_PAN_REMOVED_FOR_PRIVACY]');

  const idsDetected = cleanedText !== text;

  return { cleanedText, idsDetected };
}

/**
 * Heuristic fallback parser if Gemini API key is absent or offline.
 */
function heuristicParse(text: string): Partial<CitizenProfile> {
  const lower = text.toLowerCase();
  const profile: Partial<CitizenProfile> = {};

  // Age extraction
  const ageMatch = lower.match(/(?:వయస్సు|उम्र|age|years? old|sal|saal)\s*[:=]?\s*(\d{1,2})/i) ||
                   lower.match(/(\d{1,2})\s*(?:years? old|సంవత్సరాలు|साल|yrs)/i);
  if (ageMatch) {
    profile.age = parseInt(ageMatch[1], 10);
  }

  // State
  if (lower.includes('telangana') || lower.includes('తెలంగాణ') || lower.includes('तेलंगाना')) {
    profile.state = 'Telangana';
  } else if (lower.includes('andhra') || lower.includes('ఆంధ్ర') || lower.includes('आंध्र')) {
    profile.state = 'Andhra Pradesh';
  } else if (lower.includes('goa') || lower.includes('గోవా') || lower.includes('गोवा')) {
    profile.state = 'Goa';
  }

  // Marital Status
  if (lower.includes('widow') || lower.includes('వితంతువు') || lower.includes('విధవ') || lower.includes('विधवा')) {
    profile.marital_status = 'widow';
  } else if (lower.includes('married') || lower.includes('వివాహిత') || lower.includes('శ్రీమతి') || lower.includes('विवाहित')) {
    profile.marital_status = 'married';
  } else if (lower.includes('single') || lower.includes('unmarried') || lower.includes('అవివాహిత') || lower.includes('अविवाहित')) {
    profile.marital_status = 'single';
  }

  // Gender
  if (lower.includes('female') || lower.includes('woman') || lower.includes('ఆమె') || lower.includes('మహిళ') || lower.includes('महिला') || lower.includes('స్త్రీ') || profile.marital_status === 'widow') {
    profile.gender = 'female';
  } else if (lower.includes('male') || lower.includes('man') || lower.includes('పురుషుడు') || lower.includes('पुरुष')) {
    profile.gender = 'male';
  }

  // Occupation
  if (lower.includes('farmer') || lower.includes('రైతు') || lower.includes('किसान') || lower.includes('వ్యవసాయ')) {
    profile.occupation = 'farmer';
  } else if (lower.includes('labour') || lower.includes('కూలీ') || lower.includes('मजदूर')) {
    profile.occupation = 'agricultural labourer';
  } else if (lower.includes('artisan') || lower.includes('చేనేత') || lower.includes('बुनकर')) {
    profile.occupation = 'artisan';
  }

  // Income
  const incomeMatch = lower.match(/(?:income|ఆదాయం|आय|salary|rupees|₹|rs\.?)\s*[:=]?\s*(\d+[\d,]*)/i) ||
                      lower.match(/(\d+[\d,]*)\s*(?:rupees|lakh|లక్ష|लाख|k|rs)/i);
  if (incomeMatch) {
    const rawNum = incomeMatch[1].replace(/,/g, '');
    let val = parseInt(rawNum, 10);
    if (lower.includes('lakh') || lower.includes('లక్ష') || lower.includes('लाख')) {
      val = val * 100000;
    }
    profile.annual_income = val;
  }

  // Held documents
  const docs: string[] = [];
  if (lower.includes('aadhaar') || lower.includes('ఆధార్') || lower.includes('आधार')) docs.push('Aadhaar Card');
  if (lower.includes('ration') || lower.includes('రేషన్') || lower.includes('రాషన్') || lower.includes('खाद्य')) docs.push('Food Security Card (Ration Card)');
  if (lower.includes('pattadar') || lower.includes('పట్టాదారు') || lower.includes('passbook') || lower.includes('పాస్ పుస్తకం') || lower.includes('पट्टा')) docs.push('Pattadar Passbook (Land Title)');
  if (lower.includes('bank') || lower.includes('బ్యాంక్') || lower.includes('बैंक')) docs.push('Bank Passbook');
  if (lower.includes('death certificate') || lower.includes('మరణ ధృవీకరణ') || lower.includes('मृत्यु')) docs.push('Spouse Death Certificate');
  if (lower.includes('income certificate') || lower.includes('ఆదాయ ధృవీకరణ') || lower.includes('आय प्रमाण')) docs.push('Income Certificate');
  if (lower.includes('caste') || lower.includes('కుల ధృవీకరణ') || lower.includes('जाति')) docs.push('Community / Caste Certificate');

  if (docs.length > 0) {
    profile.held_documents = docs;
  }

  return profile;
}

/**
 * Intelligent Multilingual Intake Agent:
 * Takes conversational citizen speech or text in Hindi, Telugu, or English,
 * guarantees zero Aadhaar storage, and extracts structured profile parameters.
 */
export async function parseCitizenIntake(input: string, language: 'en' | 'te' | 'hi' = 'en'): Promise<{
  extracted: CitizenProfile;
  privacyNotice: string;
  assistantReply: string;
  provider?: 'groq' | 'heuristic';
}> {
  const { cleanedText, idsDetected } = scrubGovernmentIdTokens(input);

  const defaultProfile: CitizenProfile = {
    state: 'Telangana',
    age: 42,
    gender: 'female',
    marital_status: 'widow',
    occupation: 'farmer',
    annual_income: 90000,
    held_documents: ['Aadhaar Card', 'Food Security Card (Ration Card)'],
    preferred_language: language
  };

  const privacyNotice = idsDetected
    ? '🛡️ Privacy Guard Activated: Detected potential Aadhaar/identity number in input. Per Haqdar privacy protocols, government identity numbers are stripped and never recorded.'
    : '🛡️ Privacy Guard Active: No Aadhaar or identity numbers stored.';

  const buildFallbackResult = () => {
    const heuristic = heuristicParse(cleanedText);
    const merged: CitizenProfile = {
      ...defaultProfile,
      ...heuristic,
      held_documents: heuristic.held_documents || defaultProfile.held_documents,
      preferred_language: language
    };

    let reply = `Understood your profile: ${merged.age} years, ${merged.occupation} from ${merged.state}. Proceeding to graph reasoning.`;
    if (language === 'te') {
      reply = `మీ ప్రొఫైల్ వివరాలు స్వీకరించబడ్డాయి: వయస్సు ${merged.age}, ${merged.state} నుండి ${merged.occupation}. సంక్షేమ పథకాల విశ్లేషణ సిద్ధంగా ఉంది.`;
    } else if (language === 'hi') {
      reply = `आपकी जानकारी दर्ज कर ली गई है: उम्र ${merged.age} वर्ष, ${merged.state} से ${merged.occupation}। कल्याणकारी योजनाओं की जांच हो रही है।`;
    }

    return {
      extracted: merged,
      privacyNotice,
      assistantReply: reply,
      provider: 'heuristic' as const
    };
  };

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.warn('[Groq Intake] GROQ_API_KEY is not set. Using heuristic intake parser.');
    return buildFallbackResult();
  }

  try {
    const systemPrompt = `You are the INTAKE AGENT of "Haqdar", a graph-powered AI welfare navigator built for Indian citizens.
You communicate fluently in Hindi, Telugu, or English.
Your job:
1. Parse citizen demographics from user text or transcript.
2. Return ONLY a valid JSON object with these exact keys:
   - state (string, default "Telangana")
   - age (integer, between 18 and 100)
   - gender ("female", "male", or "other")
   - marital_status ("single", "married", "widow", "divorced")
   - occupation (string, e.g. "farmer", "agricultural labourer", "artisan", "daily wage worker", "homemaker", "self-employed")
   - annual_income (number in INR)
   - held_documents (array of strings, chosen ONLY from: "Aadhaar Card", "Food Security Card (Ration Card)", "Spouse Death Certificate", "Income Certificate", "Pattadar Passbook (Land Title)", "Bank Passbook", "Community / Caste Certificate")
   - assistant_reply (warm, empathetic 1-2 sentence reply in the citizen's preferred language: "${language}")
3. CRITICAL PRIVACY RULE: NEVER extract or output Aadhaar numbers, PAN numbers, or government identity tokens.`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Citizen statement: "${cleanedText}". Preferred language: ${language}. Extract profile JSON.` }
        ]
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Groq API returned HTTP ${response.status}`);
    }

    const payload: any = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty completion content from Groq API');
    }

    const parsed = JSON.parse(rawContent);

    const allowedGenders = ['female', 'male', 'other'];
    const normalizedGender = typeof parsed.gender === 'string' ? parsed.gender.toLowerCase() : '';

    const resultProfile: CitizenProfile = {
      state: parsed.state || defaultProfile.state,
      age: Number(parsed.age) || defaultProfile.age,
      gender: allowedGenders.includes(normalizedGender) ? normalizedGender : defaultProfile.gender,
      marital_status: typeof parsed.marital_status === 'string' ? parsed.marital_status.toLowerCase() : defaultProfile.marital_status,
      occupation: parsed.occupation || defaultProfile.occupation,
      annual_income: Number(parsed.annual_income) || defaultProfile.annual_income,
      held_documents: Array.isArray(parsed.held_documents) && parsed.held_documents.length > 0 ? parsed.held_documents : defaultProfile.held_documents,
      preferred_language: language
    };

    return {
      extracted: resultProfile,
      privacyNotice,
      assistantReply: parsed.assistant_reply || 'Profile processed successfully.',
      provider: 'groq'
    };
  } catch (err: any) {
    console.warn('[Groq Intake] Falling back to heuristic parser:', err?.message || 'Unknown error');
    return buildFallbackResult();
  }
}
