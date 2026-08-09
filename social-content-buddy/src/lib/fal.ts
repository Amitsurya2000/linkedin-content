import { createFalClient } from "@fal-ai/client";

const MODEL_ID = "fal-ai/gpt-image-1.5";
const EDIT_MODEL_ID = "fal-ai/gpt-image-1.5/edit";

export interface GenerateImageInput {
  prompt: string;
  quality?: "low" | "medium" | "high";
  imageSize?: "1024x1024" | "1536x1024" | "1024x1536";
  /** Reference image URLs (logo, product). When provided, uses the /edit endpoint. */
  imageUrls?: string[];
}

/** Generate an image using fal.ai. Blocks until the image is ready. Returns the image URL. */
export async function generateImage(
  input: GenerateImageInput,
  apiKey: string
): Promise<string> {
  const fal = createFalClient({ credentials: apiKey });

  const hasReferenceImages = input.imageUrls && input.imageUrls.length > 0;
  const modelId = hasReferenceImages ? EDIT_MODEL_ID : MODEL_ID;

  const baseInput: Record<string, unknown> = {
    prompt: input.prompt,
    image_size: input.imageSize ?? "1024x1024",
    quality: input.quality ?? "medium",
    output_format: "png",
    num_images: 1,
  };

  if (hasReferenceImages) {
    baseInput.image_urls = input.imageUrls;
  }

  const result = await fal.subscribe(modelId, { input: baseInput });

  const data = result.data as { images?: Array<{ url: string }> };
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL in fal.ai response");
  return imageUrl;
}
