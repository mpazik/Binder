import { beforeEach, describe, expect, it } from "bun:test";
import { type ErrorObject, throwIfError, throwIfValue } from "@binder/utils";
import "@binder/utils/tests";
import {
  mockTask1Record,
  mockTask1Uid,
  mockUserRecord,
} from "./model/record.mock.ts";
import { mockChangesetUpdateTask1 } from "./model/changeset.mock.ts";
import { getTestDatabase, insertConfig, insertRecord } from "./db.mock.ts";
import { type Database } from "./db.ts";
import { processChangesetInput } from "./changeset-processor";
import {
  type ConfigKey,
  type ConfigType,
  coreConfigSchema,
  type EntityChangesetInput,
  fieldSystemType,
  GENESIS_ENTITY_ID,
  type NamespaceEditable,
  typeSystemType,
} from "./model";
import { mockRecordSchema } from "./model/schema.mock.ts";
import {
  mockFieldKeyEmail,
  mockNotExistingRecordTypeKey,
  mockPriorityField,
  mockPriorityFieldKey,
  mockProjectTypeKey,
  mockTaskTypeKey,
  mockUserTypeKey,
} from "./model/config.mock.ts";
import { mockChangesetInputUpdateTask1 } from "./model/changeset-input.mock.ts";

describe("changeset processor", () => {
  let db: Database;

  beforeEach(() => {
    db = getTestDatabase();
  });

  describe("processChangesetInput", () => {
    const invalidConfigType = "InvalidConfigType" as ConfigType;
    const testFieldKey = "testField" as ConfigKey;

    const process = async (
      inputs: EntityChangesetInput<NamespaceEditable>[],
      namespace: NamespaceEditable = "record",
    ) => {
      const schema =
        namespace === "config" ? coreConfigSchema : mockRecordSchema;
      return await db.transaction(async (tx) =>
        processChangesetInput(tx, namespace, inputs, schema, GENESIS_ENTITY_ID),
      );
    };

    const expectError = async (
      inputs: EntityChangesetInput<NamespaceEditable>[],
      expectedError: ErrorObject,
      namespace?: NamespaceEditable,
    ) => {
      const result = await process(inputs, namespace);
      const error = throwIfValue(result);
      expect(error).toEqual(expectedError);
    };

    const checkErrors = async (
      inputs: EntityChangesetInput<NamespaceEditable>[],
      expectedErrors: object[],
      namespace?: NamespaceEditable,
    ) => {
      const result = await process(inputs, namespace);
      expect(result).toBeErrWithKey("changeset-input-process-failed");
      const error = throwIfValue(result);
      expect((error.data as { errors: object[] }).errors).toEqual(
        expectedErrors,
      );
    };

    const checkSuccess = async (
      inputs: EntityChangesetInput<NamespaceEditable>[],
      namespace?: NamespaceEditable,
    ) => {
      const result = await process(inputs, namespace);
      expect(result).toBeOk();
    };

    describe("changeset creation", () => {
      it("creates changeset for updated entity", async () => {
        await insertRecord(db, mockTask1Record);

        const result = await db.transaction(async (tx) =>
          throwIfError(
            await processChangesetInput(
              tx,
              "record",
              [mockChangesetInputUpdateTask1],
              mockRecordSchema,
              mockTask1Record.id,
            ),
          ),
        );

        expect(result).toEqual({
          [mockTask1Record.uid]: mockChangesetUpdateTask1,
        });
      });

      it("creates changeset for new config entity with uid field", async () => {
        const result = await db.transaction(async (tx) =>
          throwIfError(
            await processChangesetInput(
              tx,
              "config",
              [
                {
                  type: fieldSystemType,
                  key: testFieldKey,
                  dataType: "plaintext",
                },
              ],
              coreConfigSchema,
              GENESIS_ENTITY_ID,
            ),
          ),
        );

        const changeset = result[testFieldKey];
        expect(changeset).toMatchObject({
          uid: expect.any(String),
          key: testFieldKey,
          type: fieldSystemType,
          dataType: "plaintext",
        });
      });
    });

    describe("default values", () => {
      const check = async (
        input: EntityChangesetInput<"record">,
        expected: Record<string, unknown>,
      ) => {
        const result = throwIfError(await process([input]));
        expect(Object.values(result)[0]).toMatchObject(expected);
      };

      it("includes field default values in changeset for new entity", () =>
        check(
          { type: mockTaskTypeKey, title: "Task without priority" },
          { priority: "medium", status: "pending" },
        ));

      it("includes type-level default over field-level default", () =>
        check(
          { type: mockProjectTypeKey, title: "Project" },
          { status: "active" },
        ));

      it("does not override user-provided value with default", () =>
        check(
          { type: mockTaskTypeKey, title: "Task", priority: "high" },
          { priority: "high" },
        ));

      it("skips default when 'when' condition is not met", async () => {
        const result = throwIfError(
          await process([
            {
              type: mockTaskTypeKey,
              title: "Pending Task",
              status: "pending",
            },
          ]),
        );
        expect(Object.values(result)[0]).not.toHaveProperty("completedAt");
      });

      it("applies default when 'when' condition is met", () =>
        check(
          {
            type: mockTaskTypeKey,
            title: "Complete Task",
            status: "complete",
          },
          { completedAt: "2024-01-01T00:00:00.000Z" },
        ));

      it("accepts Field with valid default matching dataType", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testDefaultField" as ConfigKey,
              dataType: "plaintext",
              default: "hello",
            },
          ],
          "config",
        ));

      it("accepts Field with integer default", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testIntField" as ConfigKey,
              dataType: "integer",
              default: 42,
            },
          ],
          "config",
        ));

      it("accepts Field with boolean default", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testBoolField" as ConfigKey,
              dataType: "boolean",
              default: true,
            },
          ],
          "config",
        ));

      it("rejects Field with default not matching dataType", () =>
        checkErrors(
          [
            {
              type: fieldSystemType,
              key: "testBadDefault" as ConfigKey,
              dataType: "integer",
              default: "not a number",
            },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "default",
              message: expect.stringContaining(
                "default value does not match dataType 'integer'",
              ),
            },
          ],
          "config",
        ));

      it("rejects Type with field attr default not matching field dataType", () =>
        checkErrors(
          [
            {
              type: typeSystemType,
              key: "TestTypeBadDefault" as ConfigKey,
              name: "Test Type",
              fields: [["name", { default: 123 }]],
            },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "fields.name.default",
              message: expect.stringContaining(
                "default value does not match dataType 'plaintext'",
              ),
            },
          ],
          "config",
        ));

      it("accepts Field with option default matching valid option", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testOptionField" as ConfigKey,
              dataType: "option",
              options: [{ key: "a" }, { key: "b" }],
              default: "a",
            },
          ],
          "config",
        ));

      it("rejects Field with option default not in options list", () =>
        checkErrors(
          [
            {
              type: fieldSystemType,
              key: "testBadOptionField" as ConfigKey,
              dataType: "option",
              options: [{ key: "a" }, { key: "b" }],
              default: "invalid",
            },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "default",
              message: expect.stringContaining(
                "Invalid option value: invalid. Expected one of: a, b",
              ),
            },
          ],
          "config",
        ));
    });

    describe("validation", () => {
      it("rejects create with invalid record type", () =>
        expectError(
          [{ type: mockNotExistingRecordTypeKey, name: "Test Item" }],
          {
            key: "changeset-input-process-failed",
            message: "failed creating changeset",
            data: {
              errors: [
                {
                  index: 0,
                  namespace: "record",
                  field: "type",
                  message: "invalid type: NotExistingRecordType",
                },
              ],
            },
          },
        ));

      it("rejects create with invalid config type", () =>
        expectError(
          [{ type: invalidConfigType, key: testFieldKey }],
          {
            key: "changeset-input-process-failed",
            message: "failed creating changeset",
            data: {
              errors: [
                {
                  index: 0,
                  namespace: "config",
                  field: "type",
                  message: "invalid type: InvalidConfigType",
                },
              ],
            },
          },
          "config",
        ));

      it("rejects create missing mandatory property", () =>
        checkErrors(
          [{ type: mockTaskTypeKey }],
          [
            {
              index: 0,
              namespace: "record",
              field: "title",
              message: "mandatory property is missing or null",
            },
          ],
        ));

      it("accepts create without conditional required field when condition not met", () =>
        checkSuccess([
          { type: mockTaskTypeKey, title: "Task", status: "pending" },
        ]));

      it("rejects create missing conditional required field when condition is met", () =>
        checkErrors(
          [
            {
              type: mockTaskTypeKey,
              title: "Cancelled Task",
              status: "cancelled",
            },
          ],
          [
            {
              index: 0,
              namespace: "record",
              field: "cancelReason",
              message: "mandatory property is missing or null",
            },
          ],
        ));

      it("accepts create with conditional required field when condition is met", () =>
        checkSuccess([
          {
            type: mockTaskTypeKey,
            title: "Cancelled Task",
            status: "cancelled",
            cancelReason: "No longer needed",
          },
        ]));

      it("rejects update to status triggering conditional required field", async () => {
        await insertRecord(db, mockTask1Record);

        await checkErrors(
          [{ $ref: mockTask1Record.uid, status: "cancelled" }],
          [
            {
              index: 0,
              namespace: "record",
              field: "cancelReason",
              message: "mandatory property is missing or null",
            },
          ],
        );
      });

      it("accepts update to status with conditional required field provided", async () => {
        await insertRecord(db, mockTask1Record);

        await checkSuccess([
          {
            $ref: mockTask1Record.uid,
            status: "cancelled",
            cancelReason: "Project cancelled",
          },
        ]);
      });

      it("rejects create missing multiple mandatory properties", () =>
        checkErrors(
          [{ type: fieldSystemType }],
          [
            {
              index: 0,
              namespace: "config",
              field: "key",
              message: "mandatory property is missing or null",
            },
            {
              index: 0,
              namespace: "config",
              field: "dataType",
              message: "mandatory property is missing or null",
            },
          ],
          "config",
        ));

      it("validates multiple changesets and reports all errors", () =>
        checkErrors(
          [
            { type: mockTaskTypeKey },
            {
              title: "Updated Task",
            } as unknown as EntityChangesetInput<"record">,
          ],
          [
            {
              index: 0,
              namespace: "record",
              field: "title",
              message: "mandatory property is missing or null",
            },
            {
              index: 1,
              namespace: "record",
              field: "type",
              message: "type is required for create entity changeset",
            },
          ],
        ));

      it("rejects undefined fields in schema for create and update", () =>
        checkErrors(
          [
            {
              type: mockTaskTypeKey,
              title: "Test Task",
              invalidField: "test value",
            } as EntityChangesetInput<"record">,
            { $ref: mockTask1Uid, anotherInvalidField: "test" },
          ],
          [
            {
              index: 0,
              namespace: "record",
              field: "invalidField",
              message: 'field "invalidField" is not defined in schema',
            },
            {
              index: 1,
              namespace: "record",
              field: "anotherInvalidField",
              message: 'field "anotherInvalidField" is not defined in schema',
            },
          ],
        ));

      it("rejects reserved keys on create and update", async () => {
        await insertConfig(db, mockPriorityField);

        await checkErrors(
          [
            {
              type: fieldSystemType,
              key: "first" as ConfigKey,
              dataType: "plaintext",
            },
            { $ref: mockPriorityFieldKey, key: "last" as ConfigKey },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "key",
              message: 'key "first" is reserved and cannot be used',
            },
            {
              index: 1,
              namespace: "config",
              field: "key",
              message: 'key "last" is reserved and cannot be used',
            },
          ],
          "config",
        );
      });

      it("rejects keys that match the UID format", async () => {
        await insertConfig(db, mockPriorityField);

        await checkErrors(
          [
            {
              type: fieldSystemType,
              key: "_0a1b2c3d4e" as ConfigKey,
              dataType: "plaintext",
            },
            { $ref: mockPriorityFieldKey, key: "0a1b2c3d4e5" as ConfigKey },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "key",
              message:
                'key "_0a1b2c3d4e" is ambiguous because it matches the UID format',
            },
            {
              index: 1,
              namespace: "config",
              field: "key",
              message:
                'key "0a1b2c3d4e5" is ambiguous because it matches the UID format',
            },
          ],
          "config",
        );
      });

      it("validates field data types", () =>
        checkErrors(
          [
            {
              type: fieldSystemType,
              key: testFieldKey,
              dataType: 123 as unknown as string,
            },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "dataType",
              message: "Expected non-empty string for option",
            },
          ],
          "config",
        ));

      it("validates option values against allowed options", () =>
        checkErrors(
          [
            {
              type: fieldSystemType,
              key: testFieldKey,
              dataType: "invalidDataType",
            },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "dataType",
              message: expect.stringContaining(
                "Invalid option value: invalidDataType",
              ),
            },
          ],
          "config",
        ));

      it("validates values in list mutations", async () => {
        await insertRecord(db, mockTask1Record);

        await checkErrors(
          [
            {
              $ref: mockTask1Record.uid,
              tags: [
                ["insert", 123 as unknown as string, 0],
                ["remove", 456 as unknown as string, 1],
              ],
            },
          ],
          [
            {
              index: 0,
              namespace: "record",
              field: "tags",
              message: expect.stringContaining("Invalid insert value"),
            },
            {
              index: 0,
              namespace: "record",
              field: "tags",
              message: expect.stringContaining("Invalid remove value"),
            },
          ],
        );
      });

      it("accepts valid list mutations", async () => {
        await insertRecord(db, mockTask1Record);

        await checkSuccess([
          {
            $ref: mockTask1Record.uid,
            tags: [
              ["insert", "urgent", 0],
              ["remove", "important", 1],
            ],
          },
        ]);
      });

      it("rejects duplicate unique field value", async () => {
        await insertRecord(db, mockUserRecord);

        await checkErrors(
          [
            {
              type: mockUserTypeKey,
              name: "Richard",
              [mockFieldKeyEmail]: "rick@example.com",
            },
          ],
          [
            {
              index: 0,
              namespace: "record",
              field: mockFieldKeyEmail,
              message: expect.stringContaining(
                "value must be unique, already exists",
              ),
            },
          ],
        );
      });

      it("rejects updates to immutable fields", async () => {
        await insertConfig(db, mockPriorityField);

        await checkErrors(
          [
            { $ref: mockPriorityFieldKey, dataType: "integer" },
            { $ref: mockPriorityFieldKey, allowMultiple: true },
            { $ref: mockPriorityFieldKey, unique: true },
          ],
          [
            {
              index: 0,
              namespace: "config",
              field: "dataType",
              message: "field is immutable and cannot be updated",
            },
            {
              index: 1,
              namespace: "config",
              field: "allowMultiple",
              message: "field is immutable and cannot be updated",
            },
            {
              index: 2,
              namespace: "config",
              field: "unique",
              message: "field is immutable and cannot be updated",
            },
          ],
          "config",
        );
      });

      it("creates Field with dataType='plaintext'", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testStringField" as ConfigKey,
              dataType: "plaintext",
            },
          ],
          "config",
        ));

      it("creates Field with dataType='plaintext' and unique constraint", () =>
        checkSuccess(
          [
            {
              type: fieldSystemType,
              key: "testStringField2" as ConfigKey,
              dataType: "plaintext",
              unique: true,
            },
          ],
          "config",
        ));

      it("creates Type with fields using ObjTuple format", () =>
        checkSuccess(
          [
            {
              type: typeSystemType,
              key: "TestType" as ConfigKey,
              name: "Test Type",
              fields: [{ title: { required: true } }, "description"],
            },
          ],
          "config",
        ));
    });
  });
});
