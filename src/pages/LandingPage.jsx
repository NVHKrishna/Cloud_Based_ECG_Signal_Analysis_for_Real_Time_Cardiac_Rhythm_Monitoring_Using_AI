import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Activity, Shield, Wifi, Cloud, Heart, Zap,
  ChevronRight, ArrowRight, CheckCircle, Menu, X
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateECGBeat } from '../utils/ecgSimulator.js'

// Mini SVG ECG waveform for hero decoration
function HeroECGLine() {
  const pathRef = useRef(null)
  const [path, setPath] = useState('')

  useEffect(() => {
    const beat = generateECGBeat(300, 0.01)
    const w = 700
    const h = 100
    const mid = h / 2
    const scaleY = 35

    const pts = beat.map((pt, i) => {
      if (!pt || pt.value === undefined) return ''
      const x = (i / beat.length) * w
      const yPx = mid - pt.value * scaleY
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yPx.toFixed(1)}`
    }).filter(p => p !== '')
    setPath(pts.join(' '))
  }, [])

  return (
    <svg viewBox="0 0 700 100" className="w-full h-24 opacity-80" preserveAspectRatio="none">
      <path d={path} stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const features = [
  {
    icon: Activity,
    title: 'Real-Time ECG Monitoring',
    desc: 'Stream live ECG waveforms from IoT sensors directly to your dashboard with millisecond precision.',
    color: 'ecg-green',
  },
  {
    icon: Wifi,
    title: 'Remote Patient Tracking',
    desc: 'Monitor patients from anywhere in the world with secure, low-latency WebSocket streaming.',
    color: 'ecg-cyan',
  },
  {
    icon: Zap,
    title: 'Early Anomaly Detection',
    desc: 'AI-assisted algorithms flag arrhythmias, ST elevation, and other critical patterns instantly.',
    color: 'ecg-warning',
  },
  {
    icon: Cloud,
    title: 'Secure Cloud Storage',
    desc: 'All ECG recordings are encrypted and stored with HIPAA-ready cloud infrastructure.',
    color: 'ecg-green',
  },
]

const stats = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<15ms', label: 'Signal Latency' },
  { value: '500+', label: 'Hospitals Using' },
  { value: '2M+', label: 'Patients Monitored' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-ecg-dark overflow-x-hidden text-ecg-text">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b-2 ${scrolled ? 'bg-white/90 backdrop-blur-xl pt-2 pb-2 border-slate-300/80 shadow-md' : 'bg-white/60 backdrop-blur-md pt-3 pb-4 border-slate-200'
        }`}>
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-ecg-green/10 border border-ecg-green/30 flex items-center justify-center text-ecg-green group-hover:scale-110 transition-transform shadow-sm">
              <Activity className="w-7 h-7" />
            </div>
            <span className="font-black text-3xl tracking-tighter text-ecg-text">
              Cardio<span className="text-ecg-green">AI</span>
            </span>
          </Link>

          {/* Unified Desktop Navigation Cluster */}
          <div className="hidden md:flex items-center gap-10 ml-auto">
            {['Features', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="nav-link text-sm font-semibold transition-colors hover:text-ecg-green">
                {link}
              </a>
            ))}

            {user ? (
              <button onClick={() => navigate('/dashboard')} className="btn-primary">
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <>
                <Link to="/login" className="nav-link text-sm font-semibold">Login</Link>
                <Link to="/login" className="btn-primary ml-4">
                  Get Started <ChevronRight className="w-4 h-4 text-white" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-ecg-text" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-ecg-dark-border px-8 py-6 flex flex-col gap-5 animate-slide-up shadow-2xl">
            {['Features', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="text-ecg-text-dim hover:text-ecg-text text-sm font-medium"
                onClick={() => setMenuOpen(false)}>
                {link}
              </a>
            ))}
            <div className="flex gap-4 pt-4 border-t border-ecg-dark-border">
              <Link to="/login" className="btn-ghost flex-1 justify-center bg-slate-50">Login</Link>
              <Link to="/login" className="btn-primary flex-1 justify-center">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col justify-center pt-32 pb-20 px-8">
        {/* Background decorations */}
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full
          bg-ecg-cyan/5 blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-16">
            <div className="max-w-4xl">
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-extrabold leading-tight mb-4 animate-slide-up text-ecg-text">
                <span className="md:whitespace-nowrap font-black">AI-Powered Real-Time</span> <br />
                <span className="md:whitespace-nowrap font-black">ECG Monitoring</span>
              </h1>

              <p className="text-lg md:text-xl text-ecg-text-dim leading-relaxed mb-6 max-w-2xl animate-fade-in font-medium">
                Real-time cardiac surveillance powered by connected IoT sensors. Monitor heart
                activity live, detect anomalies early, and deliver better patient outcomes —
                anywhere, anytime.
              </p>

              <div className="flex flex-wrap gap-4 animate-slide-up">
                <Link to="/login" id="hero-login-btn" className="btn-primary text-base px-8 py-4">
                  Get Started <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
                <a href="#features" className="btn-outline text-base px-8 py-4 bg-white border border-ecg-green">
                  Explore Features
                </a>
              </div>
            </div>

            {/* Live IoT Badge on the Right */}
            <div className="mt-8 lg:mt-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                border border-ecg-green/30 bg-ecg-green/5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-ecg-green animate-pulse" />
                <span className="text-xs font-medium text-ecg-green">Live IoT Integration Active</span>
              </div>
            </div>
          </div>

          {/* ECG waveform banner — Positioned at bottom */}
          <div className="card bg-white p-5 ecg-grid relative overflow-hidden animate-slide-up shadow-2xl border-ecg-dark-border/50 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-ecg-green animate-pulse" />
              <span className="text-xs font-mono text-ecg-green font-bold">LEAD II — LIVE SIGNAL</span>
              <span className="ml-auto text-xs font-mono text-ecg-muted font-bold">25 mm/s · 10 mm/mV</span>
            </div>
            <HeroECGLine />
            {/* scan overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="h-full w-20 bg-gradient-to-r from-transparent via-ecg-cyan/5 to-transparent animate-scan-line" />
            </div>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-ecg-green text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
              Built for Clinical Excellence
            </h2>
            <p className="text-ecg-text-dim text-lg max-w-2xl mx-auto font-medium">
              Purpose-built tools for cardiologists, ICU teams, and remote care providers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card bg-white p-6 group hover:border-ecg-green/40
                hover:-translate-y-1 transition-all duration-300 cursor-default shadow-sm border-ecg-dark-border">
                <div className={`w-12 h-12 rounded-xl bg-ecg-green/10 border border-ecg-green/20
                  flex items-center justify-center mb-5
                  group-hover:bg-ecg-green group-hover:text-white transition-all duration-300 shadow-sm`}>
                  <f.icon className="w-6 h-6 text-ecg-green group-hover:text-white" />
                </div>
                <h3 className="font-bold text-ecg-text mb-2 text-lg">{f.title}</h3>
                <p className="text-sm text-ecg-text-dim leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-24 px-6 border-t border-b border-slate-400/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div>
              <p className="text-ecg-green text-sm font-semibold uppercase tracking-widest mb-3">About</p>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">
                ECG + IoT:{' '}
                <span className="text-gradient">The Future of</span>{' '}
                Cardiac Care
              </h2>
              <p className="text-lg text-ecg-text-dim leading-relaxed mb-6 font-medium">
                An Electrocardiogram (ECG) records the electrical activity of the heart. By
                integrating ECG sensors with IoT technology, we enable continuous, wireless
                transmission of cardiac data to cloud-based dashboards — eliminating the need
                for patients to remain tethered to hospital equipment.
              </p>
              <p className="text-lg text-ecg-text-dim leading-relaxed mb-8 font-medium">
                CardioAI bridges the gap between bedside monitoring and remote care delivery.
                Whether in a bustling ICU or a rural clinic, physicians receive the same
                high-fidelity data they need to make life-saving decisions.
              </p>

              <div className="space-y-3">
                {[
                  'Real-time ECG signal acquisition from ESP32 device in Cloud ',
                  'AI-based arrhythmia detection using trained ML model',
                  'Live ECG waveform visualization on dashboard',
                  'Automatic heart rate & RR interval analysis',
                ].map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-ecg-green flex-shrink-0" />
                    <span className="text-sm font-bold text-ecg-text">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right illustration - Updated with Cardio Image & ECG Symbol */}
            <div className="relative group">
              <div className="absolute inset-0 bg-ecg-cyan/10 blur-[100px] opacity-20" />
              <div className="card bg-white p-4 relative overflow-hidden shadow-2xl border-ecg-dark-border/50 rounded-2xl">
                <div className="relative rounded-xl overflow-hidden mb-4">
                  <img
                    src="/cardio_ecg.png"
                    alt="Clinical Cardio Test"
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* ECG Symbol Overlay */}
                  <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 animate-pulse">
                    <Activity className="w-8 h-8 text-ecg-green" />
                  </div>

                  <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-ecg-green animate-pulse" />
                    <span className="text-[10px] font-mono text-white font-bold tracking-widest uppercase">Telemetry Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="contact" className="border-t border-ecg-dark-border py-12 px-8 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 text-ecg-green" />
            <span className="font-black text-2xl tracking-tighter text-ecg-text">Cardio<span className="text-ecg-green">AI</span></span>
            <span className="text-ecg-muted text-sm ml-2">© 2026</span>
          </div>
          <p className="text-xs text-ecg-muted text-center max-w-sm">
            IoT-Based ECG Monitoring System · For demonstration purposes only.
            Not a substitute for professional medical advice.
          </p>
          <div className="flex gap-8 text-sm text-ecg-muted font-medium">
            <a href="#" className="hover:text-ecg-text transition-colors">Privacy</a>
            <a href="#" className="hover:text-ecg-text transition-colors">Terms</a>
            <a href="#" className="hover:text-ecg-text transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
