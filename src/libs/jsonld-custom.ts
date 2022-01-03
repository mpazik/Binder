export const customDoclandSchema = (name: string): string =>
  "https://schema.docland.app/" + name;

export const nameFromCustomDoclandSchema = (name: string): string =>
  name.replace(/^https:\/\/schema.docland.app\//, "");
