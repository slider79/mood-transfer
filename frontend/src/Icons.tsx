// chote icons, sab ek hi stroke mein
type P = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const DownloadIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 4v11" />
    <path d="M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  </svg>
)

export const ExposeIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </svg>
)

export const StopIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
)

export const SwapIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M7 4 4 7l3 3" />
    <path d="M4 7h12a4 4 0 0 1 4 4" />
    <path d="m17 20 3-3-3-3" />
    <path d="M20 17H8a4 4 0 0 1-4-4" />
  </svg>
)

export const CloseIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
