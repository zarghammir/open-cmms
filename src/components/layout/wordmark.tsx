/**
 * The mark is an equipment nameplate: a riveted plate with two engraved lines.
 * Every asset in a laboratory carries one, and it is the thing a technician
 * actually looks for when they walk up to a machine.
 */
export function WorkAxisMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="1.4" y="3.4" width="13.2" height="9.2" rx="1.4" />
      <circle cx="4.4" cy="8" r="0.95" fill="currentColor" stroke="none" />
      <path d="M7.1 6.5h5.1" />
      <path d="M7.1 9.5h3.4" />
    </svg>
  );
}
