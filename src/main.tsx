import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type CrashState = {
  hasError: boolean
  error: Error | null
}

class PMFCrashBoundary extends Component<
  { children: ReactNode },
  CrashState
> {
  state: CrashState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(
    error: Error,
  ): CrashState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ) {
    console.error(
      'PMF-FLIX RUNTIME CRASH:',
      error,
      errorInfo,
    )
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error

      return (
        <div className="min-h-screen bg-black px-6 py-10 text-white">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">
                PMF-Flix Runtime Error
              </p>

              <h1 className="mt-3 text-3xl font-black">
                The app crashed while rendering.
              </h1>

              <p className="mt-3 text-sm text-white/60">
                This diagnostic screen is temporary. Copy
                the error below and send it to ChatGPT.
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-red-300">
                Exact Error
              </p>

              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm leading-6 text-red-100">
                {error?.name
                  ? `${error.name}: ${error.message}`
                  : String(error)}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.reload()
              }}
              className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
            >
              Reload PMF-Flix
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(
  document.getElementById('root')!,
).render(
  <StrictMode>
    <PMFCrashBoundary>
      <App />
    </PMFCrashBoundary>
  </StrictMode>,
)
