// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerApiClient } from "@/utils/server-api-client";

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
    const apiClient = createServerApiClient();
    
    // This would be a real API call in production
    // const result = await apiClient.get('/some-endpoint');
    
    res.status(200).json({ 
      name: "John Doe",
      message: "Server-side API client configured for Docker internal communication",
      apiBase: process.env.API_BASE_INTERNAL || "http://localhost:8080"
    });
  } catch (error) {
    res.status(500).json({ 
      name: "Error",
      message: "Failed to process request",
      apiBase: process.env.API_BASE_INTERNAL || "http://localhost:8080"
    });
  }
}
