/** Keep healthy deployments visible while clearly reporting unavailable sources. */
export async function availableResults<T>(
  requests: Promise<T>[],
  labels: string[],
): Promise<{ data: T[]; warnings: string[] }> {
  const results = await Promise.allSettled(requests);
  const data: T[] = [];
  const warnings: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") data.push(result.value);
    else
      warnings.push(
        `${labels[index]} is unavailable. Results and totals cover available deployments only.`,
      );
  }
  if (!data.length)
    throw new Error(
      "The selected data sources are unavailable. Please try again.",
    );
  return { data, warnings };
}
