// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
  message: string;
  apiBase: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  try {
    // Example of using server-side API client for internal Docker communication
    // const apiClient = createServerApiClient();
    // const result = await apiClient.get('/some-endpoint');
    
    res.status(200).json({ 
      name: "John Doe",
      message: "Server-side API client configured for Docker internal communication",
      apiBase: process.env.API_BASE_INTERNAL || "http://localhost:8080"
    });
  } catch {
    res.status(500).json({ 
      name: "Error",
      message: "Failed to process request",
      apiBase: process.env.API_BASE_INTERNAL || "http://localhost:8080"
    });
  }
}
