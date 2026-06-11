import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const exportZip = async (prompt: string, useCase: string, results: any[]) => {
  const zip = new JSZip();
  
  let detailsContent = `AI Image Benchmark Report\nDate: ${new Date().toLocaleString()}\nUse Case: ${useCase}\nPrompt: ${prompt}\n\n`;
  
  const imgFolder = zip.folder("images");
  
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    detailsContent += `--- Model: ${res.modelName} (${res.quality}) ---\n`;
    detailsContent += `Generation Time: ${(res.latency / 1000).toFixed(2)}s\n`;
    detailsContent += `Cost: $${res.costUSD}\n`;
    detailsContent += `Tokens (In/Out): ${res.inputTokens} / ${res.outputTokens}\n`;
    detailsContent += `Resolution: ${res.resolution}\n`;
    
    if (res.imageUrl) {
      let filename = `${res.modelName.replace(/[^a-zA-Z0-9]/g, '_')}_${res.quality}_${i}.png`;
      detailsContent += `File: ${filename}\n\n`;
      
      try {
        if (res.imageUrl.startsWith('data:image/')) {
          const base64Data = res.imageUrl.split(',')[1];
          imgFolder?.file(filename, base64Data, { base64: true });
        } else {
          const response = await fetch(res.imageUrl);
          const blob = await response.blob();
          imgFolder?.file(filename, blob);
        }
      } catch (e) {
        console.error("Failed to add image to zip", e);
      }
    } else {
      detailsContent += `File: Generation Failed\n\n`;
    }
  }
  
  zip.file("details.txt", detailsContent);
  
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `benchmark_results_${Date.now()}.zip`);
};
