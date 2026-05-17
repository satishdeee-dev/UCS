import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import { NotesPanel } from "@/components/notes-panel";

export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return <NotesPanel userId={user.id} />;
}
