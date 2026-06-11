import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const exportPdf = async (prompt: string, useCase: string, results: any[]) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Page 1: Summary
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  
  page.drawText('AI Image Model Benchmarking Report', { x: 50, y: height - 50, size: 20, font: boldFont });
  page.drawText(`Date: ${new Date().toLocaleString()}`, { x: 50, y: height - 80, size: 12, font });
  page.drawText(`Use Case: ${useCase}`, { x: 50, y: height - 100, size: 12, font });
  
  // Handle prompt text wrapping simply for now
  page.drawText(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`, { x: 50, y: height - 120, size: 12, font });

  let yOffset = height - 160;

  // Add metrics table
  page.drawText('Metrics Summary', { x: 50, y: yOffset, size: 16, font: boldFont });
  yOffset -= 30;

  for (const r of results) {
    page.drawText(`Model: ${r.modelName} (${r.quality})`, { x: 50, y: yOffset, size: 12, font: boldFont });
    yOffset -= 20;
    page.drawText(`Generation Time: ${(r.latency / 1000).toFixed(2)}s | Cost: $${r.costUSD} | Tokens: ${r.inputTokens} | Resolution: ${r.resolution}`, { x: 60, y: yOffset, size: 10, font });
    yOffset -= 30;
  }

  // Page 2+: Real Images
  for (const r of results) {
    page = pdfDoc.addPage();
    height = page.getSize().height;
    width = page.getSize().width;
    
    page.drawText(`${r.modelName} (${r.quality})`, { x: 50, y: height - 50, size: 16, font: boldFont });
    
    if (r.imageUrl) {
      try {
        let imageBytes: Uint8Array;
        if (r.imageUrl.startsWith('data:image/')) {
          const base64Data = r.imageUrl.split(',')[1];
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          imageBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              imageBytes[i] = binaryString.charCodeAt(i);
          }
        } else {
          const res = await fetch(r.imageUrl);
          const arrayBuffer = await res.arrayBuffer();
          imageBytes = new Uint8Array(arrayBuffer);
        }
        
        let embeddedImage;
        try {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } catch(e) {
          try {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          } catch(err) {
            console.error("Could not embed image as PNG or JPG", err);
          }
        }
        
        if (embeddedImage) {
          const imgDims = embeddedImage.scaleToFit(width - 100, height - 150);
          page.drawImage(embeddedImage, {
            x: 50,
            y: height - 100 - imgDims.height,
            width: imgDims.width,
            height: imgDims.height,
          });
        } else {
          page.drawText(`Image format not supported by pdf-lib.`, { x: 50, y: height - 100, size: 12, font, color: rgb(1, 0, 0) });
        }
      } catch(e) {
        page.drawText(`Failed to load image.`, { x: 50, y: height - 100, size: 12, font, color: rgb(1, 0, 0) });
      }
    } else {
      page.drawText(`Generation failed. No image available.`, { x: 50, y: height - 100, size: 12, font, color: rgb(1, 0, 0) });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `benchmark_${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
