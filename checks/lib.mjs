// Shared helpers for the release checks.
import { deflateSync } from "node:zlib";

export const json = (body) => ({
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function api(runtime, path, { role, method = "GET", body } = {}) {
  const response = await runtime.fetch(path, {
    role,
    method,
    ...(body === undefined ? {} : json(body)),
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

export async function html(runtime, path, role) {
  const response = await runtime.fetch(path, role ? { role } : {});
  return { status: response.status, text: await response.text() };
}

export async function upload(runtime, role, name, bytes, type) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const response = await runtime.fetch("/api/media", {
    role,
    method: "POST",
    body: form,
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

export async function postComment(runtime, fields) {
  const response = await runtime.fetch("/site/comments", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
  };
}

/** Picks an option in a Base UI select by its trigger's test id. */
export async function choose(page, testId, label) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

// A small landscape PNG: a sky-to-sea gradient.
export function landscapePng(width = 480, height = 270) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    const t = y / height;
    for (let x = 0; x < width; x++) {
      const sea = t > 0.6;
      const sun = (x - width * 0.7) ** 2 + (y - height * 0.55) ** 2 < 900;
      const r = sun ? 250 : sea ? 30 : Math.round(250 - 120 * t);
      const g = sun ? 190 : sea ? 80 + Math.round(40 * (t - 0.6)) : Math.round(170 - 60 * t);
      const b = sun ? 90 : sea ? 140 : Math.round(120 + 100 * t);
      row.set([r, g, b], 1 + x * 3);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
