'use client';
import { useParams } from 'next/navigation';
import MessagesView from '@/components/Messages';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  return <MessagesView id={decodeURIComponent(id)} />;
}
