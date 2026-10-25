type Props = {
  title: string;
  hint?: string;
  identifier?: string;
};

export function Placeholder({ title, hint, identifier }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-8">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Scaffold
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      {identifier && (
        <p className="mt-3 break-all font-mono text-sm text-muted-foreground">
          <span className="text-muted-foreground/70">id:</span> {identifier}
        </p>
      )}
      {hint && <p className="mt-4 text-sm text-muted-foreground">{hint}</p>}
    </section>
  );
}
