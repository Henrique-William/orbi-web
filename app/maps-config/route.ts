import { NextResponse } from 'next/server';

export async function GET() {
  const key =
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    '';
  return NextResponse.json({ key: key.trim() });
}
