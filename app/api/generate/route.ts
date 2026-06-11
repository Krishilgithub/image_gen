import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const configId = formData.get('configId') as string;
    const targetDimension = formData.get('dimension') as string || '1024x1024';
    
    const sourceFile = formData.get('source') as File | null;
    const targetFile = formData.get('target') as File | null;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let model = 'gpt-image-2';
    let size = targetDimension;
    let quality = 'medium';
    let estimatedCostUSD = 0.020;

    // Map configId to their exact custom models and qualities
    if (configId === 'gpt-img-2-low') {
      model = 'gpt-image-2';
      quality = 'low';
      estimatedCostUSD = size === '1024x1792' ? 0.010 : 0.005;
    } else if (configId === 'gpt-img-2-med') {
      model = 'gpt-image-2';
      quality = 'medium';
      estimatedCostUSD = size === '1024x1792' ? 0.080 : 0.040;
    } else if (configId === 'gpt-img-1-mini-med') {
      model = 'gpt-image-1-mini';
      quality = 'medium';
      estimatedCostUSD = size === '1024x1792' ? 0.030 : 0.020;
    } else if (configId === 'gpt-img-1-mini-high') {
      model = 'gpt-image-1-mini';
      quality = 'high';
      estimatedCostUSD = size === '1024x1792' ? 0.050 : 0.040;
    }

    const startTime = performance.now();

    let imageUrl = '';

    try {
      if (sourceFile && targetFile) {
        // Custom proxy implementation for images.edit with array of images
        const response = await openai.images.edit({
          model: model,
          image: [sourceFile, targetFile] as any,
          prompt: prompt,
          n: 1,
          size: size as any,
          quality: quality as any,
        } as any);
        // The custom proxy might return base64 or url. Handle both gracefully
        imageUrl = response.data?.[0]?.url || (response.data?.[0]?.b64_json ? `data:image/png;base64,${response.data[0].b64_json}` : '');
      } else {
        // Standard generate if no images were provided
        const response = await openai.images.generate({
          model: model,
          prompt: prompt,
          n: 1,
          size: size as any,
          quality: quality as any,
        } as any);
        imageUrl = response.data?.[0]?.url || (response.data?.[0]?.b64_json ? `data:image/png;base64,${response.data[0].b64_json}` : '');
      }
    } catch (openaiError: any) {
       console.error("OpenAI API Error:", openaiError);
       return NextResponse.json({ error: openaiError.message || 'OpenAI API failed' }, { status: 500 });
    }

    const endTime = performance.now();
    const latency = Math.floor(endTime - startTime);

    // Approximate token counts (1 token ~= 4 chars)
    const inputTokens = Math.ceil(prompt.length / 4);

    return NextResponse.json({
      imageUrl,
      latency,
      costUSD: estimatedCostUSD,
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
      resolution: size
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
