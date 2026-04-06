// @name Level Loader

const levelstring =
  "H4sIAAAAAAAACqVQwY3DMAxbyAVEyU5c3KszdAAN0BU6_Emm74ACDtqgj4ixKVKiH3frBV7F1aHNzbU1BwhK4GX1C3xziIjvDkfL0l28O57wYSH6mQW-t7guLbKHgo9M1FO_Mjr1JHH-3qMuPVL-F0jexWmHceTMq2yHNiefdxWpPG6wIgmNsBFqicr_fVSdPE_oCXe7khuVPoO41VHJQtjELmWbskP3gmwXQieAoAOUjkozI2fkjBtWelZ61kb55LiwGQWVwDDG6caxESYBMxPlOpcHowT8oHQrMT9MwjSGtfheb-u8LaHLl_9nt_csDljVZC8LGqmVl21-AUgpZHlLBAAA";

api.patchMethod("loadLevel", (code) => {
  const argName = code.match(/\((_0x[\da-f]+)\)/)[1];

  return code.replace("{", `{var ${argName} = "${levelstring}";`);
});
