import { describe, expect, it } from "vitest";
import { describeProviderError } from "./friendly_model_error";

describe("describeProviderError", () => {
  it("explains a 429 hidden inside a retry error", () => {
    const retry = {
      name: "AI_RetryError",
      message: "Failed after 3 attempts. Last error: ",
      lastError: { name: "AI_APICallError", statusCode: 429, message: "" },
    };
    expect(describeProviderError(retry)).toMatch(
      /limiting requests \(HTTP 429\)/,
    );
  });

  it("recognises a rejected reasoning effort from the response body", () => {
    expect(
      describeProviderError({
        statusCode: 400,
        responseBody:
          "reasoning_effort=medium is not supported by Mistral models",
      }),
    ).toMatch(/reasoning effort/);
  });

  it("maps 404, 401 and unreachable servers, and ignores the rest", () => {
    expect(describeProviderError({ statusCode: 404 })).toMatch(
      /no longer be available/,
    );
    expect(describeProviderError({ statusCode: 401 })).toMatch(/API key/);
    expect(
      describeProviderError({ cause: { message: "getaddrinfo ENOTFOUND x" } }),
    ).toMatch(/could not be reached/);
    expect(describeProviderError(new Error("something odd"))).toBeNull();
    expect(describeProviderError(undefined)).toBeNull();
  });
});
