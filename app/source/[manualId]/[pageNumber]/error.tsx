"use client";

export default function SourceError({
  error
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div style={{ padding: "2rem", color: "#ef4444" }}>
      <h2>Source page error</h2>
      <pre>{error.message}</pre>
      {error.digest ? <p>Digest: {error.digest}</p> : null}
    </div>
  );
}
