export class BlueprintRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlueprintRequestError";
  }
}

// Transport only: normalization validates this unknown response before it reaches the UI.
export async function fetchBlueprint(endpoint: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  let response: Response;
  try {
    response = await fetch(endpoint, { signal, headers: { Accept: "application/json" } });
    signal.throwIfAborted();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new BlueprintRequestError("Unable to reach the blueprint server. Check that it is running and try again.");
  }
  if (!response.ok) {
    throw new BlueprintRequestError(`The blueprint request failed (HTTP ${response.status}). Try again.`);
  }
  try {
    const data: unknown = await response.json();
    signal.throwIfAborted();
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new BlueprintRequestError("The blueprint server returned unreadable JSON. Check the server response and try again.");
  }
}
