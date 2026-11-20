import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { competitions } from "@/db/schema";
import { processLifecycle } from "@/lib/competitions";
import { CompetitionForm } from "../form";

export default async function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await processLifecycle();
  const [c] = await db.select().from(competitions).where(eq(competitions.id, id));
  if (!c) notFound();
  return <CompetitionForm c={c} />;
}
