import PortalGate from '@/components/PortalGate';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalGate>{children}</PortalGate>;
}
