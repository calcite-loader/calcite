const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((message, sender) => {
  (api.runtime.sendMessage as (message: any) => Promise<void>)({
    type: "DEVTOOLS",
    payload: message,
    tabId: sender.tab?.id,
  }).catch(() => {});
});
