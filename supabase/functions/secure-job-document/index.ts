import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://clienti.simprolamiere.it",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);

  try {
    const { token, document_id: documentId } = await request.json();
    if (!token || !documentId) return json({ error: "Richiesta non valida." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("access_token", token)
      .eq("active", true)
      .maybeSingle();
    if (!client) return json({ error: "Accesso non autorizzato." }, 403);

    const { data: document } = await admin
      .from("job_documents")
      .select("storage_path,file_name,job_id")
      .eq("id", documentId)
      .maybeSingle();
    if (!document) return json({ error: "Documento non trovato." }, 404);

    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("id", document.job_id)
      .eq("client_id", client.id)
      .is("completed_at", null)
      .maybeSingle();
    if (!job) return json({ error: "Accesso non autorizzato." }, 403);

    const { data: file, error } = await admin.storage
      .from("job-documents")
      .download(document.storage_path);
    if (error || !file) return json({ error: "Documento non disponibile." }, 404);

    const safeName = String(document.file_name || "documento").replace(/["\r\n]/g, "_");
    return new Response(file, {
      headers: {
        ...corsHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }
});
