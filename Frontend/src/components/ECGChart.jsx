import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useRef, useEffect } from 'react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const WINDOW_SIZE = 300

export default function ECGChart({ dataBuffer }) {
  const chartRef = useRef(null)

  // Custom plugin: draw vertical scan line
  const scanLinePlugin = {
    id: 'scanLine',
    afterDraw(chart) {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart
      const lastIndex = chart.data.labels.length - 1
      if (lastIndex < 0) return
      const xPos = x.getPixelForValue(lastIndex)
      ctx.save()
      ctx.strokeStyle = '#0ea5e9' // clinical cyan
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xPos, top)
      ctx.lineTo(xPos, bottom)
      ctx.stroke()
      ctx.restore()
    },
  }

  const labels = dataBuffer.map((_, i) => i)

  const data = {
    labels,
    datasets: [
      {
        label: 'ECG Signal (mV)',
        data: dataBuffer.map(d => (typeof d === 'object' ? d.value : d)),
        borderColor: '#10b981', // Emerald 500
        borderWidth: 2,
        pointRadius: dataBuffer.map(d => (d.isPeak ? 4 : 0)),
        pointBackgroundColor: '#ef4444', // Red for R-peaks
        pointBorderColor: '#ef4444',
        pointHoverRadius: 0,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return 'transparent'
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.08)')
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
          return gradient
        },
        tension: 0.35,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        display: false,
        ticks: { display: false },
        grid: { display: false },
      },
      y: {
        min: -0.6,
        max: 1.6,
        grid: {
          display: false, // We use the CSS grid background
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10, family: 'Inter' },
          stepSize: 0.5,
        },
        border: { display: false },
      },
    },
    elements: {
      line: {
        capBezierPoints: false,
      },
    },
  }

  return (
    <div className="w-full h-full">
      <Line ref={chartRef} data={data} options={options} plugins={[scanLinePlugin]} />
    </div>
  )
}
