import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, Plus, RotateCcw } from "lucide-react";
import { listRetailProducts, saveRetailProduct, setRetailProductActive } from "@/lib/clinic.functions";
import { SaveRetailProduct } from "@/lib/validation/schemas";
import { numericText } from "@/lib/validation/primitives";
import { money } from "@/components/period-picker";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  active: boolean;
  featured_on_portal: boolean;
};

type Draft = { name: string; sku: string; price: string; featured_on_portal: boolean };

const blank: Draft = { name: "", sku: "", price: "", featured_on_portal: false };
const shape = SaveRetailProduct.shape;
const DraftSchema = z.object({
  name: shape.name,
  sku: z.string().trim().max(80),
  price: numericText(shape.price, null),
  featured_on_portal: z.boolean(),
});

export function RetailProductSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchItems = useServerFn(listRetailProducts);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const { data } = useQuery({ queryKey: ["retail-products"], queryFn: () => fetchItems() });
  const draftForm = useForm<Draft>({
    resolver: zodResolver(DraftSchema),
    defaultValues: blank,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["retail-products"] });

  const save = useMutation({
    mutationFn: useServerFn(saveRetailProduct),
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast.success("Product saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: useServerFn(setRetailProductActive),
    onSuccess: () => {
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = (data ?? []) as Product[];

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Retail products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Physical products for Insights and a featured strip on the patient portal. No cart.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            className="shrink-0"
            onClick={() => {
              draftForm.reset(blank);
              setEditing({ id: null });
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add product
          </Button>
        )}
      </div>

      {editing && canEdit && (
        <Form {...draftForm}>
          <form
            className="mb-4 grid gap-3 rounded-xl border border-edge bg-glass-2 p-4 shadow-inset-hi sm:grid-cols-2"
            onSubmit={draftForm.handleSubmit((values) =>
              save.mutate({
                data: {
                  id: editing.id,
                  name: values.name,
                  sku: values.sku || null,
                  price: values.price === "" ? null : Number(values.price),
                  featured_on_portal: values.featured_on_portal,
                },
              }),
            )}
          >
            <FormField
              control={draftForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={draftForm.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={draftForm.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input className="rounded-xl" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={draftForm.control}
              name="featured_on_portal"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 sm:pt-6">
                  <FormLabel>Featured on portal</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}

      <ul className="divide-y divide-glass-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${item.active ? "text-foreground" : "text-muted-foreground"}`}>
                {item.name}
              </p>
              <p className="text-2xs text-muted-foreground">
                {item.sku ?? "No SKU"}
                {item.featured_on_portal ? " · Featured" : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-foreground">
              {item.price != null ? money(Number(item.price)) : "—"}
            </span>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    draftForm.reset({
                      name: item.name,
                      sku: item.sku ?? "",
                      price: item.price != null ? String(item.price) : "",
                      featured_on_portal: item.featured_on_portal,
                    });
                    setEditing({ id: item.id });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={item.active ? "Archive product" : "Restore product"}
                  onClick={() => setActive.mutate({ data: { id: item.id, active: !item.active } })}
                >
                  {item.active ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No products listed yet.</li>
        )}
      </ul>
    </Card>
  );
}
