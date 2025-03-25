import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Replicate API token not configured' },
      { status: 500 }
    );
  }

  try {
    const { prompt } = await req.json();
    
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f",
        input: {
          prompt: prompt || "professional anime line art sketch, clean linework, black and white ink illustration",
          negative_prompt: "color, shading, noise, texture, background, watermark, signature, blurry, grainy, low quality, text, multiple views",
          num_inference_steps: 50,
          guidance_scale: 12,
          width: 768,
          height: 768,
          scheduler: "K_EULER"
        },
      }),
    });

    let prediction = await response.json();
    console.log("Initial prediction:", prediction);

    if (response.status !== 201) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || 'Failed to start image generation' },
        { status: response.status }
      );
    }

    // Poll for the result
    let attempts = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!pollResponse.ok) {
        const errorData = await pollResponse.text();
        let errorMessage = 'Failed to check generation status';
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.detail || errorMessage;
        } catch (e) {
          errorMessage = errorData || errorMessage;
        }
        return NextResponse.json({ error: errorMessage }, { status: pollResponse.status });
      }

      prediction = await pollResponse.json();
      console.log("Poll result:", prediction);
      attempts++;
    }

    if (prediction.status === "succeeded") {
      return NextResponse.json({
        imageUrl: prediction.output[0]
      });
    } else {
      return NextResponse.json(
        { error: prediction.error || "Image generation failed or timed out" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Replicate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
} 