export function getProviderConfig() {
  return {
    host: localStorage.getItem("providerHost") || "https://opencode.ai/zen/go/v1",
    apiKey: localStorage.getItem("providerApiKey") || "",
    // Header names are user-editable. Empty string disables the header.
    sessionHeader:
      localStorage.getItem("providerSessionHeader") ?? "x-opencode-session",
    requestHeader:
      localStorage.getItem("providerRequestHeader") ?? "x-opencode-request",
    extraHeaders: localStorage.getItem("providerExtraHeaders") || "",
  };
}

export function saveProviderConfig(
  host,
  apiKey,
  sessionHeader,
  requestHeader,
  extraHeaders,
) {
  localStorage.setItem("providerHost", host);
  localStorage.setItem("providerApiKey", apiKey);
  localStorage.setItem(
    "providerSessionHeader",
    sessionHeader ?? "x-opencode-session",
  );
  localStorage.setItem(
    "providerRequestHeader",
    requestHeader ?? "x-opencode-request",
  );
  localStorage.setItem("providerExtraHeaders", extraHeaders || "");
}

export function hasProviderConfig() {
  const { host, apiKey } = getProviderConfig();
  return Boolean(host && apiKey);
}
