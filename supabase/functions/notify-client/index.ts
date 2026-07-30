import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stepLabels: Record<string, string> = {
  materiale_ordinato: "Materiale ordinato",
  inizio_lavorazione: "In lavorazione",
  fine_lavorazione: "Fine lavorazione",
  zincatura: "In zincatura",
  verniciatura: "In verniciatura",
  arrivo_officina: "Arrivo in officina",
  controllo: "Controllo",
  pronto_ritiro: "Pronto per il ritiro",
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Accesso non autorizzato.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("Servizio email non configurato.");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Accesso non autorizzato.");
    if (userData.user.email?.toLowerCase() !== "fabrizio986@gmail.com") {
      throw new Error("Account non autorizzato all’invio.");
    }

    const { job_id } = await request.json();
    if (!job_id) throw new Error("Lavorazione non specificata.");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id,title,code,current_step,phase,progress,note,delivery,client_id")
      .eq("id", job_id)
      .single();
    if (jobError || !job) throw new Error("Lavorazione non trovata.");

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("name,contact_name,email,access_token,active")
      .eq("id", job.client_id)
      .single();
    if (clientError || !client) throw new Error("Cliente non trovato.");
    if (!client.email) throw new Error("Il cliente non ha un indirizzo email.");
    if (!client.active) throw new Error("Il cliente è disattivato.");

    const portalUrl = `https://clienti.simprolamiere.it/?cliente=${encodeURIComponent(client.access_token)}`;
    const status = stepLabels[job.current_step] || job.phase || "Aggiornamento lavorazione";
    const recipient = client.contact_name || client.name;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SIMPRO Lamiere <info@simprolamiere.it>",
        to: [client.email],
        subject: `Aggiornamento lavorazione: ${job.title}`,
        html: `<!doctype html>
          <html lang="it">
            <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
              <div style="max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e6ea">
                <div style="background:#182129;padding:24px 30px;color:#fff">
                  <strong style="font-size:22px">SIMPRO LAMIERE</strong>
                </div>
                <div style="padding:30px">
                  <p>Buongiorno ${escapeHtml(recipient)},</p>
                  <p>la lavorazione <strong>${escapeHtml(job.title)}</strong>${job.code ? ` (${escapeHtml(job.code)})` : ""} è stata aggiornata.</p>
                  <div style="background:#f6f7f8;border-left:4px solid #d9232e;padding:18px;margin:24px 0">
                    <small style="color:#6f7a85">STATO ATTUALE</small>
                    <h2 style="margin:6px 0">${escapeHtml(status)}</h2>
                    <strong>${Number(job.progress)}% completato</strong>
                  </div>
                  ${job.note ? `<p><strong>Nota di SIMPRO:</strong><br>${escapeHtml(job.note)}</p>` : ""}
                  ${job.delivery ? `<p><strong>Consegna prevista:</strong> ${escapeHtml(job.delivery)}</p>` : ""}
                  <a href="${portalUrl}" style="display:inline-block;margin-top:16px;background:#d9232e;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:bold">Visualizza la lavorazione</a>
                  <p style="margin-top:28px;color:#6f7a85;font-size:12px">Messaggio automatico inviato dal portale clienti SIMPRO Lamiere.</p>
                </div>
              </div>
            </body>
          </html>`,
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      throw new Error(`Invio email non riuscito: ${detail}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore durante l’invio.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
