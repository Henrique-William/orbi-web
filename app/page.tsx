import { redirect } from 'next/navigation';

// "/" abre a visão geral; "/?demo" abre direto no modo demonstração
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  redirect('demo' in q ? '/overview?demo' : '/overview');
}
