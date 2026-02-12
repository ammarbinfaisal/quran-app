import { type } from "arktype";
import protobuf from "protobufjs";
import type { MushafCode } from "../preferences";

export interface MushafWordPayload {
  text: string;
  verseKey: string;
  x: number;
  width: number;
}

export interface MushafLinePayload {
  lineNumber: number;
  words: MushafWordPayload[];
}

export interface MushafPagePayload {
  page: number;
  mushafCode: MushafCode;
  lines: MushafLinePayload[];
}

const mushafPageSchema = type({
  page: "number.integer >= 1",
  mushafCode: '"v1"|"v2"|"t4"|"ut"|"i5"|"i6"|"qh"|"tj"',
  lines: "unknown[]",
});

const mushafLineSchema = type({
  lineNumber: "number.integer >= 1",
  words: "unknown[]",
});

const mushafWordSchema = type({
  text: "string",
  verseKey: "string",
  x: "number",
  width: "number",
});

const protoSource = `
syntax = "proto3";

message MushafWord {
  string text = 1;
  string verseKey = 2;
  float x = 3;
  float width = 4;
}

message MushafLine {
  uint32 lineNumber = 1;
  repeated MushafWord words = 2;
}

message MushafPage {
  uint32 page = 1;
  string mushafCode = 2;
  repeated MushafLine lines = 3;
}
`;

const root = protobuf.parse(protoSource).root;
const mushafPageMessage = root.lookupType("MushafPage");

function isArkErrors(value: unknown): value is InstanceType<typeof type.errors> {
  return value instanceof type.errors;
}

export function parseMushafPagePayload(input: unknown): MushafPagePayload | null {
  const parsedPage = mushafPageSchema(input);
  if (isArkErrors(parsedPage)) return null;

  const normalizedLines: MushafLinePayload[] = [];

  for (const line of parsedPage.lines) {
    const parsedLine = mushafLineSchema(line);
    if (isArkErrors(parsedLine)) return null;

    const normalizedWords: MushafWordPayload[] = [];

    for (const word of parsedLine.words) {
      const parsedWord = mushafWordSchema(word);
      if (isArkErrors(parsedWord)) return null;
      normalizedWords.push(parsedWord);
    }

    normalizedLines.push({
      lineNumber: parsedLine.lineNumber,
      words: normalizedWords,
    });
  }

  return {
    page: parsedPage.page,
    mushafCode: parsedPage.mushafCode as MushafCode,
    lines: normalizedLines,
  };
}

export function encodeMushafPagePayload(payload: MushafPagePayload): Uint8Array {
  const validated = parseMushafPagePayload(payload);
  if (!validated) {
    throw new Error("Invalid mushaf payload for protobuf encoding");
  }

  const err = mushafPageMessage.verify(validated);
  if (err) {
    throw new Error(`Invalid protobuf payload: ${err}`);
  }

  return mushafPageMessage.encode(mushafPageMessage.create(validated)).finish();
}

export function decodeMushafPagePayloadFromProto(
  binary: Uint8Array
): MushafPagePayload | null {
  try {
    const decoded = mushafPageMessage.decode(binary);
    const normalized = mushafPageMessage.toObject(decoded, {
      longs: Number,
      defaults: true,
      arrays: true,
      objects: true,
    });

    return parseMushafPagePayload(normalized);
  } catch {
    return null;
  }
}
