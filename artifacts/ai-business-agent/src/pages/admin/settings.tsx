import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyBusiness,
  getGetMyBusinessQueryKey,
  useUpdateBusiness,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const settingsSchema = z.object({
  businessName: z.string().min(1, "Biznes nomi kiritilishi shart").max(100, "Nom juda uzun"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: business, isLoading } = useGetMyBusiness();
  const updateBusiness = useUpdateBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
    },
  });

  useEffect(() => {
    if (business) {
      form.reset({
        businessName: business.businessName,
      });
    }
  }, [business, form]);

  const onSubmit = (values: SettingsFormValues) => {
    updateBusiness.mutate(
      { data: values },
      {
        onSuccess: (updatedBusiness) => {
          queryClient.setQueryData(getGetMyBusinessQueryKey(), updatedBusiness);
          toast({ title: "Sozlamalar saqlandi" });
        },
        onError: () => {
          toast({ title: "Sozlamalarni saqlashda xato", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-muted-foreground mt-2">
          Biznes profilingiz va sozlamalarini boshqaring.
        </p>
      </div>

      {isLoading ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-10 w-24" />
          </CardContent>
        </Card>
      ) : !business ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Avval boshqaruv panelida biznes sozlamalarini yakunlang.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Biznes profili</CardTitle>
            <CardDescription>
              Bu ma'lumotlar mijozlarga AI chat interfeysida ko'rinadi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem className="max-w-md">
                      <FormLabel>Biznes nomi</FormLabel>
                      <FormControl>
                        <Input placeholder="masalan: Acme Corp" {...field} />
                      </FormControl>
                      <FormDescription>
                        Ommaga ochiq brend nomingiz.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateBusiness.isPending || !form.formState.isDirty}>
                  {updateBusiness.isPending ? (
                    "Saqlanmoqda..."
                  ) : (
                    <>
                      <Save className="size-4 mr-2" />
                      O'zgarishlarni saqlash
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
