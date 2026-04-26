async function createPdfThumbnailBuffer(fileBuffer) {
  if (!fileBuffer) return null;

  try {
    const [{ createCanvas }, pdfjsLib] = await Promise.all([
      import('@napi-rs/canvas'),
      import('pdfjs-dist/legacy/build/pdf.mjs'),
    ]);

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 420;
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toBuffer('image/png');
  } catch {
    return null;
  }
}

export { createPdfThumbnailBuffer };
