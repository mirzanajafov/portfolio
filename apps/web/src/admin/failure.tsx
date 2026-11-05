export function Failure({ failure }: { failure: string | null }) {
  return (
    failure && (
      <p role="alert" className="max-w-[65ch] whitespace-pre-line text-muted">
        {failure}
      </p>
    )
  );
}
