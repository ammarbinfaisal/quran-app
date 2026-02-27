import { JsonLd as JsonLdData, stringifyJsonLd } from "@/lib/seo";

interface JsonLdProps {
  data: JsonLdData;
  id?: string;
}

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }}
    />
  );
}
