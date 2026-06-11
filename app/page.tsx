"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, UploadCloud, Play, FileText, Image as ImageIcon, Loader2, Info, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportZip } from '@/utils/exportZip';
import { exportPdf } from '@/utils/exportPdf';

type GenerationStatus = "idle" | "generating" | "completed" | "failed";
type UseCase = "head-swap" | "try-on";

interface ModelConfig {
  id: string;
  name: string;
  quality: string;
}

export const MODEL_CONFIGS: ModelConfig[] = [
  { id: "gpt-img-2-low", name: "GPT image 2", quality: "low" },
  { id: "gpt-img-2-med", name: "GPT image 2", quality: "medium" },
  { id: "gpt-img-1-mini-med", name: "GPT Image 1 mini", quality: "medium" },
  { id: "gpt-img-1-mini-high", name: "GPT Image 1 mini", quality: "high" },
];

interface BenchmarkResult {
  configId: string;
  modelName: string;
  quality: string;
  imageUrl: string;
  latency: number;
  costUSD: number;
  costINR: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  resolution: string;
}

export default function BenchmarkDashboard() {
  const [useCase, setUseCase] = useState<UseCase>("head-swap");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [dimension, setDimension] = useState("1024x1024");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [images, setImages] = useState({ source: null as string | null, target: null as string | null });
  const [files, setFiles] = useState({ source: null as File | null, target: null as File | null });

  useEffect(() => {
    if (useCase === 'head-swap') {
      setPrompt(`Replace the entire head of the target person with the head from the source image.

Requirements:
- Transfer the complete head including hairstyle, hairline, ears, facial features, beard, and neck transitions.
- Preserve all details exactly.
- Match perspective and lighting.
- Ensure seamless integration with the target body.
- Avoid any visible cut lines or blending artifacts.
- Generate a realistic result.`);
    } else if (useCase === 'try-on') {
      setPrompt(`Replace the person's complete outfit with the uploaded garments.

Requirements:
- Keep the person's identity unchanged.
- Preserve face, hair, skin tone, body proportions, hands, and feet.
- Maintain original pose and camera angle.
- Ensure realistic garment draping and fabric behavior.
- Preserve all garment details accurately.
- Produce a studio-quality photorealistic image.`);
    }
  }, [useCase]);

  const handleImageUpload = (e: any, type: 'source' | 'target') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImages(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
      setFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const handleRemoveImage = (type: 'source' | 'target', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setImages(prev => ({ ...prev, [type]: null }));
    setFiles(prev => ({ ...prev, [type]: null }));
  };

  const targetConfigs = selectedModel === 'all' 
    ? MODEL_CONFIGS 
    : MODEL_CONFIGS.filter(c => c.id === selectedModel);

  const handleGenerate = async () => {
    if (!prompt) return;
    setStatus("generating");
    setProgress(0);
    setResults([]);

    // Progress simulation
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 5));
    }, 1000);

    try {
      const realResults = await Promise.all(
        targetConfigs.map(async (config) => {
          const formData = new FormData();
          formData.append('prompt', prompt);
          formData.append('configId', config.id);
          formData.append('dimension', dimension);
          if (files.source) formData.append('source', files.source);
          if (files.target) formData.append('target', files.target);

          const res = await fetch('/api/generate', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`API failed for ${config.name}`);
          }

          const data = await res.json();

          return {
            configId: config.id,
            modelName: config.name,
            quality: config.quality,
            imageUrl: data.imageUrl,
            latency: data.latency,
            costUSD: data.costUSD,
            costINR: Number((data.costUSD * 83).toFixed(2)),
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            totalTokens: data.totalTokens,
            resolution: data.resolution,
          };
        })
      );

      setResults(realResults);
      setStatus("completed");
      setProgress(100);
    } catch (error) {
      console.error(error);
      setStatus("failed");
    } finally {
      clearInterval(interval);
    }
  };

  const bestModel = results.length > 0 
    ? [...results].sort((a, b) => (a.latency * a.costUSD) - (b.latency * b.costUSD))[0] 
    : null;

  const handleDownloadAll = () => {
    results.forEach((result, index) => {
      if (!result.imageUrl) return;
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `benchmark_${result.modelName.replace(/\s+/g, '_')}_${result.quality}_${index}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">AI Image Model Benchmarking</h1>
            <p className="text-neutral-500 mt-1">Compare performance, cost, and quality across different AI image generation models.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm border-neutral-200">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                System Operational
              </span>
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Configuration */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-sm border-neutral-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="w-5 h-5 text-indigo-500" />
                  Benchmark Configuration
                </CardTitle>
                <CardDescription>Setup your input parameters for the test run.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                
                <div className="space-y-2">
                  <Label>Use Case</Label>
                  <Select value={useCase} onValueChange={(v) => setUseCase(v as UseCase)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a use case" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="head-swap">Head Swap</SelectItem>
                      <SelectItem value="try-on">Virtual Try-On</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dimensions</Label>
                  <Select value={dimension} onValueChange={(v) => v && setDimension(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select dimensions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">1024 x 1024</SelectItem>
                      <SelectItem value="1024x1792">1024 x 1792</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Models</Label>
                  <Select value={selectedModel} onValueChange={(v) => v && setSelectedModel(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select models to run" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      {MODEL_CONFIGS.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.quality})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{useCase === 'head-swap' ? 'Source Head Image' : 'Person Image'}</Label>
                    <div className="border-2 border-dashed border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors text-center cursor-pointer relative">
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'source')} accept="image/*" />
                      {images.source ? (
                        <div className="relative h-24 w-full rounded-md overflow-hidden bg-black/5 border border-neutral-200">
                           <img src={images.source} alt="Source" className="object-contain w-full h-full" />
                           <button onClick={(e) => handleRemoveImage('source', e)} className="absolute top-1 right-1 bg-white/80 p-1.5 rounded-full text-neutral-600 hover:bg-white hover:text-red-500 shadow-sm transition-all">
                             <X className="w-3 h-3" />
                           </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-neutral-400">
                          <UploadCloud className="w-6 h-6" />
                          <span className="text-sm">Upload Image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{useCase === 'head-swap' ? 'Target Body Image' : 'Garment Image'}</Label>
                    <div className="border-2 border-dashed border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors text-center cursor-pointer relative">
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'target')} accept="image/*" />
                      {images.target ? (
                        <div className="relative h-24 w-full rounded-md overflow-hidden bg-black/5 border border-neutral-200">
                           <img src={images.target} alt="Target" className="object-contain w-full h-full" />
                           <button onClick={(e) => handleRemoveImage('target', e)} className="absolute top-1 right-1 bg-white/80 p-1.5 rounded-full text-neutral-600 hover:bg-white hover:text-red-500 shadow-sm transition-all">
                             <X className="w-3 h-3" />
                           </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-neutral-400">
                          <UploadCloud className="w-6 h-6" />
                          <span className="text-sm">Upload Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea 
                    placeholder="Describe the desired output in detail..." 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-24 resize-none"
                  />
                </div>

              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleGenerate} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  disabled={status === 'generating' || !prompt}
                >
                  {status === 'generating' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating across 4 models...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Benchmark
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Status Panel */}
            {status !== 'idle' && (
              <Card className="shadow-sm border-neutral-200 overflow-hidden">
                <div className="p-4 bg-indigo-50/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-indigo-900">
                      {status === 'generating' ? 'Execution in Progress...' : status === 'completed' ? 'Benchmark Complete' : 'Benchmark Failed'}
                    </span>
                    <span className="text-xs text-indigo-600 font-bold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-indigo-100" />
                  <div className="mt-3 flex gap-2">
                    {targetConfigs.map((config, idx) => (
                      <div key={idx} className={`h-1.5 flex-1 rounded-full ${status === 'completed' || (progress > (idx+1)*(100/targetConfigs.length)) ? 'bg-indigo-500' : 'bg-indigo-200'}`} />
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Panel: Results & Analytics */}
          <div className="lg:col-span-8">
            <Tabs defaultValue="grid" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-white border border-neutral-200 shadow-sm">
                  <TabsTrigger value="grid" className="data-[state=active]:bg-neutral-100">Side-by-Side Comparison</TabsTrigger>
                  <TabsTrigger value="analytics" className="data-[state=active]:bg-neutral-100">Analytics Dashboard</TabsTrigger>
                </TabsList>

                {status === 'completed' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-9 gap-1 shadow-sm" onClick={() => exportZip(prompt, useCase, results)}>
                      <FileText className="w-4 h-4" />
                      Export ZIP
                    </Button>
                    <Button variant="default" size="sm" className="h-9 gap-1 shadow-sm bg-neutral-900 hover:bg-neutral-800" onClick={() => exportPdf(prompt, useCase, results)}>
                      <Download className="w-4 h-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 gap-1 shadow-sm" onClick={handleDownloadAll}>
                      <Download className="w-4 h-4" />
                      Download Images
                    </Button>
                  </div>
                )}
              </div>

              <TabsContent value="grid" className="mt-0 outline-none">
                {status === 'idle' ? (
                  <Card className="h-[600px] border-dashed flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/50">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium text-neutral-600">No Benchmark Run</p>
                    <p className="text-sm max-w-sm text-center mt-2">Configure parameters and hit Run Benchmark to see side-by-side results here.</p>
                  </Card>
                ) : status === 'generating' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[600px]">
                    {MODEL_CONFIGS.map((config) => (
                      <Card key={config.id} className="animate-pulse bg-white border-neutral-100 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-300 animate-spin mb-4" />
                        <div className="text-sm font-medium text-neutral-400">Waiting for {config.name}...</div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((result) => (
                      <Card key={result.configId} className="overflow-hidden border-neutral-200 shadow-sm group hover:shadow-md transition-shadow">
                        <div className="relative aspect-square bg-neutral-100 overflow-hidden">
                          <img src={result.imageUrl} alt={result.modelName} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-3 left-3 flex gap-2">
                            <Badge className="bg-black/70 hover:bg-black/80 text-white backdrop-blur-md border-none shadow-sm">
                              {result.modelName}
                            </Badge>
                            <Badge variant="secondary" className="bg-white/80 hover:bg-white/90 text-black backdrop-blur-md shadow-sm">
                              {result.quality}
                            </Badge>
                          </div>
                          {bestModel?.configId === result.configId && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm flex gap-1 items-center">
                                ★ Best Value
                              </Badge>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4 pb-2">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <div className="flex flex-col">
                              <span className="text-neutral-500 text-xs">Generation Time</span>
                              <span className="font-semibold text-neutral-900">{(result.latency / 1000).toFixed(2)}s</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-neutral-500 text-xs">Cost</span>
                              <span className="font-semibold text-neutral-900">${result.costUSD} <span className="text-neutral-400 font-normal">/ ₹{result.costINR}</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-neutral-500 text-xs">Tokens (In/Out)</span>
                              <span className="font-medium text-neutral-700">{result.inputTokens} / {result.outputTokens}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-neutral-500 text-xs">Resolution</span>
                              <span className="font-medium text-neutral-700">{result.resolution}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-4 pt-2 flex gap-2 border-t border-neutral-100 mt-2 bg-neutral-50/50">
                          <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-white">
                            <Info className="w-1 h-2 mr-1" /> Metadata
                          </Button>
                          <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-white">
                            <Download className="w-1 h-2 mr-1" /> Download
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="mt-0 outline-none">
                {status === 'completed' && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="text-sm text-neutral-500 mb-1">Fastest Model</div>
                          <div className="text-xl font-bold text-neutral-900">
                            {[...results].sort((a, b) => a.latency - b.latency)[0]?.modelName}
                          </div>
                          <div className="text-sm text-emerald-600 mt-1">
                            {[...results].sort((a, b) => a.latency - b.latency)[0]?.latency}ms
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="text-sm text-neutral-500 mb-1">Lowest Cost</div>
                          <div className="text-xl font-bold text-neutral-900">
                            {[...results].sort((a, b) => a.costUSD - b.costUSD)[0]?.modelName}
                          </div>
                          <div className="text-sm text-emerald-600 mt-1">
                            ${[...results].sort((a, b) => a.costUSD - b.costUSD)[0]?.costUSD} <span className="text-neutral-400">/ ₹{[...results].sort((a, b) => a.costUSD - b.costUSD)[0]?.costINR}</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="text-sm text-neutral-500 mb-1">Total Test Cost</div>
                          <div className="text-xl font-bold text-neutral-900">
                            ${results.reduce((acc, curr) => acc + curr.costUSD, 0).toFixed(3)}
                          </div>
                          <div className="text-sm text-neutral-400 mt-1">
                            ₹{results.reduce((acc, curr) => acc + curr.costINR, 0).toFixed(2)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts */}
                    <Card className="shadow-sm border-neutral-200">
                      <CardHeader>
                        <CardTitle className="text-base">Latency Comparison (ms)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                              <XAxis dataKey="modelName" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                              <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="latency" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm border-neutral-200">
                      <CardHeader>
                        <CardTitle className="text-base">Cost Comparison (USD & INR)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                              <XAxis dataKey="modelName" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                              <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Legend wrapperStyle={{fontSize: '12px'}} />
                              <Bar dataKey="costUSD" name="Cost (USD)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                              <Bar dataKey="costINR" name="Cost (INR)" fill="#34d399" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                )}
                {status !== 'completed' && (
                  <Card className="h-[600px] border-dashed flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/50">
                    <BarChart className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium text-neutral-600">Analytics Unavailable</p>
                    <p className="text-sm max-w-sm text-center mt-2">Run a benchmark first to generate comparison charts.</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
