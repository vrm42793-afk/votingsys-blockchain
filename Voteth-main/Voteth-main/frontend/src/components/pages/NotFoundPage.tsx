import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-4">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-3xl font-bold text-neutral-100 mb-2">404 — Page Not Found</h1>
      <p className="text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
        The page you are looking for does not exist, or you do not have permission to view it within this organization context.
      </p>
      <Link
        to="/"
        className="text-xs font-semibold bg-accent-600 hover:bg-accent-500 text-neutral-100 px-6 py-2.5 rounded-lg shadow-md transition-all animate-fade-in"
      >
        Return Home
      </Link>
    </div>
  )
}
