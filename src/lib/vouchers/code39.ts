const CODE39: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  A: "100001001",
  B: "001001001",
  C: "101001000",
  D: "000011001",
  E: "100011000",
  F: "001011000",
  G: "000001101",
  H: "100001100",
  I: "001001100",
  J: "000011100",
  K: "100000011",
  L: "001000011",
  M: "101000010",
  N: "000010011",
  O: "100010010",
  P: "001010010",
  Q: "000000111",
  R: "100000110",
  S: "001000110",
  T: "000010110",
  U: "110000001",
  V: "011000001",
  W: "111000000",
  X: "010010001",
  Y: "110010000",
  Z: "011010000",
  "-": "010000101",
  ".": "110000100",
  " ": "011000100",
  "*": "010010100",
};

/** Code 39 bars for a voucher code. Narrow = 1 unit, wide = 3 units. */
export function code39Svg(value: string, height = 70): string {
  const text = `*${value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "")}*`;
  const narrow = 2;
  const wide = 6;
  let x = 20;
  const rects: string[] = [];
  for (const ch of text) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === "1" ? wide : narrow;
      if (i % 2 === 0)
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#111"/>`);
      x += w;
    }
    x += narrow;
  }
  x += 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${height}" width="${x}" height="${height}" role="img" aria-label="${value}">${rects.join("")}</svg>`;
}
