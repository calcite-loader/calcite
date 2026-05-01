const api = typeof browser !== "undefined" ? browser : chrome;

window.addEventListener("message", async (e) => {
  if (e.source != window) return;

  if (e.data.type == "SAVE_MOD") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    let modToSave = structuredClone(e.data.mod);
    if (e.data.mod.id in mods) {
      modToSave.settings = mods[e.data.mod.id].settings;
    }
    mods[e.data.mod.id] = modToSave;
    await api.storage.local.set({ mods });
    window.postMessage({ type: "SAVE_MOD_SUCCESS", id: e.data.mod.id }, "*");
    return;
  }

  if (e.data.type == "FETCH_MODS") {
    const data = await api.storage.local.get("mods");
    window.postMessage({
      type: "RECEIVE_MODS",
      mods: Object.values(data.mods || {}),
    }, "*");
    return;
  }

  if (e.data.type == "REMOVE_MOD") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    delete mods[e.data.id];
    await api.storage.local.set({ mods });
    window.postMessage({ type: "REMOVE_MOD_SUCCESS", id: e.data.id }, "*");
    return;
  }

  if (e.data.type == "ENABLE_MOD") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    mods[e.data.id].enabled = true;
    await api.storage.local.set({ mods });
    window.postMessage({ type: "ENABLE_MOD_SUCCESS", id: e.data.id }, "*");
    return;
  }

  if (e.data.type == "DISABLE_MOD") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    mods[e.data.id].enabled = false;
    await api.storage.local.set({ mods });
    window.postMessage({ type: "DISABLE_MOD_SUCCESS", id: e.data.id }, "*");
    return;
  }

  if (e.data.type == "SET_SETTING") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    mods[e.data.modId].settings[e.data.id] = e.data.value;
    await api.storage.local.set({ mods });
    window.postMessage({
      type: "SET_SETTING_SUCCESS",
      id: e.data.id,
      modId: e.data.modId,
    }, "*");
    return;
  }

  if (e.data.type == "SET_HOTKEY") {
    const mods = (await api.storage.local.get("mods")).mods || {};
    mods[e.data.modId].hotkeys[e.data.id] = e.data.value;
    await api.storage.local.set({ mods });
    window.postMessage({
      type: "SET_HOTKEY_SUCCESS",
      id: e.data.id,
      modId: e.data.modId,
    }, "*");
    return;
  }

  if (e.data.type == "GET_ASSET") {
    const url = api.runtime.getURL(e.data.path);
    window.postMessage({
      type: "RECEIVE_ASSET",
      path: e.data.path,
      url: url,
    }, "*");
  }

  if (e.data.type == "DEVTOOLS") {
    (api.runtime.sendMessage as (message: any) => void)(e.data.payload);
  }
});
