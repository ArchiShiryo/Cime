/**
 * Turns the opaque provider failures of the AI SDK ("AI_RetryError: Failed
 * after 3 attempts. Last error:" with nothing after it) into a sentence a
 * user can act on. Returns null when the failure is not one we recognise.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null;

/** Every nested error of an AI SDK failure: itself, lastError, errors[], cause. */
function* walk(error: unknown, depth = 0): Generator<Rec> {
  if (!isRec(error) || depth > 5) return;
  yield error;
  yield* walk(error.lastError, depth + 1);
  yield* walk(error.cause, depth + 1);
  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) yield* walk(nested, depth + 1);
  }
}

function statusOf(error: Rec): number | undefined {
  if (typeof error.statusCode === "number") return error.statusCode;
  if (typeof error.status === "number") return error.status;
  if (isRec(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }
  return undefined;
}

export function describeProviderError(error: unknown): string | null {
  let status: number | undefined;
  let body = "";
  for (const nested of walk(error)) {
    status ??= statusOf(nested);
    if (typeof nested.responseBody === "string")
      body += ` ${nested.responseBody}`;
    if (typeof nested.message === "string") body += ` ${nested.message}`;
  }
  const text = body.toLowerCase();
  if (/reasoning_effort/.test(text)) {
    return "This model does not accept the selected reasoning effort. Change the effort in the model picker, or choose another model.";
  }
  switch (status) {
    case 429:
      return "The model provider is limiting requests (HTTP 429). Wait a minute and try again, or choose another model.";
    case 404:
      return "The provider does not know this model (HTTP 404): it may no longer be available. Choose another model.";
    case 401:
    case 403:
      return `The provider refused the key (HTTP ${status}). Check the API key in Settings.`;
    case 408:
    case 504:
      return `The provider took too long to answer (HTTP ${status}). Try again in a moment.`;
    case 500:
    case 502:
    case 503:
      return `The provider is having a problem (HTTP ${status}). Try again later or choose another model.`;
    default:
      break;
  }
  if (/err_cert|certificate|self.signed|unable to verify/.test(text)) {
    return "The secure connection was refused because of a certificate problem. On a school or administration network, ask the IT team to allow the model server.";
  }
  if (
    /enotfound|econnrefused|econnreset|etimedout|net::err_(internet|name|connection)/.test(
      text,
    )
  ) {
    return "The model server could not be reached. Check the network connection and try again.";
  }
  return null;
}
