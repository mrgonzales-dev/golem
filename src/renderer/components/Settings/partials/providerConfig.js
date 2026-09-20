export function getProviderConfig() {
  return {
    host: localStorage.getItem("providerHost") || "https://opencode.ai/zen/go/v1",
    apiKey: localStorage.getItem("providerApiKey") || "",
  };
}

export function saveProviderConfig(host, apiKey) {
  localStorage.setItem("providerHost", host);
  localStorage.setItem("providerApiKey", apiKey);
}

export function hasProviderConfig() {
  const { host, apiKey } = getProviderConfig();
  return Boolean(host && apiKey);
}
