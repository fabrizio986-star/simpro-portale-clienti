import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jrudwnrorufmxjtjtwip.supabase.co",
  "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs"
);

const { data } = await supabase.auth.getSession();
const email = String(data.session?.user?.email || "").toLowerCase();
if (email === "officina@simprolamiere.it" && !location.pathname.endsWith("/officina.html")) {
  location.replace("/officina.html");
  await new Promise(() => {});
}
