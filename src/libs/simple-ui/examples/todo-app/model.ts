type UUID = string;
const generateUuid = (): UUID =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export type TodoName = string;
export type TodoId = UUID;
export type Todo = {
  id: TodoId;
  title: TodoName;
  completed: boolean;
};

export const newTodo = (title: string) => ({
  id: generateUuid(),
  title,
  completed: false,
});
