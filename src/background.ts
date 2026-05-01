const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((message, sender) => {
  try {
    (api.runtime.sendMessage as (message: any) => void)({
      type: "DEVTOOLS",
      payload: message,
      tabId: sender.tab?.id,
    });
  } catch (e) {}
});
