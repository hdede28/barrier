export function Loading({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-accent" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-base font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
      <p className="font-medium">Bir şeyler ters gitti</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-danger/40 px-3 py-1 text-xs font-medium hover:bg-danger/10"
        >
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-3 text-sm text-success">
      {message}
    </div>
  );
}

export function WarningsList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-2xl border border-warn-border bg-warn-bg p-3 text-sm text-warn-fg">
      {warnings.map((w, i) => (
        <li key={i}>⚠ {w}</li>
      ))}
    </ul>
  );
}
