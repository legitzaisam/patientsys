import { Card } from "@/components/ui/card";
import { money } from "@/components/period-picker";

type PortalProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  purchasedAt?: string | null;
};

export function PortalProducts({
  featured,
  purchased,
}: {
  featured: PortalProduct[];
  purchased: PortalProduct[];
}) {
  if (featured.length === 0 && purchased.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="section-title">From the clinic</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Products your clinic recommends. Ask the team if you would like to purchase one.
      </p>
      {featured.length > 0 && (
        <ProductStrip title="Featured" items={featured} />
      )}
      {purchased.length > 0 && (
        <ProductStrip title="Previously purchased" items={purchased} />
      )}
    </Card>
  );
}

function ProductStrip({ title, items }: { title: string; items: PortalProduct[] }) {
  return (
    <div className="mt-4">
      <p className="text-2xs font-medium uppercase tracking-[0.04em] text-muted-foreground">{title}</p>
      <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <li
            key={`${title}-${item.id}`}
            className="w-[168px] shrink-0 rounded-xl border border-edge bg-glass-2 p-3 shadow-inset-hi"
          >
            <div className="flex h-16 items-center justify-center rounded-lg bg-accent-wash text-xs text-ink-3">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
              ) : (
                item.name.slice(0, 1)
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-foreground">{item.name}</p>
            <p className="text-2xs tabular-nums text-muted-foreground">{money(item.price)}</p>
            {item.purchasedAt && (
              <p className="mt-1 text-2xs text-muted-foreground">
                {new Date(item.purchasedAt).toLocaleDateString("en-GB")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
