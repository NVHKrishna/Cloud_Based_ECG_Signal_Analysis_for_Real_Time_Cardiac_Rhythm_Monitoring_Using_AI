import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Activity, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ChevronLeft, User, Github, ShieldCheck } from 'lucide-react'
import { generateECGBeat } from '../utils/ecgSimulator.js'

function BGECGLines() {
  const [paths, setPaths] = useState([])

  useEffect(() => {
    const lines = [0, 1, 2].map(i => {
      const beat = generateECGBeat(250, 0.015)
      const h = 60
      const mid = h / 2
      const scale = 18 + i * 4
      const pts = beat.map((pt, idx) => {
        const x = (idx / beat.length) * 100
        const yPx = mid - pt.value * scale
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${yPx.toFixed(2)}`
      })
      return pts.join(' ')
    })
    setPaths(lines)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.08]">
      {paths.map((d, i) => (
        <svg key={i} viewBox="0 0 100 60" preserveAspectRatio="none"
          className="absolute w-full"
          style={{ top: `${20 + i * 28}%`, height: '60px' }}>
          <path d={d} stroke="#10b981" strokeWidth="0.5" fill="none" />
        </svg>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { login, register, oauthLogin, user } = useAuth()
  const navigate = useNavigate()

  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', age: '', gender: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const validate = () => {
    const e = {}
    if (!isLogin && !form.name) e.name = 'Full Name is required'
    if (!isLogin && !form.age) e.age = 'Age is required'
    else if (!isLogin && (isNaN(form.age) || form.age < 1 || form.age > 120)) e.age = 'Enter a valid age'
    if (!isLogin && !form.gender) e.gender = 'Gender is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    return e
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    let result;
    if (isLogin) {
      result = await login(form.email, form.password)
    } else {
      result = await register(form.name, form.email, form.password, Number(form.age), form.gender)
    }

    setLoading(false)
    if (result.success) {
      if (isLogin) {
        navigate('/dashboard', { replace: true })
      } else {
        setSuccessMsg('Registration successful! Please sign in with your new credentials.')
        setIsLogin(true)
        setForm(f => ({ ...f, password: '' })) // Clear password for security, keep email for convenience
      }
    } else {
      setServerError(result.message)
    }
  }

  const handleOAuth = async (provider) => {
    setLoading(true)
    setServerError('')
    // Simulating OAuth flow. In a real app, this redirects to Google/Github
    setTimeout(async () => {
      const mockEmail = provider === 'google' ? 'user@gmail.com' : 'user@github.com'
      const mockName = provider === 'google' ? 'Google User' : 'Github User'
      const result = await oauthLogin(provider, mockEmail, mockName, provider + '-id-123')
      setLoading(false)
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        setServerError(result.message)
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-ecg-dark flex relative overflow-hidden text-ecg-text">
      <BGECGLines />

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[40%] p-16 relative border-r border-ecg-dark-border bg-white shadow-2xl z-20">
        <div className="absolute inset-0 bg-gradient-to-br from-ecg-cyan/[0.03] via-transparent to-ecg-green/[0.03]" />
        <div className="absolute inset-0 dot-grid opacity-[0.05]" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-ecg-green/10 border border-ecg-green/30 flex items-center justify-center text-ecg-green shadow-sm group-hover:scale-110 transition-transform">
              <Activity className="w-7 h-7" />
            </div>
            <span className="font-black text-3xl tracking-tighter text-ecg-text">
              Cardio<span className="text-ecg-green">AI</span>
            </span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight">
            Monitor Hearts,<br />
            <span className="text-gradient">Save Lives.</span>
          </h2>
          <p className="text-lg text-ecg-text-dim leading-relaxed max-w-sm font-medium">
            Access real-time ECG streams, patient vitals, and clinical-grade analytics —
            all in one secure dashboard.
          </p>
        </div>

        {/* Features list */}
        <div className="relative z-10 space-y-5">
          {[
            'Real-time IoT ECG waveform streaming',
            'Heart rate & RR interval analysis',
            'Automated anomaly detection alerts',
            'Encrypted HIPAA-compliant data',
          ].map(f => (
            <div key={f} className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full bg-ecg-green/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-ecg-green" />
              </div>
              <span className="text-sm font-semibold text-ecg-text-dim">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto min-h-[0px] relative z-10 bg-slate-50/50">
        <div className="w-full max-w-md my-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ecg-green/10 border border-ecg-green/30 flex items-center justify-center text-ecg-green shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-ecg-text">Cardio<span className="text-ecg-green">AI</span></span>
          </div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-ecg-muted hover:text-ecg-text transition-colors text-sm mb-6 font-medium">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>

          <div className="card bg-white p-6 sm:p-8 shadow-2xl shadow-slate-200/50 rounded-3xl">
            <div className="mb-5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ecg-text mb-2">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h1>
              <p className="text-ecg-text-dim text-sm font-medium">
                {isLogin ? 'Sign in to your CardioAI account' : 'Join CardioAI to monitor patients'}
              </p>
            </div>

            <div className="flex mb-6 space-x-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${isLogin ? 'bg-white shadow-sm text-ecg-cyan' : 'text-ecg-muted hover:text-ecg-text'}`}
                onClick={() => { setIsLogin(true); setErrors({}); setServerError(''); setSuccessMsg(''); }}
              >
                Login
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isLogin ? 'bg-white shadow-sm text-ecg-cyan' : 'text-ecg-muted hover:text-ecg-text'}`}
                onClick={() => { setIsLogin(false); setErrors({}); setServerError(''); setSuccessMsg(''); }}
              >
                Register
              </button>
            </div>

            {successMsg && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl
                bg-ecg-green/10 border border-ecg-green/20 text-ecg-green text-sm font-medium">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                {successMsg}
              </div>
            )}

            {serverError && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl
                bg-ecg-critical/10 border border-ecg-critical/20 text-ecg-critical text-sm font-medium">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">

              {!isLogin && (
                <div>
                  <label htmlFor="register-name" className="block text-[11px] font-bold text-ecg-text mb-1 ml-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ecg-muted" />
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Dr. Smith"
                      value={form.name}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })) }}
                      className={`input-field pl-12 h-12 text-sm ${errors.name ? 'border-ecg-critical focus:border-ecg-critical focus:ring-ecg-critical/20' : ''}`}
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-2 text-xs text-ecg-critical flex items-center gap-1.5 ml-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                    </p>
                  )}
                </div>
              )}

              {/* Age & Gender — Register only */}
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Age */}
                  <div>
                    <label htmlFor="register-age" className="block text-[11px] font-bold text-ecg-text mb-1 ml-1">
                      Age
                    </label>
                    <input
                      id="register-age"
                      type="number"
                      min="1"
                      max="120"
                      placeholder="e.g. 35"
                      value={form.age}
                      onChange={e => { setForm(f => ({ ...f, age: e.target.value })); setErrors(er => ({ ...er, age: '' })) }}
                      className={`input-field h-12 text-sm text-center ${errors.age ? 'border-ecg-critical focus:border-ecg-critical focus:ring-ecg-critical/20' : ''}`}
                    />
                    {errors.age && (
                      <p className="mt-2 text-xs text-ecg-critical flex items-center gap-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.age}
                      </p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <label htmlFor="register-gender" className="block text-[11px] font-bold text-ecg-text mb-1 ml-1">
                      Gender
                    </label>
                    <select
                      id="register-gender"
                      value={form.gender}
                      onChange={e => { setForm(f => ({ ...f, gender: e.target.value })); setErrors(er => ({ ...er, gender: '' })) }}
                      className={`input-field h-12 text-sm ${errors.gender ? 'border-ecg-critical focus:border-ecg-critical focus:ring-ecg-critical/20' : ''}`}
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && (
                      <p className="mt-2 text-xs text-ecg-critical flex items-center gap-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.gender}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-[11px] font-bold text-ecg-text mb-1 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ecg-muted" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="test@gmail.com"
                    value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })) }}
                    className={`input-field pl-12 h-12 text-sm ${errors.email ? 'border-ecg-critical focus:border-ecg-critical focus:ring-ecg-critical/20' : ''}`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-xs text-ecg-critical flex items-center gap-1.5 ml-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="block text-[11px] font-bold text-ecg-text mb-1 ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ecg-muted" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '' })) }}
                    className={`input-field pl-12 pr-12 h-12 text-sm ${errors.password ? 'border-ecg-critical focus:border-ecg-critical focus:ring-ecg-critical/20' : ''}`}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ecg-muted hover:text-ecg-text transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-ecg-critical flex items-center gap-1.5 ml-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.password}
                  </p>
                )}
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center h-12 text-sm font-bold rounded-xl shadow-lg shadow-ecg-green/20 disabled:opacity-50 mt-2">
                {loading ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Authenticating…
                  </span>
                ) : (
                  <>{isLogin ? 'Sign In' : 'Sign Up'} <ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </button>
            </form>



          </div>
        </div>
      </div>
    </div>
  )
}
