import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Megaphone, Tag } from "lucide-react";
import { getMyRecord, getPortalHome } from "@/lib/clinic.functions";
import { PortalCard, PortalHead, PortalPhoto } from "@/components/portal/ui";
import { PortalProducts } from "@/components/portal-products";

export const Route = createFileRoute("/_authenticated/my-record/resources")({
  component: Resources,
});

/**
 * Clinic news, current offers and the retail products the clinic recommends —
 * the product shelf folded in from the old single-page portal.
 */
function Resources() {
  const fetchHome = useServerFn(getPortalHome);
  const fetchRecord = useServerFn(getMyRecord);
  const { data: home } = useQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome() });
  const { data: record } = useQuery({ queryKey: ["my-record"], queryFn: () => fetchRecord() });

  return (
    <div data-qc="portal-resources">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resources</h1>
          <p className="page-subtitle">Clinic news, current offers and the products your team recommends.</p>
        </div>
      </div>

      <div className="grid items-start gap-3.5 md:grid-cols-2">
        <PortalCard>
          <PortalHead icon={Megaphone} title="Clinic news" />
          {home?.news ? (
            <>
              <PortalPhoto icon={BookOpen} height={110} label="Clinic" />
              <p className="mt-2.5 text-[13px] font-semibold">{home.news.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{home.news.body}</p>
            </>
          ) : (
            <p className="py-4 text-xs text-muted-foreground">No clinic updates right now.</p>
          )}
        </PortalCard>

        <PortalCard>
          <PortalHead icon={Tag} title="Current offers" />
          {home?.offer ? (
            <div className="rounded-[14px] bg-rose-bg px-3.5 py-3">
              {home.offer.flag && (
                <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold text-rose-ink">
                  {home.offer.flag}
                </span>
              )}
              <p className="mt-1.5 text-[13.5px] font-semibold">{home.offer.title}</p>
              {home.offer.body && <p className="mt-1 text-xs text-muted-foreground">{home.offer.body}</p>}
            </div>
          ) : (
            <p className="py-4 text-xs text-muted-foreground">No offers right now.</p>
          )}
        </PortalCard>
      </div>

      {record?.products && (
        <div className="mt-3.5">
          <PortalProducts featured={record.products.featured ?? []} purchased={record.products.purchased ?? []} />
        </div>
      )}
    </div>
  );
}
