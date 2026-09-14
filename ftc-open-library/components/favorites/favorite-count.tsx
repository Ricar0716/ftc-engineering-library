export function FavoriteCount({ count }: { count: number | null | undefined }) {
  if (count == null || count <= 0) {
    return null;
  }

  const formatted = new Intl.NumberFormat("en-US").format(count);
  const label = count === 1 ? "1 save" : `${formatted} saves`;

  return <p className="font-mono text-xs text-ink-muted">{label}</p>;
}
