import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Mic, 
  Send, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2
} from 'lucide-react';

const API_BASE = import.meta.env.DEV 
  ? 'http://127.0.0.1:8000/api' 
  : '/api';

// List of test users matching backend/test_users.md
const TEST_USERS = [
  { name: 'Enkh', id: 'e1a8b9c8-1234-5678-abcd-ef0123456789', pattern: 'Anxious-leaning' },
  { name: 'Alex', id: 'f2b9c0d1-2345-6789-bcde-f0123456789a', pattern: 'Avoidant-leaning' },
  { name: 'Taylor', id: 'a3c0d1e2-3456-7890-cdef-0123456789ab', pattern: 'Secure' },
  { name: 'Jordan', id: 'b4d1e2f3-4567-8901-def0-123456789abc', pattern: 'Disorganized' },
  { name: 'Morgan', id: 'c5e2f3a4-5678-9012-ef01-23456789abcd', pattern: 'Anxious-leaning' }
];

// Scenario-based onboarding questions. Answers are sent to the assessor agent.
const ONBOARD_QUESTIONS = [
  {
    q: "Your partner takes hours to reply to a casual text. What happens first in you?",
    options: [
      { label: "I start checking my phone and worry I said something wrong.", style: "Anxious" },
      { label: "I shrug and give it space — I've got my own things going on.", style: "Avoidant" },
      { label: "I assume they got caught up; we can talk later, it's okay.", style: "Secure" },
      { label: "I feel anxious, then tell myself I don't need anyone and pull away.", style: "Disorganized" },
    ],
  },
  {
    q: "When a relationship starts getting really close, you notice…",
    options: [
      { label: "I want constant reassurance and worry it could slip away.", style: "Anxious" },
      { label: "an urge to keep some distance and protect my space.", style: "Avoidant" },
      { label: "I feel comfortable and trust where it's going.", style: "Secure" },
      { label: "I crave being close but also feel the pull to withdraw.", style: "Disorganized" },
    ],
  },
  {
    q: "After a fight with someone you love, you usually…",
    options: [
      { label: "replay it and overthink every word, waiting for them to reach out.", style: "Anxious" },
      { label: "go quiet and shut down until I've cooled off alone.", style: "Avoidant" },
      { label: "want to talk it through honestly once we're both calm.", style: "Secure" },
      { label: "reach out, then pull away the moment it feels too close.", style: "Disorganized" },
    ],
  },
  {
    q: "There was a time you almost reached out — but didn't. Why?",
    options: [
      { label: "I worried I'd seem too needy or be a bother.", style: "Anxious" },
      { label: "I was tired and figured I'd just handle it myself.", style: "Avoidant" },
      { label: "Honestly I did reach out — I'd rather just communicate.", style: "Secure" },
      { label: "I almost called, then put the phone down at the last second.", style: "Disorganized" },
    ],
  },
  {
    q: "The story you catch yourself telling about why closeness is hard:",
    options: [
      { label: "I overthink that people will drift away if I'm not careful.", style: "Anxious" },
      { label: "I'm better off alone; depending on people feels unsafe, so I keep my independence.", style: "Avoidant" },
      { label: "Closeness isn't always easy, but I trust it's worth it.", style: "Secure" },
      { label: "I want to be close and need space at the very same time.", style: "Disorganized" },
    ],
  },
];

const QUICK_REPLIES = [
  "I'm not sure, honestly.",
  "Tell me more.",
  "That's hard to sit with.",
  "I keep avoiding it.",
];

