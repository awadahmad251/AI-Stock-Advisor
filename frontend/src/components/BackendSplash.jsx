import { useState, useEffect, useRef } from 'react';
import { ping, checkHealth } from '../api';

const STEPS = [
  { key: 'wake',     label: 'Waking up server',        icon: '🖥️' },
  { key: 'connect',  label: 'Establishing connection',  icon: '🔗' },
  { key: 'ai',       label: 'Loading AI models',        icon: '🤖' },
  { key: 'ready',    label: 'Ready to go!',             icon: '🚀' },
];

const TIPS = [
  'InvestIQ uses AI to analyze stocks in real-time.',
  'You can compare multiple stocks side by side.',
  'Try the screener to filter stocks by technical indicators.',
  'Chat with the AI for personalized investment insights.',
  'Your portfolio is tracked and analyzed automatically.',
  'The heatmap shows market performance at a glance.',
  'Backtesting lets you simulate strategies on historical data.',
];

export default function BackendSplash({ onReady }) {
  const [step, setStep] = useState(0);        // 0 = wake, 1 = connect, 2 = ai, 3 = ready
  const [elapsed, setElapsed] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());

  // Rotate tips every 4s
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling — wake the backend
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await ping();
        if (cancelled) return;
        if (res.ready || res.rag_ready || res.rag_disabled) {
          setStep(3); // ready
          // small delay so user sees "Ready!" before splash disappears
          setTimeout(() => {
            if (!cancelled) {
              setFadeOut(true);
              setTimeout(() => { if (!cancelled) onReady('ready'); }, 500);
            }
          }, 800);
          return;
        }
        // ping succeeded but RAG not ready
        setStep(2); // loading AI
      } catch {
        // ping failed — try health
        try {
          await checkHealth();
          if (!cancelled) setStep(2);
        } catch {
          if (!cancelled) {
            // still waking
            setStep((prev) => (prev < 1 ? 1 : prev)); // at least "connecting"
          }
        }
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };

    // Kick off immediately
    poll();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [onReady]);

  const pct = step === 3 ? 100 : step === 2 ? 75 : step === 1 ? 40 : 15;

  return (
    <div className={`splash-root ${fadeOut ? 'splash-fade-out' : ''}`}>
      {/* Animated background blobs */}
      <div className="splash-blob splash-blob-1" />
      <div className="splash-blob splash-blob-2" />
      <div className="splash-blob splash-blob-3" />

      <div className="splash-card">
        {/* Logo */}
        <div className="splash-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="splash-logo-icon">
            <rect width="48" height="48" rx="12" fill="url(#logoGrad)" />
            <path d="M14 32L20 22L26 26L34 16" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="34" cy="16" r="3" fill="#fff" />
            <defs><linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#10b981"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
          </svg>
          <span className="splash-logo-text">InvestIQ</span>
        </div>

        {/* Steps */}
        <div className="splash-steps">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`splash-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
              <span className="splash-step-icon">{s.icon}</span>
              <span className="splash-step-label">{s.label}</span>
              {i === step && i < 3 && <span className="splash-step-spinner" />}
              {i < step && <span className="splash-step-check">✓</span>}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="splash-bar-track">
          <div className="splash-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Elapsed */}
        <p className="splash-elapsed">{elapsed}s elapsed</p>

        {/* Tip */}
        <div className="splash-tip">
          <span className="splash-tip-label">💡 Did you know?</span>
          <p className="splash-tip-text">{TIPS[tipIdx]}</p>
        </div>

        {elapsed > 15 && step < 2 && (
          <p className="splash-patience">
            Free-tier servers can take up to 60s to wake up — hang tight!
          </p>
        )}
      </div>
    </div>
  );
}
