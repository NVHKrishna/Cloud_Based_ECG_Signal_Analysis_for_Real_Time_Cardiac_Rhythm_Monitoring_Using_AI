import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ECGChart from '../components/ECGChart.jsx'
import {
  Activity, Heart, LogOut, Sun,
  AlertTriangle, Cpu, UserCircle, Smartphone, ShieldAlert, ShieldCheck,
  Wifi, Clock, RefreshCw, Zap, Download, Edit3, X, Check
} from 'lucide-react'
import {
  generateECGBeat,
  getStatusFromBPM,
} from '../utils/ecgSimulator.js'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const WINDOW = 300
const TICK_MS = 40

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [ecgBuffer, setEcgBuffer] = useState(() => new Array(WINDOW).fill({ value: 0, isPeak: false }))
  const sourceBuffer = useRef([])
  const sourceIdx = useRef(0)

  // R-Peak states
  const [rPeakCount, setRPeakCount] = useState(0)
  const [lastPeakTime, setLastPeakTime] = useState(null)
  const [rrInterval, setRrInterval] = useState(0)
  const [isPulse, setIsPulse] = useState(false)
  const lastPeakTimestampRef = useRef(0)
  const rrHistoryRef = useRef([])

  const [metrics, setMetrics] = useState({ bpm: 72, pr: 156, qrs: 88, qt: 412, status: 'Normal' })
  const [patient, setPatient] = useState(null)
  const [timestamp, setTimestamp] = useState(new Date())
  const [recording, setRecording] = useState(true)

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ age: '', gender: '' })
  const [profileSaving, setProfileSaving] = useState(false)

  // fetch patient
  useEffect(() => {
    if (!user?.token) return
    fetch('/api/patient', { headers: { Authorization: `Bearer ${user?.token}` } })
      .then(r => {
        if (r.status === 401) { logout(); navigate('/login'); return }
        if (!r.ok) throw new Error('Failed to fetch patient')
        return r.json()
      })
      .then(data => {
        if (data) {
          setPatient(data)
          setProfileForm({ 
            age: data.age && data.age !== '--' ? data.age : '', 
            gender: data.gender && data.gender !== '--' ? data.gender : '' 
          })
        }
      })
      .catch(() => setPatient({
        name: user?.name || 'Unknown', age: '--', id: 'PT-LOCAL', gender: user?.gender || '--',
        ward: 'Cardiology CCU', bed: 'B-04', deviceId: 'ESP32-ECG-001',
        admittedOn: '--', diagnosis: 'Pending ECG Analysis',
      }))
  }, [user, logout, navigate])

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify(profileForm)
      });
      if (resp.ok) {
        const data = await resp.json();
        setPatient(prev => ({ ...prev, age: data.age || '--', gender: data.gender || '--' }));
        setIsEditingProfile(false);
      }
    } catch(err) {
      console.error(err);
    }
    setProfileSaving(false);
  }

  // build source buffer
  const refreshSource = useCallback((bpm = 72) => {
    const spb = Math.round((60 / bpm) * 250)
    sourceBuffer.current = generateECGBeat(spb * 4, 0.02)
    sourceIdx.current = 0
  }, [])

  useEffect(() => { refreshSource(72) }, [refreshSource])

  // tick logic for waveform and peak detection
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      const src = sourceBuffer.current
      if (!src.length) return

      setEcgBuffer(prev => {
        const next = [...prev]
        for (let i = 0; i < 4; i++) {
          const sample = src[sourceIdx.current % src.length]
          if (!sample) continue

          next.shift()
          next.push(sample)

          // Peak detection logic: Check if flagged OR detect locally on raw value
          const isPeakValue = sample.isPeak || (sample.value > 0.8 && sample.value > (next[next.length - 2]?.value || 0))

          if (isPeakValue) {
            const now = Date.now()
            // Avoid duplicate detections for same peak within short window (300ms)
            if (now - lastPeakTimestampRef.current > 300) {
              setRPeakCount(c => c + 1)
              setLastPeakTime(new Date().toLocaleTimeString())

              if (lastPeakTimestampRef.current > 0) {
                const interval = now - lastPeakTimestampRef.current
                setRrInterval(interval)
                rrHistoryRef.current = [interval, ...rrHistoryRef.current].slice(0, 10)
              }
              lastPeakTimestampRef.current = now
              setIsPulse(true)
              setTimeout(() => setIsPulse(false), 200)
            }
          }
          sourceIdx.current++
        }
        return next
      })
      setTimestamp(new Date())
    }, TICK_MS)
    return () => clearInterval(id)
  }, [recording])

  const [history, setHistory] = useState([])
  const [report, setReport] = useState(null)

  // Fetch report once on mount (Read-only now to avoid overwriting manual runs)
  useEffect(() => {
    if (!user?.token) return
    fetch('/api/ecg/latest-report', { headers: { Authorization: `Bearer ${user?.token}` } })
      .then(r => {
        if (r.status === 401) { logout(); navigate('/login'); return }
        return r.json()
      })
      .then(data => { if (data && !data.error) setReport(data) })
      .catch(err => console.error('Failed to fetch initial report:', err))
  }, [user, logout, navigate])

  // fetch metrics and history every 2s
  useEffect(() => {
    if (!user?.token) return
    const fetchData = () => {
      // Trigger processing to save data for the current user
      fetch('/api/ecg/process-ecg', { headers: { Authorization: `Bearer ${user?.token}` } })
        .then(r => r.json())
        .catch(err => console.error('Failed to trigger background processing:', err));

      // Fetch latest
      fetch('/api/ecg/latest', { headers: { Authorization: `Bearer ${user?.token}` } })
        .then(r => {
          if (r.status === 401) { logout(); navigate('/login'); return null }
          if (!r.ok) return null
          return r.json()
        })
        .then(data => {
          if (!data || data.error) return;
          setMetrics({
            bpm: data.heartRate,
            classification: data.prediction,
            confidence: data.confidence,
            timestamp: data.timestamp,
            status: data.prediction === 'Normal' ? 'Normal' : 'Abnormal'
          });
          if (data.ecg && data.ecg.length > 0) {
            // Only update buffer if it's new or empty
            const newSamples = data.ecg.map(val => ({ value: val, isPeak: false, timestamp: Date.now() }));
            sourceBuffer.current = [...sourceBuffer.current, ...newSamples].slice(-2000);
          }
        })
        .catch(err => console.error('Failed to fetch latest:', err));

      // Fetch latest report
      fetch('/api/ecg/latest-report', { headers: { Authorization: `Bearer ${user?.token}` } })
        .then(r => {
          if (r.status === 401) { logout(); navigate('/login'); return null }
          if (!r.ok) return null
          return r.json()
        })
        .then(data => {
          if (data && !data.error) setReport(data);
        })
        .catch(err => console.error('Failed to fetch latest report:', err));

      // Fetch history
      fetch('/api/ecg/history', { headers: { Authorization: `Bearer ${user?.token}` } })
        .then(r => {
          if (r.status === 401) { logout(); navigate('/login'); return null }
          if (!r.ok) return null
          return r.json()
        })
        .then(data => data && !data.error && setHistory(data))
        .catch(err => console.error('Failed to fetch history:', err));
    }
    fetchData()
    const t = setInterval(fetchData, 2000)
    return () => clearInterval(t)
  }, [user, logout, navigate])

  const handleLogout = () => { logout(); navigate('/', { replace: true }) }

  const hr = metrics.bpm || 0
  const { hrStatus, hrColor } = useMemo(() => {
    if (hr === 0) return { hrStatus: "Waiting...", hrColor: "text-ecg-muted" };
    if (metrics.status === "Abnormal" || hr < 50 || hr > 100) return { hrStatus: "Abnormal", hrColor: "text-ecg-critical" };
    if (hr >= 60 && hr <= 100) return { hrStatus: "Normal Range", hrColor: "text-ecg-green" };
    return { hrStatus: "Elevated", hrColor: "text-ecg-warning" };
  }, [hr, metrics.status])

  // RR Status Logic
  const { rrStatus, rrStatusColor } = useMemo(() => {
    if (rrInterval === 0) return { rrStatus: "Waiting...", rrStatusColor: "text-ecg-muted" }
    const avg = rrHistoryRef.current.reduce((a, b) => a + b, 0) / rrHistoryRef.current.length
    const diff = Math.abs(rrInterval - avg)
    if (diff > 150) return { rrStatus: "Abnormal", rrStatusColor: "text-ecg-critical" }
    if (diff > 50) return { rrStatus: "Irregular", rrStatusColor: "text-ecg-warning" }
    return { rrStatus: "Stable", rrStatusColor: "text-ecg-green" }
  }, [rrInterval])

  const generatePDFReport = () => {
    const doc = new jsPDF()
    const now = new Date().toLocaleString()

    // Title
    doc.setFontSize(22)
    doc.setTextColor(2, 132, 199) // ecg-cyan
    doc.text('CardioAI Clinical Report', 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated on: ${now}`, 14, 28)

    // Patient Information Section
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text('Patient Information', 14, 40)
    doc.line(14, 42, 60, 42)

    doc.setFontSize(11)
    doc.text(`Name: ${patient?.name || 'N/A'}`, 14, 50)
    doc.text(`Patient ID: ${patient?.id || 'N/A'}`, 14, 56)
    doc.text(`Age/Gender: ${patient?.age || 'N/A'} yrs / ${patient?.gender || 'N/A'}`, 100, 50)
    doc.text(`Diagnosis: ${patient?.diagnosis || 'N/A'}`, 100, 56)

    // Overall Vitals Section
    doc.setFontSize(14)
    doc.text('Clinical Summary', 14, 70)
    doc.line(14, 72, 60, 72)

    const summaryData = [
      ['Metric', 'Value', 'Status'],
      ['Heart Rate (BPM)', `${hr || '--'}`, hrStatus],
      ['RR Interval (ms)', `${report?.rrIntervals?.[report.rrIntervals.length - 1] || rrInterval || '--'}`, rrStatus],
      ['AI Classification', report?.finalResult || metrics.classification || 'Normal', report?.finalResult === 'Normal' ? 'Normal' : 'Attention Required'],
      ['Analysis Confidence', `${metrics.confidence || 0}%`, 'N/A']
    ]

    autoTable(doc, {
      startY: 78,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: { fillStyle: [2, 132, 199] }
    })

    // Heart Rate Windows Table
    doc.setFontSize(14)
    doc.text('Heart Rate Windows (Every 10 Beats)', 14, (doc).lastAutoTable.finalY + 15)
    
    const hrRows = (report?.hrWindows || []).map(win => [win.beatRange, win.robustHR, win.meanHR])
    autoTable(doc, {
      startY: (doc).lastAutoTable.finalY + 20,
      head: [['Beat Range', 'Robust HR', 'Mean HR']],
      body: hrRows.length > 0 ? hrRows : [['No data', '--', '--']],
      theme: 'grid'
    })

    doc.save(`CardioAI_Report_${patient?.name || 'Patient'}.pdf`)
  }

  return (
    <div className="min-h-screen bg-ecg-dark text-ecg-text p-4 lg:p-6 font-sans selection:bg-ecg-cyan/30 overflow-y-auto flex flex-col pb-16">

      {/* Background decoration */}
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-8 pb-3 border-b-2 border-slate-200/80 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-ecg-cyan flex items-center justify-center text-white shadow-lg shadow-ecg-cyan/20">
            <Activity className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-ecg-text">CardioAI</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={generatePDFReport}
            className="flex items-center gap-2 px-4 py-2 bg-white text-ecg-cyan border border-ecg-dark-border rounded-xl text-xs font-bold hover:bg-ecg-cyan hover:text-white transition-all duration-300 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>



          <div className="flex items-center gap-4 border-l-2 border-slate-400 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-ecg-text leading-tight">{user?.name || "Dr. Staff"}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-ecg-cyan/10 border border-ecg-cyan/30 flex items-center justify-center text-ecg-cyan text-sm font-bold shadow-inner">
              {user?.name?.[0] || "U"}
            </div>
            <button onClick={handleLogout} className="text-ecg-text-dim hover:text-ecg-critical transition-colors ml-1 p-2 hover:bg-red-50 rounded-xl">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <main className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-[420px_320px] gap-6 relative z-10 flex-1 mb-6">

        {/* UPPER LEFT: ECG WAVEFORM */}
        <div className="lg:col-span-2 card bg-white flex flex-col min-h-0 overflow-hidden shadow-lg shadow-slate-200/50 rounded-3xl">
          <div className="flex items-center justify-between p-3 border-b border-ecg-dark-border bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-ecg-cyan/10 flex items-center justify-center text-ecg-cyan">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-ecg-text">ECG Signal</h3>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRecording(!recording)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${recording
                  ? 'bg-ecg-warning/10 text-ecg-warning border-ecg-warning/30 hover:bg-ecg-warning hover:text-white'
                  : 'bg-ecg-green/10 text-ecg-green border-ecg-green/30 hover:bg-ecg-green hover:text-white'
                  }`}
              >
                {recording ? (
                  <><div className="w-2 h-2 rounded-full bg-current animate-pulse" /> Pause Stream</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Resume Stream</>
                )}
              </button>

              <div className="text-[10px] font-semibold text-ecg-muted bg-white px-3 py-1.5 rounded-lg border border-ecg-dark-border uppercase tracking-wider">
                25 mm/s | 10 mm/mV
              </div>
            </div>
          </div>

          <div className="flex-1 w-full relative ecg-grid min-h-0">
            <ECGChart dataBuffer={ecgBuffer} />

            {(!recording || ecgBuffer.every(v => v.value === 0)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-ecg-muted bg-white/80 backdrop-blur-[2px] z-20">
                <AlertTriangle className="w-10 h-10 mb-3 text-ecg-warning opacity-80" />
                <p className="font-medium text-ecg-text">Waiting for sensor stream...</p>
              </div>
            )}
          </div>
        </div >

        {/* UPPER RIGHT: VITALS & AI */}
        <div className="flex flex-col gap-5 min-h-0">

          {/* HEART RATE CARD */}
          <div className={`card p-5 bg-white flex-1 flex flex-col transition-all duration-500 border-2 border-ecg-cyan min-h-0 shadow-md`}>
            <div className="flex flex-1 items-center gap-8 min-h-0">
              {/* BPM Section */}
              <div className="flex-1 border-r border-slate-400 pr-8">
                <p className="text-xs font-semibold text-ecg-muted mb-2">Live Heart Rate (BPM)</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-6xl font-bold font-mono ${hrColor} transition-all duration-300 ${isPulse ? 'scale-105' : 'scale-100'}`}>
                    {hr || "--"}
                  </span>
                  <span className="text-xs text-ecg-muted ml-1 font-bold">BPM</span>
                </div>
                {report && (
                  <p className="text-[10px] text-ecg-cyan mt-1 uppercase tracking-wider font-bold">
                    Dataset Avg: <span className="font-mono">{report.robustHeartRate}</span>
                  </p>
                )}
              </div>

              {/* RR Interval Section */}
              <div className="flex-1 space-y-2">
                <p className="text-xs font-semibold text-ecg-muted mb-2">RR Interval</p>
                <p className="text-4xl font-bold text-ecg-cyan font-mono leading-none">
                  {report?.rrIntervals?.length > 0 
                    ? report.rrIntervals[report.rrIntervals.length - 1] 
                    : (rrInterval || "--")}
                  <span className="text-xs ml-1 text-ecg-muted">ms</span>
                </p>
                {report?.avgRRms && (
                  <p className="text-[10px] text-ecg-cyan mt-1 uppercase tracking-wider font-bold">
                    Dataset Mean: <span className="font-mono">{report.avgRRms} ms</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* AI CLASSIFICATION */}
          <div className={`card p-4 bg-white flex-1 flex flex-col transition-all duration-500 border-2 border-ecg-cyan overflow-hidden min-h-0 shadow-lg shadow-slate-200/50 rounded-2xl`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold text-ecg-muted uppercase tracking-wider mb-1">AI Classification</p>
                <h4 className={`text-xl font-bold leading-none ${report ? (report.finalResult === 'Normal' ? 'text-ecg-green' : 'text-ecg-critical') : hrColor}`}>
                  {report ? report.finalResult : (hr > 0 ? (metrics.classification || 'Normal') : 'Syncing...')}
                </h4>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-ecg-dark-border ${hrColor} shadow-inner`}>
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            {/* Report stats from New_Testing.py */}
            {report ? (
              <div className="space-y-2 mt-1">
                {/* Overall Accuracy */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-ecg-muted uppercase tracking-wider">Overall Accuracy</span>
                  <span className="text-base font-bold font-mono text-ecg-cyan">{report.accuracy}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-ecg-cyan rounded-full transition-all duration-1000" style={{ width: `${report.accuracy}%` }} />
                </div>

                {/* Beat breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="text-center bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                    <p className="text-[9px] text-ecg-muted uppercase font-bold mb-0.5">Total</p>
                    <p className="text-sm font-bold font-mono text-ecg-text">{report.totalBeats}</p>
                  </div>
                  <div className="text-center bg-ecg-green/5 rounded-lg p-1.5 border border-ecg-green/20">
                    <p className="text-[9px] text-ecg-green uppercase font-bold mb-0.5">Normal</p>
                    <p className="text-sm font-bold font-mono text-ecg-green">{report.normalBeats}</p>
                  </div>
                  <div className="text-center bg-ecg-critical/5 rounded-lg p-1.5 border border-ecg-critical/20">
                    <p className="text-[9px] text-ecg-critical uppercase font-bold mb-0.5">Arrhy.</p>
                    <p className="text-sm font-bold font-mono text-ecg-critical">{report.arrhythmiaBeats}</p>
                  </div>
                </div>

                {/* Arrhythmia % */}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-[10px] font-semibold text-ecg-muted uppercase tracking-wider">Arrhythmia %</span>
                  <span className={`text-sm font-bold font-mono ${report.arrhythmiaPercent > 10 ? 'text-ecg-critical' : 'text-ecg-green'}`}>
                    {report.arrhythmiaPercent}%
                  </span>
                </div>

                {/* HR & RR from dataset */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100 text-center">
                    <p className="text-[9px] text-ecg-muted uppercase font-bold mb-0.5">Avg HR</p>
                    <p className="text-sm font-bold font-mono text-ecg-text">{report.avgHeartRate} <span className="text-[8px] text-ecg-muted">BPM</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100 text-center">
                    <p className="text-[9px] text-ecg-muted uppercase font-bold mb-0.5">Avg RR</p>
                    <p className="text-sm font-bold font-mono text-ecg-cyan">{report.avgRRms} <span className="text-[8px] text-ecg-muted">ms</span></p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mt-auto">
                <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider">
                  <span className="text-ecg-text-dim">Confidence Score</span>
                  <span className={`${hrColor} font-mono text-base font-bold`}>{hr > 0 ? `${metrics.confidence}%` : '0.0%'}</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-1">
                  <div
                    className={`h-full rounded-full ${metrics.status === 'Abnormal' ? 'bg-ecg-critical' : 'bg-ecg-green'} transition-all duration-1000 relative`}
                    style={{ width: hr > 0 ? `${metrics.confidence}%` : '0%' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
                  </div>
                </div>
                <p className="text-[10px] text-ecg-muted text-center animate-pulse">Loading full report...</p>
              </div>
            )}
          </div>
        </div>

        {/* LOWER LEFT: PATIENT INFO */}
        <div className="card bg-white flex flex-col min-h-0 shadow-md">
          <div className="flex items-center gap-3 p-4 border-b border-ecg-dark-border bg-slate-50/50">
            <div className="w-8 h-8 rounded-lg bg-ecg-green/10 flex items-center justify-center text-ecg-green">
              <UserCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-ecg-text">Patient Information</h3>
            <div className="ml-auto flex items-center">
              {isEditingProfile ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsEditingProfile(false)} className="p-1 px-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center gap-1 transition-colors">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={saveProfile} disabled={profileSaving} className="p-1 px-2 text-xs font-bold bg-ecg-cyan text-white hover:bg-ecg-cyan/90 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" /> {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditingProfile(true)} className="p-1 px-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center gap-1 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-5 grid grid-cols-2 gap-y-5 gap-x-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Full Name</p>
              <p className="text-sm font-semibold text-ecg-text">{patient?.name || user?.name || '--'}</p>
            </div>
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Test Record</p>
              <p className="text-sm font-medium text-ecg-text font-mono">
                {report?.record ? `MIT-BIH #${report.record}` : patient?.id || '--'}
              </p>
            </div>
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Age</p>
              {isEditingProfile ? (
                <input type="number" min="1" max="120" value={profileForm.age} onChange={e => setProfileForm(f => ({ ...f, age: e.target.value }))} className="w-20 px-2 py-0.5 text-sm border border-slate-300 rounded overflow-hidden focus:outline-none focus:border-ecg-cyan" />
              ) : (
                <p className="text-sm font-medium text-ecg-text">{patient?.age !== '--' && patient?.age ? `${patient?.age} yrs` : '--'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Gender</p>
              {isEditingProfile ? (
                <select value={profileForm.gender} onChange={e => setProfileForm(f => ({ ...f, gender: e.target.value }))} className="w-24 px-2 py-0.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-ecg-cyan bg-white">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <p className="text-sm font-medium text-ecg-text">{patient?.gender || '--'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Linked Device</p>
              <div className="flex items-center gap-2 mt-1">
                <Smartphone className="w-4 h-4 text-ecg-cyan" />
                <p className="text-sm font-medium text-ecg-text">{patient?.deviceId || 'DEV-XYZ'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-ecg-text-dim mb-0.5">Registered On</p>
              <p className="text-sm font-medium text-ecg-text">{patient?.admittedOn || '--'}</p>
            </div>
          </div>
        </div>

        {/* LOWER RIGHT: DATA FEEDS (Spans 2 cols) */}
        <div className="lg:col-span-2 flex gap-4 min-h-0">
          
          {/* HR Windows Feed */}
          <div className="card bg-white flex flex-col flex-1 shadow-md min-h-0 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between p-4 border-b border-ecg-dark-border bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-ecg-cyan/10 flex items-center justify-center text-ecg-cyan">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-ecg-text">Heart Rate Windows</h3>
              </div>
              <span className="text-[10px] bg-ecg-cyan/10 text-ecg-cyan px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-ecg-cyan/20">Every 10 Beats</span>
            </div>

            <div className="flex-1 p-0 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                  <tr className="text-[10px] font-bold text-ecg-muted uppercase tracking-wider bg-slate-50/80">
                    <th className="py-2.5 px-4">Beat Range</th>
                    <th className="py-2.5 px-4">Robust HR</th>
                    <th className="py-2.5 px-4">Mean HR</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {report?.hrWindows?.length > 0 ? (
                    report.hrWindows.map((win, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-4 text-[12px] font-mono font-semibold text-ecg-text-dim">
                          {win.beatRange}
                        </td>
                        <td className="py-2 px-4 font-bold font-mono text-ecg-text">
                          {win.robustHR}
                        </td>
                        <td className="py-2 px-4 font-mono text-ecg-muted">
                          {win.meanHR}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-[11px] text-ecg-muted uppercase tracking-wider">Waiting for Report...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RR Intervals Feed */}
          <div className="card bg-white flex flex-col flex-1 shadow-md min-h-0 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between p-4 border-b border-ecg-dark-border bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-ecg-text/5 flex items-center justify-center text-ecg-text">
                  <Heart className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-ecg-text">RR Intervals</h3>
              </div>
              <span className="text-[10px] bg-ecg-text/5 text-ecg-text px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-ecg-text/10">Continuous</span>
            </div>

            <div className="flex-1 p-0 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                  <tr className="text-[10px] font-bold text-ecg-muted uppercase tracking-wider bg-slate-50/80">
                    <th className="py-2.5 px-4 w-20">Seq</th>
                    <th className="py-2.5 px-4">Interval Duration</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {report?.rrIntervals?.length > 0 ? (
                    report.rrIntervals.map((val, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-1.5 px-4 text-[10px] text-ecg-muted font-mono">
                          #{String(i + 1).padStart(3, '0')}
                        </td>
                        <td className="py-1.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-ecg-cyan text-sm w-12">{val}</span>
                            <span className="text-[9px] text-ecg-muted uppercase tracking-wider">ms</span>
                            <div className="h-1.5 bg-slate-100 rounded-full w-24 overflow-hidden ml-2">
                              {/* Simple visual bar using RR value where max realistic RR is 1500ms */}
                              <div className="h-full bg-ecg-cyan rounded-full" style={{ width: `${Math.min((val / 1500) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="py-8 text-center text-[11px] text-ecg-muted uppercase tracking-wider">Waiting for Report...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="mt-4 flex flex-col md:flex-row justify-between items-center gap-2 text-[10px] font-bold text-ecg-muted uppercase tracking-[0.3em] relative z-10">
        <div className="flex items-center gap-3">
          <Wifi className="w-4 h-4 text-ecg-green" />
          <span>Real-time Secure Connection Active</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4" />
          <span>Last update: {timestamp.toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  )
}
