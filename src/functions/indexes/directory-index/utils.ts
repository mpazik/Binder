import { DirectoryQuery, DirectoryRecord } from "./index";

export const createQueryMatcher = ({ name, type }: DirectoryQuery) => ({
  props,
}: DirectoryRecord): boolean =>
  (!name ||
    props.name.toLocaleLowerCase().includes(name.toLocaleLowerCase())) &&
  (!type || props.type === type);
