import JSZip from "jszip";

export type EpubChapter = {
  order: number;
  title: string;
  paragraphs: string[];
};

export type EpubInput = {
  title: string;
  subtitle?: string;
  author: string;
  language?: string;
  genre?: string;
  description?: string;
  chapters: EpubChapter[];
  cover?: { bytes: Uint8Array; mime: string };
};

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!
  );

export async function buildEpub(input: EpubInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const lang = input.language ?? "en";
  const uid = `urn:uuid:${cryptoRandom()}`;

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const coverExt = input.cover
    ? input.cover.mime === "image/jpeg"
      ? "jpg"
      : "png"
    : null;
  if (input.cover && coverExt) {
    zip.file(`OEBPS/cover.${coverExt}`, input.cover.bytes);
    zip.file(
      "OEBPS/cover.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head>
<body style="margin:0"><img src="cover.${coverExt}" alt="cover" style="max-width:100%;height:auto"/></body></html>`
    );
  }

  const chapterFiles = input.chapters.map((c) => ({
    id: `ch${c.order}`,
    href: `chapter-${String(c.order).padStart(3, "0")}.xhtml`,
    title: c.title,
    body: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(c.title)}</title></head>
<body><h1>${xmlEscape(c.title)}</h1>${c.paragraphs.map((p) => `<p>${xmlEscape(p)}</p>`).join("\n")}</body></html>`,
  }));

  for (const f of chapterFiles) {
    zip.file(`OEBPS/${f.href}`, f.body);
  }

  const manifestItems = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...(input.cover && coverExt
      ? [
          `<item id="cover-img" href="cover.${coverExt}" media-type="${input.cover.mime}" properties="cover-image"/>`,
          `<item id="cover-xhtml" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
        ]
      : []),
    ...chapterFiles.map(
      (f) => `<item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`
    ),
  ].join("\n    ");

  const spineItems = [
    ...(input.cover ? [`<itemref idref="cover-xhtml"/>`] : []),
    `<itemref idref="nav"/>`,
    ...chapterFiles.map((f) => `<itemref idref="${f.id}"/>`),
  ].join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${xmlEscape(input.title)}${input.subtitle ? `: ${xmlEscape(input.subtitle)}` : ""}</dc:title>
    <dc:creator>${xmlEscape(input.author)}</dc:creator>
    <dc:language>${lang}</dc:language>
    ${input.description ? `<dc:description>${xmlEscape(input.description)}</dc:description>` : ""}
    ${input.genre ? `<dc:subject>${xmlEscape(input.genre)}</dc:subject>` : ""}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`
  );

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc"><h1>Contents</h1><ol>
    ${chapterFiles.map((f) => `<li><a href="${f.href}">${xmlEscape(f.title)}</a></li>`).join("\n    ")}
  </ol></nav>
</body></html>`
  );

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${xmlEscape(input.title)}</text></docTitle>
  <navMap>
    ${chapterFiles
      .map(
        (f, i) =>
          `<navPoint id="${f.id}" playOrder="${i + 1}"><navLabel><text>${xmlEscape(f.title)}</text></navLabel><content src="${f.href}"/></navPoint>`
      )
      .join("\n    ")}
  </navMap>
</ncx>`
  );

  return await zip.generateAsync({ type: "uint8array" });
}

function cryptoRandom(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
