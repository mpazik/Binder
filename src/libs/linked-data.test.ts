import { validateLinkedData } from "./linked-data";

describe("Validate linked data", () => {
  test("does not return error for a correct linked data", async () => {
    expect(
      await validateLinkedData({
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Note",
        actor: {
          "@id": "mailto:test@user.pl",
          name: "Test",
        },
        object: "http://reference.data.gov.uk/id/gregorian-day2022-03-01",
        published: "2022-03-01T13:32:01.342203Z",
      })
    ).toHaveLength(0);
  });

  test("does return error for not correct type", async () => {
    expect(
      await validateLinkedData({
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "NotDefined",
      })
    ).toHaveLength(1);
  });

  test("does return error for not correct id", async () => {
    expect(
      await validateLinkedData({
        "@context": "https://www.w3.org/ns/activitystreams",
        actor: "test@user.pl", // email is not a correct URI, it requires "mailto:" prefix
      })
    ).toHaveLength(1);
  });

  test("does return error for a property without definition", async () => {
    expect(
      await validateLinkedData({
        "@context": "https://www.w3.org/ns/activitystreams",
        myProp: 4,
      })
    ).toHaveLength(1);
  });

  test("does return errors for nested objects", async () => {
    expect(
      await validateLinkedData({
        "@context": "https://www.w3.org/ns/activitystreams",
        actor: {
          "@id": "test@user.pl", // email is not a correct URI, it requires "mailto:" prefix
          "@type": "CustomUser", // not existing type
          name: "Test",
          myProp: 4, // not defined property
        },
      })
    ).toHaveLength(3);
  });
});
