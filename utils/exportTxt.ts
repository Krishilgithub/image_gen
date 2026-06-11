export const exportTxt = (prompt: string, useCase: string, results: any[]) => {
  let content = `AI Image Model Benchmarking Report\n`;
  content += `==================================\n\n`;
  content += `Date: ${new Date().toLocaleString()}\n`;
  content += `Use Case: ${useCase}\n`;
  content += `Prompt: "${prompt}"\n\n`;
  content += `--- Results ---\n\n`;

  results.forEach((r, idx) => {
    content += `Model ${idx + 1}: ${r.modelName} (${r.quality})\n`;
    content += `Resolution: ${r.resolution}\n`;
    content += `Latency: ${r.latency}ms\n`;
    content += `Cost: $${r.costUSD} (₹${r.costINR})\n`;
    content += `Tokens: ${r.inputTokens} In / ${r.outputTokens} Out / ${r.totalTokens} Total\n`;
    content += `Image URL: ${r.imageUrl}\n\n`;
  });

  // Calculate winner
  if (results.length > 0) {
    const fastest = [...results].sort((a, b) => a.latency - b.latency)[0];
    const cheapest = [...results].sort((a, b) => a.costUSD - b.costUSD)[0];
    
    content += `--- Summary ---\n`;
    content += `Fastest Model: ${fastest.modelName} (${fastest.latency}ms)\n`;
    content += `Cheapest Model: ${cheapest.modelName} ($${cheapest.costUSD})\n`;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `benchmark_${Date.now()}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
