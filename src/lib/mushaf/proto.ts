import protobuf from "protobufjs";
import type { MushafPagePayload } from "../types";

export type { MushafPagePayload } from "../types";

// ---------------------------------------------------------------------------
// Protobuf schema (matches generate-mushaf-assets.ts output)
// ---------------------------------------------------------------------------
const root = protobuf.Root.fromJSON({
  nested: {
    MushafWord: {
      fields: {
        text: { type: "string", id: 1 },
        verseKey: { type: "string", id: 2 },
        x: { type: "float", id: 3 },
        width: { type: "float", id: 4 },
        charTypeName: { type: "string", id: 5 },
      },
    },
    MushafLine: {
      fields: {
        lineNumber: { type: "int32", id: 1 },
        words: { rule: "repeated", type: "MushafWord", id: 2 },
      },
    },
    MushafPagePayload: {
      fields: {
        page: { type: "int32", id: 1 },
        mushafCode: { type: "string", id: 2 },
        lines: { rule: "repeated", type: "MushafLine", id: 3 },
      },
    },
  },
});

const MushafPagePayloadType = root.lookupType("MushafPagePayload");

export function encodeMushafPagePayload(payload: MushafPagePayload): Uint8Array {
  const errMsg = MushafPagePayloadType.verify(payload);
  if (errMsg) throw new Error(`Proto verify: ${errMsg}`);
  const message = MushafPagePayloadType.create(payload);
  return MushafPagePayloadType.encode(message).finish();
}

export function decodeMushafPagePayload(buffer: Uint8Array): MushafPagePayload {
  const message = MushafPagePayloadType.decode(buffer);
  return MushafPagePayloadType.toObject(message, {
    defaults: true,
    arrays: true,
  }) as MushafPagePayload;
}
