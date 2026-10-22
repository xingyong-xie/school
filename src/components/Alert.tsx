export function Alert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  return (
    <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="alert">
      <span className="alert-icon">{error ? "!" : "✓"}</span>
      <span>{error ?? success}</span>
    </div>
  );
}