export default function App() {
  // Developer user switcher state
  const [currentUser, setCurrentUser] = useState(TEST_USERS[0]);
  const [screen, setScreen] = useState('welcome'); // 'welcome' | 'onboard' | 'reveal' | 'home' | 'journal' | 'chat' | 'mirror' | 'map'
  
  // Data states
  const [journals, setJournals] = useState([]);
  const [chats, setChats] = useState([]);
  const [observations, setObservations] = useState([]);
  const [attachmentMap, setAttachmentMap] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showReflection, setShowReflection] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [activeReflectionTab, setActiveReflectionTab] = useState('current'); // 'current' | 'ideal'
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [expandedTimelineId, setExpandedTimelineId] = useState(null);
  const [mirrorChatInput, setMirrorChatInput] = useState('');
  const [mirrorChatLoading, setMirrorChatLoading] = useState(false);
  const [mirrorVoiceRecording, setMirrorVoiceRecording] = useState(false);
  const audioRef = useRef(null);
  const mirrorRecognitionRef = useRef(null);
  
  // Interactive UI states
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [onboardChoice, setOnboardChoice] = useState(null);
  const [onboardCustom, setOnboardCustom] = useState('');
  const [onboardListening, setOnboardListening] = useState(false);
  const [activeTopic, setActiveTopic] = useState('general'); // 'general' | 'relationship' | 'mental' | 'family'
  const [onboardStep, setOnboardStep] = useState(0);
  const [onboardAnswers, setOnboardAnswers] = useState([]);
  const recognitionRef = useRef(null);
  const [assessment, setAssessment] = useState(null);
  const [assessing, setAssessing] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [savedJournalTags, setSavedJournalTags] = useState([]);
  
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Mirror Session specific states
  const [mirrorSubScreen, setMirrorSubScreen] = useState('intro'); // 'intro' | 'observation' | 'integration'
  const [obsIndex, setObsIndex] = useState(0); // 0, 1, or 2 (complete)
  const [mirrorStatus, setMirrorStatus] = useState('idle'); // 'idle' | 'analyzing' | 'finished'

  const chatEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const recordingTimer = useRef(null);

  // Load user data whenever current user changes
  useEffect(() => {
    fetchUserData();
  }, [currentUser]);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, isTyping]);

  const fetchUserData = async () => {
    setLoading(true);
    const headers = { 'x-user-id': currentUser.id };
    try {
      const [journalRes, chatRes, obsRes, mapRes, profileRes, reflectionsRes] = await Promise.all([
        axios.get(`${API_BASE}/journals`, { headers }),
        axios.get(`${API_BASE}/chats?topic=general`, { headers }),
        axios.get(`${API_BASE}/observations`, { headers }),
        axios.get(`${API_BASE}/attachment-map`, { headers }),
        axios.get(`${API_BASE}/profile`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_BASE}/reflections`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setJournals(journalRes.data);
      setChats(chatRes.data);
      setObservations(obsRes.data);
      setAttachmentMap(mapRes.data);
      setProfile(profileRes ? profileRes.data : null);
      setTimeline(reflectionsRes ? reflectionsRes.data : []);
      setObsIndex(0);
    } catch (err) {
      console.error("Error loading user data from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (e) => {
    const selected = TEST_USERS.find(u => u.id === e.target.value);
    if (selected) {
      setCurrentUser(selected);
      // Reset temporary states
      setJournalInput('');
      setIsRecording(false);
      setSavedJournalTags([]);
      setChatInput('');
      setActiveTopic('general');
      setScreen('home'); // Send to home on user switch
    }
  };

  // --- JOURNAL LOGIC ---
  const toggleRecording = () => {
    if (isRecording) {
      clearInterval(recordingTimer.current);
      setIsRecording(false);
      setJournalInput(prev => prev + ` [Voice note snippet - duration: ${recordTime}s]`);
      setRecordTime(0);
    } else {
      setIsRecording(true);
      setRecordTime(0);
      recordingTimer.current = setInterval(() => {
        setRecordTime(t => t + 1);
      }, 1000);
    }
  };

  const saveJournal = async () => {
    if (!journalInput.trim() && !isRecording) return;
    setSaveStatus('saving');
    setLoading(true);
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.post(`${API_BASE}/journals`, {
        content: journalInput,
        voice_duration: isRecording ? recordTime : null
      }, { headers });
      
      setJournals(prev => [res.data, ...prev]);
      setSavedJournalTags(res.data.tags);
      setJournalInput('');
      
      // Update attachment counts locally
      const mapRes = await axios.get(`${API_BASE}/attachment-map`, { headers });
      setAttachmentMap(mapRes.data);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error("Error saving journal:", err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const changeTopic = async (topic) => {
    setActiveTopic(topic);
    setLoading(true);
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.get(`${API_BASE}/chats?topic=${topic}`, { headers });
      setChats(res.data);
    } catch (err) {
      console.error("Error changing topic:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- CHAT LOGIC ---
  const sendChatMessage = async (textToSend) => {
    const message = textToSend || chatInput;
    if (!message.trim()) return;
    
    setChatInput('');
    const headers = { 'x-user-id': currentUser.id };
    
    // Optimistically add user message
    const userMsg = {
      id: Date.now().toString(),
      user_id: currentUser.id,
      created_at: new Date().toISOString(),
      sender: 'me',
      message: message,
      topic: activeTopic
    };
    setChats(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE}/chats`, { message, topic: activeTopic }, { headers });
      setChats(prev => [...prev, res.data]);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const selectQuickReply = (replyText) => {
    sendChatMessage(replyText);
  };

  // --- ONBOARDING LOGIC ---
  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setOnboardListening(false);
  };

  const toggleDictation = () => {
    if (onboardListening) {
      stopDictation();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported in this browser — try typing instead.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = onboardCustom ? onboardCustom + ' ' : '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setOnboardChoice(null);
      setOnboardCustom((finalText + interim).trimStart());
    };
    rec.onerror = () => stopDictation();
    rec.onend = () => setOnboardListening(false);
    recognitionRef.current = rec;
    rec.start();
    setOnboardListening(true);
  };

  const startOnboarding = () => {
    setOnboardStep(0);
    setOnboardAnswers([]);
    setOnboardChoice(null);
    setOnboardCustom('');
    stopDictation();
    setAssessment(null);
    setScreen('onboard');
  };

  const handleOnboardContinue = async () => {
    const custom = onboardCustom.trim();
    if (onboardChoice === null && !custom) return;
    stopDictation();
    const chosen = custom || ONBOARD_QUESTIONS[onboardStep].options[onboardChoice].label;
    const updatedAnswers = [...onboardAnswers, chosen];
    setOnboardAnswers(updatedAnswers);

    if (onboardStep + 1 < ONBOARD_QUESTIONS.length) {
      setOnboardStep(onboardStep + 1);
      setOnboardChoice(null);
      setOnboardCustom('');
      return;
    }

    // Last question answered -> run the assessment agent
    setAssessing(true);
    setScreen('reveal');
    try {
      const res = await axios.post(
        `${API_BASE}/onboarding/assess`,
        { answers: updatedAnswers },
        { headers: { 'x-user-id': currentUser.id } }
      );
      setAssessment(res.data);
    } catch (err) {
      console.error("Error assessing onboarding:", err);
    } finally {
      setAssessing(false);
    }
  };

  // --- MIRROR LOGIC ---
  const generateMirrorObservations = async () => {
    setMirrorStatus('analyzing');
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.post(`${API_BASE}/observations/generate`, {}, { headers });
      setObservations(res.data);
      setObsIndex(0);
      setMirrorSubScreen('intro');
      setMirrorStatus('finished');
    } catch (err) {
      console.error("Error running Mirror pipeline:", err);
      setMirrorStatus('idle');
    }
  };

  const handleObsFeedback = async (obsId, val) => {
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.post(`${API_BASE}/observations/${obsId}/feedback`, { feedback: val }, { headers });
      // Update local state
      setObservations(prev => prev.map(o => o.id === obsId ? res.data : o));
      // Move to next slide after a short delay
      setTimeout(() => {
        if (obsIndex + 1 >= observations.length) {
          setMirrorSubScreen('integration');
        } else {
          setObsIndex(prev => prev + 1);
        }
      }, 500);
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  const playTTS = async (text) => {
    if (ttsPlaying && audioRef.current) {
      audioRef.current.pause();
      setTtsPlaying(false);
      return;
    }
    setTtsPlaying(true);
    try {
      const response = await axios.post(`${API_BASE}/tts`, { text }, { responseType: 'blob' });
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setTtsPlaying(false);
      audio.play();
    } catch (err) {
      console.error("Gemini TTS playback failed:", err);
      setTtsPlaying(false);
    }
  };

  const submitMirrorReflectionQuery = async () => {
    if (!mirrorChatInput.trim() || mirrorChatLoading) return;
    setMirrorChatLoading(true);
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.post(`${API_BASE}/reflections/interact`, { message: mirrorChatInput }, { headers });
      if (res.data && res.data.status === "success") {
        await fetchUserData();
        setMirrorChatInput('');
      }
    } catch (err) {
      console.error("Error updating reflection from mirror interaction:", err);
    } finally {
      setMirrorChatLoading(false);
    }
  };

  const toggleMirrorVoice = () => {
    if (mirrorVoiceRecording && mirrorRecognitionRef.current) {
      mirrorRecognitionRef.current.stop();
      setMirrorVoiceRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    mirrorRecognitionRef.current = recognition;
    setMirrorVoiceRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMirrorChatInput(prev => prev ? prev + ' ' + transcript : transcript);
      setMirrorVoiceRecording(false);
    };
    recognition.onerror = () => setMirrorVoiceRecording(false);
    recognition.onend = () => setMirrorVoiceRecording(false);
    recognition.start();
  };

  const getPatternDescription = (pattern) => {
    if (pattern.includes('Anxious')) {
      return "You stay close. You over-tend. You're often the one who notices the silence before anyone else does.";
    } else if (pattern.includes('Avoidant') || pattern.includes('Disorganized')) {
      return "You keep your distance. You self-soothe. You're often the one who notices the pressure before anyone else does.";
    } else {
      return "You balance closeness and autonomy. You communicate clearly. You feel grounded in relationships.";
    }
  };

  const getPatternQuote = (pattern) => {
    if (pattern.includes('Anxious')) {
      return `"You used the word 'almost' six times. We can come back to that."`;
    } else if (pattern.includes('Avoidant')) {
      return `"You wrote about projects eleven times, but people only twice. Protection has many shapes."`;
    } else {
      return `"A steady pulse. There is space in your stories for both yourself and the other."`;
    }
  };

  const renderTabBar = () => (
    <div className="tab-bar">
      <button 
        className={`tab ${screen === 'home' ? 'on' : ''}`}
        onClick={() => setScreen('home')}
      >
        <svg viewBox="0 0 24 24"><path d="M3 12L12 4l9 8M5 10v10h14V10"/></svg>
        Home
      </button>
      <button 
        className={`tab ${screen === 'journal' ? 'on' : ''}`}
        onClick={() => { setScreen('journal'); setSavedJournalTags([]); }}
      >
        <svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM10 8h4M10 12h4M10 16h2"/></svg>
        Journal
      </button>
      <button 
        className={`tab tab-center ${screen === 'mirror' ? 'on' : ''}`}
        onClick={() => { setScreen('mirror'); setMirrorSubScreen('intro'); }}
      >
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
        Mirror
      </button>
      <button 
        className={`tab ${screen === 'chat' ? 'on' : ''}`}
        onClick={() => setScreen('chat')}
      >
        <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 119 9H4l3-3a9 9 0 01-4-6z"/></svg>
        Chat
      </button>
      <button 
        className={`tab ${screen === 'map' ? 'on' : ''}`}
        onClick={() => setScreen('map')}
      >
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
        Map
      </button>
    </div>
  );

  // Determine if the current screen requires dark styling
  const isDarkScreen = ['welcome', 'onboard', 'reveal'].includes(screen) === false && 
                       (showReflection || (screen === 'mirror' && (mirrorSubScreen === 'intro' || mirrorSubScreen === 'observation' || mirrorSubScreen === 'integration')));

  return (
    <>
      <div className="stage">
        {/* Sleek developer account switcher */}
        <div className="dev-switcher">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-bold">
              Developer Selector
            </span>
            <span className="text-xs text-[#E8B89A] font-semibold">{currentUser.pattern}</span>
          </div>
          <select 
            value={currentUser.id} 
            onChange={handleUserChange}
          >
            {TEST_USERS.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.pattern})</option>
            ))}
          </select>
        </div>

        {/* Brand bar above the phone */}
        <div className="brand-bar">
          <span className="brand-dot"></span>
          <span className="brand-name">Mirror</span>
          <span className="brand-tag">AI for self-inquiry · Built on Gemini</span>
        </div>

        {/* High-fidelity Phone Frame */}
        <div className="phone">
          <div className={`screen ${isDarkScreen ? 'dark' : ''}`}>
            <div className="notch"></div>

            {/* Status Bar */}
            <div className="status">
              <span>9:41</span>
              <div className="right">
                <svg viewBox="0 0 16 12" fill="currentColor">
                  <path d="M1 11h2V7H1v4zm4 0h2V4H5v7zm4 0h2V1H9v10zm4 0h2V8h-2v3z"/>
                </svg>
                <span>100</span>
              </div>
            </div>

            {/* Screens routing */}
            
            {/* 1. WELCOME */}
            {screen === 'welcome' && (
              <div className="screen-content active">
                <div className="welcome-body">
                  <div className="orb-large"></div>
                  <div className="welcome-title">Begin<br/><em>gently</em>.</div>
                  <p className="welcome-sub">Mirror learns who you are through stories, not questions.</p>
                  <button className="cta" onClick={startOnboarding}>I'm ready →</button>
                  <div className="welcome-meta">Takes about 5 minutes</div>
                </div>
              </div>
            )}

            {/* 2. ONBOARDING */}
            {screen === 'onboard' && (
              <div className="screen-content active">
                <div className="ob-body">
                  <div className="ob-step">Question {onboardStep + 1} of {ONBOARD_QUESTIONS.length}</div>
                  <div className="ob-progress">
                    {ONBOARD_QUESTIONS.map((_, i) => (
                      <span key={i} className={i <= onboardStep ? 'on' : ''}></span>
                    ))}
                  </div>
                  <div className="ob-question">{ONBOARD_QUESTIONS[onboardStep].q}</div>
                  <div className="ob-options">
                    {ONBOARD_QUESTIONS[onboardStep].options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`ob-option${onboardChoice === i ? ' sel' : ''}`}
                        onClick={() => { setOnboardChoice(i); setOnboardCustom(''); stopDictation(); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="ob-or">or, in your own words</div>
                  <div className={`ob-custom${onboardCustom ? ' active' : ''}`}>
                    <textarea
                      value={onboardCustom}
                      onChange={(e) => { setOnboardCustom(e.target.value); if (e.target.value) setOnboardChoice(null); }}
                      placeholder="Type how it actually feels for you…"
                      rows={2}
                    />
                    <button
                      type="button"
                      className={`ob-voice${onboardListening ? ' rec' : ''}`}
                      onClick={toggleDictation}
                      title={onboardListening ? 'Stop' : 'Speak'}
                    >
                      <Mic size={18} />
                    </button>
                  </div>
                  {onboardListening && <div className="ob-listening">Listening… speak now</div>}

                  <div className="ob-foot">
                    <div className="ob-hint">Pick what's closest, or say it yourself — no wrong answer.</div>
                    <button
                      className="cta"
                      disabled={onboardChoice === null && !onboardCustom.trim()}
                      onClick={handleOnboardContinue}
                    >
                      {onboardStep + 1 < ONBOARD_QUESTIONS.length ? 'Continue →' : 'See my pattern →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. REVEAL */}
            {screen === 'reveal' && (
              <div className="screen-content active">
                <div className="result-body">
                  {assessing ? (
                    <>
                      <div className="orb-large"></div>
                      <div className="result-eye">Reading your stories</div>
                      <div className="result-title">One moment<em>…</em></div>
                      <p className="result-desc">The Mirror is listening for the shape beneath your words.</p>
                    </>
                  ) : (
                    <>
                      <div className="result-eye">Your pattern</div>
                      <div className="result-title">
                        {assessment ? assessment.pattern_name : (
                          <>
                            {currentUser.pattern.replace('-leaning', '')}
                            {currentUser.pattern.includes('-leaning') ? <><em>-leaning</em>.</> : <>.</>}
                          </>
                        )}
                      </div>
                      {assessment && (
                        <div className="result-eye" style={{ marginTop: 4, opacity: 0.65 }}>
                          {assessment.primary_style}
                          {assessment.secondary_style ? ` · with some ${assessment.secondary_style}` : ''}
                        </div>
                      )}
                      <p className="result-desc">
                        {assessment ? assessment.description : getPatternDescription(currentUser.pattern)}
                      </p>
                      <div className="result-note">
                        <div className="result-note-label">A note from the Mirror</div>
                        <div className="result-note-quote">
                          {assessment ? assessment.quote : getPatternQuote(currentUser.pattern)}
                        </div>
                      </div>
                      {assessment && assessment.triggers && assessment.triggers.length > 0 && (
                        <div className="result-note">
                          <div className="result-note-label">Patterns to watch</div>
                          <div className="result-note-quote" style={{ fontStyle: 'normal' }}>
                            {assessment.triggers.join(' · ')}
                          </div>
                        </div>
                      )}
                      <div className="result-cta">
                        <button className="cta" onClick={() => setScreen('home')}>Enter Mirror</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 4. HOME */}
            {screen === 'home' && (
              <div className="screen-content active">
                <div className="home-scroll-container">
                  <div className="home-head">
                    <div className="home-eye">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="home-greet">
                      Good evening,<br/><em>{currentUser.name}</em>.
                    </div>
                  </div>

                  <div className="home-card" onClick={() => { setScreen('journal'); setSavedJournalTags([]); }}>
                    <div className="home-card-shape"></div>
                    <div className="home-card-label">Today</div>
                    <div className="home-card-title">Write to <em>yourself</em></div>
                    <div className="home-card-meta"><span>2 min · Journal</span><span>→</span></div>
                  </div>

                  <div className="home-card mirror-c" onClick={() => { setScreen('mirror'); setMirrorSubScreen('intro'); }}>
                    <div className="home-card-shape"></div>
                    <div className="home-card-label">Ready now</div>
                    <div className="home-card-title">Your <em>Mirror Session</em></div>
                    <div className="home-card-meta">
                      <span>{observations.length > 0 ? `The Mirror has ${observations.length} notes` : 'Mirror Session'}</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="home-list">
                    {journals.length === 0 ? (
                      <div className="home-list-row">
                        <div className="day">Today</div>
                        <div className="snippet" style={{ fontStyle: 'italic', opacity: 0.6 }}>No entries yet</div>
                      </div>
                    ) : (
                      journals.slice(0, 3).map((j, i) => {
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        const dayName = days[new Date(j.created_at).getDay()];
                        return (
                          <div className="home-list-row" key={j.id || i}>
                            <div className="day">{dayName}</div>
                            <div className="snippet">{j.content}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                {renderTabBar()}
              </div>
            )}

            {/* 5. JOURNAL */}
            {screen === 'journal' && (
              <div className="screen-content active">
                <div className="journal-head">
                  <div className="home-eye">Journal · Today</div>
                  <div className="journal-prompt">What's <em>true</em> right now?</div>
                </div>
                <div className="journal-body">
                  {saveStatus && (
                    <div className={`journal-status-banner ${saveStatus}`}>
                      {saveStatus === 'saving' && (
                        <div className="saving-spinner-wrap">
                          <span className="spinner-dot"></span>
                          <span>Reflecting on your thoughts...</span>
                        </div>
                      )}
                      {saveStatus === 'success' && <span>✓ Journal entry saved and reflected</span>}
                      {saveStatus === 'error' && <span>✗ Failed to save. Please try again.</span>}
                    </div>
                  )}

                  {isRecording ? (
                    <div className="ob-field animate-fade-in" style={{ minHeight: 'auto', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <div className="ob-mic">
                        <div className="ob-mic-dot"></div>
                        <span>Listening · 0:{recordTime < 10 ? `0${recordTime}` : recordTime}</span>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      className="journal-text"
                      value={journalInput}
                      onChange={(e) => setJournalInput(e.target.value)}
                      placeholder="Write without filtering. Let thoughts wander..."
                      disabled={saveStatus === 'saving'}
                    />
                  )}
                  
                  <div className="journal-tags">
                    {savedJournalTags.map((tag, idx) => (
                      <div 
                        key={idx}
                        className={`journal-tag ${tag.includes('auto-tagged') ? 'secondary' : 'primary'}`}
                        style={{ opacity: 1, animation: 'none' }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="journal-foot">
                  <button 
                    className="cta" 
                    onClick={saveJournal}
                    disabled={(!journalInput.trim() && !isRecording) || saveStatus === 'saving'}
                  >
                    {saveStatus === 'saving' && 'Reflecting...'}
                    {saveStatus === 'success' && 'Saved'}
                    {saveStatus === 'error' && 'Failed'}
                    {!saveStatus && 'Save & reflect'}
                  </button>
                  <button 
                    className="journal-voice" 
                    onClick={toggleRecording}
                    disabled={saveStatus === 'saving'}
                    style={{
                      backgroundColor: isRecording ? 'var(--ink)' : 'var(--terra)',
                      transform: isRecording ? 'scale(0.95)' : 'none',
                      opacity: saveStatus === 'saving' ? 0.3 : 1,
                      cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isRecording ? '■' : '●'}
                  </button>
                </div>
                {renderTabBar()}
              </div>
            )}

            {/* 6. CHAT */}
            {screen === 'chat' && (() => {
              const topicDetails = {
                general: { name: "The Therapist", role: "Conscious layer", avatarClass: "avatar-general" },
                anxiety: { name: "The Anxiety Specialist", role: "Worry & panic", avatarClass: "avatar-anxiety" },
                depression: { name: "The Mood Guide", role: "Low mood & motivation", avatarClass: "avatar-depression" },
                trauma: { name: "The Steady Presence", role: "A safe, gentle space", avatarClass: "avatar-trauma" },
                grief: { name: "The Grief Companion", role: "Loss & bereavement", avatarClass: "avatar-grief" },
                stress: { name: "The Burnout Coach", role: "Stress & overwhelm", avatarClass: "avatar-stress" },
                relationship: { name: "The Relationship Guide", role: "Attachment patterns", avatarClass: "avatar-relationship" },
                mental: { name: "The Wellness Coach", role: "Emotional regulation", avatarClass: "avatar-mental" },
                family: { name: "The Family Specialist", role: "Childhood systems", avatarClass: "avatar-family" }
              };
              const details = topicDetails[activeTopic] || topicDetails.general;
              
              return (
                <div className="screen-content active">
                  <div className="chat-head">
                    <div className="chat-back" onClick={() => setScreen('home')}>←</div>
                    <div className={`chat-avatar ${details.avatarClass}`}></div>
                    <div className="chat-name">
                      {details.name}
                      <small>{details.role}</small>
                    </div>
                  </div>

                  <div className="chat-topics">
                    <button className={`topic-btn ${activeTopic === 'general' ? 'active' : ''}`} onClick={() => changeTopic('general')}>General</button>
                    <button className={`topic-btn ${activeTopic === 'anxiety' ? 'active' : ''}`} onClick={() => changeTopic('anxiety')}>Anxiety</button>
                    <button className={`topic-btn ${activeTopic === 'depression' ? 'active' : ''}`} onClick={() => changeTopic('depression')}>Depression</button>
                    <button className={`topic-btn ${activeTopic === 'trauma' ? 'active' : ''}`} onClick={() => changeTopic('trauma')}>Trauma</button>
                    <button className={`topic-btn ${activeTopic === 'grief' ? 'active' : ''}`} onClick={() => changeTopic('grief')}>Grief</button>
                    <button className={`topic-btn ${activeTopic === 'stress' ? 'active' : ''}`} onClick={() => changeTopic('stress')}>Stress</button>
                    <button className={`topic-btn ${activeTopic === 'relationship' ? 'active' : ''}`} onClick={() => changeTopic('relationship')}>Relationships</button>
                    <button className={`topic-btn ${activeTopic === 'mental' ? 'active' : ''}`} onClick={() => changeTopic('mental')}>Calm</button>
                    <button className={`topic-btn ${activeTopic === 'family' ? 'active' : ''}`} onClick={() => changeTopic('family')}>Family</button>
                  </div>

                  <div className="chat-body" ref={chatBodyRef}>
                  {chats.map((c, i) => (
                    <div 
                      key={c.id || i} 
                      className={`bubble ${c.sender === 'me' ? 'me' : 'them'}`}
                      dangerouslySetInnerHTML={{ __html: c.message }}
                    />
                  ))}
                  {isTyping && (
                    <div className="typing animate-fade-in">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="chat-input-wrap">
                  {!isTyping && chats.length > 0 && chats[chats.length - 1].sender === 'them' && (
                    <div className="quick-replies">
                      {QUICK_REPLIES.map((reply, i) => (
                        <button
                          key={i}
                          className="quick-reply"
                          onClick={() => selectQuickReply(reply)}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="chat-input">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder={`Reply to ${details.name}…`}
                    />
                    <button 
                      className="chat-input-mic"
                      onClick={() => sendChatMessage()}
                      disabled={!chatInput.trim()}
                    >
                      {chatInput.trim() ? '→' : '●'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

            {/* 7. MIRROR */}
            {screen === 'mirror' && (
              <>
                {observations.length === 0 ? (
                  <div className="screen-content dark active">
                    <div className="mirror-intro">
                      <div className="orb-mirror" onClick={() => setShowReflection(true)} style={{ cursor: 'pointer' }}></div>
                      <h3 className="mirror-title">The Mirror is <em>sleeping</em></h3>
                      <p className="mirror-sub">
                        Write some journals and chat with the Therapist first. Then prompt the Mirror to inspect your logs.
                      </p>
                      <button 
                        onClick={generateMirrorObservations}
                        disabled={mirrorStatus === 'analyzing'}
                        className="cta cta-light flex items-center gap-2 justify-center mx-auto"
                      >
                        <RefreshCw size={12} className={mirrorStatus === 'analyzing' ? 'animate-spin' : ''} />
                        {mirrorStatus === 'analyzing' ? 'Mirror analyzing logs...' : 'Awaken the Mirror'}
                      </button>
                    </div>
                    {renderTabBar()}
                  </div>
                ) : (
                  <>
                    {/* 7a. MIRROR INTRO */}
                    {mirrorSubScreen === 'intro' && (
                      <div className="screen-content dark active">
                        <div className="mirror-intro">
                          <div className="orb-mirror" onClick={() => setShowReflection(true)} style={{ cursor: 'pointer' }}></div>
                          <div className="mirror-eye">Mirror Session · Week 12</div>
                          <div className="mirror-title">I noticed<br/><em>some things</em>.</div>
                          <p className="mirror-sub">Each is something you wrote yourself. I'm only showing it back.</p>
                          <button className="cta cta-light" onClick={() => {
                            setMirrorSubScreen('observation');
                            setObsIndex(0);
                          }}>Show me</button>
                        </div>
                        {renderTabBar()}
                      </div>
                    )}

                    {/* 7b. OBSERVATION SLIDES */}
                    {mirrorSubScreen === 'observation' && obsIndex < observations.length && (
                      <div className="screen-content dark active">
                        <div className="obs-scroll-container">
                          <div className="obs-head">
                            <div className="mirror-eye">Observation {obsIndex + 1} of {observations.length}</div>
                            <div className="obs-title">On <em>{observations[obsIndex].category}</em>.</div>
                          </div>
                          <div className="obs-progress">
                            <span>{obsIndex + 1}</span>
                            <div className="obs-progress-bar">
                              <div 
                                className="obs-progress-fill" 
                                style={{ width: `${((obsIndex + 1) / observations.length) * 100}%` }}
                              />
                            </div>
                            <span>{observations.length}</span>
                          </div>
                          <div className="obs-card">
                            <div className="obs-quote">"{observations[obsIndex].quote}"</div>
                            <div className="obs-evidence" dangerouslySetInnerHTML={{ __html: observations[obsIndex].evidence }} />
                            <div className="obs-actions">
                              {['lands', 'not_yet', 'say_more'].map((opt) => {
                                const isSelected = observations[obsIndex].feedback === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => handleObsFeedback(observations[obsIndex].id, opt)}
                                    className={`pill ${isSelected ? 'selected' : ''}`}
                                  >
                                    {opt === 'lands' ? 'Lands' : opt === 'not_yet' ? 'Not yet' : 'Say more'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}></div>
                        </div>
                        {renderTabBar()}
                      </div>
                    )}

                    {/* 7c. INTEGRATION / COMPLETE */}
                    {mirrorSubScreen === 'integration' && (
                      <div className="screen-content dark active">
                        <div className="integ-scroll-container">
                          <div className="integ-head">
                            <div className="orb-mirror" onClick={() => setShowReflection(true)} style={{ cursor: 'pointer', marginBottom: '16px' }}></div>
                            <div className="mirror-eye">Session complete</div>
                            <div className="obs-title">Sit <em>with this</em>.</div>
                            <p className="mirror-sub" style={{ marginTop: '8px', marginBottom: 0 }}>There's nothing to do tonight.</p>
                            <button 
                              className="cta cta-outline" 
                              style={{ marginTop: '12px', fontSize: '11px', padding: '6px 16px', opacity: 0.85 }}
                              onClick={() => setShowReflection(true)}
                            >
                              View my Reflection ✦
                            </button>
                          </div>
                          
                          <div className="integ-card">
                            <div className="integ-card-label">Optional · Tomorrow</div>
                            <div className="integ-card-quote">"Write your mother a letter you'll never send. Use her name."</div>
                            <div className="integ-card-footer">Prompt designed by your Therapist, in response.</div>
                          </div>

                          <div className="chart-wrap">
                            <div className="chart-label">Your patterns · 6 weeks</div>
                            <div className="chart-bars">
                              {[30, 45, 65, 80, 90, 100].map((h, i) => {
                                const colors = [
                                  'linear-gradient(180deg, var(--lavender-soft), transparent)',
                                  'linear-gradient(180deg, var(--lavender-soft), transparent)',
                                  'linear-gradient(180deg, var(--lavender-soft), transparent)',
                                  'linear-gradient(180deg, var(--terra-soft), transparent)',
                                  'linear-gradient(180deg, var(--terra-soft), transparent)',
                                  'linear-gradient(180deg, var(--terra-soft), var(--terra))'
                                ];
                                return (
                                  <div 
                                    key={i} 
                                    className="chart-bar" 
                                    style={{ 
                                      background: colors[i], 
                                      height: `${h}%`,
                                      animationDelay: `${i * 0.1}s` 
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="chart-axis"><span>W7</span><span>W8</span><span>W9</span><span>W10</span><span>W11</span><span>W12</span></div>
                          </div>

                          <div style={{ flex: 1 }}></div>
                          <div style={{ padding: '12px 24px 14px' }}>
                            <button className="cta cta-light" style={{ width: '100%' }} onClick={() => setScreen('map')}>
                              See your Map →
                            </button>
                          </div>
                        </div>
                        {renderTabBar()}
                      </div>
                    )}
                  </>
                )}
                {showReflection && (
                  <div className="reflection-overlay animate-fade-in">
                    <div className="reflection-header">
                      <button 
                        className="reflection-back-btn" 
                        onClick={() => { setShowReflection(false); setTtsPlaying(false); if (audioRef.current) audioRef.current.pause(); }}
                        title="Go back"
                      >
                        ←
                      </button>
                      <div className="reflection-header-title">Reflection</div>
                      <div style={{ width: 32 }}></div>
                    </div>

                    <div className="reflection-body-scroll">
                      <div className="reflection-modal" onClick={(e) => e.stopPropagation()}>
                        
                        <div className="reflection-tabs">
                          <button 
                            className={`reflection-tab ${activeReflectionTab === 'current' ? 'active' : ''}`}
                            onClick={() => { setActiveReflectionTab('current'); setTtsPlaying(false); if (audioRef.current) audioRef.current.pause(); }}
                          >
                            Current Self
                          </button>
                          <button 
                            className={`reflection-tab ${activeReflectionTab === 'ideal' ? 'active' : ''}`}
                            onClick={() => { setActiveReflectionTab('ideal'); setTtsPlaying(false); if (audioRef.current) audioRef.current.pause(); }}
                          >
                            Ideal Self
                          </button>
                        </div>

                        <div className="portrait-container">
                          {activeReflectionTab === 'current' ? (
                            <img 
                              src={timeline[0]?.image_url || "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_june27.png"} 
                              className="orb-portrait animate-pulse-slow" 
                              alt="Current Ghibli Reflection" 
                            />
                          ) : (
                            <img 
                              src={profile?.ideal_image_url || "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"} 
                              className="orb-portrait animate-pulse-slow" 
                              alt="Ideal Ghibli Reflection" 
                            />
                          )}
                        </div>

                        <div className="reflection-title">
                          {activeReflectionTab === 'current' ? (
                            <>Through the <em>looking glass</em></>
                          ) : (
                            <>Your <em>ideal reflection</em></>
                          )}
                        </div>
                        <div className="reflection-name">
                          {profile?.name || currentUser.name}
                        </div>
                        <div className="reflection-style">
                          {activeReflectionTab === 'current' ? (profile?.attachment_style || currentUser.pattern) : "Secure Alignment"}
                        </div>
                        
                        <div className="tts-wrap">
                          <button 
                            className={`tts-button ${ttsPlaying ? 'playing' : ''}`}
                            onClick={() => playTTS(activeReflectionTab === 'current' ? (profile?.overall_reflection || timeline[0]?.overall_reflection) : profile?.ideal_reflection)}
                          >
                            {ttsPlaying ? '🔊 Playing...' : '🔈 Listen'}
                          </button>
                        </div>

                        <p className="reflection-text">
                          {activeReflectionTab === 'current' ? (
                            (profile?.overall_reflection || timeline[0]?.overall_reflection || "The mirror is dark. Speak to it through journals and chats to reveal your reflection.")
                          ) : (
                            (profile?.ideal_reflection || "A peaceful, secure reflection is taking shape. Keep writing to clarify this vision.")
                          )}
                        </p>

                        {activeReflectionTab === 'current' && timeline.length > 0 && (
                          <div className="reflection-timeline-container">
                            <div className="timeline-title">Self-Inquiry Timeline</div>
                            <div className="timeline-list">
                              {timeline.map((item) => {
                                const isExpanded = expandedTimelineId === item.id;
                                const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return (
                                  <div key={item.id} className="timeline-item">
                                    <div className="timeline-node-wrap">
                                      <span className="timeline-node"></span>
                                      <span className="timeline-date">{formattedDate}</span>
                                    </div>
                                    <div 
                                      className={`timeline-card ${isExpanded ? 'expanded' : ''}`}
                                      onClick={() => setExpandedTimelineId(isExpanded ? null : item.id)}
                                    >
                                      <div className="timeline-card-header">
                                        <img src={item.image_url} className="timeline-avatar" alt="Ghibli avatar" />
                                        <div className="timeline-card-meta">
                                          <div className="timeline-card-style">{item.attachment_style}</div>
                                          <div className="timeline-card-insight">{item.insight}</div>
                                        </div>
                                        <span className="timeline-card-arrow">{isExpanded ? '▲' : '▼'}</span>
                                      </div>
                                      {isExpanded && (
                                        <p className="timeline-card-text animate-fade-in">
                                          {item.overall_reflection}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mirror-interact-section">
                          <div className="mirror-interact-label">Speak to your reflection</div>
                          <textarea
                            placeholder="Tell the mirror what you're feeling, what you want to become, or ask it to reflect on something specific..."
                            value={mirrorChatInput}
                            onChange={(e) => setMirrorChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMirrorReflectionQuery(); } }}
                            className="mirror-chat-textarea"
                            rows={3}
                            disabled={mirrorChatLoading}
                          />
                          <div className="mirror-interact-actions">
                            <button 
                              className={`mirror-mic-btn ${mirrorVoiceRecording ? 'recording' : ''}`}
                              onClick={toggleMirrorVoice}
                              title={mirrorVoiceRecording ? 'Stop recording' : 'Voice input'}
                            >
                              {mirrorVoiceRecording ? '⏹' : '🎙'}
                            </button>
                            <button 
                              className="cta cta-light mirror-reflect-btn"
                              onClick={submitMirrorReflectionQuery}
                              disabled={mirrorChatLoading || !mirrorChatInput.trim()}
                            >
                              {mirrorChatLoading ? 'Reflecting...' : 'Reflect ✦'}
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 8. MAP */}
            {screen === 'map' && (
              <div className="screen-content map-content active">
                <div className="map-head">
                  <div className="map-eye">June · Month 3</div>
                  <div className="map-title">Your <em>attachment</em> landscape.</div>
                </div>
                
                <div className="map-canvas">
                  {attachmentMap && (
                    <>
                      {/* Anxious dots (gold / terra) */}
                      {Array.from({ length: Math.min(attachmentMap.anxious_count, 15) }).map((_, i) => (
                        <span 
                          key={`anx-${i}`} 
                          className="map-dot"
                          style={{
                            top: `${20 + (i * 27) % 65}%`,
                            left: `${15 + (i * 41) % 70}%`,
                            color: 'var(--terra)',
                            background: 'var(--terra)',
                            animationDelay: `${i * 0.08}s`
                          }}
                        />
                      ))}
                      {/* Avoidant dots (lavender) */}
                      {Array.from({ length: Math.min(attachmentMap.avoidant_count, 15) }).map((_, i) => (
                        <span 
                          key={`avd-${i}`} 
                          className="map-dot"
                          style={{
                            top: `${15 + (i * 37) % 75}%`,
                            left: `${20 + (i * 19) % 65}%`,
                            color: 'var(--lavender)',
                            background: 'var(--lavender)',
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                      {/* Secure dots (ink) */}
                      {Array.from({ length: Math.min(attachmentMap.secure_count, 20) }).map((_, i) => (
                        <span 
                          key={`sec-${i}`} 
                          className="map-dot"
                          style={{
                            top: `${30 + (i * 23) % 55}%`,
                            left: `${30 + (i * 33) % 45}%`,
                            color: 'var(--ink)',
                            background: 'var(--ink)',
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>

                <div className="map-legend">
                  <div className="map-legend-row">
                    <span className="legend-dot" style={{ background: 'var(--terra)' }}></span>
                    Anxious · {attachmentMap ? attachmentMap.anxious_count : 0} entries
                  </div>
                  <div className="map-legend-row">
                    <span className="legend-dot" style={{ background: 'var(--lavender)' }}></span>
                    Avoidant · {attachmentMap ? attachmentMap.avoidant_count : 0} entries
                  </div>
                  <div className="map-legend-row">
                    <span className="legend-dot" style={{ background: 'var(--ink)' }}></span>
                    Secure · {attachmentMap ? attachmentMap.secure_count : 0} <span className="green-up">↑ from May</span>
                  </div>
                </div>

                <div className="map-foot">
                  <div className="map-btn outline">Compare</div>
                  <div className="map-btn solid">Share</div>
                </div>
                {renderTabBar()}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
