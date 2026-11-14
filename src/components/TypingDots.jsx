// The 3-dot sine-wave typing indicator.
export default function TypingDots({ className = '' }) {
  return (
    <span className={`inline-flex items-end gap-1 ${className}`}>
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  )
}
