export function StackList({ stack, className = '' }: { stack: string[]; className?: string }) {
  return (
    <ul
      aria-label="Built with"
      className={[className, 'flex flex-wrap gap-2 font-mono text-xs text-muted'].join(' ').trim()}
    >
      {stack.map((tool) => (
        <li key={tool} className="rounded-full border border-line px-3 py-1">
          {tool}
        </li>
      ))}
    </ul>
  );
}
