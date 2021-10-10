export const camelize = (s: string): string =>
  s.replace(/-./g, (x) => x.toUpperCase()[1]);

export const kebabize = (str: string): string => {
  const subs = [];
  let char = "";
  let j = 0;

  for (let i = 0; i < str.length; i++) {
    char = str[i];

    if (str[i] === char.toUpperCase()) {
      subs.push(str.slice(j, i));
      j = i;
    }

    if (i == str.length - 1) {
      subs.push(str.slice(j, str.length));
    }
  }

  return subs
    .map((el) => el.charAt(0).toLowerCase() + el.substr(1, el.length))
    .join("-");
};

export const capitalize = (s: string): string => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const decapitalize = (s: string): string => {
  return s.charAt(0).toLowerCase() + s.slice(1);
};
