import type { NextApiRequest, NextApiResponse } from "next";

type MultipartUploadResponse = {
  url?: string;
  error?: string;
};

// Disable Next.js body parsing to handle raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MultipartUploadResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the raw body from the request
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyData = Buffer.concat(chunks).toString();
    
    const { authorization } = req.headers;
    
    // Forward the multipart upload part request to the internal API server
    const response = await fetch(`${process.env.API_BASE_INTERNAL}/upload/multipart/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization && { Authorization: authorization }),
      },
      body: bodyData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    console.error('Multipart upload API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}