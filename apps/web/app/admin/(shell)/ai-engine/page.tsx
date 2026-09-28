import type { Metadata } from 'next';
import { AiTelemetryView } from '@/components/admin/ai-engine/AiTelemetryView';

export const metadata: Metadata = {
  title: 'AI Engine Telemetry — Miad Admin Portal',
  description: 'Live AI pipeline metrics, operation breakdowns, and failure diagnostics.',
  robots: { index: false, follow: false },
};

export default function AdminAiEnginePage() {
  return <AiTelemetryView />;
}
