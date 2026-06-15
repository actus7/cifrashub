import { cache } from "react";
import type { Metadata } from "next";
import { fetchSharePayloadByToken } from "@/lib/server/share-query";
import { PublicShareView } from "@/components/share/public-share-view";

type PageProps = { params: Promise<{ token: string }> };

const fetchSharePayload = cache(fetchSharePayloadByToken);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const payload = await fetchSharePayload(token);

  if (!payload) {
    return {
      title: "Link invalido",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (payload.type === "arrangement") {
    return {
      title: `${payload.song.title} - ${payload.song.artist}`,
      description: `Cifra de ${payload.song.title} por ${payload.song.artist}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: payload.title,
    description: payload.description ?? `Setlist: ${payload.title}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SharedPage({ params }: PageProps) {
  const { token } = await params;
  const payload = await fetchSharePayload(token);

  return <PublicShareView payload={payload} />;
}
