const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener(async (message, sender) => {
  if (typeof message == "object" && "input" in message && "init" in message) {
    await api.tabs.sendMessage(sender.tab?.id!, {
      type: "FETCH",
      payload: {
        response: Array.from(
          new Uint8Array(
            await (await fetch(message.input, message.init)).arrayBuffer(),
          ),
        ),
        id: message.id,
      },
    });
    return;
  }

  (api.runtime.sendMessage as (message: any) => Promise<void>)({
    type: "DEVTOOLS",
    payload: message,
    tabId: sender.tab?.id,
  }).catch(() => {});
});
