import type { NextApiRequest, NextApiResponse } from "next";

type MultipartResponse = {
  upload_id?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MultipartResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { authorization } = req.headers;
    
    // Forward the multipart start request to the internal API server
    const response = await fetch(`${process.env.API_BASE_INTERNAL}/upload/multipart/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization && { Authorization: authorization }),
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    console.error('Multipart start API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}