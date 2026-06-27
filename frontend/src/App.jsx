import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Home, 
  BookOpen, 
  MessageSquare, 
  Compass, 
  ChevronLeft, 
  ChevronRight, 
  Mic, 
  Send, 
  RefreshCw, 
  Sparkles, 
  Flame,
  CheckCircle2
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

// List of test users matching backend/test_users.md
const TEST_USERS = [
  { name: 'Enkh', id: 'e1a8b9c8-1234-5678-abcd-ef0123456789', pattern: 'Anxious-leaning' },
  { name: 'Alex', id: 'f2b9c0d1-2345-6789-bcde-f0123456789a', pattern: 'Avoidant-leaning' },
  { name: 'Taylor', id: 'a3c0d1e2-3456-7890-cdef-0123456789ab', pattern: 'Secure' },
  { name: 'Jordan', id: 'b4d1e2f3-4567-8901-def0-123456789abc', pattern: 'Disorganized' },
  { name: 'Morgan', id: 'c5e2f3a4-5678-9012-ef01-23456789abcd', pattern: 'Anxious-leaning' }
];

export default function App() {
  // Developer user switcher state
  const [currentUser, setCurrentUser] = useState(TEST_USERS[0]);
  const [screen, setScreen] = useState('home'); // 'home' | 'journal' | 'chat' | 'mirror' | 'map'
  
  // Data states
  const [journals, setJournals] = useState([]);
  const [chats, setChats] = useState([]);
  const [observations, setObservations] = useState([]);
  const [attachmentMap, setAttachmentMap] = useState(null);
  
  // Interactive UI states
  const [loading, setLoading] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [savedJournalTags, setSavedJournalTags] = useState([]);
  
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Mirror Session specific states
  const [obsIndex, setObsIndex] = useState(0); // 0, 1, or 2 (complete)
  const [mirrorStatus, setMirrorStatus] = useState('idle'); // 'idle' | 'analyzing' | 'finished'

  const chatEndRef = useRef(null);
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
        axios.get(`${API_BASE}/chats`, { headers }),
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
    if (!journalInput.trim()) return;
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
    } catch (err) {
      console.error("Error saving journal:", err);
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
      message: message
    };
    setChats(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE}/chats`, { message }, { headers });
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

  // --- MIRROR LOGIC ---
  const generateMirrorObservations = async () => {
    setMirrorStatus('analyzing');
    const headers = { 'x-user-id': currentUser.id };
    try {
      const res = await axios.post(`${API_BASE}/observations/generate`, {}, { headers });
      setObservations(res.data);
      setObsIndex(0);
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
        setObsIndex(prev => prev + 1);
      }, 500);
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F6] text-[#1C1C1E] p-4 select-none relative font-sans">
      
      {/* Dev Switcher Header */}
      <div className="w-full max-w-[390px] mb-4 bg-white border border-[#E5E5EA] rounded-2xl p-3 flex items-center justify-between shadow-sm z-50">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-[#767680] font-semibold flex items-center gap-1">
            Developer Account Selector
          </span>
          <span className="text-xs text-[#B2904C] font-semibold">{currentUser.pattern}</span>
        </div>
        <select 
          value={currentUser.id} 
          onChange={handleUserChange}
          className="text-xs font-medium border border-[#E5E5EA] rounded-lg p-2 bg-[#FAF9F6] text-[#1C1C1E] focus:outline-none focus:border-[#B2904C]"
        >
          {TEST_USERS.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.pattern})</option>
          ))}
        </select>
      </div>

      {/* Main phone frame container */}
      <div className="relative w-[375px] h-[780px] bg-black rounded-[50px] p-[10px] shadow-2xl flex flex-col items-center justify-center border-4 border-[#1C1C1E]">
        <div className="absolute top-[20px] left-1/2 transform -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-[14px] z-50"></div>
        
        {/* Screen container */}
        <div className="w-full h-full bg-[#FAF9F6] rounded-[42px] overflow-hidden flex flex-col relative border border-[#E5E5EA]">
          
          {/* Status Bar */}
          <div className="h-[46px] w-full px-6 flex justify-between items-end pb-1 text-xs font-semibold text-[#1C1C1E] z-30">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              {/* Battery / connection SVGs */}
              <svg className="w-4 h-3.5" viewBox="0 0 16 12" fill="currentColor">
                <path d="M1 11h2V7H1v4zm4 0h2V4H5v7zm4 0h2V1H9v10zm4 0h2V8h-2v3z"/>
              </svg>
              <span>100%</span>
            </div>
          </div>

          {/* Screen Content loader */}
          <div className="flex-1 flex flex-col overflow-y-auto px-6 pb-20 pt-2 animate-fade-in">
            {screen === 'home' && (
              <div className="flex flex-col gap-6">
                <div>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#767680] font-bold">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  <h1 className="font-serif text-[42px] leading-tight text-[#1C1C1E] mt-1 font-light">
                    Good evening,<br/>
                    <em className="italic text-[#B2904C]">{currentUser.name}</em>.
                  </h1>
                </div>

                {/* Daily journal prompt card */}
                <div 
                  onClick={() => { setScreen('journal'); setSavedJournalTags([]); }} 
                  className="bg-white border border-[#E5E5EA] rounded-3xl p-5 shadow-sm hover:scale-[0.99] active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden group"
                >
                  <div className="absolute right-[-10px] top-[-10px] w-20 h-20 rounded-full bg-[#B2904C]/5 group-hover:scale-110 transition-transform"></div>
                  <span className="text-[10px] tracking-wider uppercase text-[#767680] font-semibold">Today</span>
                  <h3 className="font-serif text-2xl font-light text-[#1C1C1E] mt-1.5">
                    Write to <em className="italic">yourself</em>
                  </h3>
                  <div className="flex justify-between items-center mt-5 text-[11px] text-[#767680]">
                    <span>2 min · Journal</span>
                    <span className="text-[#B2904C] font-semibold">→</span>
                  </div>
                </div>

                {/* Mirror session card */}
                <div 
                  onClick={() => setScreen('mirror')} 
                  className="bg-white border border-[#E5E5EA] rounded-3xl p-5 shadow-sm hover:scale-[0.99] active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden group"
                >
                  <div className="absolute right-[-10px] top-[-10px] w-20 h-20 rounded-full bg-[#635A94]/5 group-hover:scale-110 transition-transform"></div>
                  <span className="text-[10px] tracking-wider uppercase text-[#767680] font-semibold">Weekly</span>
                  <h3 className="font-serif text-2xl font-light text-[#1C1C1E] mt-1.5">
                    Your <em className="italic text-[#635A94]">Mirror Session</em>
                  </h3>
                  <div className="flex justify-between items-center mt-5 text-[11px] text-[#767680]">
                    <span>{observations.length > 0 ? `${observations.length} Observations ready` : "Needs analysis"}</span>
                    <span className="text-[#635A94] font-semibold">→</span>
                  </div>
                </div>

                {/* History Snippets */}
                <div className="mt-2">
                  <h4 className="text-[10px] tracking-wider uppercase text-[#767680] font-bold mb-3">Recent Writings</h4>
                  {journals.length === 0 ? (
                    <p className="text-xs text-[#767680] italic">Your journal entries will show up here.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-[#E5E5EA]">
                      {journals.slice(0, 3).map(j => (
                        <div key={j.id} className="py-3 flex justify-between items-baseline gap-4">
                          <span className="font-serif italic text-sm text-[#767680] shrink-0">
                            {new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-xs text-[#1C1C1E] truncate max-w-[200px] text-right">
                            {j.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {screen === 'journal' && (
              <div className="flex flex-col h-full gap-4">
                <div>
                  <span className="text-[10px] tracking-wider uppercase text-[#767680] font-semibold">Journal · Today</span>
                  <h2 className="font-serif text-3xl font-light text-[#1C1C1E] mt-1">
                    What's <em className="italic text-[#B2904C]">true</em> right now?
                  </h2>
                </div>

                <div className="flex-1 flex flex-col relative bg-white border border-[#E5E5EA] rounded-3xl p-5 shadow-sm min-h-[220px]">
                  <textarea
                    value={journalInput}
                    onChange={(e) => setJournalInput(e.target.value)}
                    placeholder="Write without filtering. Let thoughts wander..."
                    className="flex-1 w-full bg-transparent text-sm resize-none text-[#1C1C1E] placeholder-[#767680] focus:outline-none leading-relaxed"
                  />
                  
                  {/* Saved Tags Preview */}
                  {savedJournalTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#E5E5EA] animate-fade-in">
                      {savedJournalTags.map((tag, i) => (
                        <span 
                          key={i} 
                          className={`text-[9px] font-semibold px-2 py-1 rounded-full ${
                            tag.includes('auto-tagged') ? 'bg-[#767680]/10 text-[#767680]' : 'bg-[#B2904C]/10 text-[#B2904C]'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Recording overlay indicator */}
                  {isRecording && (
                    <div className="absolute inset-0 bg-white/95 rounded-3xl flex flex-col items-center justify-center animate-fade-in">
                      <div className="w-12 h-12 rounded-full bg-[#B2904C]/10 flex items-center justify-center text-[#B2904C] animate-pulse">
                        <Mic size={22} className="animate-float" />
                      </div>
                      <span className="text-xs text-[#1C1C1E] font-medium mt-3">Listening to your voice...</span>
                      <span className="text-[10px] text-[#767680] font-mono mt-1">
                        0:{recordTime < 10 ? `0${recordTime}` : recordTime}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-auto pb-4">
                  <button 
                    onClick={saveJournal}
                    disabled={!journalInput.trim() && !isRecording}
                    className="flex-1 bg-[#1C1C1E] text-white py-3.5 rounded-full font-medium text-xs hover:bg-[#2E2E30] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Save & reflect
                  </button>
                  <button 
                    onClick={toggleRecording}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all ${
                      isRecording ? 'bg-[#1C1C1E] scale-95' : 'bg-[#B2904C]'
                    }`}
                  >
                    {isRecording ? <span className="font-bold text-xs">■</span> : <Mic size={18} />}
                  </button>
                </div>
              </div>
            )}

            {screen === 'chat' && (
              <div className="flex flex-col h-full relative">
                {/* Chat Head */}
                <div className="flex items-center gap-3 border-b border-[#E5E5EA] pb-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#B2904C]/30 to-[#B2904C] flex items-center justify-center font-serif text-[#1C1C1E] text-lg italic">
                    T
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-semibold leading-tight">The Therapist</h3>
                    <span className="text-[9px] uppercase tracking-wider text-[#767680] font-bold">Conscious Layer</span>
                  </div>
                </div>

                {/* Chat Feed */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 max-h-[420px]">
                  {chats.map((c) => (
                    <div 
                      key={c.id} 
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        c.sender === 'me' 
                          ? 'bg-[#1C1C1E] text-white self-end rounded-br-none' 
                          : 'bg-white border border-[#E5E5EA] text-[#1C1C1E] self-start rounded-bl-none shadow-sm'
                      }`}
                    >
                      {c.message}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="bg-white border border-[#E5E5EA] text-[#1C1C1E] self-start rounded-2xl rounded-bl-none shadow-sm px-4 py-3 flex gap-1.5 items-center w-fit animate-fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#767680] animate-typing-dot"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#767680] animate-typing-dot [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#767680] animate-typing-dot [animation-delay:0.4s]"></span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick replies & inputs */}
                <div className="mt-auto pt-3">
                  {chats.length === 1 && !isTyping && (
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                      <button 
                        onClick={() => selectQuickReply("I keep checking if he's online.")}
                        className="shrink-0 bg-white border border-[#E5E5EA] hover:bg-[#FAF9F6] text-xs px-3.5 py-2 rounded-full text-[#767680] shadow-sm font-medium transition-colors"
                      >
                        "I keep checking if he's online."
                      </button>
                      <button 
                        onClick={() => selectQuickReply("I feel small.")}
                        className="shrink-0 bg-white border border-[#E5E5EA] hover:bg-[#FAF9F6] text-xs px-3.5 py-2 rounded-full text-[#767680] shadow-sm font-medium transition-colors"
                      >
                        "I feel small."
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 border border-[#E5E5EA] rounded-full bg-white px-4 py-2 shadow-sm">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Reply to The Therapist..."
                      className="flex-1 bg-transparent text-xs text-[#1C1C1E] placeholder-[#767680] focus:outline-none"
                    />
                    <button 
                      onClick={() => sendChatMessage()}
                      disabled={!chatInput.trim()}
                      className="text-[#1C1C1E] disabled:opacity-20 transition-opacity"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {screen === 'mirror' && (
              <div className="flex flex-col h-full gap-4">
                {observations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#635A94]/20 via-[#635A94]/40 to-[#B2904C]/20 shadow-md animate-float flex items-center justify-center text-[#635A94]">
                      <Sparkles size={36} />
                    </div>
                    <h3 className="font-serif text-2xl mt-6 text-[#1C1C1E] font-light">The Mirror is sleeping</h3>
                    <p className="text-xs text-[#767680] mt-2 max-w-[240px] leading-relaxed">
                      Write some journals and chat with the Therapist first. Then prompt the Unconscious agent to inspect your logs.
                    </p>
                    <button 
                      onClick={generateMirrorObservations}
                      disabled={mirrorStatus === 'analyzing'}
                      className="mt-6 bg-[#635A94] text-white px-5 py-3 rounded-full text-xs font-semibold shadow-sm hover:bg-[#524982] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={mirrorStatus === 'analyzing' ? 'animate-spin' : ''} />
                      {mirrorStatus === 'analyzing' ? 'Mirror analyzing logs...' : 'Awaken the Mirror'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col h-full gap-3">
                    {/* Slides page */}
                    {obsIndex < observations.length ? (
                      <div className="flex-1 flex flex-col animate-fade-in">
                        <div>
                          <span className="text-[10px] tracking-wider uppercase text-[#767680] font-semibold">
                            Observation {obsIndex + 1} of {observations.length}
                          </span>
                          <h2 className="font-serif text-3xl font-light text-[#1C1C1E] mt-1">
                            On <em className="italic text-[#635A94]">{observations[obsIndex].category}</em>.
                          </h2>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex items-center gap-2 my-4">
                          <span className="text-[10px] font-mono text-[#767680]">{obsIndex + 1}</span>
                          <div className="flex-1 h-[2px] bg-[#E5E5EA] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#635A94] transition-all duration-300"
                              style={{ width: `${((obsIndex + 1) / observations.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[#767680]">{observations.length}</span>
                        </div>

                        {/* Card */}
                        <div className="bg-white border border-[#E5E5EA] rounded-3xl p-5 shadow-sm flex flex-col gap-4 flex-1">
                          <p className="font-serif italic text-[17px] text-[#1C1C1E] leading-relaxed">
                            "{observations[obsIndex].quote}"
                          </p>
                          <div className="pt-4 border-t border-[#E5E5EA] text-[11px] text-[#767680] leading-relaxed">
                            <strong className="text-[#635A94] font-medium block mb-1">Unconscious Pattern:</strong>
                            {observations[obsIndex].evidence}
                          </div>

                          {/* Multi-choice feedback */}
                          <div className="mt-auto pt-4 flex gap-2">
                            {['lands', 'not_yet', 'say_more'].map((opt) => {
                              const isSelected = observations[obsIndex].feedback === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => handleObsFeedback(observations[obsIndex].id, opt)}
                                  className={`flex-1 py-2 text-[10px] font-semibold rounded-full border transition-all ${
                                    isSelected 
                                      ? 'bg-[#635A94] text-white border-[#635A94]'
                                      : 'bg-white border-[#E5E5EA] hover:bg-[#FAF9F6] text-[#635A94]'
                                  }`}
                                >
                                  {opt === 'lands' ? 'Lands' : opt === 'not_yet' ? 'Not yet' : 'Say more'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Complete State
                      <div className="flex-1 flex flex-col gap-5 justify-center animate-fade-in">
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 size={24} />
                          </div>
                          <span className="text-[10px] tracking-wider uppercase text-[#767680] font-bold">Session Complete</span>
                          <h2 className="font-serif text-3xl font-light text-[#1C1C1E] mt-1">
                            Sit <em className="italic">with this</em>.
                          </h2>
                          <p className="text-xs text-[#767680] mt-1">There is nothing more to do tonight.</p>
                        </div>

                        {/* Prompt Integration Card */}
                        <div className="bg-white border border-[#E5E5EA] rounded-3xl p-5 shadow-sm">
                          <span className="text-[9px] tracking-wider uppercase text-[#B2904C] font-semibold block mb-1.5">Optional · Tomorrow</span>
                          <p className="font-serif italic text-base text-[#1C1C1E] leading-relaxed">
                            "Write your mother a letter you'll never send. Use her name."
                          </p>
                          <span className="text-[9px] text-[#767680] block mt-4">
                            Prompt designed by your Therapist, in response to Mirror notes.
                          </span>
                        </div>

                        <div className="flex gap-2.5">
                          <button 
                            onClick={() => setScreen('map')}
                            className="flex-1 bg-[#1C1C1E] text-white py-3.5 rounded-full font-medium text-xs hover:bg-[#2E2E30] transition-colors"
                          >
                            See attachment Map
                          </button>
                          <button 
                            onClick={generateMirrorObservations}
                            className="w-12 h-12 border border-[#E5E5EA] hover:bg-[#FAF9F6] bg-white rounded-full flex items-center justify-center text-[#767680] transition-colors shadow-sm"
                            title="Regenerate Observations"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {screen === 'map' && (
              <div className="flex flex-col h-full gap-4">
                <div>
                  <span className="text-[10px] tracking-wider uppercase text-[#767680] font-semibold">June · Month 3</span>
                  <h2 className="font-serif text-3xl font-light text-[#1C1C1E] mt-1">
                    Your <em className="italic text-[#B2904C]">attachment</em> landscape.
                  </h2>
                </div>

                {/* Map Canvas Visual */}
                <div className="h-[200px] w-full border border-[#E5E5EA] rounded-3xl bg-gradient-to-br from-[#FAF6EF] via-[#EFE5D6] to-[#E5DBC5] shadow-inner relative overflow-hidden flex items-center justify-center">
                  <div className="absolute w-[180px] h-[180px] rounded-full bg-[#B2904C]/5 filter blur-md"></div>
                  <div className="absolute w-[120px] h-[120px] rounded-full bg-[#635A94]/5 filter blur-md"></div>
                  
                  {/* Dynamic scattering dots matching counts */}
                  {attachmentMap && (
                    <>
                      {/* Anxious dots (gold) */}
                      {Array.from({ length: Math.min(attachmentMap.anxious_count, 15) }).map((_, i) => (
                        <span 
                          key={`anx-${i}`} 
                          className="absolute w-2 h-2 rounded-full bg-[#B2904C] shadow-lg animate-fade-in"
                          style={{
                            top: `${20 + (i * 27) % 65}%`,
                            left: `${15 + (i * 41) % 70}%`,
                            animationDelay: `${i * 0.08}s`
                          }}
                        />
                      ))}
                      {/* Avoidant dots (indigo) */}
                      {Array.from({ length: Math.min(attachmentMap.avoidant_count, 15) }).map((_, i) => (
                        <span 
                          key={`avd-${i}`} 
                          className="absolute w-2 h-2 rounded-full bg-[#635A94] shadow-lg animate-fade-in"
                          style={{
                            top: `${15 + (i * 37) % 75}%`,
                            left: `${20 + (i * 19) % 65}%`,
                            opacity: 0.8,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                      {/* Secure dots (charcoal) */}
                      {Array.from({ length: Math.min(attachmentMap.secure_count, 20) }).map((_, i) => (
                        <span 
                          key={`sec-${i}`} 
                          className="absolute w-1.5 h-1.5 rounded-full bg-[#1C1C1E] shadow-sm animate-fade-in"
                          style={{
                            top: `${30 + (i * 23) % 55}%`,
                            left: `${30 + (i * 33) % 45}%`,
                            opacity: 0.6,
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>

                {/* Legend list */}
                {attachmentMap && (
                  <div className="flex flex-col gap-2.5 bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#B2904C]" />
                        <span className="text-[#1C1C1E] font-medium">Anxious Expressions</span>
                      </div>
                      <span className="text-[#767680] font-semibold">{attachmentMap.anxious_count} entries</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#635A94]" />
                        <span className="text-[#1C1C1E] font-medium">Avoidant Expressions</span>
                      </div>
                      <span className="text-[#767680] font-semibold">{attachmentMap.avoidant_count} entries</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1E]" />
                        <span className="text-[#1C1C1E] font-medium">Secure Integration</span>
                      </div>
                      <span className="text-[#767680] font-semibold">{attachmentMap.secure_count} entries</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-auto pb-4 text-xs font-semibold">
                  <button className="flex-1 py-3 bg-white border border-[#E5E5EA] rounded-full text-[#767680] hover:bg-[#FAF9F6] transition-colors shadow-sm">
                    Compare patterns
                  </button>
                  <button className="flex-1 py-3 bg-[#1C1C1E] text-white rounded-full hover:bg-[#2E2E30] transition-colors">
                    Share map
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tab Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[74px] border-t border-[#E5E5EA] bg-white/80 backdrop-blur-md flex justify-around items-center px-4 pb-4 pt-1 z-30">
            <button 
              onClick={() => setScreen('home')}
              className={`flex flex-col items-center gap-1 text-[9px] font-semibold ${
                screen === 'home' ? 'text-[#1C1C1E]' : 'text-[#767680]'
              }`}
            >
              <Home size={18} strokeWidth={screen === 'home' ? 2.5 : 1.8} />
              Home
            </button>
            <button 
              onClick={() => { setScreen('journal'); setSavedJournalTags([]); }}
              className={`flex flex-col items-center gap-1 text-[9px] font-semibold ${
                screen === 'journal' ? 'text-[#1C1C1E]' : 'text-[#767680]'
              }`}
            >
              <BookOpen size={18} strokeWidth={screen === 'journal' ? 2.5 : 1.8} />
              Journal
            </button>
            <button 
              onClick={() => setScreen('chat')}
              className={`flex flex-col items-center gap-1 text-[9px] font-semibold ${
                screen === 'chat' ? 'text-[#1C1C1E]' : 'text-[#767680]'
              }`}
            >
              <MessageSquare size={18} strokeWidth={screen === 'chat' ? 2.5 : 1.8} />
              Chat
            </button>
            <button 
              onClick={() => setScreen('mirror')}
              className={`flex flex-col items-center gap-1 text-[9px] font-semibold ${
                screen === 'mirror' ? 'text-[#1C1C1E]' : 'text-[#767680]'
              }`}
            >
              <Sparkles size={18} strokeWidth={screen === 'mirror' ? 2.5 : 1.8} />
              Mirror
            </button>
            <button 
              onClick={() => setScreen('map')}
              className={`flex flex-col items-center gap-1 text-[9px] font-semibold ${
                screen === 'map' ? 'text-[#1C1C1E]' : 'text-[#767680]'
              }`}
            >
              <Compass size={18} strokeWidth={screen === 'map' ? 2.5 : 1.8} />
              Map
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
