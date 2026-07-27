type AlertDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
};

export default function AlertDialog({
  open,
  title = "Thông báo",
  message,
  confirmLabel = "OK",
  onClose,
}: AlertDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-300/25 bg-[#111C44] text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="mt-1 text-lg font-black leading-snug">{title}</h2>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">{message}</p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-[#0D1637]/70 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-rose-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-rose-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
