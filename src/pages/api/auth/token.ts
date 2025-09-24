import type { NextApiRequest, NextApiResponse } from "next";

type AuthResponse = {
  access_token?: string;
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
  res: NextApiResponse<AuthResponse>,
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

    // Forward the auth request to the internal API server
    const response = await fetch(`${process.env.API_BASE_INTERNAL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const tokens = await response.json();
    res.status(200).json(tokens);
  } catch (error) {
    console.error('Auth API error:', error);
    console.log('API_BASE_INTERNAL:', process.env.API_BASE_INTERNAL);
    res.status(500).json({ error: `${error} API_BASE_INTERNAL: ${process.env.API_BASE_INTERNAL}` });
  }
}