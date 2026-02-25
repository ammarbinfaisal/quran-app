import { ScrollModeReader } from "@/components/reader/ScrollModeReader";
import { InvalidPathMessage } from "@/components/ui/InvalidPathMessage";
import { Suspense } from "react";

export async function generateStaticParams() {
  const params = [];

  for (let p = 1; p <= 604; p++) {
    params.push({ type: "p", id: String(p) });
  }

  for (let s = 1; s <= 114; s++) {
    params.push({ type: "s", id: String(s) });
  }

  for (let j = 1; j <= 30; j++) {
    params.push({ type: "j", id: String(j) });
  }

  return params;
}

export default async function ScrollModeRoute({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  if (!/^(p|s|j)$/.test(type) || !/^[0-9]+$/.test(id)) {
    return (
      <InvalidPathMessage
        message={`"/s/${type}/${id}" is not a valid view path.`}
      />
    );
  }

  const validType = type as "p" | "s" | "j";
  const num = Number.parseInt(id, 10);

  return (
    <Suspense>
      <ScrollModeReader type={validType} id={num} />
    </Suspense>
  );
}
