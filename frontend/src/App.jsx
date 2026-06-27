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
  "Your partner takes six hours to reply to a casual text. What's the first thing you feel?",
  "Tell me about a time you almost reached out — but didn't.",
  "When a relationship gets really close, what do you notice happening in you?",
  "After a fight with someone you love, what do you usually do?",
  "What's the story you catch yourself telling about why closeness is hard?"
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
  
  // Interactive UI states
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [activeTopic, setActiveTopic] = useState('general'); // 'general' | 'relationship' | 'mental' | 'family'
  const [onboardInput, setOnboardInput] = useState('');
  const [onboardStep, setOnboardStep] = useState(0);
  const [onboardAnswers, setOnboardAnswers] = useState([]);
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
      const [journalRes, chatRes, obsRes, mapRes] = await Promise.all([
        axios.get(`${API_BASE}/journals`, { headers }),
        axios.get(`${API_BASE}/chats?topic=general`, { headers }),
        axios.get(`${API_BASE}/observations`, { headers }),
        axios.get(`${API_BASE}/attachment-map`, { headers })
      ]);
      
      setJournals(journalRes.data);
      setChats(chatRes.data);
      setObservations(obsRes.data);
      setAttachmentMap(mapRes.data);
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
  const startOnboarding = () => {
    setOnboardStep(0);
    setOnboardAnswers([]);
    setOnboardInput('');
    setAssessment(null);
    setScreen('onboard');
  };

  const handleOnboardContinue = async () => {
    const updatedAnswers = [...onboardAnswers, onboardInput.trim()];
    setOnboardAnswers(updatedAnswers);

    if (onboardStep + 1 < ONBOARD_QUESTIONS.length) {
      setOnboardStep(onboardStep + 1);
      setOnboardInput('');
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
                       (screen === 'mirror' && (mirrorSubScreen === 'intro' || mirrorSubScreen === 'observation' || mirrorSubScreen === 'integration'));

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
                  <div className="ob-question">{ONBOARD_QUESTIONS[onboardStep]}</div>
                  <div className="ob-field">
                    <textarea
                      value={onboardInput}
                      onChange={(e) => setOnboardInput(e.target.value)}
                      placeholder="Write without filtering..."
                    />
                  </div>
                  <div className="ob-foot">
                    <div className="ob-mic">
                      <div className="ob-mic-dot"></div>
                      <span>Listening · 0:14</span>
                    </div>
                    <button
                      className="cta"
                      disabled={!onboardInput.trim()}
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
                  {chats.length === 1 && !isTyping && (
                    <div className="quick-replies">
                      <button 
                        className="quick-reply" 
                        onClick={() => selectQuickReply("I keep checking if he's online.")}
                      >
                        "I keep checking if he's online."
                      </button>
                      <button 
                        className="quick-reply" 
                        onClick={() => selectQuickReply("I feel small.")}
                      >
                        "I feel small."
                      </button>
                      <button 
                        className="quick-reply" 
                        onClick={() => selectQuickReply("Just tired.")}
                      >
                        "Just tired."
                      </button>
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
                      <div className="orb-mirror"></div>
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
                          <div className="orb-mirror"></div>
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
                        {renderTabBar()}
                      </div>
                    )}

                    {/* 7c. INTEGRATION / COMPLETE */}
                    {mirrorSubScreen === 'integration' && (
                      <div className="screen-content dark active">
                        <div className="integ-head">
                          <div className="mirror-eye">Session complete</div>
                          <div className="obs-title">Sit <em>with this</em>.</div>
                          <p className="mirror-sub" style={{ marginTop: '8px', marginBottom: 0 }}>There's nothing to do tonight.</p>
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
                        {renderTabBar()}
                      </div>
                    )}
                  </>
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
