type Uri = string;
export type Undo = {
  "@context": "https://www.w3.org/ns/activitystreams";
  "@type": "Undo";
  object: Uri;
  published: string;
};

export const createUndo = (
  actionToUndo: Uri,
  published = new Date()
): Undo => ({
  "@context": "https://www.w3.org/ns/activitystreams",
  "@type": "Undo",
  object: actionToUndo,
  published: published.toISOString(),
});

export type Delete = {
  "@context": "https://www.w3.org/ns/activitystreams";
  "@type": "Delete";
  object: Uri;
  published: string;
};

export const createDelete = (
  objectToDelete: Uri,
  published = new Date()
): Delete => ({
  "@context": "https://www.w3.org/ns/activitystreams",
  "@type": "Delete",
  object: objectToDelete,
  published: published.toISOString(),
});
