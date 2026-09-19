import { config } from "../config.js";

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

interface NewsApiResponse {
  articles?: {
    title: string;
    source: { name: string };
    url: string;
    publishedAt: string;
  }[];
}

export async function getTopHeadlines(category = "business", pageSize = 6): Promise<NewsHeadline[]> {
  if (!config.newsApiKey) return [];

  const url = `https://newsapi.org/v2/top-headlines?category=${category}&language=en&pageSize=${pageSize}&apiKey=${config.newsApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as NewsApiResponse;

  return (data.articles ?? []).map((article) => ({
    title: article.title,
    source: article.source.name,
    url: article.url,
    publishedAt: article.publishedAt,
  }));
}
