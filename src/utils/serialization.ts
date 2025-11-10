import Decimal from "decimal.js"
import SuperJSON from "superjson"

SuperJSON.registerCustom<Decimal, string>(
  {
    isApplicable: (v): v is Decimal =>
      v instanceof Decimal ||
      // interop with decimal.js
      v?.toStringTag === "[object Decimal]",
    serialize: (v) => v.toJSON(),
    deserialize: (v) => new Decimal(v),
  },
  "Decimal",
)

// For Uint8Array (Prisma Bytes type) serialization
SuperJSON.registerCustom<Uint8Array, string>(
  {
    isApplicable: (v): v is Uint8Array => v instanceof Uint8Array,
    serialize: (v) => btoa(String.fromCharCode(...v)),
    deserialize: (v) => Uint8Array.from(atob(v), c => c.charCodeAt(0)),
  },
  "Bytes",
)

/**
 * Serialize the given value with superjson
 */
export function serialize(value: unknown): { data: unknown; meta: unknown } {
  const { json, meta } = SuperJSON.serialize(value)
  return { data: json, meta }
}

/**
 * Deserialize the given value with superjson using the given metadata
 */
export function deserialize(value: unknown, meta: any): unknown {
  return SuperJSON.deserialize({ json: value as any, meta })
}
