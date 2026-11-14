import { X } from 'lucide-react'

// Bottom sheet on phones, centered dialog on wider screens.
export default function Sheet({ open, title, onClose, children, footer }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[88vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-slate-800 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
