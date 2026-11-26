// 레이드 알림 보내기 (Supabase Edge Function). 1분마다 불려서, 지금 보내야 할 알림을 폰으로 보냄.
// 필요한 비밀 값(Secrets): VAPID_PUBLIC, VAPID_PRIVATE  → docs/폰알림_설정.md 참고
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const label = (m: number) => m >= 1440 ? `${Math.round(m / 1440)}일` : m >= 60 ? `${Math.round(m / 60)}시간` : `${m}분`;

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  webpush.setVapidDetails("mailto:push@xn--299a009a7ibxz4b.com", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

  const { data: due, error } = await sb.rpc("push_due");
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const d of due ?? []) {
    const time = new Date(d.starts_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
    const payload = JSON.stringify({
      title: `${label(d.offset_min)} 뒤 출발: ${d.title}`,
      body: `${time} 출발${d.dungeon ? " · " + d.dungeon : ""}`,
      tag: `raid-${d.raid_id}-${d.offset_min}`,
      url: "./#/raid",
    });
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload);
      sent++;
    } catch (e) {
      // 기기에서 알림을 끊었으면(404·410) 구독을 지움
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subs").delete().eq("endpoint", d.endpoint);
    }
  }
  return new Response(JSON.stringify({ due: due?.length ?? 0, sent }), { headers: { "content-type": "application/json" } });
});
